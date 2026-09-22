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
/** Above these, a session is paying for iterations and tool output rather than for the change. */
const MANY_TOOL_CALLS = 80;
const HEAVY_TOOL_OUTPUT_BYTES = 200 * 1024;

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
  for (const session of sessions.filter((s) => ['failed','blocked'].includes(s.outcome))) {
    const last = session.agents.slice().sort((a, b) => String(a.at).localeCompare(String(b.at))).at(-1);
    if (last) deaths.set(last.agent, (deaths.get(last.agent) ?? 0) + 1);
  }
  for (const [agent, count] of deaths) {
    if (count >= 2) {
      findings.push({
        kind: 'sessions die here',
        subject: agent,
        detail: `${count} session(s) stopped after ${agent} with an explicit failed/blocked result`,
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

  // Tokens are billed per model call and per byte that enters the context,
  // so a session that iterated a hundred times, or read a megabyte of test
  // output, paid for that rather than for the change.
  for (const session of sessions) {
    const usage = session.usage ?? {};
    if ((usage.toolCalls ?? 0) > MANY_TOOL_CALLS) {
      findings.push({
        kind: 'many tool calls',
        subject: session.id,
        detail: `${usage.toolCalls} tool calls, ${usage.subagents ?? 0} sub-agent(s), ${usage.prompts ?? 0} prompt(s); every call resent the context`,
        question: 'Was this a small change that should have stayed in the direct lane, or a verify loop that did not converge?',
      });
    }
    if ((usage.toolOutputBytes ?? 0) > HEAVY_TOOL_OUTPUT_BYTES && (usage.rewrites ?? 0) === 0) {
      findings.push({
        kind: 'heavy tool output',
        subject: session.id,
        detail: `${Math.round(usage.toolOutputBytes / 1024)} KB returned by tools and no command went through crosstk run`,
        question: 'Tests, diffs and listings entered the context whole. Is the crosstk binary on PATH, or the rewrite hook switched off?',
      });
    }
  }

  // A track that never ships is a track nobody should be choosing.
  const tracks = new Map();
  for (const session of sessions) {
    const key = session.track ?? 'unknown';
    if (!tracks.has(key)) tracks.set(key, { runs: 0, validated: 0 });
    tracks.get(key).runs += 1;
    if (session.outcome === 'validated') tracks.get(key).validated += 1;
  }
  for (const [name, entry] of tracks) {
    if (entry.runs >= 3 && entry.validated === 0 && !['spike','unknown'].includes(name)) {
      findings.push({
        kind: 'track has no recorded validation',
        subject: name,
        detail: `${entry.runs} runs, none validated`,
        question: 'Check explicit failures, blockers and missing outcome records before changing routing.',
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
  log.plain(`  ${c.dim('Token cost per phase, unless the runtime reports usage on SubagentStop. Credits are read in the')}`);
  log.plain(`  ${c.dim('editor: hover a response for the turn, the context control for the session, the Status Bar for the month.')}`);
  log.plain(`  ${c.dim('Every finding above is a question to investigate, not a conclusion.')}`);

  log.plain(`\n  ${c.dim('This command never edits anything.')}`);

  if (args.json) log.plain(`\n${JSON.stringify({ findings, sessions: sessions.length }, null, 2)}`);
  return 0;
}
