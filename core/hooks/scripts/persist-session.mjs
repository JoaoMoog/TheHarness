#!/usr/bin/env node
/**
 * PreCompact: writes a marker into the open session before the conversation is
 * compacted, so the phase summaries survive in a file rather than in a context
 * window that is about to be rewritten.
 *
 * This is what makes the E-mem rule safe: the orchestrator can discard detail
 * precisely because the summary is already on disk.
 */
import fs from 'node:fs';
import { readSession } from './lib/session.mjs';
import * as git from './lib/git.mjs';
import { readHookInput, isHookMode, context, EXIT_OK } from './lib/io.mjs';

const input = await readHookInput();
if (!isHookMode(input)) process.exit(EXIT_OK);

let root;
try {
  root = git.isInsideRepo() ? git.repoRoot() : process.cwd();
} catch {
  root = process.cwd();
}

const session = readSession(root);
if (!session) process.exit(EXIT_OK);

try {
  fs.appendFileSync(
    session.file,
    `\n<!-- context compacted ${new Date().toISOString()} at phase ${session.phase} -->\n`,
    'utf8'
  );
} catch {
  // The reminder below still fires even if the file cannot be written.
}

process.exit(
  context(
    'PreCompact',
    `Before compacting: session ${session.id}-${session.slug} is at phase ${session.phase}. ` +
      `Write the summary of the current phase into ${session.file.replace(root, '.')} first: ` +
      'what was verified and on which tree state, the findings still open, and the warnings. ' +
      'Anything not written there is lost by the next turn, and redone at full price.'
  )
);
