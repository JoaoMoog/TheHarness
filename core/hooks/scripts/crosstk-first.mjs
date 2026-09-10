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
 */
import fs from 'node:fs';
import path from 'node:path';
import { crossTkServer, isCrossTkTool, isMandatory } from './lib/crosstk.mjs';
import * as git from './lib/git.mjs';
import { readHookInput, isHookMode, allow, deny, EXIT_OK } from './lib/io.mjs';

/** The same reads read-guard watches, plus the search and listing tools the agents carry. */
const READ = /read|view|open|cat|fetch|textSearch|fileSearch|semantic_search|grep_search|file_search|listDirectory|list_dir|codebase|usages/i;
const STATE_TTL_MS = 12 * 60 * 60 * 1000;

const input = await readHookInput();
if (!isHookMode(input)) process.exit(EXIT_OK);

let root;
try {
  root = git.isInsideRepo() ? git.repoRoot() : process.cwd();
} catch {
  root = process.cwd();
}

const server = crossTkServer(root);
if (!server) process.exit(allow('PreToolUse'));

const tool = String(input.tool_name ?? '');
const session = String(input.session_id ?? 'unknown').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64) || 'unknown';
const STATE_DIR = path.join(root, '.harness', 'crosstk');
const stateFile = path.join(STATE_DIR, session + '.json');

function loadState() {
  try {
    const raw = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    return Date.now() - (raw.startedAt ?? 0) > STATE_TTL_MS ? { startedAt: Date.now() } : raw;
  } catch {
    return { startedAt: Date.now() };
  }
}

/** Best effort: a state that cannot be written turns the gate into a reminder for this call, never into a block. */
function saveState(state) {
  try {
    fs.mkdirSync(STATE_DIR, { recursive: true });
    for (const name of fs.readdirSync(STATE_DIR)) {
      const file = path.join(STATE_DIR, name);
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

const state = loadState();

if (isCrossTkTool(tool, server)) {
  if (!state.used) saveState({ ...state, used: true, tool });
  process.exit(allow('PreToolUse'));
}

if (state.used || !READ.test(tool)) process.exit(allow('PreToolUse'));

const reason =
  `Cross TK first: \`${server.name}\` is declared in ${server.file} and has not been used in this session yet. ` +
  'Learn its tools from their descriptions and make this read through it; the built-in tools open after that, as ' +
  'the fallback. If this agent has no Cross TK tool, its tools list must name one (harness doctor says which agents ' +
  'lack it); if its calls are not being recognised, list its tool names under "tools" in the server entry.';

if (isMandatory(server)) process.exit(deny('PreToolUse', reason));

// Advisory: said once per session, then quiet.
if (!state.nudged && saveState({ ...state, nudged: true })) {
  process.exit(allow('PreToolUse', reason.replace('Cross TK first:', 'Cross TK first (advisory):')));
}
process.exit(allow('PreToolUse'));
