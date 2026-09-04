import crypto from 'node:crypto';
import fs from 'node:fs';
import { harnessPath } from './paths.mjs';
import { readJson, writeJson } from './config.mjs';

export const LOCK_FILE = harnessPath('harness.lock.json');

export const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

export function hashFile(file) {
  try {
    return sha256(fs.readFileSync(file));
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

export function loadLock() {
  return readJson(LOCK_FILE, { version: 1, repos: {} });
}

export function saveLock(lock) {
  writeJson(LOCK_FILE, lock);
}

/**
 * Records what was installed into one repo so unlink can reverse it exactly and
 * doctor can detect drift on copied files.
 */
export function recordRepo(lock, name, entry) {
  return { ...lock, repos: { ...lock.repos, [name]: entry } };
}

export function forgetRepo(lock, name) {
  const repos = { ...lock.repos };
  delete repos[name];
  return { ...lock, repos };
}
