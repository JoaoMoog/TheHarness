import fs from 'node:fs';
import path from 'node:path';
import { hashFile, sha256 } from '../lib/lock.mjs';

/**
 * Copies a single surface file. Refuses to clobber a file the harness did not
 * write: knownHash is the hash recorded in the lock from the previous install.
 */
/**
 * Writes content the harness produced, under the same refusal rule as a copied
 * file: whatever is already on disk is somebody's, until the lock says the
 * harness is the one who put it there.
 *
 * Generated files need this as much as copied ones do - more, since two of
 * them, CLAUDE.md and .mcp.json, land at the repository root under exactly the
 * names a repository that already uses the tool is likeliest to have written
 * for itself.
 */
export function writeGenerated(targetFile, content, { knownHash = null, force = false } = {}) {
  const sourceHash = sha256(content);
  const currentHash = hashFile(targetFile);

  if (currentHash === sourceHash) return { status: 'already-correct', hash: sourceHash };

  // Two different refusals: a file we never installed must not be clobbered,
  // and one we did install but that someone has since edited is local work.
  if (currentHash !== null && currentHash !== knownHash && !force) {
    return {
      status: 'refused',
      reason:
        knownHash !== null
          ? `${path.basename(targetFile)} was modified locally; use --force to restore it`
          : `${path.basename(targetFile)} exists and was not written by the harness; use --force to replace it`,
      hash: currentHash,
    };
  }

  fs.mkdirSync(path.dirname(targetFile), { recursive: true });
  fs.writeFileSync(targetFile, content);
  return { status: currentHash === null ? 'created' : 'updated', hash: sourceHash };
}

export function copyFile(sourceFile, targetFile, options = {}) {
  return writeGenerated(targetFile, fs.readFileSync(sourceFile), options);
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
