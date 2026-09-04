import fs from 'node:fs';
import path from 'node:path';
import { hashFile, sha256 } from '../lib/lock.mjs';

/**
 * Copies a single surface file. Refuses to clobber a file the harness did not
 * write: knownHash is the hash recorded in the lock from the previous install.
 */
export function copyFile(sourceFile, targetFile, { knownHash = null, force = false } = {}) {
  const content = fs.readFileSync(sourceFile);
  const sourceHash = sha256(content);
  const currentHash = hashFile(targetFile);

  if (currentHash === sourceHash) return { status: 'already-correct', hash: sourceHash };

  if (currentHash !== null && !force) {
    // Two different refusals: a file we never installed must not be clobbered,
    // and one we did install but that someone has since edited is local work.
    const weInstalledIt = knownHash !== null;
    return {
      status: 'refused',
      reason: weInstalledIt
        ? `${path.basename(targetFile)} was modified locally; use --force to restore it`
        : `${path.basename(targetFile)} exists and was not written by the harness; use --force to replace it`,
      hash: currentHash,
    };
  }

  fs.mkdirSync(path.dirname(targetFile), { recursive: true });
  fs.writeFileSync(targetFile, content);
  return { status: currentHash === null ? 'created' : 'updated', hash: sourceHash };
}

/** Removes a copied file only when it still matches what the harness wrote. */
export function removeCopy(targetFile, knownHash) {
  const currentHash = hashFile(targetFile);
  if (currentHash === null) return 'absent';
  if (knownHash && currentHash !== knownHash) return 'modified-kept';
  fs.rmSync(targetFile);
  return 'removed';
}

/** Recursive copy used by vendor mode; skips nothing, overwrites by content. */
export function copyTree(sourceDir, targetDir) {
  fs.mkdirSync(targetDir, { recursive: true });
  const written = [];
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const from = path.join(sourceDir, entry.name);
    const to = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      written.push(...copyTree(from, to));
    } else if (entry.isFile()) {
      fs.copyFileSync(from, to);
      written.push(to);
    }
  }
  return written;
}
