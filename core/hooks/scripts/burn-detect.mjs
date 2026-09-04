#!/usr/bin/env node
/**
 * Guardrail: notices when a session is going in circles.
 *
 * The signal is repetition. The same tool with the same argument five times, or
 * the same file read three times, is a model re-deriving something it already
 * has rather than making progress - and every one of those turns resends the
 * whole history, so going in circles does not cost a flat rate.
 *
 * It only warns. A repeated call is sometimes legitimate, and a guardrail that
 * blocks legitimate work gets disabled, which costs more than the burn.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { readHookInput, isHookMode, collectStrings, allow, emit, EXIT_OK } from './lib/io.mjs';

import { repoRoot } from './lib/git.mjs';

/**
 * State lives in the target repository, like the telemetry does, so two
 * repositories never share a counter and unlink can remove it. Files older
 * than the TTL are pruned on every run, so the directory cannot grow forever.
 */
/** Outside a repository there is nowhere sensible to keep state; the cwd will do. */
function stateRoot() {
  try {
    return repoRoot() ?? process.cwd();
  } catch {
    return process.cwd();
  }
}

const STATE_DIR = path.join(stateRoot(), '.harness', 'burn');

const REPEAT_LIMIT = 5;
const READ_LIMIT = 3;
const STATE_TTL_MS = 12 * 60 * 60 * 1000;

const input = await readHookInput();
if (!isHookMode(input)) process.exit(EXIT_OK);

const rawSession = String(input.session_id ?? 'unknown');
const session = rawSession.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64) || 'unknown';
const tool = String(input.tool_name ?? 'tool');

const signature = crypto
  .createHash('sha256')
  .update(tool + ' ' + collectStrings(input.tool_input).join(' '))
  .digest('hex')
  .slice(0, 16);

const isRead = /read|view|open|cat|get_file/i.test(tool);
const limit = isRead ? READ_LIMIT : REPEAT_LIMIT;
const stateFile = path.join(STATE_DIR, session + '.json');

function loadState() {
  try {
    const raw = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    if (Date.now() - (raw.startedAt ?? 0) > STATE_TTL_MS) return { startedAt: Date.now(), calls: {} };
    return raw;
  } catch {
    return { startedAt: Date.now(), calls: {} };
  }
}

// Best effort throughout: a counter that cannot be written must not stop a tool
// call. This hook is an observation, not a gate.
let state;
try {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  state = loadState();
  for (const name of fs.readdirSync(STATE_DIR)) {
    const file = path.join(STATE_DIR, name);
    try {
      if (Date.now() - fs.statSync(file).mtimeMs > STATE_TTL_MS) fs.rmSync(file);
    } catch {
      // Another hook may have removed it first; nothing to do.
    }
  }
  const previous = state.calls[signature]?.count ?? 0;
  state.calls[signature] = { tool, count: previous + 1 };
  fs.writeFileSync(stateFile, JSON.stringify(state), 'utf8');
} catch {
  process.exit(allow('PostToolUse'));
}

const count = state.calls[signature].count;

if (count === limit) {
  const total = Object.values(state.calls).reduce((sum, c) => sum + c.count, 0);
  const distinct = Object.keys(state.calls).length;
  emit({
    systemMessage:
      'harness: ' + tool + ' has now run ' + count + ' times with the same arguments in this ' +
      'session (' + total + ' calls, ' + distinct + ' distinct). That usually means the answer ' +
      'is already in context and is being re-derived rather than used. Re-read what came back ' +
      'the first time, or change the approach. Repeating it will not return something different.',
    hookSpecificOutput: { hookEventName: 'PostToolUse' },
  });
  process.exit(EXIT_OK);
}

process.exit(allow('PostToolUse'));
