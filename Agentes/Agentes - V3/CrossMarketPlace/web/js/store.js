// Demo state shared by every screen. Updates are immutable: a recipe edits a copy, never the current state.
import { buildInitialState } from "./seed/index.js";

const STORAGE_KEY = "cmp-demo-v1";
const listeners = new Set();

function load() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.version === 1 ? parsed : null;
  } catch {
    return null;
  }
}

function persist(next) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage can be blocked (private mode); the demo keeps working in memory.
  }
}

let state = load() ?? buildInitialState();

export const getState = () => state;
export const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

/** Applies a recipe to a deep copy of the state. Throws if the recipe throws, leaving the state untouched. */
export function update(recipe, { silent = false } = {}) {
  const next = structuredClone(state);
  recipe(next);
  state = next;
  persist(state);
  if (!silent) listeners.forEach((fn) => fn(state));
}

/** Next unique id for records created during the session. */
export function nextId(prefix) {
  let id = "";
  update((s) => { s.seq += 1; id = `${prefix}-${s.seq}`; }, { silent: true });
  return id;
}

export function resetDemo() {
  state = buildInitialState();
  persist(state);
  listeners.forEach((fn) => fn(state));
}
