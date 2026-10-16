import { VALIDATION } from "./runtime.js";

// A mock never reads or persists the user's account, credentials or application state.
export const MOCK_ID = VALIDATION ? new URLSearchParams(globalThis.location?.search ?? "").get("mock") : null;
const memory = new Map();
export const credentialStorage = MOCK_ID ? {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => memory.set(key, String(value)),
  removeItem: (key) => memory.delete(key),
} : {
  getItem: (key) => globalThis.localStorage.getItem(key),
  setItem: (key, value) => globalThis.localStorage.setItem(key, value),
  removeItem: (key) => globalThis.localStorage.removeItem(key),
};
