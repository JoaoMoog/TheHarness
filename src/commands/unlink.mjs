import path from 'node:path';
import fs from 'node:fs';
import { loadLock, saveLock, forgetRepo } from '../lib/lock.mjs';
import { removeLink } from '../fs/link.mjs';
import { removeCopy } from '../fs/copy.mjs';
import { clearExclude } from '../fs/gitexclude.mjs';
import { removeGitHook } from './githook.mjs';
import { prunableDirs } from '../lib/targets.mjs';
import { log, c } from '../lib/log.mjs';

/** Locks written before targets were recorded were all Copilot. */
const LEGACY_TARGETS = ['copilot'];

/** Removes a directory only when every level of it is already empty. */
function pruneEmpty(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) pruneEmpty(path.join(dir, entry.name));
  }
  try {
    if (fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
  } catch {
    // Not empty, or already gone. Either way, leave it alone.
  }
}

/** Reverses exactly what the lock says was installed, and nothing else. */
function uninstallRepo(name, entry) {
  const dir = entry.dir;
  const removed = [];
  const kept = [];

  for (const target of Object.keys(entry.links ?? {})) {
    const result = removeLink(path.join(dir, target));
    if (result === 'removed') removed.push(target);
    else if (result === 'not-a-link') kept.push(`${target} (real directory, kept)`);
  }

  for (const [target, hash] of Object.entries(entry.files ?? {})) {
    const result = removeCopy(path.join(dir, target), hash);
    if (result === 'removed') removed.push(target);
    else if (result === 'modified-kept') kept.push(`${target} (locally modified, kept)`);
  }

  // Vendored files are hashed, so a file the team has since edited is theirs
  // now and is left in place rather than silently deleted.
  // Generated files are the harness's own output, so they go without a hash
  // check: there is nothing of the user's in them to preserve.
  for (const target of Object.keys(entry.generated ?? {})) {
    const full = path.join(entry.dir, target);
    if (fs.existsSync(full)) {
      fs.rmSync(full, { force: true });
      removed.push(target);
    }
  }

  for (const [target, hash] of Object.entries(entry.vendored ?? {})) {
    const result = removeCopy(path.join(dir, target), hash);
    if (result === 'removed') removed.push(target);
    else if (result === 'modified-kept') kept.push(`${target} (locally modified, kept)`);
  }

  // Only directories the install itself created. Locks written before that
  // was recorded fall back to the old behaviour of pruning any of them.
  const created = entry.createdDirs ?? prunableDirs(entry.targets ?? LEGACY_TARGETS);
  for (const prunable of created) pruneEmpty(path.join(dir, prunable));

  clearExclude(dir);
  removeGitHook(dir);

  log.ok(`${name.padEnd(32)} ${removed.length} removed${kept.length ? c.yellow(`, ${kept.length} kept`) : ''}`);
  for (const k of kept) log.info(`  ${k}`);
  return removed.length;
}

/**
 * The lock is the source of truth, not the config. A repository that was
 * renamed, moved, or dropped from harness.config.json is still installed on
 * disk, and reporting a clean removal without touching it would be a lie.
 */
export default function unlink(args) {
  const only = args._[0] ?? null;
  if (!only && !args.all) throw new Error('Specify a repository name or pass --all.');

  let lock = loadLock();
  const names = only ? [only] : Object.keys(lock.repos ?? {});

  if (names.length === 0) {
    log.warn('Nothing installed according to harness.lock.json.');
    return 0;
  }

  log.step(`Removing harness from ${names.length} repositor${names.length === 1 ? 'y' : 'ies'}`);
  for (const name of names) {
    const entry = lock.repos[name];
    if (!entry) {
      log.warn(`${name}: not in the lock file, nothing to remove`);
      continue;
    }
    if (!fs.existsSync(entry.dir)) {
      log.warn(`${name}: ${entry.dir} no longer exists, dropping it from the lock`);
    } else {
      uninstallRepo(name, entry);
    }
    lock = forgetRepo(lock, name);
    saveLock(lock);
  }

  log.plain('');
  log.ok('Removal complete. Target repositories are back to their original state.');
  return 0;
}
