import fs from 'node:fs';
import path from 'node:path';

/**
 * 'junction' is what makes this work without elevation: on Windows a directory
 * junction needs no admin rights and no Developer Mode, unlike a real symlink,
 * and unlike a hard link it may cross volumes. On POSIX the type argument is
 * ignored and a normal symlink is created.
 */
const LINK_TYPE = 'junction';

/** realpath normalises the extended-length prefix Windows puts on junctions. */
function realpathOrNull(p) {
  try {
    return fs.realpathSync(p);
  } catch {
    return null;
  }
}

export function inspect(linkPath) {
  let stat;
  try {
    stat = fs.lstatSync(linkPath);
  } catch (err) {
    if (err.code === 'ENOENT') return { state: 'absent', target: null };
    throw err;
  }
  if (!stat.isSymbolicLink()) {
    return { state: stat.isDirectory() ? 'foreign-dir' : 'foreign-file', target: null };
  }
  const target = realpathOrNull(linkPath);
  return target === null ? { state: 'broken-link', target: null } : { state: 'link', target };
}

export function linksTo(linkPath, expectedTarget) {
  const info = inspect(linkPath);
  if (info.state !== 'link') return false;
  const expected = realpathOrNull(expectedTarget);
  return expected !== null && path.relative(info.target, expected) === '';
}

/** Creates the link. Returns 'created' | 'already-correct' | 'refused'. */
export function createLink(sourceDir, linkPath, { force = false } = {}) {
  const info = inspect(linkPath);
  if (info.state === 'link' || info.state === 'broken-link') {
    if (linksTo(linkPath, sourceDir)) return { status: 'already-correct' };
    removeLink(linkPath);
  } else if (info.state !== 'absent') {
    if (!force) {
      return {
        status: 'refused',
        reason: `${path.basename(linkPath)} already exists as a real ${
          info.state === 'foreign-dir' ? 'directory' : 'file'
        }; use --force to replace it`,
      };
    }
    fs.rmSync(linkPath, { recursive: true, force: true });
  }
  fs.mkdirSync(path.dirname(linkPath), { recursive: true });
  fs.symlinkSync(path.resolve(sourceDir), linkPath, LINK_TYPE);
  return { status: 'created' };
}

/**
 * Windows will not always unlink a directory junction; rmdir does. Neither call
 * recurses, so removing a link can never delete the harness source through it.
 */
export function removeLink(linkPath) {
  const info = inspect(linkPath);
  if (info.state === 'absent') return 'absent';
  if (info.state !== 'link' && info.state !== 'broken-link') return 'not-a-link';
  try {
    fs.unlinkSync(linkPath);
  } catch (err) {
    if (err.code === 'EPERM' || err.code === 'EISDIR' || err.code === 'EACCES') {
      fs.rmdirSync(linkPath);
    } else {
      throw err;
    }
  }
  return 'removed';
}
