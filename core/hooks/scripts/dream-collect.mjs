#!/usr/bin/env node
/**
 * Stop / AgentStop: gathers what the closed sessions can be read to say, so the
 * next session can consolidate it into memory.
 *
 * This half is deliberately dumb. It runs no model, makes no judgement and
 * writes nothing into the repository - it only assembles the evidence and drops
 * it in .harness/dream-pending.json. The next SessionStart names that material;
 * the extraction runs when that session closes or on /dream, and --consume
 * removes the file once the candidates are written. The work therefore happens
 * between one session and the next, which is the whole point, never before a
 * request, and costs nothing while nothing is new.
 *
 * Silence is the normal outcome. A hook that speaks every session gets turned
 * off, and then none of this runs at all.
 */
import fs from 'node:fs';
import path from 'node:path';
import { listSessions, currentPhase, specsDir } from './lib/session.mjs';
import * as git from './lib/git.mjs';
import { readHookInput, isHookMode, EXIT_OK } from './lib/io.mjs';

/**
 * A window, not the whole history. A pattern needs two sessions to be a
 * pattern, but it does not need twenty, and the material has to fit in the
 * context the next session injects it into.
 */
const WINDOW = 10;
const MAX_DECISIONS = 40;
const LOW_SCORE = 4;
const STATE_KEEP = 100;

/** Invoked without --hook means a person ran it, and a person expects output. */
const DIRECT = !process.argv.includes('--hook');

/** The extraction step ends with --consume: the material was read and its candidates written. */
const CONSUME = process.argv.includes('--consume');

/** The status word that means a phase could not finish on its own. */
const ESCALATED = new Set(['escalated']);

const clean = (cell) => String(cell ?? '').trim();

/** Rows of one markdown table under a heading, as arrays of trimmed cells. */
function tableRows(text, heading) {
  const lines = text.split('\n');
  const start = lines.findIndex((line) => line.trim().toLowerCase() === `## ${heading}`.toLowerCase());
  if (start === -1) return [];
  const rows = [];
  for (const line of lines.slice(start + 1)) {
    const trimmed = line.trim();
    if (trimmed.startsWith('## ')) break;
    if (!trimmed.startsWith('|')) continue;
    const cells = trimmed.slice(1, -1).split('|').map(clean);
    // The header row and its separator carry no data.
    if (cells.every((cell) => /^:?-{2,}:?$/.test(cell)) || cells[0] === 'phase') continue;
    rows.push(cells);
  }
  return rows;
}

/** A `key: value` line from the session header, ignoring unfilled placeholders. */
function headerField(text, key) {
  const match = new RegExp(`^${key}:\\s*(.+)$`, 'im').exec(text);
  const value = match ? clean(match[1]) : '';
  return value && !value.startsWith('<') ? value : null;
}

/**
 * One appended block per phase pass. Two blocks for the same phase means the
 * phase ran twice, which is the signal - not the summaries themselves.
 */
function phasePasses(text) {
  const passes = {};
  const agents = {};
  for (const line of text.split('\n')) {
    const match = /^###\s+([a-z]+)\s+[-—]\s+([a-z0-9-]+)\s+[-—]/i.exec(line.trim());
    if (!match) continue;
    const phase = match[1].toLowerCase();
    passes[phase] = (passes[phase] ?? 0) + 1;
    agents[phase] = match[2];
  }
  return { passes, agents };
}

/** Requirement ids the matrix left uncovered when the session closed. */
function gapIds(text) {
  const ids = new Set();
  for (const line of text.split('\n')) {
    if (!/\bGAP\b/.test(line)) continue;
    for (const id of line.match(/\b(?:FR|NFR)-\d{3}\b/g) ?? []) ids.add(id);
  }
  return [...ids];
}

/** Rubric scores the reviewer recorded, keeping only the ones that fell short. */
function lowScores(text) {
  return tableRows(text, 'Scores')
    .map((cells) => ({ phase: cells[0], rubric: cells[1], lowest: Number(cells[3]) }))
    .filter((row) => Number.isFinite(row.lowest) && row.lowest < LOW_SCORE);
}

/** Everything one closed session can be read to say, with no interpretation. */
function readClosed(session) {
  const text = fs.readFileSync(session.file, 'utf8');
  const { passes, agents } = phasePasses(text);
  const phases = tableRows(text, 'Phases').map((cells) => ({
    phase: cells[0],
    status: cells[1].toLowerCase(),
  }));

  return {
    id: session.id,
    slug: session.slug,
    dirName: path.basename(session.dir),
    track: headerField(text, 'track'),
    promotedFrom: headerField(text, 'promoted from'),
    trackReason: headerField(text, 'track reason'),
    escalations: phases
      .filter((row) => ESCALATED.has(row.status))
      .map((row) => ({ phase: row.phase, agent: agents[row.phase] ?? null })),
    repeatedPhases: Object.entries(passes)
      .filter(([, count]) => count > 1)
      .map(([phase, count]) => ({ phase, passes: count })),
    gaps: gapIds(text),
    lowScores: lowScores(text),
  };
}

/** Decision titles already in repository memory, so nothing is reproposed. */
function existingDecisions(root) {
  return headings(path.join(specsDir(root), '_decisions.md')).slice(-MAX_DECISIONS);
}

/** Candidates already waiting, so a later pass adds to them instead of repeating them. */
function openCandidates(root) {
  return headings(path.join(specsDir(root), '_dreams.md'));
}

function headings(file) {
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .filter((line) => line.startsWith('## '))
    .map((line) => line.slice(3).trim());
}

function repoRoot() {
  try {
    return git.isInsideRepo() ? git.repoRoot() : process.cwd();
  } catch {
    return process.cwd();
  }
}

function readState(statePath) {
  try {
    if (fs.existsSync(statePath)) return JSON.parse(fs.readFileSync(statePath, 'utf8'));
  } catch {
    // A corrupt state file makes everything look new. Noisy once, never wrong.
  }
  return { consolidated: [], lastCollectedAt: null };
}

function collect() {
  const root = repoRoot();
  const closed = listSessions(root)
    .filter((session) => fs.existsSync(session.file))
    .filter((session) => currentPhase(fs.readFileSync(session.file, 'utf8')) === 'done')
    .slice(-WINDOW);

  if (closed.length === 0) return { wrote: false, reason: 'no closed sessions yet' };

  const stateDir = path.join(root, '.harness');
  const statePath = path.join(stateDir, 'dream-state.json');
  const pendingPath = path.join(stateDir, 'dream-pending.json');

  const state = readState(statePath);
  const seen = new Set(state.consolidated ?? []);
  const fresh = closed.filter((session) => !seen.has(path.basename(session.dir)));
  if (fresh.length === 0) return { wrote: false, reason: 'nothing has closed since the last pass' };

  // The whole window goes out, not just the new sessions: a pattern that spans
  // one old session and one new one is invisible if only the new one is sent.
  const pending = {
    collectedAt: new Date().toISOString(),
    root,
    newSessions: fresh.map((session) => path.basename(session.dir)),
    closed: closed.map(readClosed),
    decisions: existingDecisions(root),
    openCandidates: openCandidates(root),
  };

  const nextState = {
    consolidated: [...new Set([...(state.consolidated ?? []), ...pending.newSessions])].slice(-STATE_KEEP),
    lastCollectedAt: pending.collectedAt,
  };

  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(pendingPath, `${JSON.stringify(pending, null, 2)}\n`, 'utf8');
  fs.writeFileSync(statePath, `${JSON.stringify(nextState, null, 2)}\n`, 'utf8');

  return { wrote: true, file: pendingPath, sessions: fresh.length, window: closed.length };
}

if (CONSUME) {
  const file = path.join(repoRoot(), '.harness', 'dream-pending.json');
  const existed = fs.existsSync(file);
  fs.rmSync(file, { force: true });
  console.log(existed ? `Consumed ${file}: the next session start will not name it again.` : 'Nothing pending to consume.');
  process.exit(EXIT_OK);
}

if (DIRECT) {
  const result = collect();
  console.log(
    result.wrote
      ? `Collected ${result.sessions} newly closed session(s) across a window of ${result.window}.\n  ${result.file}`
      : `Nothing to collect: ${result.reason}.`
  );
  process.exit(EXIT_OK);
}

const input = await readHookInput();
if (!isHookMode(input)) process.exit(EXIT_OK);
try {
  collect();
} catch (err) {
  // Losing one night of consolidation is not worth failing a session over.
  console.error(`harness dream-collect: ${err.message}`);
}
process.exit(EXIT_OK);
