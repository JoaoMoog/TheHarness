#!/usr/bin/env node
/**
 * Advisory: Cross TK where it returns less than a whole read.
 *
 * When a Cross TK MCP server is declared and a built-in tool is about to read
 * a large file whole, this says so, once per file: a symbol, a summary or a
 * search through the server puts a fraction of that file into the context,
 * and the context is billed again on every model call that follows. A small
 * file, a ranged read, or a file the session was already told about passes
 * in silence.
 *
 * It never denies. A refused read costs a whole model round trip to redo,
 * and when the server is declared but not in the tool picker it cost a human
 * turn - both more than the read it was refusing. The rule that Cross TK is
 * used where it pays lives in token-economy.instructions.md; this is the one
 * reminder the runtime adds at the moment it matters.
 *
 * Runs inside tool-hooks.mjs on every tool call, and on its own for Kiro and
 * the self-test.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { crossTkServer } from './lib/crosstk.mjs';
import { hookContext } from './lib/git.mjs';
import { readHookInput, isHookMode, toolFilePath, verdict, emitVerdict, isMain, EXIT_OK } from './lib/io.mjs';
import { stateFile, loadState, saveState } from './lib/state.mjs';

/** The built-in tools that put a file into the context whole, by last name segment. */
const WHOLE_FILE_READS = new Set(['readFile', 'read_file', 'read', 'view', 'open', 'cat', 'get_file', 'get_file_contents']);

/** A read that names a slice is already targeted; the reminder would be noise. */
const RANGE_KEYS = [
  'startLine', 'endLine', 'start_line', 'end_line', 'startLineNumberBaseZero', 'endLineNumberBaseZero',
  'offset', 'limit', 'range', 'lines', 'head', 'tail',
];

/** Above either, a whole read is the expensive way to get one symbol out of a file. */
export const LARGE_BYTES = 12 * 1024;
export const LARGE_LINES = 300;
const COUNT_LIMIT_BYTES = 512 * 1024;

const isWholeFileRead = (name) => WHOLE_FILE_READS.has(String(name).split('/').pop());
const hasRange = (ti) =>
  !!ti && typeof ti === 'object' && RANGE_KEYS.some((k) => ti[k] !== undefined && ti[k] !== null && ti[k] !== '');

/** The file a read tool targets, as one canonical absolute path, or null. */
function readTarget(input) {
  const raw = toolFilePath(input);
  if (typeof raw !== 'string' || raw === '') return null;
  try {
    return path.resolve(raw.startsWith('file://') ? fileURLToPath(raw) : raw);
  } catch {
    return null;
  }
}

/** Size and line count of a regular file; lines are counted only while counting is cheap. */
function measure(file) {
  try {
    const stat = fs.statSync(file);
    if (!stat.isFile()) return null;
    let lines = null;
    if (stat.size <= COUNT_LIMIT_BYTES) {
      const buf = fs.readFileSync(file);
      lines = 0;
      for (const byte of buf) if (byte === 10) lines += 1;
      if (buf.length > 0 && buf[buf.length - 1] !== 10) lines += 1;
    }
    return { size: stat.size, lines };
  } catch {
    return null;
  }
}

/** An allow with one reminder for the first whole read of a large file while Cross TK is declared; null otherwise. */
export function decide(input, ctx) {
  const tool = String(input.tool_name ?? '');
  if (!isWholeFileRead(tool) || hasRange(input.tool_input)) return null;
  const target = readTarget(input);
  if (!target) return null;
  const measured = measure(target);
  if (!measured) return null;
  const large = measured.size >= LARGE_BYTES || (measured.lines ?? 0) >= LARGE_LINES;
  if (!large) return null;

  // Only now the declaration files are read: most calls never get this far.
  const server = crossTkServer(ctx.root);
  if (!server) return null;

  const file = stateFile(ctx.root, 'crosstk', input.session_id);
  const state = loadState(file);
  const key = crypto.createHash('sha256').update(target).digest('hex').slice(0, 16);
  if (state.nudged?.[key]) return null;
  saveState(file, { ...state, nudged: { ...(state.nudged ?? {}), [key]: true } });

  const lines = measured.lines === null ? 'many' : '~' + measured.lines;
  const kb = Math.max(1, Math.round(measured.size / 1024));
  return verdict.allow(
    `harness: ${path.basename(target)} has ${lines} lines (${kb} KB). Cross TK \`${server.name}\` is connected: for one ` +
      'symbol or a summary its tools return a fraction of this; read it whole only if you need all of it.'
  );
}

if (isMain(import.meta.url)) {
  const input = await readHookInput();
  if (!isHookMode(input)) process.exit(EXIT_OK);
  process.exit(emitVerdict('PreToolUse', decide(input, hookContext())));
}
