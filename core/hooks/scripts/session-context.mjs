#!/usr/bin/env node
/**
 * SessionStart: injects the precomputed repository inventory and the open
 * session, so the orchestrator starts a turn already knowing where it is
 * without spending a tool call to find out.
 *
 * This is the cheap half of the Precompute idea: the expensive scan happens
 * once, in the inventory file, and every session reads it for free.
 *
 * It is also where a dream lands. dream-collect gathered the evidence when the
 * previous sessions closed; this is the first moment a model is present to read
 * it, so consolidation is asked for here and nowhere else.
 */
import fs from 'node:fs';
import path from 'node:path';
import { contextFile, readSession, clip, specsDir, layoutFor } from './lib/session.mjs';
import { crossTkServer, isMandatory, DISCOVERY_FILE } from './lib/crosstk.mjs';
import * as git from './lib/git.mjs';
import { readHookInput, isHookMode, context, EXIT_OK } from './lib/io.mjs';

const CONTEXT_LIMIT = 6000;
const SESSION_LIMIT = 4000;
const DREAM_LIMIT = 5000;
const TOOLS_SHOWN = 12;

/**
 * Whether a Cross TK server is declared here, said once so the agent does not
 * spend a turn probing for it, and said as the obligation it is: the first
 * read of the session goes through it, and crosstk-first refuses a built-in
 * read before that. Discovery is by name and never by an assumed tool.
 */
function crossTkSection(root) {
  const server = crossTkServer(root);
  if (!server) {
    return (
      '## Cross TK\n\nNo server matching cross-tk is configured in this repository or in your user profile, ' +
      'and no first run has recorded one in `' + DISCOVERY_FILE + '`. Look for it in your tool list now, as ' +
      '`token-economy.instructions.md` says: found, record it there and use it first; not found, say so ' +
      'once, use the built-in tools, and do not probe or retry for it.'
    );
  }
  const record = server.discovered;
  const known =
    server.scope === 'record'
      ? '`' + server.name + '` was recorded in `' + DISCOVERY_FILE + '`' + (record?.discoveredAt ? ' on ' + record.discoveredAt : '')
      : server.scope === 'user'
        ? '`' + server.name + '` is configured in your user profile, `' + server.file + '`, so it is connected in ' +
          'every workspace' + (record ? ', and recorded in `' + DISCOVERY_FILE + '`' : '')
        : '`' + server.name + '` is configured in `' + server.file + '`' +
          (record ? ', and recorded in `' + DISCOVERY_FILE + '`' : '');
  const tools =
    record && record.tools.length > 0
      ? ' Its tools, as your runtime shows them: ' + record.tools.slice(0, TOOLS_SHOWN).join(', ') +
        (record.tools.length > TOOLS_SHOWN ? ', +' + (record.tools.length - TOOLS_SHOWN) + ' more' : '') + '.'
      : '';
  const gate = isMandatory(server)
    ? 'The first built-in read or search of this session is refused until a Cross TK tool has been used.'
    : 'The first built-in read of this session gets a reminder; the rule still stands.';
  return (
    '## Cross TK\n\n' + known + '. Mandatory, before anything else: use it first. Read its tools from their ' +
    'descriptions once, then every read, search and summary it covers goes through it, and the built-in tools ' +
    'are the fallback, as `token-economy.instructions.md` says.' + tools + ' ' + gate
  );
}

const input = await readHookInput();
if (!isHookMode(input)) process.exit(EXIT_OK);

let root;
try {
  root = git.isInsideRepo() ? git.repoRoot() : process.cwd();
} catch {
  root = process.cwd();
}

const layout = layoutFor(root);
const specs = specsDir(root).replace(root, '.');

/**
 * The contract for consolidation, stated where the material is. Candidates,
 * never memory: a wrong extraction written straight into the decisions file is
 * inherited by every later session, and nobody goes looking for it.
 */
function dreamSection(file) {
  const material = clip(fs.readFileSync(file, 'utf8'), DREAM_LIMIT);
  return [
    '## Consolidation pending (dreaming)',
    '',
    'Sessions closed since the last pass. Before anything else this turn, read the',
    '`dreaming` skill and extract candidates from the material below into',
    '`' + specs + '/_dreams.md`, following `templates/dreams.md`.',
    '',
    'Two rules decide most of it: a pattern needs at least two sessions, and every',
    'candidate cites the sessions it rests on. Nothing here is written to',
    '`' + specs + '/_decisions.md` - promotion is a human decision, made through',
    '`harness dream --promote`.',
    '',
    'If nothing in the material clears those two rules, write nothing and say so in',
    'one line.',
    '',
    '```json',
    material,
    '```',
  ].join('\n');
}

const parts = [];

// Which names to write under. Two tools spell the same four artifacts
// differently, and an agent that guesses wrong writes files nothing reads.
parts.push(
  [
    '## Spec layout',
    '',
    'Sessions live in `' + specs + '/NNN-slug/`, using the ' + layout.id + ' layout:',
    '',
    '- specification: `' + layout.spec + '`',
    '- plan: `' + layout.plan + '`',
    '- tasks: `' + layout.tasks + '`',
    '- state: `session.md`',
    '',
    'Write those names. Any other name is a file nothing reads.',
  ].join('\n')
);

parts.push(crossTkSection(root));

const inventory = contextFile(root);
if (fs.existsSync(inventory)) {
  parts.push(
    `## Repository inventory (${specs}/_context.md)\n\n` +
      clip(fs.readFileSync(inventory, 'utf8'), CONTEXT_LIMIT)
  );
} else {
  parts.push(
    `## Repository inventory\n\nNone yet. Run the codebase-inventory skill once to create ` +
      `${specs}/_context.md; every later session reads it instead of rediscovering the repository.`
  );
}

const decisions = path.join(specsDir(root), '_decisions.md');
if (fs.existsSync(decisions)) {
  // The other half of repository memory: choices, not facts. Read so no session
  // re-litigates what a previous one settled.
  parts.push(
    `## Decisions (${specs}/_decisions.md)\n\n` +
      clip(fs.readFileSync(decisions, 'utf8'), CONTEXT_LIMIT)
  );
}

// Material exists only when a session closed since the last pass, so on an
// ordinary morning this section is simply absent.
const pending = path.join(root, '.harness', 'dream-pending.json');
if (fs.existsSync(pending)) {
  parts.push(dreamSection(pending));
  try {
    fs.rmSync(pending, { force: true });
  } catch {
    // Injected twice means a duplicate candidate, which the skill drops. Not fatal.
  }
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
