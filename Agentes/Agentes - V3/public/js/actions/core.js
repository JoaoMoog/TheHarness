// Shared action registry. Each domain module adds its handlers to `actions`.
import { update } from "../store.js";

export const actions = {};
export const go = (hash) => {
  location.hash = hash;
};
/** Short message at the bottom of the screen. */
export function toast(text, tone = "info") {
  update((s) => {
    s.ui.toast = { text, tone, id: Date.now() };
  });
}
export const ok = (text) => toast(text, "pos");
export const warn = (text) => toast(text, "warn");
export function fieldError(bind, text) {
  update((s) => { s.ui.errors = { [bind]: text }; });
  document.querySelector(`[data-bind="${CSS.escape(bind)}"], [data-local="${CSS.escape(bind)}"]`)?.focus();
  document.querySelector(`[data-bind="${CSS.escape(bind)}"], [data-local="${CSS.escape(bind)}"]`)?.scrollIntoView({ block: "center" });
}
