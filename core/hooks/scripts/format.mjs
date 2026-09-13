#!/usr/bin/env node
/**
 * Guardrail: runs the formatter the repository already defines, on the staged
 * files only. It never installs or imposes a formatter, and it never touches a
 * file whose index and working tree differ, because re-staging that file would
 * silently commit hunks the author deliberately left out of `git add -p`.
 *
 * Two entry points: the git pre-commit hook, where there is no event and the
 * staged files are the work; and PostToolUse, inside tool-hooks.mjs on every
 * tool call, where only an edit can leave something to format and a read must
 * cost nothing.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import * as git from './lib/git.mjs';
import { readHookInput, isHookMode, hookMode, isMain, EXIT_OK } from './lib/io.mjs';

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

/** Formats the fully staged files and re-stages them. A convenience, never a gate: nothing here throws. */
function formatStaged(root) {
  try {
    const formatter = detectFormatter(root);
    if (!formatter?.argv) return;

    const { safe, skipped } = fullyStaged(root);
    if (skipped.length > 0) {
      console.error(
        `harness format: left ${skipped.length} partially staged file(s) alone so no unstaged hunk is committed`
      );
    }
    if (safe.length === 0) return;

    // No shell: a filename containing an ampersand would otherwise be executed.
    const [cmd, ...args] = formatter.argv;
    const binary = process.platform === 'win32' && cmd === 'npx' ? 'npx.cmd' : cmd;
    try {
      execFileSync(binary, [...args, ...safe], { cwd: root, stdio: ['ignore', 'ignore', 'pipe'] });
    } catch {
      console.error('harness format: formatter unavailable or failed; continuing without it');
      return;
    }
    execFileSync('git', ['add', '--', ...safe], { cwd: root, stdio: 'ignore' });
  } catch {
    // Formatting is a convenience, never a gate. It must not block a commit.
  }
}

/** After an edit tool, formats what is staged; after anything else, nothing. Never speaks. */
export function observe(input, ctx) {
  if (!/edit|create|write|str_replace/i.test(String(input?.tool_name ?? ''))) return null;
  if (ctx.inRepo) formatStaged(ctx.root);
  return null;
}

if (isMain(import.meta.url)) {
  if (hookMode() === null) {
    // git pre-commit: no event on stdin, the staged files are the work.
    const ctx = git.hookContext();
    if (ctx.inRepo) formatStaged(ctx.root);
    process.exit(EXIT_OK);
  }
  const input = await readHookInput();
  if (isHookMode(input)) observe(input, git.hookContext());
  process.exit(EXIT_OK);
}
