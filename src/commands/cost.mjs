import { loadRecords, groupSessions, byAgent, formatMs, unattributed, telemetryFiles } from '../lib/telemetry.mjs';
import { log, c } from '../lib/log.mjs';

/**
 * Cost per outcome, not per token.
 *
 * A model that costs twice as much per token but needs half the retries is
 * cheaper per delivered result, and a report that only totals tokens cannot
 * show that. So this counts sessions by how far they got, and puts the spend
 * next to it.
 */
export default function cost(args) {
  const records = loadRecords(args.file ?? null);

  if (records.length === 0) {
    log.title('Cost per outcome');
    log.warn('No telemetry yet.');
    log.info('The SubagentStop hook writes .harness/sessions.jsonl inside each linked repository.');
    log.info('Run a session in a repository where the harness is linked, then come back.');
    return 0;
  }

  const sessions = groupSessions(records);
  const delivered = sessions.filter((s) => s.outcome === 'delivered');
  const reviewed = sessions.filter((s) => s.outcome === 'reviewed, not delivered');
  const stopped = sessions.filter((s) => s.outcome === 'stopped before review');

  const totalMs = sessions.reduce((sum, s) => sum + s.durationMs, 0);
  const totalTokens = sessions.reduce((sum, s) => sum + s.tokens, 0);
  const share = (n) => (sessions.length ? `${Math.round((n / sessions.length) * 100)}%` : '0%');

  log.title('Cost per outcome');
  log.info(`${telemetryFiles().length} repositor${telemetryFiles().length === 1 ? 'y' : 'ies'} with telemetry, ${unattributed(records)} run(s) with no session id (counted, not grouped)`);
  log.plain(`  ${String(sessions.length).padStart(4)}  sessions`);
  log.plain(`  ${c.green(String(delivered.length).padStart(4))}  delivered            ${share(delivered.length)}`);
  log.plain(`  ${c.yellow(String(reviewed.length).padStart(4))}  reviewed, not shipped ${share(reviewed.length)}`);
  log.plain(`  ${c.red(String(stopped.length).padStart(4))}  stopped before review ${share(stopped.length)}`);

  if (delivered.length > 0) {
    const perOutcome = Math.round(totalMs / delivered.length);
    log.plain('');
    log.plain(`  agent time per delivered outcome: ${formatMs(perOutcome)}`);
    if (totalTokens > 0) {
      log.plain(`  tokens per delivered outcome:     ${Math.round(totalTokens / delivered.length)}`);
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
    if (!tracks.has(key)) tracks.set(key, { runs: 0, delivered: 0, ms: 0 });
    const entry = tracks.get(key);
    entry.runs += 1;
    entry.ms += session.durationMs;
    if (session.outcome === 'delivered') entry.delivered += 1;
  }

  log.title('By track');
  log.plain(`  ${'track'.padEnd(10)}${'runs'.padStart(6)}${'shipped'.padStart(9)}${'agent time'.padStart(12)}`);
  for (const [name, entry] of [...tracks.entries()].sort((a, b) => b[1].runs - a[1].runs)) {
    log.plain(
      `  ${name.padEnd(10)}${String(entry.runs).padStart(6)}${String(entry.delivered).padStart(9)}${formatMs(entry.ms).padStart(12)}`
    );
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
