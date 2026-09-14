/**
 * Per-session state for the tool guardrails, kept in the target repository
 * under .harness/<name>/<session>.json so two repositories never share a
 * counter and unlink can remove it. Files older than the TTL are pruned on
 * every save, so a directory cannot grow forever.
 *
 * Everything here is best effort: a state that cannot be read starts fresh,
 * and one that cannot be written turns a guardrail into a one-off, never into
 * a block. A hook that fails because its bookkeeping failed costs a model
 * round trip for nothing.
 */
import fs from 'node:fs';
import path from 'node:path';

export const STATE_TTL_MS = 12 * 60 * 60 * 1000;

/** The session id as a file name: the runtime's id, or `unknown` when none came. */
export const sessionKey = (sessionId) =>
  String(sessionId ?? 'unknown').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64) || 'unknown';

export function stateFile(root, name, sessionId) {
  return path.join(root, '.harness', name, sessionKey(sessionId) + '.json');
}

/** The state, or a fresh one when the file is missing, unreadable or older than the TTL. */
export function loadState(file) {
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!raw || typeof raw !== 'object' || Date.now() - (raw.startedAt ?? 0) > STATE_TTL_MS) {
      return { startedAt: Date.now() };
    }
    return raw;
  } catch {
    return { startedAt: Date.now() };
  }
}

/** Writes the state and prunes expired siblings; false when nothing could be written. */
export function saveState(file, state) {
  const dir = path.dirname(file);
  try {
    fs.mkdirSync(dir, { recursive: true });
    for (const name of fs.readdirSync(dir)) {
      const sibling = path.join(dir, name);
      try {
        if (Date.now() - fs.statSync(sibling).mtimeMs > STATE_TTL_MS) fs.rmSync(sibling);
      } catch {
        // Another hook may have removed it first.
      }
    }
    fs.writeFileSync(file, JSON.stringify(state), 'utf8');
    return true;
  } catch {
    return false;
  }
}
