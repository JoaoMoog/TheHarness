import fs from 'node:fs';
import path from 'node:path';
import { RUNTIME_DIRS, harnessPath } from '../lib/paths.mjs';
import { mergedSurfaces, targetPaths, getTarget, prunableDirs } from '../lib/targets.mjs';
import { generatedFiles } from '../lib/kiro-gen.mjs';
import { createLink, removeLink, inspect } from '../fs/link.mjs';
import { copyFile, copyTree } from '../fs/copy.mjs';
import { writeExclude, clearExclude, isGitRepo } from '../fs/gitexclude.mjs';
import { parseFrontmatter } from '../lib/frontmatter.mjs';
import { hashFile, sha256 } from '../lib/lock.mjs';
import { installGitHook } from './githook.mjs';
import { log, c } from '../lib/log.mjs';

/** Lock paths are stored with forward slashes so a lock is portable. */
const posix = (p) => p.split(path.sep).join('/');

/** The surfaces a repository gets, which depend on the tools it is wired for. */
const surfacesFor = (repo) => mergedSurfaces(repo.settings.targets ?? ['copilot']);

/** Every path a repository's targets write, for the exclude block. */
const pathsFor = (repo) => (repo.settings.targets ?? ['copilot']).flatMap(targetPaths);

/** Detected ids that are covered by another stack file. */
const STACK_ALIASES = { node: 'node-ts' };

/** Stack-scoped instruction files are named stack-<id>.instructions.md. */
function instructionStack(filename) {
  const m = /^stack-([a-z0-9-]+)\.instructions\.md$/.exec(filename);
  return m ? m[1] : null;
}

function skillStacks(skillDir) {
  const file = path.join(skillDir, 'SKILL.md');
  if (!fs.existsSync(file)) return [];
  const { data } = parseFrontmatter(fs.readFileSync(file, 'utf8'));
  return Array.isArray(data.stacks) ? data.stacks : [];
}

/**
 * Removes whatever the previous mode installed before the new mode runs.
 *
 * Without this, vendoring a repository that is currently linked copies each
 * file onto itself through the junction, and switching back leaves orphan
 * junctions the lock no longer knows about.
 */
function clearPreviousMode(repo, previous, nextMode) {
  if (!previous || previous.mode === nextMode) {
    // Still remove any junction standing where vendor mode needs a real folder.
    if (nextMode === 'vendor') removeSurfaceLinks(repo.dir, surfacesFor(repo).dirSurfaces);
    return;
  }
  if (previous.mode === 'link') {
    for (const target of Object.keys(previous.links ?? {})) {
      removeLink(path.join(repo.dir, target));
    }
    clearExclude(repo.dir);
  } else {
    for (const target of Object.keys(previous.vendored ?? {})) {
      const full = path.join(repo.dir, target);
      if (fs.existsSync(full)) fs.rmSync(full, { recursive: true, force: true });
    }
  }
  // Generated files belong to whichever target produced them, so a target that
  // is no longer wired must not leave steering behind pointing at nothing.
  for (const target of Object.keys(previous.generated ?? {})) {
    const full = path.join(repo.dir, target);
    if (fs.existsSync(full)) fs.rmSync(full, { force: true });
  }
}

function removeSurfaceLinks(repoDir, dirSurfaces) {
  for (const surface of dirSurfaces) {
    const full = path.join(repoDir, surface.target);
    if (inspect(full).state === 'link') removeLink(full);
  }
}

/**
 * Link mode points the repository at the harness source, so an edit here is
 * live everywhere with no sync step. Nothing is filtered: Copilot already gates
 * instructions by applyTo and skills by relevance, so an unused stack file
 * costs nothing at runtime.
 */
function installByLink(repo, entry, { force }) {
  const links = {};
  for (const surface of surfacesFor(repo).dirSurfaces) {
    const source = harnessPath(surface.source);
    if (!fs.existsSync(source)) continue;
    const target = path.join(repo.dir, surface.target);
    const result = createLink(source, target, { force });
    if (result.status === 'refused') {
      log.warn(`${repo.name}: ${result.reason}`);
      continue;
    }
    links[surface.target] = posix(source);
  }
  return { ...entry, links, vendored: {} };
}

/**
 * Vendor mode copies real files so the team sees them in the repository. Here
 * filtering by detected stack does matter, because the files are committed.
 * Every copied file is hashed so doctor can report drift, which is what the
 * documentation has always promised.
 */
function installByVendor(repo, entry) {
  const stacks = new Set(
    (repo.stacks ?? []).flatMap((s) => (STACK_ALIASES[s] ? [s, STACK_ALIASES[s]] : [s]))
  );
  const vendored = {};
  const record = (files) => {
    for (const file of files) {
      vendored[posix(path.relative(repo.dir, file))] = hashFile(file);
    }
  };

  for (const surface of surfacesFor(repo).dirSurfaces) {
    const source = harnessPath(surface.source);
    if (!fs.existsSync(source)) continue;
    const target = path.join(repo.dir, surface.target);

    if (surface.source === 'core/instructions') {
      fs.mkdirSync(target, { recursive: true });
      for (const file of fs.readdirSync(source)) {
        const stack = instructionStack(file);
        if (stack && !stacks.has(stack)) continue;
        const to = path.join(target, file);
        fs.copyFileSync(path.join(source, file), to);
        record([to]);
      }
    } else if (surface.source === 'core/skills') {
      fs.mkdirSync(target, { recursive: true });
      for (const dir of fs.readdirSync(source, { withFileTypes: true })) {
        if (!dir.isDirectory()) continue;
        const required = skillStacks(path.join(source, dir.name));
        if (required.length > 0 && !required.some((s) => stacks.has(s))) continue;
        record(copyTree(path.join(source, dir.name), path.join(target, dir.name)));
      }
    } else {
      record(copyTree(source, target));
    }
  }
  return { ...entry, links: {}, vendored };
}

function installFiles(repo, entry, { force }) {
  const files = { ...(entry.files ?? {}) };
  for (const surface of surfacesFor(repo).fileSurfaces) {
    const source = harnessPath(surface.source);
    if (!fs.existsSync(source)) continue;
    const target = path.join(repo.dir, surface.target);
    const result = copyFile(source, target, { knownHash: files[surface.target] ?? null, force });
    if (result.status === 'refused') {
      log.warn(`${repo.name}: ${result.reason}`);
      continue;
    }
    files[surface.target] = result.hash;
  }
  return { ...entry, files };
}

/**
 * Writes the files whose format a target needs but the harness does not author:
 * Kiro's steering wrappers and its hook manifest. They are thin - front matter
 * plus one include line - and hashed, so doctor can tell a hand edit from a
 * regeneration. Targets with no generators produce nothing here.
 */
function installGenerated(repo, entry) {
  const targets = repo.settings.targets ?? ['copilot'];
  const generated = {};
  const wanted = targets.filter((id) => (getTarget(id).generators ?? []).length > 0);
  if (wanted.length === 0) return { ...entry, generated };

  for (const file of generatedFiles()) {
    const full = path.join(repo.dir, file.path);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, file.content, 'utf8');
    generated[file.path] = sha256(file.content);
  }
  return { ...entry, generated };
}

export function installRepo(repo, previous = {}, { force = false } = {}) {
  const mode = repo.settings.mode;
  if (!fs.existsSync(repo.dir)) {
    log.fail(`${repo.name}: directory not found (${repo.dir})`);
    return null;
  }

  clearPreviousMode(repo, previous, mode);

  const targetIds = repo.settings.targets ?? ['copilot'];
  // Noted before anything is written, so removal can put back only what was
  // not there before. A .github the team already had is not the harness's to
  // delete just because unlink emptied it.
  const createdDirs = (previous.createdDirs ?? prunableDirs(targetIds)).filter(
    (dir) => !fs.existsSync(path.join(repo.dir, dir))
  );
  let entry = {
    mode,
    dir: posix(repo.dir),
    targets: targetIds,
    createdDirs,
    files: previous.files ?? {},
  };
  entry = mode === 'vendor' ? installByVendor(repo, entry) : installByLink(repo, entry, { force });
  entry = installFiles(repo, entry, { force });
  entry = installGenerated(repo, entry);

  if (isGitRepo(repo.dir)) {
    if (mode === 'link') writeExclude(repo.dir, [...pathsFor(repo), ...RUNTIME_DIRS]);
    else clearExclude(repo.dir);
    if (repo.settings.gitHooks) installGitHook(repo.dir);
  } else {
    log.warn(`${repo.name}: not a git repository, skipped exclude and hooks`);
  }

  const surfaces = Object.keys(entry.links).length + Object.keys(entry.vendored).length;
  const generated = Object.keys(entry.generated ?? {}).length;
  const targets = targetIds.join('+');
  log.ok(
    `${repo.name.padEnd(30)} ${c.dim(`${mode} ${targets}`)} ${surfaces} surfaces, ` +
      `${Object.keys(entry.files).length} files${generated ? `, ${generated} generated` : ''}`
  );
  return { ...entry, installedAt: new Date().toISOString() };
}
