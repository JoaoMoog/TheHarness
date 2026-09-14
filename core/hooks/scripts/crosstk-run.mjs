#!/usr/bin/env node
/**
 * Rewrites a verbose terminal command to run through `crosstk run`.
 *
 * The output of a test run, a diff or a listing enters the context whole and
 * is resent on every model call after it; `crosstk run <cmd>` prints a
 * compressed version and keeps the exit code. Asking the agent to remember
 * the prefix is a rule it drops when it is in a hurry; rewriting the call in
 * the hook is deterministic and costs no tokens. This is the same idea as the
 * auto-rewrite hook of the tool Cross TK is modelled on.
 *
 * Conservative on purpose. Only a plain command - no pipes, chains,
 * redirections or substitutions - whose first word is in the list below is
 * rewritten, and only when the `crosstk` binary is on PATH. Builds and
 * linters stay out: Cross TK treats every output of those executables as a
 * test run and truncates a failure block, and a compiler error needs its
 * detail. On Windows `ls`, `cat` and `grep` are shell aliases rather than
 * programs, so they are left alone there. VS Code honours the rewrite through
 * `hookSpecificOutput.updatedInput`; Kiro has no such field, so the hook is
 * silent there. Opt out with the marker file below or HARNESS_CROSSTK_RUN=0.
 *
 * Runs inside tool-hooks.mjs on every tool call, and on its own for the
 * self-test.
 */
import fs from 'node:fs';
import path from 'node:path';
import { hookContext } from './lib/git.mjs';
import { readHookInput, isHookMode, hookMode, verdict, emitVerdict, isMain, EXIT_OK } from './lib/io.mjs';
import { stateFile, loadState, saveState } from './lib/state.mjs';

/** The terminal tool, by last name segment, plus the `command` field it carries. */
const TERMINAL_TOOL = /terminal|command|shell|bash|powershell|execute/i;

/** Anything that makes the string a shell program rather than one command. */
const SHELL_SYNTAX = /[|&;<>`\r\n]|\$\(/;

export const OFF_MARKER = '.harness/crosstk-run.off';
export const BINARY_NAMES = ['crosstk', 'crosstk.exe', 'crosstk.cmd', 'crosstk.bat'];

/**
 * What is rewritten. `sub` is the accepted second word, `third` the accepted
 * third one, `posix` keeps a rule off Windows. Extend the list here; a rule
 * that is not here is a command that runs as written.
 */
export const REWRITE_RULES = [
  { bin: 'git', sub: ['status', 'log', 'diff', 'show', 'fetch', 'pull', 'push'] },
  { bin: 'ls', posix: true },
  { bin: 'cat', posix: true },
  { bin: 'grep', posix: true },
  { bin: 'rg', posix: true },
  { bin: 'findstr' },
  { bin: 'npm', sub: ['test', 't'] },
  { bin: 'npm', sub: ['run'], third: ['test'] },
  { bin: 'pnpm', sub: ['test'] },
  { bin: 'yarn', sub: ['test'] },
  { bin: 'cargo', sub: ['test'] },
  { bin: 'dotnet', sub: ['test'] },
  { bin: 'pytest' },
  { bin: 'python', sub: ['-m'], third: ['pytest'] },
  { bin: 'python3', sub: ['-m'], third: ['pytest'] },
  { bin: 'mvn', sub: ['test'] },
  { bin: 'gradle', sub: ['test'] },
  { bin: 'gradlew', sub: ['test'] },
  { bin: 'go', sub: ['test'] },
];

/** Whether a command string is one plain invocation of a rule above. */
export function eligible(command, platform = process.platform) {
  if (typeof command !== 'string') return false;
  const text = command.trim();
  if (text === '' || SHELL_SYNTAX.test(text)) return false;
  const tokens = text.split(/\s+/);
  if (tokens[0].includes('=')) return false; // an environment assignment, not a program
  const head = path.basename(tokens[0]).replace(/\.(exe|cmd|bat)$/i, '').toLowerCase();
  if (head === 'crosstk') return false;
  return REWRITE_RULES.some(
    (rule) =>
      rule.bin === head &&
      (!rule.posix || platform !== 'win32') &&
      (!rule.sub || rule.sub.includes(tokens[1])) &&
      (!rule.third || rule.third.includes(tokens[2]))
  );
}

/** The crosstk binary on PATH, or null. */
export function findBinary(env = process.env) {
  const entries = String(env.PATH ?? env.Path ?? '').split(path.delimiter).filter(Boolean);
  for (const dir of entries) {
    for (const name of BINARY_NAMES) {
      const candidate = path.join(dir, name);
      try {
        if (fs.statSync(candidate).isFile()) return candidate;
      } catch {
        // Not here.
      }
    }
  }
  return null;
}

/** The binary for this session, looked up once: an empty string records "looked, not found". */
function binaryFor(root, sessionId) {
  const file = stateFile(root, 'crosstk', sessionId);
  const state = loadState(file);
  if (typeof state.runBinary === 'string') return state.runBinary || null;
  const found = findBinary();
  saveState(file, { ...state, runBinary: found ?? '' });
  return found;
}

/** An allow carrying the rewritten command, or null when the call runs as written. */
export function decide(input, ctx) {
  if (hookMode() !== 'vscode') return null;
  const tool = String(input.tool_name ?? '').split('/').pop();
  const ti = input.tool_input;
  if (!TERMINAL_TOOL.test(tool) || !ti || typeof ti.command !== 'string') return null;
  if (process.env.HARNESS_CROSSTK_RUN === '0') return null;
  if (fs.existsSync(path.join(ctx.root, ...OFF_MARKER.split('/')))) return null;
  if (!eligible(ti.command)) return null;
  if (!binaryFor(ctx.root, input.session_id)) return null;
  return verdict.allow(undefined, { updatedInput: { ...ti, command: 'crosstk run ' + ti.command.trim() } });
}

if (isMain(import.meta.url)) {
  const input = await readHookInput();
  if (!isHookMode(input)) process.exit(EXIT_OK);
  process.exit(emitVerdict('PreToolUse', decide(input, hookContext())));
}
