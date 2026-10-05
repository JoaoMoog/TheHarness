import { getState, update } from "./store.js";

const TIMEOUT_MS = 20_000;

async function request(path, { method = "GET", body } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(path, {
      method,
      headers: body ? { "content-type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? `Erro ${res.status}`);
    return data;
  } finally {
    clearTimeout(timer);
  }
}

export function toast(text, tone = "info") {
  update((s) => {
    s.ui.toast = { text, tone, id: Date.now() };
  });
}

/**
 * Runs a Jev judgment through the server. Returns null when Aval IA is off or
 * the call fails, so every screen keeps working without the AI reading.
 */
export async function judge(name, input, busyKey = name) {
  if (!getState().settings.aiEnabled) return null;
  update((s) => {
    s.ui.busy[busyKey] = true;
  });
  try {
    const result = await request(`/judge/${name}`, { method: "POST", body: input });
    update((s) => {
      s.judgmentLog.unshift({ name, routing: result.routing, confidence: result.confidence, escalateTo: result.escalateTo, queueId: result.queueId, at: new Date().toISOString() });
    });
    return result;
  } catch (error) {
    toast(`Aval IA indisponível agora (${error.message}). Siga sem a leitura.`, "warn");
    return null;
  } finally {
    update((s) => {
      delete s.ui.busy[busyKey];
    });
  }
}

export const fetchQueue = () => request("/queue");
export const fetchPolicy = () => request("/policy");
export const resolveQueueItem = (id, decision) => request(`/queue/${encodeURIComponent(id)}/resolve`, { method: "POST", body: { decision } });
export const health = () => request("/health");
