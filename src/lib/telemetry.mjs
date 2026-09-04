import fs from 'node:fs';
import path from 'node:path';
import { harnessPath } from './paths.mjs';
import { SESSION_TRACKS } from './contracts.mjs';
import { loadLock } from './lock.mjs';

export const SESSIONS_FILE = harnessPath('.harness', 'sessions.jsonl');

/** Phase agents, in the order the machine runs them. */
const PHASE_AGENT = {
  specifier: 'specify',
  planner: 'plan',
  tasker: 'tasks',
  implementer: 'implement',
  reviewer: 'review',
  security: 'review',
  'azure-devops': 'deliver',
};

/** The hook writes into each target repository, so the reader has to look there. */
export function telemetryFiles() {
  const lock = loadLock();
  const dirs = [harnessPath('.'), ...Object.values(lock.repos ?? {}).map((e) => e.dir)];
  return [...new Set(dirs)]
    .map((dir) => ({ repo: path.basename(dir), file: path.join(dir, '.harness', 'sessions.jsonl') }))
    .filter((f) => fs.existsSync(f.file));
}

export function loadRecords(file = null) {
  const sources = file ? [{ repo: path.basename(path.dirname(path.dirname(file))), file }] : telemetryFiles();
  return sources.flatMap((s) => readRecords(s.file).map((r) => ({ ...r, repo: s.repo })));
}

function readRecords(file) {
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter((r) => r && r.agent);
}

/**
 * Groups agent completions into sessions and infers how far each one got.
 *
 * Inference, not record: the telemetry hook sees agents starting and stopping,
 * not phases being approved. A session that invoked azure-devops delivered; one
 * that reached reviewer and stopped was judged and not shipped; one that never
 * reached reviewer was abandoned before anything verified it. Those three are
 * what the data actually supports, and nothing here should claim more.
 */
export function groupSessions(records) {
  const sessions = new Map();
  for (const record of records) {
    // A run with no session id cannot be attributed; fusing it into one bucket
    // would fabricate a session that spans days. It is counted, not grouped.
    if (!record.session) continue;
    const id = `${record.repo ?? ''}:${record.session}`;
    if (!sessions.has(id)) sessions.set(id, { id, agents: [], first: record.at, last: record.at });
    const session = sessions.get(id);
    session.agents.push(record);
    if (record.at < session.first) session.first = record.at;
    if (record.at > session.last) session.last = record.at;
  }

  return [...sessions.values()].map((session) => {
    const names = new Set(session.agents.map((a) => a.agent));
    const phases = [...names].map((n) => PHASE_AGENT[n]).filter(Boolean);
    const phaseAgents = [...names].filter((n) => PHASE_AGENT[n]);
    const onlyJudges = phaseAgents.length > 0 && phaseAgents.every((n) => n === 'reviewer' || n === 'security');
    const onlyDelivery = phaseAgents.length === 1 && phaseAgents[0] === 'azure-devops';
    const outcome = onlyJudges
      ? 'standalone review'
      : onlyDelivery
        ? 'standalone delivery'
        : names.has('azure-devops')
      ? 'delivered'
      : names.has('reviewer') || names.has('security')
        ? 'reviewed, not delivered'
        : 'stopped before review';

    return {
      ...session,
      names: [...names],
      phases: [...new Set(phases)],
      outcome,
      durationMs: session.agents.reduce((sum, a) => sum + (a.durationMs ?? 0), 0),
      tokens: session.agents.reduce((sum, a) => sum + (a.tokens ?? 0), 0),
      track: guessTrack([...new Set(phases)]),
    };
  });
}

/** The narrowest track whose phases contain everything this session ran. */
function guessTrack(phases) {
  if (phases.length === 0) return null;
  const candidates = Object.entries(SESSION_TRACKS)
    .filter(([, t]) => phases.every((p) => t.phases.includes(p)))
    .sort((a, b) => a[1].phases.length - b[1].phases.length);
  return candidates[0]?.[0] ?? null;
}

export function byAgent(records) {
  const agents = new Map();
  for (const record of records) {
    if (!agents.has(record.agent)) agents.set(record.agent, { agent: record.agent, runs: 0, durations: [], tokens: 0 });
    const entry = agents.get(record.agent);
    entry.runs += 1;
    if (record.durationMs !== null && record.durationMs !== undefined) entry.durations.push(record.durationMs);
    entry.tokens += record.tokens ?? 0;
  }
  return [...agents.values()].map((a) => ({
    ...a,
    medianMs: median(a.durations),
    totalMs: a.durations.reduce((s, d) => s + d, 0),
  }));
}

export function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

export const formatMs = (ms) =>
  ms === null || ms === undefined ? '-' : ms < 1000 ? `${ms}ms` : ms < 60000 ? `${(ms / 1000).toFixed(1)}s` : `${(ms / 60000).toFixed(1)}m`;

export const unattributed = (records) => records.filter((r) => !r.session).length;
