// Shared action registry. Each domain module adds its handlers to `actions`.
import { resolveQueueItem, toast } from "../api.js";

export const actions = {};
export const go = (hash) => {
  location.hash = hash;
};
export const ok = (text) => toast(text, "pos");
export const warn = (text) => toast(text, "warn");

/** Closes a low-confidence reading on the server queue; failures are reported, never swallowed. */
export async function resolveOnServer(queueId, decision) {
  if (!queueId) return;
  try {
    await resolveQueueItem(queueId, decision);
  } catch (error) {
    warn(`Não deu para fechar ${queueId}: ${error.message}`);
  }
}
