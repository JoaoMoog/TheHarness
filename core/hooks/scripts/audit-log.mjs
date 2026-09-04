#!/usr/bin/env node
/**
 * Append-only record of what the guardrails and the agents did. Runs BEFORE the
 * blocking guardrails in the git hook, because a log that only records the
 * commits that succeeded cannot tell you about the ones that were refused.
 *
 * Never blocks. A broken audit trail must be visible, not fatal.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import * as git from './lib/git.mjs';
import { readHookInput, EXIT_OK } from './lib/io.mjs';

const MAX_BYTES = 2 * 1024 * 1024;

function logFile(root) {
  const dir = path.join(root ?? os.tmpdir(), '.harness');
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, 'audit.log');
}

/** Single rotation, not a scheme: one .1 file is enough to survive a bad day. */
function rotate(file) {
  try {
    if (fs.statSync(file).size > MAX_BYTES) fs.renameSync(file, `${file}.1`);
  } catch {
    // Missing file, or a rename another process already did.
  }
}

const input = await readHookInput();

let root = null;
let branch = 'unknown';
let files = [];
try {
  if (git.isInsideRepo()) {
    root = git.repoRoot();
    branch = git.currentBranch?.() ?? branch;
    files = git.stagedFiles(root);
  }
} catch {
  // Logging degrades; it does not fail.
}

const entry = {
  at: new Date().toISOString(),
  event: input?.hook_event_name ?? 'pre-commit',
  session: input?.session_id ?? null,
  repo: root ? path.basename(root) : null,
  branch,
  stagedCount: files.length,
  staged: files.slice(0, 50),
  tool: input?.tool_name ?? null,
  agent: input?.agent_name ?? input?.subagent_name ?? null,
};

try {
  const file = logFile(root);
  rotate(file);
  fs.appendFileSync(file, `${JSON.stringify(entry)}\n`, 'utf8');
} catch (err) {
  console.error(`harness audit-log: could not write the audit entry - ${err.message}`);
}
process.exit(EXIT_OK);
