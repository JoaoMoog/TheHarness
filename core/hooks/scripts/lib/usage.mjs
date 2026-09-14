/**
 * What a session costs, approximated by what the hooks can see.
 *
 * Copilot bills tokens: every model call resends the context, every tool
 * result enters it, every sub-agent opens another one. The runtime does not
 * hand the hooks a token count, but it does hand them every prompt, every
 * tool call, every tool result and every sub-agent start, and those are the
 * drivers of the bill. This counts them per session, in the target
 * repository, and writes one `usage` line to .harness/sessions.jsonl when the
 * session stops, next to the sub-agent records the telemetry already keeps.
 * `harness cost` reads both.
 *
 * The runtime may fire Stop once per turn or once per session; the reader
 * sums every usage line of a session, so either is right.
 */
import fs from 'node:fs';
import path from 'node:path';
import { stateFile, loadState, saveState } from './state.mjs';

export const COUNTERS = ['prompts', 'toolCalls', 'crossTk', 'rewrites', 'subagents', 'toolOutputBytes'];

/** Adds to the session's counters; `tool` names the tool of a call, counted by its last segment. */
export function bumpUsage(root, sessionId, patch = {}) {
  const file = stateFile(root, 'usage', sessionId);
  const state = loadState(file);
  for (const key of COUNTERS) {
    if (patch[key]) state[key] = (state[key] ?? 0) + Number(patch[key]);
  }
  if (patch.tool) {
    const name = String(patch.tool).split('/').pop();
    state.byTool = state.byTool ?? {};
    state.byTool[name] = (state.byTool[name] ?? 0) + 1;
  }
  return saveState(file, state) ? state : null;
}

/** The size of what the runtime handed back from the tool, in bytes; 0 when it handed nothing. */
export function responseBytes(input) {
  const body = input?.tool_response ?? input?.tool_output ?? input?.tool_result ?? input?.result ?? input?.output;
  if (body === undefined || body === null) return 0;
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return Buffer.byteLength(text, 'utf8');
}

/** The usage record of a session, in the shape sessions.jsonl carries. */
export function usageRecord(state, sessionId) {
  return {
    at: new Date().toISOString(),
    event: 'usage',
    session: sessionId ?? null,
    prompts: state.prompts ?? 0,
    toolCalls: state.toolCalls ?? 0,
    crossTk: state.crossTk ?? 0,
    rewrites: state.rewrites ?? 0,
    subagents: state.subagents ?? 0,
    toolOutputBytes: state.toolOutputBytes ?? 0,
    byTool: state.byTool ?? {},
  };
}

/** Appends the session's usage line to sessions.jsonl and clears the counters; null when there were none. */
export function finishUsage(root, sessionId) {
  const file = stateFile(root, 'usage', sessionId);
  if (!fs.existsSync(file)) return null;
  const record = usageRecord(loadState(file), sessionId);
  try {
    const dir = path.join(root, '.harness');
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(path.join(dir, 'sessions.jsonl'), JSON.stringify(record) + '\n', 'utf8');
    fs.rmSync(file, { force: true });
  } catch {
    return null;
  }
  return record;
}
