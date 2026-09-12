#!/usr/bin/env node
/**
 * SessionStart: injects the precomputed repository inventory and the open
 * sessions, so the orchestrator starts a turn already knowing where it is
 * without spending a tool call to find out.
 *
 * This is the cheap half of the Precompute idea: the expensive scan happens
 * once, in the inventory file, and every session reads it for free.
 *
 * It is also where pending consolidation is named. dream-collect gathered the
 * evidence when the previous sessions closed; the start says it is waiting and
 * nothing more, because the extraction runs when this session reaches done or
 * on /dream, never before the request that opened the chat.
 */
import fs from 'node:fs';
import path from 'node:path';
import { contextFile, openSessions, clip, specsDir, layoutFor } from './lib/session.mjs';
import { crossTkServer, isMandatory, DISCOVERY_FILE } from './lib/crosstk.mjs';
import * as git from './lib/git.mjs';
import { readHookInput, isHookMode, context, EXIT_OK } from './lib/io.mjs';

const CONTEXT_LIMIT = 6000;
const SESSION_LIMIT = 4000;
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
 * Consolidation is named here and done later. The material is about sessions
 * that already closed, so nothing in it is urgent, and asking for the
 * extraction before the request made every quick fix pay for the previous
 * session's memory first. The file stays until `dream-collect --consume`
 * removes it, once the candidates are written: at this session's done, or on
 * /dream. Candidates, never memory: a wrong extraction written straight into
 * the decisions file is inherited by every later session.
 */
function dreamNotice(file) {
  let sessions = 0;
  try {
    const pending = JSON.parse(fs.readFileSync(file, 'utf8'));
    sessions = Array.isArray(pending.closed) ? pending.closed.length : 0;
  } catch {
    // Unreadable material is still pending; only the count is lost.
  }
  const count = sessions > 0 ? sessions + ' closed session' + (sessions === 1 ? '' : 's') : 'closed sessions';
  return [
    '## Consolidation pending (dreaming)',
    '',
    'Material from ' + count + ' is waiting in `.harness/dream-pending.json`. Not now: consolidate it when',
    'this session reaches `done`, as the last step, or on request with `/dream`. Both apply the `dreaming`',
    'skill, write candidates to `' + specs + '/_dreams.md`, and end with',
    '`node .github/hooks/scripts/dream-collect.mjs --consume`. Nothing reaches `' + specs + '/_decisions.md`',
    'without `harness dream --promote`.',
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
    `## Repository inventory\n\nNone yet. A patch, fix or incident continues without it, on the scripts the ` +
      `repository manifest defines. Run the codebase-inventory skill before the first feature or refactor to ` +
      `create ${specs}/_context.md; every later session reads it instead of rediscovering the repository.`
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
// ordinary morning this section is simply absent. It is named, not consumed:
// the file goes when the candidates are written.
const pending = path.join(root, '.harness', 'dream-pending.json');
if (fs.existsSync(pending)) parts.push(dreamNotice(pending));

// Every open session, not only the newest: two unrelated adjustments in two
// chats are two sessions, and a start that names one and forbids the other
// blocks the second chat for no reason. The newest is shown in full; the rest
// are one line each, so /resume <id> can pick any of them.
const open = openSessions(root);
if (open.length > 0) {
  const [newest] = open;
  const line = (s) => `- ${s.id}-${s.slug} (phase: ${s.phase}` + (s.workBranch ? `, work branch: ${s.workBranch}` : '') + ')';
  parts.push(
    `## Open sessions (${open.length})\n\n` +
      open.map(line).join('\n') +
      `\n\n/resume <id> continues one of them; /feature starts another alongside them. ` +
      `Two sessions that change the same files are the one real conflict, so say so before the first phase.` +
      `\n\n### Newest: ${newest.id}-${newest.slug}\n\n` +
      clip(fs.readFileSync(newest.file, 'utf8'), SESSION_LIMIT)
  );
} else {
  parts.push('## Open sessions\n\nNone. Start multi-step work with @orchestrator, which will create one.');
}

process.exit(context('SessionStart', parts.join('\n\n')));
