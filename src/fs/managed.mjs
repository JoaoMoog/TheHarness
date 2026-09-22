import fs from 'node:fs';
import path from 'node:path';
import { hashFile, sha256 } from '../lib/lock.mjs';

export function managedPath(root, relative) {
  const base = path.resolve(root);
  const full = path.resolve(base, relative);
  if (full === base || !full.startsWith(base + path.sep)) throw new Error(`Managed path escapes repository: ${relative}`);
  let parent = path.dirname(full);
  while (!fs.existsSync(parent)) parent = path.dirname(parent);
  const realBase = fs.realpathSync(base), realParent = fs.realpathSync(parent);
  if (realParent !== realBase && !realParent.startsWith(realBase + path.sep)) throw new Error(`Managed parent escapes repository: ${relative}`);
  return full;
}

export function writeManaged(root, relative, content, knownHash = null) {
  const full = managedPath(root, relative);
  if (fs.existsSync(full) && (!fs.lstatSync(full).isFile() || fs.lstatSync(full).isSymbolicLink())) return { conflict: 'not a managed regular file' };
  const current = hashFile(full);
  if (current !== null && (knownHash === null || current !== knownHash)) return { conflict: 'locally modified or not owned by the harness' };
  const hash = sha256(content);
  if (current !== hash) {
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
  return { hash };
}

export function removeManaged(root, relative, hash) {
  const full = managedPath(root, relative);
  if (!fs.existsSync(full)) return true;
  if (!hash || fs.lstatSync(full).isSymbolicLink() || !fs.lstatSync(full).isFile() || hashFile(full) !== hash) return false;
  fs.unlinkSync(full);
  return true;
}

export function pruneEmpty(root, relative) {
  const full = managedPath(root, relative);
  if (!fs.existsSync(full) || fs.lstatSync(full).isSymbolicLink() || !fs.statSync(full).isDirectory()) return;
  for (const e of fs.readdirSync(full, { withFileTypes: true })) if (e.isDirectory() && !e.isSymbolicLink()) pruneEmpty(root, path.join(relative, e.name));
  if (fs.readdirSync(full).length === 0) fs.rmdirSync(full);
}

export function ownsLink(full, expected) {
  try { return path.resolve(path.dirname(full), fs.readlinkSync(full)) === path.resolve(expected); }
  catch { return false; }
}
