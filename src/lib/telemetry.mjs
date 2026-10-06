import fs from 'node:fs';
import path from 'node:path';
import { harnessPath } from './paths.mjs';
import { loadLock } from './lock.mjs';
export const SESSIONS_FILE = harnessPath('.harness', 'sessions.jsonl');
export function telemetryFiles() {
  return [...new Set([harnessPath('.'), ...Object.values(loadLock().repos ?? {}).map(e => e.dir)])]
    .map(dir => ({ repo: path.basename(dir), file: path.join(dir, '.harness/sessions.jsonl') })).filter(e => fs.existsSync(e.file));
}
export function loadRecords(file = null) {
  return (file ? [{repo: path.basename(path.dirname(path.dirname(file))), file}] : telemetryFiles()).flatMap(s => {
    if (!fs.existsSync(s.file)) return [];
    return fs.readFileSync(s.file, 'utf8').split(/\r?\n/).flatMap(line => {
      try { const r = JSON.parse(line); return r && (r.event || r.agent) ? [{...r, repo:s.repo}] : []; } catch { return []; }
    });
  });
}
export const USAGE_KEYS = ['prompts','toolCalls','crossTk','rewrites','subagents','toolOutputBytes'];
export const emptyUsage = () => Object.fromEntries([...USAGE_KEYS.map(k => [k,0]), ['lines',0]]);
export function addUsage(total, r) { for (const k of USAGE_KEYS) total[k] += Number(r[k] ?? 0) || 0; total.lines++; return total; }
const sumAvailable = values => values.length && values.every(v => Number.isFinite(v)) ? values.reduce((a,b) => a+b,0) : null;
// Outcomes must be explicit. A tool or reviewer invocation never proves success.
export function groupSessions(records) {
  const grouped = new Map();
  for (const r of records) {
    if (!r.session) continue;
    const id = (r.repo ?? '') + ':' + r.session;
    if (!grouped.has(id)) grouped.set(id, []);
    grouped.get(id).push(r);
  }
  return [...grouped].map(([id, rows]) => {
    rows.sort((a,b) => String(a.at).localeCompare(String(b.at)));
    const agents = rows.filter(r => r.agent), usage = emptyUsage();
    const usageRows = rows.filter(r => r.event === 'usage');
    usageRows.forEach(r => addUsage(usage,r));
    const outcome = rows.filter(r => r.event === 'outcome').at(-1);
    const started = rows.find(r => r.event === 'session-start');
    const end = outcome?.at;
    const provider = rows.filter(r => r.event === 'provider-usage').at(-1);
    const names = [...new Set(agents.map(a => a.agent))];
    return {id, agents, usage, names, first: rows[0].at, last: rows.at(-1).at,
      outcome: outcome?.status ?? 'unknown', evidence: outcome?.evidence ?? [], reason: outcome?.reason ?? null,
      track: outcome?.track ?? 'unknown',
      phases: [...new Set(names.map(n => ({planner:'plan',implementer:'implement',reviewer:'review',security:'review'})[n]).filter(Boolean))],
      durationMs: started && end ? Math.max(0, Date.parse(end)-Date.parse(started.at)) : null,
      agentDurationMs: sumAvailable(agents.map(a => a.durationMs)),
      approvalWaitMs: sumAvailable(rows.filter(r => r.event === 'approval-wait').map(r => r.durationMs)),
      hookDurationMs: sumAvailable(usageRows.map(r => r.hookDurationMs)),
      toolDurationMs: sumAvailable(usageRows.map(r => r.toolDurationMs)),
      tokens: Number.isFinite(provider?.tokens) ? provider.tokens : null,
      tokenMeasurement: Number.isFinite(provider?.tokens) ? 'measured-provider' : 'unavailable',
      estimatedTokens: null};
  });
}
export function usageTotals(sessions) {
  const total = emptyUsage();
  for (const s of sessions) for (const k of USAGE_KEYS) total[k] += s.usage?.[k] ?? 0;
  total.lines = sessions.filter(s => s.usage?.lines > 0).length;
  return total;
}
export function byAgent(records) {
  const groups = new Map();
  for (const r of records.filter(r => r.agent)) {
    if (!groups.has(r.agent)) groups.set(r.agent, []);
    groups.get(r.agent).push(r);
  }
  return [...groups].map(([agent, rows]) => ({agent, runs:rows.length,
    durations:rows.map(r => r.durationMs).filter(Number.isFinite),
    medianMs:median(rows.map(r => r.durationMs).filter(Number.isFinite)),
    totalMs:sumAvailable(rows.map(r => r.durationMs)), tokens:sumAvailable(rows.map(r => r.tokens))}));
}
export function median(values) {
  if (!values.length) return null;
  const sorted=[...values].sort((a,b)=>a-b), mid=Math.floor(sorted.length/2);
  return sorted.length%2 ? sorted[mid] : (sorted[mid-1]+sorted[mid])/2;
}
export const formatMs = ms => ms == null ? 'unavailable' : ms < 1000 ? ms+'ms' : (ms/1000).toFixed(1)+'s';
export const formatKb = bytes => bytes >= 1024 ? Math.round(bytes/1024)+' KB' : bytes+' B';
export const unattributed = records => records.filter(r => r.agent && !r.session).length;
