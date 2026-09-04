/**
 * Git access for the guardrails. Two rules govern this file:
 *
 *  1. Read the INDEX, not the working tree. The commit records what is staged,
 *     so scanning the file on disk can both miss a staged secret that was later
 *     edited out and refuse a clean hunk because of an unstaged one.
 *  2. Never fail open. If git cannot answer, the caller must refuse, not pass.
 */
import { execFileSync } from 'node:child_process';

const QUIET = ['-c', 'core.quotePath=false'];

export class GitUnavailable extends Error {}

function git(args, { cwd = process.cwd(), encoding = 'utf8', maxBuffer = 64 * 1024 * 1024 } = {}) {
  try {
    return execFileSync('git', [...QUIET, ...args], {
      cwd,
      encoding,
      maxBuffer,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) {
    // git prints its whole usage block on a bad invocation; one line is enough
    // to diagnose and keeps the refusal message readable.
    const detail = String(err.stderr ?? err.message ?? err).trim().split('\n')[0] || 'failed';
    throw new GitUnavailable(`git ${args.slice(2, 4).join(' ')}: ${detail.slice(0, 160)}`);
  }
}

export function isInsideRepo(cwd = process.cwd()) {
  try {
    return git(['rev-parse', '--is-inside-work-tree'], { cwd }).trim() === 'true';
  } catch {
    return false;
  }
}

export function repoRoot(cwd = process.cwd()) {
  return git(['rev-parse', '--show-toplevel'], { cwd }).trim();
}

/** NUL-separated so filenames with spaces, quotes or non-ASCII survive intact. */
export function stagedFiles(cwd = process.cwd()) {
  const out = git(['diff', '--cached', '--name-only', '-z', '--diff-filter=ACMR'], { cwd });
  return out.split('\u0000').filter(Boolean);
}

/** The staged blob itself. This is the content that would enter history. */
export function stagedContent(file, cwd = process.cwd()) {
  return git(['show', `:${file}`], { cwd, encoding: 'buffer' });
}

export function stagedSize(file, cwd = process.cwd()) {
  const out = git(['ls-files', '--stage', '--', file], { cwd }).trim();
  if (!out) return 0;
  const oid = out.split(/\s+/)[1];
  return Number(git(['cat-file', '-s', oid], { cwd }).trim());
}

/**
 * Decodes a staged blob. UTF-16 is detected by BOM rather than treated as
 * binary: PowerShell writes UTF-16LE by default, which is exactly how a .env
 * on Windows would slip past a naive NUL-byte check.
 */
export function decode(buffer) {
  if (buffer.length >= 2) {
    if (buffer[0] === 0xff && buffer[1] === 0xfe) {
      return { text: buffer.toString('utf16le'), encoding: 'utf-16le' };
    }
    if (buffer[0] === 0xfe && buffer[1] === 0xff) {
      const swapped = Buffer.from(buffer);
      swapped.swap16();
      return { text: swapped.toString('utf16le'), encoding: 'utf-16be' };
    }
  }
  const sample = buffer.subarray(0, 8192);
  const nulls = sample.filter((b) => b === 0).length;
  if (nulls > sample.length * 0.01) return { text: null, encoding: 'binary' };
  return { text: buffer.toString('utf8'), encoding: 'utf-8' };
}

/** Honours worktrees, submodules and core.hooksPath, which .git-as-a-file breaks. */
export function hooksDir(cwd = process.cwd()) {
  const configured = (() => {
    try {
      return git(['config', '--get', 'core.hooksPath'], { cwd }).trim();
    } catch {
      return '';
    }
  })();
  if (configured) return { dir: configured, managed: false };
  return { dir: `${git(['rev-parse', '--git-common-dir'], { cwd }).trim()}/hooks`, managed: true };
}

export function gitDir(cwd = process.cwd()) {
  return git(['rev-parse', '--git-dir'], { cwd }).trim();
}

export function currentBranch(cwd = process.cwd()) {
  try {
    return git(['rev-parse', '--abbrev-ref', 'HEAD'], { cwd }).trim();
  } catch {
    return 'unknown';
  }
}
