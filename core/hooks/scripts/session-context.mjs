#!/usr/bin/env node
/**
 * SessionStart: injects the precomputed repository inventory and the open
 * session, so the orchestrator starts a turn already knowing where it is
 * without spending a tool call to find out.
 *
 * This is the cheap half of the Precompute idea: the expensive scan happens
 * once, in specs/_context.md, and every session reads it for free.
 */
import fs from 'node:fs';
import path from 'node:path';
import { contextFile, readSession, clip } from './lib/session.mjs';
import * as git from './lib/git.mjs';
import { readHookInput, isHookMode, context, EXIT_OK } from './lib/io.mjs';

const CONTEXT_LIMIT = 6000;
const SESSION_LIMIT = 4000;

const input = await readHookInput();
if (!isHookMode(input)) process.exit(EXIT_OK);

let root;
try {
  root = git.isInsideRepo() ? git.repoRoot() : process.cwd();
} catch {
  root = process.cwd();
}

const parts = [];

const inventory = contextFile(root);
if (fs.existsSync(inventory)) {
  parts.push(`## Repository inventory (specs/_context.md)\n\n${clip(fs.readFileSync(inventory, 'utf8'), CONTEXT_LIMIT)}`);
} else {
  parts.push(
    '## Repository inventory\n\nNone yet. Run the codebase-inventory skill once to create specs/_context.md; ' +
      'every later session reads it instead of rediscovering the repository.'
  );
}

const decisions = path.join(root, 'specs', '_decisions.md');
if (fs.existsSync(decisions)) {
  // The other half of repository memory: choices, not facts. Read so no session
  // re-litigates what a previous one settled.
  parts.push(`## Decisions (specs/_decisions.md)

${clip(fs.readFileSync(decisions, 'utf8'), CONTEXT_LIMIT)}`);
}

const session = readSession(root);
if (session) {
  parts.push(
    `## Open session ${session.id}-${session.slug} (phase: ${session.phase})\n\n` +
      clip(session.text, SESSION_LIMIT) +
      `\n\nResume it with /resume ${session.id}. Do not start a new session while this one is open.`
  );
} else {
  parts.push('## Open session\n\nNone. Start multi-step work with @orchestrator, which will create one.');
}

process.exit(context('SessionStart', parts.join('\n\n')));
