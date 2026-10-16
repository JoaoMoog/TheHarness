export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
let activeWorkspace = '';
export function setApiWorkspace(id: string) { activeWorkspace = id; }

export async function api<T>(path: string, options: { method?: string; body?: unknown; signal?: AbortSignal; workspace?: string } = {}): Promise<T> {
  const form = options.body instanceof FormData;
  const response = await fetch(`/api/${path}`, {
    method: options.method || (options.body ? 'POST' : 'GET'), credentials: 'same-origin',
    headers: { ...(options.body && !form ? { 'Content-Type': 'application/json' } : {}), ...((options.workspace ?? activeWorkspace) ? { 'x-clara-workspace': options.workspace ?? activeWorkspace } : {}) },
    body: options.body ? form ? options.body as FormData : JSON.stringify(options.body) : undefined,
    signal: options.signal, cache: 'no-store',
  });
  const data = await response.json();
  if (!response.ok) throw new ApiError(response.status, data.error || 'Não foi possível concluir a ação. Tente novamente.');
  return data as T;
}
