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
