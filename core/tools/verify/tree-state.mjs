#!/usr/bin/env node
/**
 * Prints one short line that identifies the state of the working tree, so a
 * verification result can be tied to the tree it ran on and reused only while
 * that state holds.
 *
 *   a1b2c3d            clean at that commit
 *   a1b2c3d+9f8e7d6c   that commit plus uncommitted work, hashed
 *
 * Deterministic and cheap: a few git commands, no model. The suffix hashes the
 * diff against HEAD and the untracked files (name, size, modification time),
 * so two different sets of edits never share a state and the same edits always
 * do. A touched-but-unchanged file changes the state; that only costs a
 * re-run, which is the safe direction.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const EXIT_OK = 0;
const EXIT_NO_GIT = 2;
const NUL = String.fromCharCode(0);

function git(args) {
  return execFileSync('git', ['-c', 'core.quotePath=false', ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
    maxBuffer: 64 * 1024 * 1024,
  });
}

let root;
try {
  root = git(['rev-parse', '--show-toplevel']).trim();
} catch {
  console.error('harness tree-state: not inside a git work tree, so there is no tree state to report');
  process.exit(EXIT_NO_GIT);
}

/** An unborn branch has no HEAD; the state is then only the uncommitted work. */
let head;
try {
  head = git(['rev-parse', '--short', 'HEAD']).trim();
} catch {
  head = 'unborn';
}

const diff = head === 'unborn' ? '' : git(['diff', 'HEAD', '--no-color', '--no-ext-diff']);
const untracked = git(['ls-files', '--others', '--exclude-standard', '-z'])
  .split(NUL)
  .filter(Boolean)
  .map((file) => {
    try {
      const stat = fs.statSync(path.join(root, file));
      return `${file}:${stat.size}:${Math.floor(stat.mtimeMs)}`;
    } catch {
      return `${file}:gone`;
    }
  });

if (diff === '' && untracked.length === 0) {
  console.log(head);
  process.exit(EXIT_OK);
}

const suffix = crypto.createHash('sha256').update(diff).update(NUL).update(untracked.join(NUL)).digest('hex').slice(0, 8);
console.log(`${head}+${suffix}`);
process.exit(EXIT_OK);
