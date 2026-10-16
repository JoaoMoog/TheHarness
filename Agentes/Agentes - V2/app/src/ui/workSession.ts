import { workSchema, type WorkSession } from '@/core/work';
export type { WorkSession } from '@/core/work';
const memory = new Map<string, WorkSession>();
const key = (owner: string) => `clara:work:${owner}`;

export function readWork(owner: string): WorkSession | null {
  const cached = memory.get(owner);
  if (cached) return cached;
  try {
    const raw = sessionStorage.getItem(key(owner));
    if (!raw) return memory.get(owner) || null;
    const result = workSchema.safeParse(JSON.parse(raw));
    return result.success && result.data.owner === owner ? result.data : null;
  } catch { return memory.get(owner) || null; }
}

export function writeWork(owner: string, work: WorkSession | null) {
  if (work && work.owner !== owner) return;
  if (work) memory.set(owner, work); else memory.delete(owner);
  try {
    if (work) sessionStorage.setItem(key(owner), JSON.stringify(work));
    else sessionStorage.removeItem(key(owner));
  } catch { /* Navigation still preserves work when browser storage is unavailable. */ }
}
