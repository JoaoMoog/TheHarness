#!/usr/bin/env node
/**
 * Guardrail: notices when a session is going in circles.
 *
 * The signal is repetition. The same tool with the same argument five times, or
 * the same file read three times without it changing in between, is a model
 * re-deriving something it already has rather than making progress - and every
 * one of those turns resends the whole history, so going in circles does not
 * cost a flat rate.
 *
 * Reads are counted by path, not by argument, so reading the same file in
 * different slices still counts as re-reading it. The count resets when the
 * content changes, because re-reading a file you just edited is how you check
 * the edit, not a circle.
 *
 * It only warns, and it warns again at every multiple of the limit. A repeated
 * call is sometimes legitimate, and a guardrail that blocks legitimate work gets
 * disabled, which costs more than the burn.
 *
 * Runs inside tool-hooks.mjs on every tool call, and on its own for Kiro and
 * the self-test.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { hookContext } from './lib/git.mjs';
import { readHookInput, isHookMode, collectStrings, toolFilePath, verdict, emitVerdict, isMain, EXIT_OK } from './lib/io.mjs';

const REPEAT_LIMIT = 5;
const READ_LIMIT = 3;
const STATE_TTL_MS = 12 * 60 * 60 * 1000;
const HASH_LIMIT_BYTES = 8 * 1024 * 1024;

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

/** A cheap fingerprint of the content, or null when the file cannot be read. */
function contentHash(file) {
  try {
    if (fs.statSync(file).size > HASH_LIMIT_BYTES) return null;
    return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 16);
  } catch {
    return null;
  }
}

function loadState(stateFile) {
  try {
    const raw = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    if (Date.now() - (raw.startedAt ?? 0) > STATE_TTL_MS) return { startedAt: Date.now(), calls: {} };
    return raw;
  } catch {
    return { startedAt: Date.now(), calls: {} };
  }
}

/**
 * Counts the call and warns at every multiple of the limit; null otherwise.
 * State lives in the target repository, like the telemetry does, so two
 * repositories never share a counter and unlink can remove it. Files older
 * than the TTL are pruned on every run, so the directory cannot grow forever.
 */
export function observe(input, ctx) {
  const stateDir = path.join(ctx.root, '.harness', 'burn');
  const session = String(input.session_id ?? 'unknown').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64) || 'unknown';
  const tool = String(input.tool_name ?? 'tool');
  const isRead = /read|view|open|cat|get_file/i.test(tool);
  const target = isRead ? readTarget(input) : null;
  const signature = target
    ? 'read:' + crypto.createHash('sha256').update(target).digest('hex').slice(0, 16)
    : crypto
        .createHash('sha256')
        .update(tool + ' ' + collectStrings(input.tool_input).join(' '))
        .digest('hex')
        .slice(0, 16);
  const limit = isRead ? READ_LIMIT : REPEAT_LIMIT;
  const stateFile = path.join(stateDir, session + '.json');

  // Best effort throughout: a counter that cannot be written must not stop a
  // tool call. This hook is an observation, not a gate.
  let state;
  let count;
  try {
    fs.mkdirSync(stateDir, { recursive: true });
    state = loadState(stateFile);
    for (const name of fs.readdirSync(stateDir)) {
      const file = path.join(stateDir, name);
      try {
        if (Date.now() - fs.statSync(file).mtimeMs > STATE_TTL_MS) fs.rmSync(file);
      } catch {
        // Another hook may have removed it first; nothing to do.
      }
    }
    const previous = state.calls[signature] ?? { count: 0, hash: null };
    const hash = target ? contentHash(target) : null;
    // Content that changed since the last read makes this the first read of a
    // new file, as far as circling is concerned.
    const changed = target && previous.hash && hash && previous.hash !== hash;
    count = changed ? 1 : previous.count + 1;
    state.calls[signature] = { tool, count, hash: hash ?? previous.hash ?? null };
    fs.writeFileSync(stateFile, JSON.stringify(state), 'utf8');
  } catch {
    return null;
  }

  if (count % limit !== 0) return null;

  const total = Object.values(state.calls).reduce((sum, c) => sum + c.count, 0);
  const distinct = Object.keys(state.calls).length;
  const what = target
    ? path.basename(target) + ' has now been read ' + count + ' times in this session without changing in between'
    : tool + ' has now run ' + count + ' times with the same arguments in this session';
  return verdict.allow(
    'harness: ' + what + ' (' + total + ' calls, ' + distinct + ' distinct). That usually means ' +
      'the answer is already in context and is being re-derived rather than used. Re-read what came ' +
      'back the first time, or change the approach. Repeating it will not return something different.'
  );
}

if (isMain(import.meta.url)) {
  const input = await readHookInput();
  if (!isHookMode(input)) process.exit(EXIT_OK);
  process.exit(emitVerdict('PostToolUse', observe(input, hookContext())));
}
