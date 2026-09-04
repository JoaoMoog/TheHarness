#!/usr/bin/env node
/**
 * SubagentStart / SubagentStop: records who ran, in which phase, for how long.
 *
 * Without this a multi-agent session is a black box: you can see the final
 * answer and the bill, and nothing in between. `harness budget --sessions`
 * reads this file back.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import * as git from './lib/git.mjs';
import { readHookInput, isHookMode, EXIT_OK } from './lib/io.mjs';

const input = await readHookInput();
if (!isHookMode(input)) process.exit(EXIT_OK);

let root;
try {
  root = git.isInsideRepo() ? git.repoRoot() : os.tmpdir();
} catch {
  root = os.tmpdir();
}

const dir = path.join(root, '.harness');
const file = path.join(dir, 'sessions.jsonl');
const startedFile = path.join(dir, 'agent-starts.json');

const agent = input.agent_name ?? input.subagent_name ?? input.subagent ?? 'unknown';
const key = `${input.session_id ?? 'no-session'}:${agent}`;

try {
  fs.mkdirSync(dir, { recursive: true });
  const starts = fs.existsSync(startedFile) ? JSON.parse(fs.readFileSync(startedFile, 'utf8')) : {};

  if (input.hook_event_name === 'SubagentStart') {
    starts[key] = Date.now();
    fs.writeFileSync(startedFile, JSON.stringify(starts), 'utf8');
  } else {
    const started = starts[key];
    delete starts[key];
    fs.writeFileSync(startedFile, JSON.stringify(starts), 'utf8');
    fs.appendFileSync(
      file,
      `${JSON.stringify({
        at: new Date().toISOString(),
        session: input.session_id ?? null,
        agent,
        durationMs: started ? Date.now() - started : null,
        tokens: input.usage?.total_tokens ?? input.total_tokens ?? null,
      })}\n`,
      'utf8'
    );
  }
} catch (err) {
  console.error(`harness telemetry: ${err.message}`);
}
process.exit(EXIT_OK);
