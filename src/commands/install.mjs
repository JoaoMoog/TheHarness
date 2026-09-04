import fs from 'node:fs';
import path from 'node:path';
import { DIR_SURFACES, FILE_SURFACES, ALL_TARGETS, RUNTIME_DIRS, harnessPath } from '../lib/paths.mjs';
import { createLink, removeLink, inspect } from '../fs/link.mjs';
import { copyFile, copyTree } from '../fs/copy.mjs';
import { writeExclude, clearExclude, isGitRepo } from '../fs/gitexclude.mjs';
import { parseFrontmatter } from '../lib/frontmatter.mjs';
import { hashFile } from '../lib/lock.mjs';
import { installGitHook } from './githook.mjs';
import { log, c } from '../lib/log.mjs';

/** Lock paths are stored with forward slashes so a lock is portable. */
const posix = (p) => p.split(path.sep).join('/');

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
    if (nextMode === 'vendor') removeSurfaceLinks(repo.dir);
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
}

function removeSurfaceLinks(repoDir) {
  for (const surface of DIR_SURFACES) {
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
  for (const surface of DIR_SURFACES) {
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

  for (const surface of DIR_SURFACES) {
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
  for (const surface of FILE_SURFACES) {
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

export function installRepo(repo, previous = {}, { force = false } = {}) {
  const mode = repo.settings.mode;
  if (!fs.existsSync(repo.dir)) {
    log.fail(`${repo.name}: directory not found (${repo.dir})`);
    return null;
  }

  clearPreviousMode(repo, previous, mode);

  let entry = { mode, dir: posix(repo.dir), files: previous.files ?? {} };
  entry = mode === 'vendor' ? installByVendor(repo, entry) : installByLink(repo, entry, { force });
  entry = installFiles(repo, entry, { force });

  if (isGitRepo(repo.dir)) {
    if (mode === 'link') writeExclude(repo.dir, [...ALL_TARGETS, ...RUNTIME_DIRS]);
    else clearExclude(repo.dir);
    if (repo.settings.gitHooks) installGitHook(repo.dir);
  } else {
    log.warn(`${repo.name}: not a git repository, skipped exclude and hooks`);
  }

  const surfaces = Object.keys(entry.links).length + Object.keys(entry.vendored).length;
  log.ok(`${repo.name.padEnd(32)} ${c.dim(mode)} ${surfaces} surfaces, ${Object.keys(entry.files).length} files`);
  return { ...entry, installedAt: new Date().toISOString() };
}
