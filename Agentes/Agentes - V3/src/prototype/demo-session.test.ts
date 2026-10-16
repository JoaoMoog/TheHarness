import assert from "node:assert/strict";
import { it } from "node:test";

// A reload in the middle of the presentation must keep whoever was acting signed in (the demo build only).
const memory = new Map<string, string>();
memory.set("aval-validation-v12", JSON.stringify({
  session: { person: "carlos", mode: "prestador", loggedIn: true },
  ui: { drafts: {}, errors: {} }, contracts: [], accounts: {}, people: {}, invites: [], disputes: [], notifications: [],
}));
Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
  getItem: (k: string) => memory.get(k) ?? null, setItem: (k: string, v: string) => memory.set(k, v), removeItem: (k: string) => memory.delete(k),
} });
// @ts-expect-error Browser module intentionally uses plain JavaScript.
const { getState, update } = await import("../../public/js/store.js");

it("the demo keeps the session across a reload", () => {
  assert.deepEqual(getState().session, { person: "carlos", mode: "prestador", loggedIn: true });
  update((s: { ui: { toast: unknown } }) => { s.ui.toast = null; });
  assert.equal(JSON.parse(memory.get("aval-validation-v12") ?? "{}").session.loggedIn, true);
});
