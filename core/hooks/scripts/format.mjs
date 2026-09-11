#!/usr/bin/env node
/**
 * Guardrail: runs the formatter the repository already defines, on the staged
 * files only. It never installs or imposes a formatter, and it never touches a
 * file whose index and working tree differ, because re-staging that file would
 * silently commit hunks the author deliberately left out of `git add -p`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import * as git from './lib/git.mjs';
import { readHookInput, EXIT_OK } from './lib/io.mjs';

const NUL = String.fromCharCode(0);

const DETECT = [
  { marker: 'package.json', script: 'format', argv: ['npm', 'run', 'format', '--silent', '--'] },
  { marker: '.prettierrc', argv: ['npx', '--no-install', 'prettier', '--write'] },
  { marker: '.prettierrc.json', argv: ['npx', '--no-install', 'prettier', '--write'] },
  { marker: 'prettier.config.js', argv: ['npx', '--no-install', 'prettier', '--write'] },
  { marker: 'pyproject.toml', argv: ['ruff', 'format'] },
  { marker: '.editorconfig', argv: null },
];

function hasNpmScript(root, name) {
  try {
    return Boolean(JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).scripts?.[name]);
  } catch {
    return false;
  }
}

function detectFormatter(root) {
  return DETECT.find((d) => {
    if (!fs.existsSync(path.join(root, d.marker))) return false;
    return d.script ? hasNpmScript(root, d.script) : Boolean(d.argv);
  });
}

/** Files whose staged content already equals the working tree; safe to rewrite. */
function fullyStaged(root) {
  const staged = git.stagedFiles(root);
  const unstagedDiff = execFileSync('git', ['diff', '--name-only', '-z'], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  const partial = new Set(unstagedDiff.split(NUL).filter(Boolean));
  return {
    safe: staged.filter((f) => !partial.has(f)),
    skipped: staged.filter((f) => partial.has(f)),
  };
}

const input = await readHookInput();
// As an agent hook it runs after every tool call, reads included, because the
// runtime ignores matchers. Only an edit can leave something to format.
if (input && !/edit|create|write|str_replace/i.test(String(input.tool_name ?? ''))) process.exit(EXIT_OK);
try {
  if (!git.isInsideRepo()) process.exit(EXIT_OK);
  const root = git.repoRoot();
  const formatter = detectFormatter(root);
  if (!formatter?.argv) process.exit(EXIT_OK);

  const { safe, skipped } = fullyStaged(root);
  if (skipped.length > 0) {
    console.error(
      `harness format: left ${skipped.length} partially staged file(s) alone so no unstaged hunk is committed`
    );
  }
  if (safe.length === 0) process.exit(EXIT_OK);

  // No shell: a filename containing an ampersand would otherwise be executed.
  const [cmd, ...args] = formatter.argv;
  const binary = process.platform === 'win32' && cmd === 'npx' ? 'npx.cmd' : cmd;
  try {
    execFileSync(binary, [...args, ...safe], { cwd: root, stdio: ['ignore', 'ignore', 'pipe'] });
  } catch {
    console.error('harness format: formatter unavailable or failed; continuing without it');
    process.exit(EXIT_OK);
  }
  execFileSync('git', ['add', '--', ...safe], { cwd: root, stdio: 'ignore' });
  process.exit(EXIT_OK);
} catch {
  // Formatting is a convenience, never a gate. It must not block a commit.
  process.exit(EXIT_OK);
}
