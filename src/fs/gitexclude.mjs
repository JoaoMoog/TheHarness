import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const BEGIN = '# >>> the-harness (managed) >>>';
const END = '# <<< the-harness (managed) <<<';

/**
 * Resolves the real git directory. In a worktree or a submodule, .git is a FILE
 * containing a gitdir pointer, so joining <repo>/.git/info/exclude produces a
 * path that does not exist and the whole install throws.
 */
export function gitDir(repoDir) {
  try {
    const out = execFileSync('git', ['rev-parse', '--git-dir'], {
      cwd: repoDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return path.resolve(repoDir, out);
  } catch {
    return null;
  }
}

export function isGitRepo(repoDir) {
  return gitDir(repoDir) !== null;
}

export function excludeFile(repoDir) {
  const dir = gitDir(repoDir);
  return dir === null ? null : path.join(dir, 'info', 'exclude');
}

function stripBlock(text) {
  const start = text.indexOf(BEGIN);
  if (start === -1) return text;
  const end = text.indexOf(END, start);
  if (end === -1) return text.slice(0, start);
  return text.slice(0, start) + text.slice(end + END.length).replace(/^\r?\n/, '');
}

/**
 * Writes the managed paths into the repository's local exclude file. That file
 * is never committed, so the target repository stays byte-identical for its team.
 */
export function writeExclude(repoDir, targets) {
  const file = excludeFile(repoDir);
  if (file === null) return null;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  const base = stripBlock(existing).replace(/\s*$/, '');
  // ALL_TARGETS are authored with forward slashes, which is what git expects.
  const lines = targets.map((t) => `/${t}`);
  const block = [BEGIN, ...lines, END, ''].join('\n');
  fs.writeFileSync(file, `${base ? `${base}\n\n` : ''}${block}`, 'utf8');
  return file;
}

export function clearExclude(repoDir) {
  const file = excludeFile(repoDir);
  if (file === null || !fs.existsSync(file)) return 'absent';
  const text = fs.readFileSync(file, 'utf8');
  if (!text.includes(BEGIN)) return 'not-managed';
  fs.writeFileSync(file, stripBlock(text).replace(/\s*$/, '\n'), 'utf8');
  return 'cleared';
}

export function hasManagedBlock(repoDir) {
  const file = excludeFile(repoDir);
  return file !== null && fs.existsSync(file) && fs.readFileSync(file, 'utf8').includes(BEGIN);
}
