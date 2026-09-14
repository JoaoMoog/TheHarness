import { loadRecords, groupSessions, byAgent, formatMs, formatKb, unattributed, usageTotals, telemetryFiles } from '../lib/telemetry.mjs';
import { log, c } from '../lib/log.mjs';

/**
 * Cost per outcome, not per token.
 *
 * A model that costs twice as much per token but needs half the retries is
 * cheaper per delivered result, and a report that only totals tokens cannot
 * show that. So this counts sessions by how far they got, and puts the spend
 * next to it.
 *
 * The runtime does not report tokens, so the spend is what the hooks can
 * count and what drives a token bill: prompts, tool calls (each one resends
 * the context), sub-agents (each one opens another context), and the bytes
 * the tools returned (resent on every call after). Fewer of each is the
 * saving; the credits themselves are read in the editor.
 */
export default function cost(args) {
  const records = loadRecords(args.file ?? null);

  if (records.length === 0) {
    log.title('Cost per outcome');
    log.warn('No telemetry yet.');
    log.info('The hooks write .harness/sessions.jsonl inside each linked repository: a line per sub-agent, a usage line per session.');
    log.info('Run a session in a repository where the harness is linked, then come back.');
    return 0;
  }

  const sessions = groupSessions(records);
  const delivered = sessions.filter((s) => s.outcome === 'delivered');
  const reviewed = sessions.filter((s) => s.outcome === 'reviewed, not delivered');
  const stopped = sessions.filter((s) => s.outcome === 'stopped before review');
  const direct = sessions.filter((s) => s.outcome === 'direct');

  const totalMs = sessions.reduce((sum, s) => sum + s.durationMs, 0);
  const totalTokens = sessions.reduce((sum, s) => sum + s.tokens, 0);
  const share = (n) => (sessions.length ? `${Math.round((n / sessions.length) * 100)}%` : '0%');

  log.title('Cost per outcome');
  log.info(`${telemetryFiles().length} repositor${telemetryFiles().length === 1 ? 'y' : 'ies'} with telemetry, ${unattributed(records)} run(s) with no session id (counted, not grouped)`);
  log.plain(`  ${String(sessions.length).padStart(4)}  sessions`);
  log.plain(`  ${c.green(String(delivered.length).padStart(4))}  delivered            ${share(delivered.length)}`);
  log.plain(`  ${c.yellow(String(reviewed.length).padStart(4))}  reviewed, not shipped ${share(reviewed.length)}`);
  log.plain(`  ${c.red(String(stopped.length).padStart(4))}  stopped before review ${share(stopped.length)}`);
  log.plain(`  ${String(direct.length).padStart(4)}  direct, no sub-agent  ${share(direct.length)}`);

  if (delivered.length > 0) {
    const perOutcome = Math.round(totalMs / delivered.length);
    const usage = usageTotals(sessions);
    log.plain('');
    log.plain(`  agent time per delivered outcome: ${formatMs(perOutcome)}`);
    if (totalTokens > 0) {
      log.plain(`  tokens per delivered outcome:     ${Math.round(totalTokens / delivered.length)}`);
    }
    if (usage.lines > 0) {
      log.plain(`  tool calls per delivered outcome: ${Math.round(usage.toolCalls / delivered.length)}`);
      log.plain(`  tool output per delivered outcome: ${formatKb(Math.round(usage.toolOutputBytes / delivered.length))}`);
    }
    log.plain(
      `  ${c.dim('Total agent time divided by outcomes that shipped. Work that stopped short is')}`
    );
    log.plain(`  ${c.dim('part of the cost of the ones that did not, which is the point of the number.')}`);
  } else {
    log.plain('');
    log.warn('Nothing delivered yet, so there is no cost per outcome to report.');
  }

  const tracks = new Map();
  for (const session of sessions) {
    const key = session.track ?? 'unknown';
    if (!tracks.has(key)) tracks.set(key, { runs: 0, delivered: 0, ms: 0, sessions: [] });
    const entry = tracks.get(key);
    entry.runs += 1;
    entry.ms += session.durationMs;
    entry.sessions.push(session);
    if (session.outcome === 'delivered') entry.delivered += 1;
  }

  log.title('By track');
  log.plain(`  ${'track'.padEnd(10)}${'runs'.padStart(6)}${'shipped'.padStart(9)}${'agent time'.padStart(12)}`);
  for (const [name, entry] of [...tracks.entries()].sort((a, b) => b[1].runs - a[1].runs)) {
    log.plain(
      `  ${name.padEnd(10)}${String(entry.runs).padStart(6)}${String(entry.delivered).padStart(9)}${formatMs(entry.ms).padStart(12)}`
    );
  }

  // What each track makes the model pay for, per session: the counters that
  // drive a token bill, averaged over the sessions that reported them.
  const measured = [...tracks.entries()].filter(([, entry]) => usageTotals(entry.sessions).lines > 0);
  if (measured.length > 0) {
    log.title('By usage, per session');
    log.plain(
      `  ${'track'.padEnd(10)}${'prompts'.padStart(9)}${'tool calls'.padStart(12)}${'cross tk'.padStart(10)}${'rewrites'.padStart(10)}${'sub-agents'.padStart(12)}${'tool output'.padStart(13)}`
    );
    for (const [name, entry] of measured.sort((a, b) => b[1].runs - a[1].runs)) {
      const usage = usageTotals(entry.sessions);
      const per = (n) => String(Math.round(n / usage.lines)).padStart(0);
      log.plain(
        `  ${name.padEnd(10)}${per(usage.prompts).padStart(9)}${per(usage.toolCalls).padStart(12)}${per(usage.crossTk).padStart(10)}${per(usage.rewrites).padStart(10)}${per(usage.subagents).padStart(12)}${formatKb(Math.round(usage.toolOutputBytes / usage.lines)).padStart(13)}`
      );
    }
    log.plain(`  ${c.dim('Every tool call resends the context and every sub-agent opens another one; tool output is')}`);
    log.plain(`  ${c.dim('resent on every call after it. Rewrites are commands routed through crosstk run by the hook.')}`);
  }

  log.title('By agent');
  const agents = byAgent(records).sort((a, b) => b.totalMs - a.totalMs);
  log.plain(`  ${'agent'.padEnd(16)}${'runs'.padStart(6)}${'median'.padStart(10)}${'total'.padStart(10)}`);
  for (const agent of agents) {
    log.plain(
      `  ${agent.agent.padEnd(16)}${String(agent.runs).padStart(6)}${formatMs(agent.medianMs).padStart(10)}${formatMs(agent.totalMs).padStart(10)}`
    );
  }

  log.plain(
    `\n  ${c.dim('Outcomes are inferred from which agents ran, not from approvals: the hook')}`
  );
  log.plain(`  ${c.dim('sees agents stop, not humans click. Treat the split as a signal, not a ledger.')}`);

  if (args.json) log.plain(`\n${JSON.stringify({ sessions, agents }, null, 2)}`);
  return 0;
}
