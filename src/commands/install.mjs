import fs from 'node:fs';
import path from 'node:path';
import { RUNTIME_DIRS, harnessPath } from '../lib/paths.mjs';
import { mergedSurfaces, targetPaths, getTarget, prunableDirs } from '../lib/targets.mjs';
import { generatedFilesFor, contestedPaths } from '../lib/generators.mjs';
import { claudeHooks } from '../lib/claude-gen.mjs';
import { mergeInto, removeFrom } from '../fs/settings.mjs';
import { createLink, removeLink, inspect } from '../fs/link.mjs';
import { copyFile, copyTree, writeGenerated } from '../fs/copy.mjs';
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
 * Kiro's steering wrappers, Claude Code's subagents and commands, and the two
 * hook manifests. They are hashed, so doctor can tell a hand edit from a
 * regeneration. Targets with no generators produce nothing here.
 *
 * A path another target already copied verbatim is left alone. `.mcp.json` is
 * the case that matters: Copilot reads it under one schema and Claude Code
 * under another, so the second target to arrive goes without its MCP servers
 * rather than silently rewriting the first one's file on every install.
 */
function installGenerated(repo, entry, { force }) {
  const targets = repo.settings.targets ?? ['copilot'];
  const generated = {};
  const previousGenerated = entry.generated ?? {};
  const contested = new Set(contestedPaths(targets));
  const skipped = [];

  for (const file of generatedFilesFor(targets)) {
    if (contested.has(file.path) && entry.files?.[file.path] !== undefined) {
      skipped.push(file.path);
      continue;
    }
    // Same rule as a copied file. CLAUDE.md and .mcp.json land at the root
    // under the names a repository already using Claude Code most likely wrote
    // itself, so a generated path is no more the harness's to take than any
    // other.
    const result = writeGenerated(path.join(repo.dir, file.path), file.content, {
      knownHash: previousGenerated[file.path] ?? null,
      force,
    });
    if (result.status === 'refused') {
      log.warn(`${repo.name}: ${result.reason}`);
      continue;
    }
    generated[file.path] = result.hash;
  }

  for (const target of skipped) {
    log.warn(`${repo.name}: ${target} is already written by another target, so this one goes without it`);
  }
  return { ...entry, generated, contested: skipped };
}

/**
 * Adds the harness's hooks to Claude Code's local settings layer.
 *
 * The local file rather than the shared one, for the reason the whole harness
 * exists: `.claude/settings.json` is what a team commits, and a tracked file
 * the harness edits shows up as a local modification in everyone's git status
 * forever - the local exclude can hide an untracked file, never a tracked one.
 * Claude Code applies `.claude/settings.local.json` over the shared file and
 * merges the hook lists across layers, so the team's hooks and the harness's
 * both run.
 *
 * Even there the harness is a guest: the file holds the standing permission
 * approvals somebody gave with "don't ask again". Only the harness's own
 * entries are written, and only their hash is recorded - hashing the whole file
 * would report drift the next time Claude Code saved an approval into it.
 */
function installMergedSettings(repo, entry) {
  if (!(repo.settings.targets ?? []).includes('claude')) return entry;

  const target = '.claude/settings.local.json';
  const file = path.join(repo.dir, target);
  const existed = fs.existsSync(file);

  const result = mergeInto(file, claudeHooks().hooks);
  if (result.status === 'refused') {
    log.warn(`${repo.name}: ${result.reason}, leaving it alone`);
    return entry;
  }

  const createdFiles = [...new Set(entry.createdFiles ?? [])];
  if (!existed && !createdFiles.includes(target)) createdFiles.push(target);

  return {
    ...entry,
    createdFiles,
    mergedFiles: { ...(entry.mergedFiles ?? {}), [target]: sha256(JSON.stringify(result.slice)) },
  };
}

/**
 * Removes what a target that is no longer wired left behind.
 *
 * clearPreviousMode only fires when the mode changes, so rewiring a repository
 * from one tool to another - same mode, different targets - used to leave the
 * old target's generated files in place. Two ways that hurts: a stale
 * `.mcp.json` makes the arriving target's own copy refuse, and stale hook
 * entries point at scripts the link no longer provides, so every tool call
 * fails on a hook that cannot run.
 */
function clearDroppedTargets(repo, previous, entry) {
  const targetIds = repo.settings.targets ?? [];
  const expected = new Set(generatedFilesFor(targetIds).map((file) => file.path));

  const generated = { ...(previous.generated ?? {}) };
  for (const target of Object.keys(generated)) {
    if (expected.has(target)) continue;
    const full = path.join(repo.dir, target);
    if (fs.existsSync(full)) fs.rmSync(full, { force: true });
    delete generated[target];
  }

  const mergedFiles = { ...(previous.mergedFiles ?? {}) };
  if (!targetIds.includes('claude')) {
    for (const target of Object.keys(mergedFiles)) {
      removeFrom(path.join(repo.dir, target), (previous.createdFiles ?? []).includes(target));
      delete mergedFiles[target];
    }
  }

  return { ...entry, generated, mergedFiles };
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
  //
  // The filter runs only on the first install. Re-running it against a lock
  // that already answers the question would erase the answer: by the second
  // install the directories exist because the first one made them, and the
  // harness would conclude it never created any of them.
  const createdDirs =
    previous.createdDirs ??
    prunableDirs(targetIds).filter((dir) => !fs.existsSync(path.join(repo.dir, dir)));
  let entry = {
    mode,
    dir: posix(repo.dir),
    targets: targetIds,
    createdDirs,
    createdFiles: previous.createdFiles ?? [],
    files: previous.files ?? {},
  };
  // Before anything is written, so an arriving target does not trip over the
  // file a departing one left in a schema it cannot read.
  entry = clearDroppedTargets(repo, previous, entry);
  entry = mode === 'vendor' ? installByVendor(repo, entry) : installByLink(repo, entry, { force });
  entry = installFiles(repo, entry, { force });
  entry = installGenerated(repo, entry, { force });
  entry = installMergedSettings(repo, entry);

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
