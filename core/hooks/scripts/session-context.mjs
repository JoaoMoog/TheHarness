#!/usr/bin/env node
/**
 * SessionStart: says where the session is, in as few bytes as it takes.
 *
 * Everything injected here is resent on every model call of the session, and
 * on every call of a sub-agent that inherits it, so the start names things
 * and points at files rather than pasting them: the spec layout, whether a
 * Cross TK server is declared, the commands the repository sanctions, how
 * many decisions are on record, which sessions are open. A phase reads the
 * rest when it needs it, and a direct change never does.
 *
 * It is also where pending consolidation is named. dream-collect gathered the
 * evidence when the previous sessions closed; the start says it is waiting and
 * nothing more, because the extraction runs when this session reaches done or
 * on /dream, never before the request that opened the chat.
 */
import fs from 'node:fs';
import path from 'node:path';
import { contextFile, openSessions, clip, specsDir, layoutFor } from './lib/session.mjs';
import { crossTkServer } from './lib/crosstk.mjs';
import * as git from './lib/git.mjs';
import { readHookInput, isHookMode, context, EXIT_OK } from './lib/io.mjs';

const COMMANDS_LIMIT = 1200;
const SUMMARY_LIMIT = 400;

/**
 * Whether a Cross TK server is declared, said once so the agent does not
 * spend a turn probing for it, and said as what it is: the cheaper route for
 * the reads that would otherwise put a whole file or a whole search into the
 * context. Discovery is by name and never by an assumed tool.
 */
function crossTkSection(root) {
  const server = crossTkServer(root);
  if (!server) {
    return (
      '## Cross TK\n\nNo server matching cross-tk is configured in this repository or in your user profile; the ' +
      'built-in tools are what there is. Do not probe or retry for it.'
    );
  }
  const known =
    server.scope === 'user'
      ? '`' + server.name + '` is configured in your user profile, `' + server.file + '`, so it is connected in ' +
        'every workspace'
      : '`' + server.name + '` is configured in `' + server.file + '`';
  return (
    '## Cross TK\n\n' + known + '. Use it where it returns less than a whole read: one symbol out of a large ' +
    'file, a workspace search, a summary, the shape of a repository with no inventory. Small files, ranged reads ' +
    'and files already in context are read directly. Learn its tools from their descriptions; the rules are in ' +
    '`token-economy.instructions.md`.'
  );
}

/** One `## name` section of a markdown file, without its heading; empty when absent. */
function section(text, name) {
  const match = new RegExp('(?:^|\\n)## ' + name + '[^\\n]*\\n([\\s\\S]*?)(?=\\n## |$)').exec(text);
  return match ? match[1].trim() : '';
}

/**
 * The inventory is precomputed so no session rediscovers the repository, but
 * pasting it whole made every session pay for the parts only a plan needs.
 * What every change needs is the sanctioned commands; the rest is pointed at.
 */
function inventorySection(root, specs) {
  const file = contextFile(root);
  if (!fs.existsSync(file)) {
    return (
      '## Repository inventory\n\nNone yet. A direct change, a patch, a fix or an incident continues without it, on ' +
      'the scripts the repository manifest defines. Run the codebase-inventory skill before the first feature or ' +
      'refactor to create `' + specs + '/_context.md`.'
    );
  }
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split('\n').length;
  const parts = ['## Repository inventory (`' + specs + '/_context.md`, ' + lines + ' lines)'];
  const what = section(text, 'What this repository is');
  if (what) parts.push(clip(what, SUMMARY_LIMIT));
  const commands = section(text, 'Commands');
  if (commands) parts.push('### Commands\n\n' + clip(commands, COMMANDS_LIMIT));
  parts.push('Stack, entry points and structure are in the file: read it when a phase needs them, not before.');
  return parts.join('\n\n');
}

/** Choices, not facts: named and counted, read by the phases that decide. */
function decisionsSection(root, specs) {
  const file = path.join(specsDir(root), '_decisions.md');
  if (!fs.existsSync(file)) return null;
  const entries = (fs.readFileSync(file, 'utf8').match(/^## (?!<)/gm) ?? []).length;
  return (
    '## Decisions\n\n`' + specs + '/_decisions.md` holds ' + entries + ' recorded decision' + (entries === 1 ? '' : 's') +
    '. Read it before specify or plan on a feature, refactor or spike; a direct change or a patch does not need it.'
  );
}

/**
 * Consolidation is named here and done later. The material is about sessions
 * that already closed, so nothing in it is urgent, and asking for the
 * extraction before the request made every quick fix pay for the previous
 * session's memory first. The file stays until `dream-collect --consume`
 * removes it, once the candidates are written: at this session's done, or on
 * /dream. Candidates, never memory: a wrong extraction written straight into
 * the decisions file is inherited by every later session.
 */
function dreamNotice(file, specs) {
  let sessions = 0;
  try {
    const pending = JSON.parse(fs.readFileSync(file, 'utf8'));
    sessions = Array.isArray(pending.closed) ? pending.closed.length : 0;
  } catch {
    // Unreadable material is still pending; only the count is lost.
  }
  const count = sessions > 0 ? sessions + ' closed session' + (sessions === 1 ? '' : 's') : 'closed sessions';
  return (
    '## Consolidation pending (dreaming)\n\nMaterial from ' + count + ' is waiting in `.harness/dream-pending.json`. ' +
    'Not now: consolidate it when this session reaches `done`, or on `/dream`, with the `dreaming` skill, ending with ' +
    '`node .github/hooks/scripts/dream-collect.mjs --consume`. Nothing reaches `' + specs + '/_decisions.md` without ' +
    '`harness dream --promote`.'
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
parts.push(inventorySection(root, specs));

const decisions = decisionsSection(root, specs);
if (decisions) parts.push(decisions);

// Material exists only when a session closed since the last pass, so on an
// ordinary morning this section is simply absent. It is named, not consumed:
// the file goes when the candidates are written.
const pending = path.join(root, '.harness', 'dream-pending.json');
if (fs.existsSync(pending)) parts.push(dreamNotice(pending, specs));

// Every open session, not only the newest: two unrelated adjustments in two
// chats are two sessions, and a start that names one and forbids the other
// blocks the second chat for no reason. One line each; /resume reads the file.
const open = openSessions(root);
if (open.length > 0) {
  const line = (s) => '- ' + s.id + '-' + s.slug + ' (phase: ' + s.phase + (s.workBranch ? ', work branch: ' + s.workBranch : '') + ')';
  parts.push(
    '## Open sessions (' + open.length + ')\n\n' + open.map(line).join('\n') +
      '\n\n`/resume <id>` continues one of them and reads its `session.md`; /feature starts another alongside them. ' +
      'Two sessions that change the same files are the one real conflict, so say so before the first phase.'
  );
} else {
  parts.push(
    '## Open sessions\n\nNone. A small change is made here directly; multi-step work starts with @orchestrator, which ' +
      'creates one.'
  );
}

process.exit(context('SessionStart', parts.join('\n\n')));
