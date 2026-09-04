import fs from 'node:fs';
import path from 'node:path';
import { loadRecords, groupSessions, byAgent, formatMs } from '../lib/telemetry.mjs';
import { parseFrontmatter } from '../lib/frontmatter.mjs';
import { harnessPath } from '../lib/paths.mjs';
import { log, c } from '../lib/log.mjs';

/**
 * Loop 4, run locally: read what actually happened and propose changes to the
 * harness itself.
 *
 * It reports and never edits. A loop that rewrites its own rules without a human
 * reading the diff is how a mistake in the telemetry becomes a permanent change
 * to the constitution.
 */

const NEAR_ZERO_MS = 1500;
const REWORK_THRESHOLD = 3;

/** Internal agents only: a user-invocable one may run as the parent, which the
 *  SubagentStop hook never sees, so its absence from telemetry proves nothing. */
function internalAgents() {
  const root = harnessPath('core/agents');
  if (!fs.existsSync(root)) return [];
  return fs
    .readdirSync(root)
    .filter((f) => f.endsWith('.agent.md'))
    .filter((f) => parseFrontmatter(fs.readFileSync(path.join(root, f), 'utf8')).data['user-invocable'] !== true)
    .map((f) => f.replace('.agent.md', ''));
}

export default function improve(args) {
  const records = loadRecords(args.file ?? null);

  if (records.length === 0) {
    log.title('Harness improvement');
    log.warn('No telemetry yet, so there is nothing to learn from.');
    log.info('Sessions are recorded by the SubagentStop hook once the harness is linked.');
    return 0;
  }

  const sessions = groupSessions(records);
  const agents = byAgent(records);
  const seen = new Set(agents.map((a) => a.agent));
  const findings = [];

  // An agent that exists and is never reached is either dead or unroutable.
  for (const declared of internalAgents()) {
    if (!seen.has(declared)) {
      findings.push({
        kind: 'unused agent',
        subject: declared,
        detail: `declared in core/agents but never invoked across ${sessions.length} session(s)`,
        question: 'Is the routing failing to reach it, or does it not need to exist?',
      });
    }
  }

  // An agent that returns instantly is usually refusing, not working.
  for (const agent of agents) {
    if (agent.medianMs !== null && agent.medianMs < NEAR_ZERO_MS && agent.runs >= 3) {
      findings.push({
        kind: 'agent returns instantly',
        subject: agent.agent,
        detail: `${agent.runs} runs, median ${formatMs(agent.medianMs)}`,
        question: 'Is it escalating on entry? Its scope or its input contract is probably wrong.',
      });
    }
  }

  // Where sessions die tells you which phase contract is failing.
  const deaths = new Map();
  for (const session of sessions.filter((s) => s.outcome === 'stopped before review')) {
    const last = session.agents.slice().sort((a, b) => String(a.at).localeCompare(String(b.at))).at(-1);
    if (last) deaths.set(last.agent, (deaths.get(last.agent) ?? 0) + 1);
  }
  for (const [agent, count] of deaths) {
    if (count >= 2) {
      findings.push({
        kind: 'sessions die here',
        subject: agent,
        detail: `${count} session(s) stopped after ${agent} and never reached review`,
        question: 'Either the phase before hands over something unusable, or the escalation rules are too broad.',
      });
    }
  }

  // The same agent several times in one session is a retry inside a phase.
  for (const session of sessions) {
    const counts = new Map();
    for (const record of session.agents) counts.set(record.agent, (counts.get(record.agent) ?? 0) + 1);
    for (const [agent, count] of counts) {
      if (count >= REWORK_THRESHOLD) {
        findings.push({
          kind: 'retries inside a phase',
          subject: `${agent} in ${session.id}`,
          detail: `invoked ${count} times in one session`,
          question: 'The verify loop is not converging. Its stop criterion or the task size is wrong.',
        });
      }
    }
  }

  // A track that never ships is a track nobody should be choosing.
  const tracks = new Map();
  for (const session of sessions) {
    const key = session.track ?? 'unknown';
    if (!tracks.has(key)) tracks.set(key, { runs: 0, delivered: 0 });
    tracks.get(key).runs += 1;
    if (session.outcome === 'delivered') tracks.get(key).delivered += 1;
  }
  for (const [name, entry] of tracks) {
    if (entry.runs >= 3 && entry.delivered === 0 && name !== 'spike') {
      findings.push({
        kind: 'track never ships',
        subject: name,
        detail: `${entry.runs} runs, none delivered`,
        question: 'Either the selection criteria send the wrong work here, or its phases are missing something.',
      });
    }
  }

  log.title('Harness improvement');
  log.plain(`  Read ${records.length} agent run(s) across ${sessions.length} session(s).\n`);

  if (findings.length === 0) {
    log.ok('Nothing stands out in the telemetry.');
  } else {
    for (const finding of findings) {
      log.plain(`  ${c.yellow(finding.kind)}: ${c.bold(finding.subject)}`);
      log.plain(`    ${finding.detail}`);
      log.plain(`    ${c.dim(finding.question)}\n`);
    }
  }

  log.title('What this cannot see');
  log.plain(`  ${c.dim('Which skills were loaded: no hook fires on a skill match.')}`);
  log.plain(`  ${c.dim('Whether a human approved a gate: the hook sees agents stop, not clicks.')}`);
  log.plain(`  ${c.dim('Token cost per phase, unless the runtime reports usage on SubagentStop.')}`);
  log.plain(`  ${c.dim('Every finding above is a question to investigate, not a conclusion.')}`);

  log.plain(`\n  ${c.dim('This command never edits anything.')}`);

  if (args.json) log.plain(`\n${JSON.stringify({ findings, sessions: sessions.length }, null, 2)}`);
  return 0;
}
