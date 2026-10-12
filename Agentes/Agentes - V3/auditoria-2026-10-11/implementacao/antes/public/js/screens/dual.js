// Two phones side by side for the presentation: the person acting (left) and the other side of the same payment
// (right), live and read-only. "Usar este celular" swaps them; the guide swaps them by itself when the scene changes.
import { actions as A, go } from "../actions/core.js";
import { PEOPLE, SELF, canSee, contractById, getState, update } from "../store.js";
import { esc, icon } from "../ui.js";
import { waColumn } from "./whatsapp.js";

const MODE = { carlos: "prestador", marina: "contratante", [SELF]: "contratante" };
const COUNTERPART = { [SELF]: "carlos", carlos: SELF, marina: SELF };
/** Routes that name a payment; the other side sees the same payment from their side. */
const CONTRACT_ROUTE = /^(?:servico|pagar|pago|coletivo|comprovante|entrega|antecipar|antecipado|dividir-pagamento)\/([^/]+)/;

export const dualOn = (s) => s.ui.dual !== false && s.session.person !== "banco";
const registered = (s, who) => who !== SELF || Boolean(s.people?.[SELF]);
const firstName = (s, who) => (who === SELF ? s.people?.[SELF]?.first ?? "Cliente" : PEOPLE[who]?.first ?? who);

/** Who shows on the right phone: the person who acted before, or the usual other side. */
export function secondPerson(s) {
  const watch = s.ui.watch;
  if (watch && watch !== s.session.person && watch !== "banco") return watch;
  const p = s.ui.second;
  return p && p !== s.session.person && p !== "banco" ? p : COUNTERPART[s.session.person] ?? SELF;
}

/** The state as the other person sees it: their session, no sheet or toast of the person acting. */
export const asPerson = (s, who) => ({
  ...s, session: { person: who, mode: MODE[who] ?? "contratante", loggedIn: registered(s, who) }, ui: { ...s.ui, sheet: null, toast: null },
});

/** Where the other side looks now: the same payment, the link they received, the screen of what they sent, or home. */
export function secondPath(s, mainPath, who) {
  const s2 = asPerson(s, who);
  const ofContract = (id) => (canSee(contractById(s, id), s2) ? `servico/${id}` : null);
  const home = registered(s, who) ? "inicio" : "entrada";
  const byContract = mainPath.match(CONTRACT_ROUTE);
  if (byContract) return ofContract(byContract[1]) ?? home;
  const token = mainPath.match(/^(?:p|etapas)\/([^/]+)/)?.[1];
  const sentId = mainPath.match(/^combinado\/enviado\/([^/]+)/)?.[1];
  const inv = s.invites.find((i) => (token && i.token === token) || (sentId && i.id === sentId));
  if (inv) {
    if (inv.contractId) return ofContract(inv.contractId) ?? home;
    return inv.createdBy === who ? `combinado/enviado/${inv.id}` : `p/${inv.token}`;
  }
  const dispute = mainPath.match(/^disputa\/([A-Z]+-\d+)/)?.[1];
  if (dispute) return `disputa/${dispute}`;
  const share = mainPath.match(/^dividir\/([^/]+)/)?.[1];
  const holder = share && s.contracts.find((c) => c.participants?.some((p) => p.token === share));
  if (holder) return ofContract(holder.id) ?? home;
  return home;
}

/** Each person keeps their half of the screen; the halves only change people when someone new enters the scene. */
let sides = [SELF, "carlos"];
let lastActing = null;
let actingSince = 0;
let lastSecond = { who: null, html: "" };
let updatedAt = 0;
const BECAME_MS = 1400;
const UPDATED_MS = 2600;

function placeSides(acting, other) {
  if (sides.includes(acting) && sides.includes(other)) return sides;
  if (sides.includes(acting)) return sides.map((w) => (w === acting ? w : other));
  if (sides.includes(other)) return sides.map((w) => (w === other ? w : acting));
  return [acting, other];
}

/**
 * A phone shrunk to fit its half with a transform inside a box of the scaled size (not CSS zoom), so every browser
 * reports the same positions for what is inside it and the presentation cursor lands on the right spot.
 */
export const fit = (device) => `<div class="device-fit">${device}</div>`;

/** An animation that survives re-renders: it restarts on the new element already advanced by the time elapsed. */
const running = (since, ms) => {
  const elapsed = Date.now() - since;
  return elapsed < ms ? ` style="--since:-${elapsed}ms"` : null;
};

const label = (s, who, main, updated) =>
  `<div class="phone-label ${main ? "main" : ""}">${main ? `<span class="live-dot" aria-hidden="true"></span>` : icon("eye")}<span class="phone-who">${esc(firstName(s, who))}</span>`
  + `${updated ? `<small class="phone-updated">${icon("bell")}Atualizou agora</small>` : `<small>${main ? "agindo agora" : "vê ao mesmo tempo"}</small>`}`
  + `${main ? "" : `<button type="button" class="dual-swap" data-action="dualSwap">${icon("arrows-left-right")}Usar este celular</button>`}</div>`;

/**
 * The screen split in half: the phone of the person acting (highlighted) and the other side of the same payment,
 * live and read-only, which flashes when something reaches it.
 */
export function dualStage(s, phone, mainPath, match) {
  const acting = s.session.person;
  const who = secondPerson(s);
  sides = placeSides(acting, who);
  if (acting !== lastActing) { actingSince = lastActing === null ? 0 : Date.now(); lastActing = acting; }
  const route = match(secondPath(s, mainPath, who)) ?? match("inicio");
  const html = route.view(asPerson(s, who), route.params);
  if (who === lastSecond.who && lastSecond.html && html !== lastSecond.html) updatedAt = Date.now();
  if (who !== lastSecond.who) updatedAt = 0;
  lastSecond = { who, html };
  const became = actingSince ? running(actingSince, BECAME_MS) : null;
  const updated = updatedAt ? running(updatedAt, UPDATED_MS) : null;
  const main = `<section class="phone-col acting${became ? " became" : ""}"${became ?? ""} aria-label="Celular de ${esc(firstName(s, acting))}, agindo agora">${label(s, acting, true, false)}${phone}</section>`;
  const second = `<section class="phone-col watching${updated ? " updated" : ""}"${updated ?? ""} aria-label="Celular de ${esc(firstName(s, who))}, só para ver">${label(s, who, false, Boolean(updated))}${fit(`<div class="device second"><div class="device-inner">${html}</div></div>`)}</section>`;
  const wa = waColumn(s, fit);
  return `<div class="dual${wa ? " triple" : ""}">${sides[0] === acting ? main + second : second + main}${wa}</div>`;
}

A.dualSwap = () => {
  const s0 = getState();
  const who = secondPerson(s0);
  const path = secondPath(s0, location.hash.replace(/^#\/?/, "") || "inicio", who);
  update((s) => {
    s.ui.second = s.session.person;
    s.session = { person: who, mode: MODE[who] ?? "contratante", loggedIn: registered(s, who) };
    s.ui.sheet = null;
  });
  go(`#/${path}`);
};
A.toggleDual = () => update((s) => { s.ui.dual = s.ui.dual === false; });
