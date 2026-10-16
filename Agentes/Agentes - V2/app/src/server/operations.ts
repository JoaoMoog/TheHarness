import { performance } from 'node:perf_hooks';
import type { Actor } from '@/core/types';
import { db } from './store';
import { governanceDb, resolveWorkspace } from './workspaces';

const started = Date.now();
const requests: { at: number; duration: number; status: number }[] = [];
/** Bounded process-local counters. No URL, prompt, user data, or token is retained. */
export function recordRequest(durationMs: number, status: number) {
  requests.push({ at: Date.now(), duration: Math.max(0, durationMs), status });
  if (requests.length > 2000) requests.splice(0, requests.length - 2000);
}
export function readiness() {
  const begin = performance.now();
  try {
    const result = db().prepare('SELECT 1 AS ok').get();
    if (result?.ok !== 1) throw new Error('database');
    return { status: 'ok' as const, app: 'prometeu', database: 'ready', checkedAt: new Date().toISOString(), latencyMs: Math.round(performance.now() - begin) };
  } catch {
    return { status: 'unavailable' as const, app: 'prometeu', database: 'unavailable', checkedAt: new Date().toISOString() };
  }
}
export function workspaceOperations(actor: Actor, workspaceId: string) {
  resolveWorkspace(actor, workspaceId, 'admin');
  const counts = db().prepare('SELECT kind,COUNT(*) AS count,SUM(length(data)) AS bytes FROM resources WHERE owner=? GROUP BY kind').all(workspaceId);
  const recent = requests.filter(request => request.at >= Date.now() - 15 * 60000);
  const durations = recent.map(request => request.duration).sort((a, b) => a - b);
  return {
    health: readiness(), resources: counts, uptimeSeconds: Math.floor((Date.now() - started) / 1000),
    processWindow: { minutes: 15, sampledRequests: recent.length, maxSamples: 2000, errors: recent.filter(request => request.status >= 500).length,
      p95Ms: durations.length ? Math.round(durations[Math.max(0, Math.ceil(durations.length * .95) - 1)]) : null },
    auditEvents: Number(governanceDb().prepare('SELECT COUNT(*) AS n FROM audit_events WHERE workspace=?').get(workspaceId)!.n),
    notes: 'As métricas de requisições são do processo atual, limitadas aos últimos 2 mil eventos e 15 minutos. Reiniciar zera essa janela. Recursos e auditoria são deste espaço.',
  };
}
