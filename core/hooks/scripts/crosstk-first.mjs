#!/usr/bin/env node
/**
 * Guardrail: Cross TK first.
 *
 * When a Cross TK MCP server is declared for the repository, the first read of
 * a session goes through it. Until a Cross TK tool has been used, a built-in
 * read or search is refused with the reason; after that the built-in tools are
 * the fallback the rule always allowed. A rule that lives only in prose is the
 * one an agent skips when it is in a hurry, which is exactly when the tokens
 * matter.
 *
 * `"mandatoryFirst": false` on the server entry turns the refusal into a
 * one-time reminder, for a repository that wants the rule without the gate.
 * No server declared, no gate: the built-in tools are all there is.
 *
 * Runs inside tool-hooks.mjs on every tool call, and on its own for Kiro and
 * the self-test.
 */
import fs from 'node:fs';
import path from 'node:path';
import { crossTkServer, isCrossTkTool, isMandatory } from './lib/crosstk.mjs';
import { hookContext } from './lib/git.mjs';
import { readHookInput, isHookMode, verdict, emitVerdict, isMain, EXIT_OK } from './lib/io.mjs';

/**
 * The built-in reads and searches the gate holds, matched by the last name
 * segment so `search/codebase` and `codebase` are the same tool. Anything
 * else passes, an MCP tool with an unrecorded name included: a Cross TK call
 * that happens to be named `search_lines` must never be refused as a read,
 * because that would lock the session out of the very tool the gate exists for.
 */
const BUILT_IN_READS = new Set([
  'readFile', 'read_file', 'read', 'view', 'open', 'cat', 'fetch', 'textSearch', 'fileSearch',
  'semantic_search', 'grep_search', 'file_search', 'listDirectory', 'list_dir', 'codebase', 'usages',
  'changes', 'problems', 'findTestFiles',
]);
const isBuiltInRead = (name) => BUILT_IN_READS.has(String(name).split('/').pop());
const STATE_TTL_MS = 12 * 60 * 60 * 1000;

function loadState(stateFile) {
  try {
    const raw = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    return Date.now() - (raw.startedAt ?? 0) > STATE_TTL_MS ? { startedAt: Date.now() } : raw;
  } catch {
    return { startedAt: Date.now() };
  }
}

/** Best effort: a state that cannot be written turns the gate into a reminder for this call, never into a block. */
function saveState(stateDir, stateFile, state) {
  try {
    fs.mkdirSync(stateDir, { recursive: true });
    for (const name of fs.readdirSync(stateDir)) {
      const file = path.join(stateDir, name);
      try {
        if (Date.now() - fs.statSync(file).mtimeMs > STATE_TTL_MS) fs.rmSync(file);
      } catch {
        // Another hook may have removed it first.
      }
    }
    fs.writeFileSync(stateFile, JSON.stringify(state), 'utf8');
    return true;
  } catch {
    return false;
  }
}

/**
 * A deny for the first built-in read of a session while Cross TK is known and
 * unused, a one-time reminder when the gate is advisory, and null otherwise.
 */
export function decide(input, ctx) {
  const root = ctx.root;
  const server = crossTkServer(root);
  if (!server) return null;

  const tool = String(input.tool_name ?? '');
  const session = String(input.session_id ?? 'unknown').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64) || 'unknown';
  const stateDir = path.join(root, '.harness', 'crosstk');
  const stateFile = path.join(stateDir, session + '.json');
  const state = loadState(stateFile);

  if (isCrossTkTool(tool, server)) {
    if (!state.used) saveState(stateDir, stateFile, { ...state, used: true, tool });
    return null;
  }

  if (state.used || !isBuiltInRead(tool)) return null;

  const where = server.scope === 'user' ? 'your user profile' : server.scope === 'record' ? 'the first-run record' : server.file;
  const reason =
    `Cross TK first: \`${server.name}\` is known from ${where} and has not been used in this session yet. ` +
    'Learn its tools from their descriptions and make this read through it; the built-in tools open after that, as ' +
    'the fallback. If the server is not in your tool list, say so to the user instead of retrying: it must be ' +
    'enabled in the tools picker. If its calls are not being recognised, record its tool names in .harness/crosstk.json.';

  if (isMandatory(server)) return verdict.deny(reason);

  // Advisory: said once per session, then quiet.
  if (!state.nudged && saveState(stateDir, stateFile, { ...state, nudged: true })) {
    return verdict.allow(reason.replace('Cross TK first:', 'Cross TK first (advisory):'));
  }
  return null;
}

if (isMain(import.meta.url)) {
  const input = await readHookInput();
  if (!isHookMode(input)) process.exit(EXIT_OK);
  process.exit(emitVerdict('PreToolUse', decide(input, hookContext())));
}
