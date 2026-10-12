// Demo state shared by every profile. Synthetic data only.
import { BASE_DATE, fmtDate, parseDdMm, shiftDate } from "./domain/dates.js";
import { DEFAULTS, PEOPLE, SELF, freshAccount, makeStage, seed } from "./seed.js";
import { VALIDATION } from "./runtime.js";
import { MOCK_ID } from "./mock-context.js";

export { DEFAULTS, PEOPLE, SELF, freshAccount, makeStage, fmtDate, parseDdMm };

const STORAGE_KEY = VALIDATION ? "aval-validation-v12" : "aval-local-v1";
const MONTHLY_CET = Math.pow(1.2905, 1 / 12) - 1;

let state = load() ?? seed();
const listeners = new Set();

function load() {
  if (MOCK_ID) return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const saved = raw ? JSON.parse(raw) : null;
    if (!saved?.session || !saved?.ui || !Array.isArray(saved.contracts) || !saved.accounts || !saved.people) return null;
    // Keep synthetic work across process death, but never restore an authenticated session from disk.
    saved.session.loggedIn = false;
    saved.ui.sheet = null;
    saved.ui.toast = null;
    saved.ui.hideValues = true;
    saved.ui.second = undefined;
    saved.ui.dual = false;
    return saved;
  } catch {
    return null;
  }
}

function persist() {
  if (MOCK_ID) return;
  try {
    const saved = structuredClone(state);
    saved.session.loggedIn = false;
    saved.ui.sheet = null;
    saved.ui.toast = null;
    saved.ui.second = undefined;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  } catch {
    // Storage may be blocked; the demo still works in memory.
  }
}

export const getState = () => state;
export const subscribe = (fn) => listeners.add(fn);

/** Applies a recipe to a copy of the state, so the previous state is never changed. */
export function update(recipe, { silent = false } = {}) {
  const next = structuredClone(state);
  recipe(next);
  state = next;
  persist();
  if (!silent) listeners.forEach((fn) => fn(state));
}

export function reset() {
  state = seed();
  persist();
  listeners.forEach((fn) => fn(state));
}

function setPath(obj, path, value) {
  const keys = path.split(".");
  let cur = obj;
  keys.slice(0, -1).forEach((k, i) => {
    if (cur[k] == null) cur[k] = /^\d+$/.test(keys[i + 1]) ? [] : {};
    cur = cur[k];
  });
  cur[keys.at(-1)] = value;
}

export const getPath = (obj, path) => path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
export const draft = (path, fallback) => getPath(state.ui.drafts, path) ?? fallback ?? DEFAULTS[path];
export const setDraft = (path, value, silent = true) => update((s) => setPath(s.ui.drafts, path, value), { silent });

// Demo clock: every date in the app moves with it
export const now = (s = state) => VALIDATION ? shiftDate(BASE_DATE, s.clock?.offsetDays ?? 0) : new Date();
export const today = () => fmtDate(now());
export const addDays = (days) => fmtDate(shiftDate(now(), days));
export const isDue = (ddmm, s = state) => parseDdMm(ddmm).getTime() <= now(s).getTime();

// Identity: one person, two modes (hiring and providing), plus the bank console
const asState = (s) => (s && typeof s === "object" && s.session ? s : state);
/** The fixed people (Marina, Carlos) plus whoever signed up in this presentation. */
export const peopleOf = (s = state) => ({ ...PEOPLE, ...(asState(s).people ?? {}) });
export const person = (s = state) => peopleOf(s)[asState(s).session.person] ?? null;
export const role = (s = state) => (asState(s).session.person === "banco" ? "banco" : asState(s).session.mode);
export const account = (s = state, id = asState(s).session.person) => asState(s).accounts[id] ?? null;
/** What is still free on the person's BTG credit card. */
export const cardAvailableCents = (s = state) => {
  const card = account(s)?.card;
  return card ? Math.max(0, card.limitCents - card.usedCents) : 0;
};
export const myName = (s = state) => (role(s) === "prestador" ? person(s)?.providerName : person(s)?.clientName) ?? "";
export const myNames = (s = state) => new Set(person(s) ? [person(s).clientName, person(s).providerName] : []);
/** The person in the presentation who owns this mobile number or e-mail, if any. */
export const personOfContact = (contact, s = state) => Object.values(peopleOf(s)).find((p) => p.phone === contact || p.email === contact) ?? null;
export const personOfName = (name, s = state) => Object.values(peopleOf(s)).find((p) => p.clientName === name || p.providerName === name) ?? null;
/** Everyone who can be hired: each person on their providing side. */
export const providerList = (s = state) => Object.values(peopleOf(s)).map((p) => ({ name: p.providerName, doc: p.providerDoc, rating: p.rating ?? "nova conta", activity: p.activity }));
/** Everyone who can hire: each person on their hiring side. */
export const clientList = (s = state) => Object.values(peopleOf(s)).map((p) => p.clientName);

export const contractById = (s, id) => s.contracts.find((c) => c.id === id);
export const clientParty = (c) => c.client;
export const myParticipant = (c, s = state) => c.participants?.find((p) => p.name === person(s)?.clientName) ?? null;
/** Where an invite to pay together lives (a service invite or already a contract) and the invited person. */
export function splitInviteOf(s, token) {
  for (const holder of [...s.contracts, ...s.invites]) {
    const participant = holder.participants?.find((p) => p.token === token);
    if (participant) return { holder, participant, isContract: s.contracts.includes(holder), declined: false };
    const gone = holder.declined?.find((p) => p.token === token);
    if (gone) return { holder, participant: gone, isContract: s.contracts.includes(holder), declined: true };
  }
  return null;
}
/** Invites to pay together that the current person still has to answer. */
export function mySplitInvites(s) {
  const me = person(s)?.clientName;
  if (!me) return [];
  return [...s.invites.filter((i) => i.status === "sent"), ...s.contracts]
    .flatMap((holder) => (holder.participants ?? []).filter((p) => p.name === me && p.status === "pending").map((participant) => ({ holder, participant })));
}
export const isClientOf = (c, s) => {
  const p = person(asState(s));
  return Boolean(p) && (c.client === p.clientName || Boolean(c.participants?.some((x) => x.name === p.clientName && x.status !== "pending")));
};
export const isProviderOf = (c, s) => c.provider === person(asState(s))?.providerName;
/** A person only sees contracts where they are one of the parties. */
export const canSee = (c, s) => Boolean(c) && (isClientOf(c, s) || isProviderOf(c, s));
export const myContracts = (s) => s.contracts.filter((c) => (role(s) === "prestador" ? isProviderOf(c, s) : isClientOf(c, s)));
/** Anticipated money of my contracts not yet paid back by a release: what is in use of the anticipation limit. */
export const anticipationInUseCents = (s) => myContracts(s).flatMap((c) => c.stages).filter((st) => st.anticipation && st.status !== "released").reduce((a, st) => a + st.anticipation.grossCents, 0);
export { custodyCents, releasedCents } from "./domain/metrics.js";

// Credit: each person has a limit to hire and a separate one to anticipate
export const installmentsOf = (s, owner) => s.installments.filter((i) => i.owner === owner);
const ownerOf = (s) => (s.session.person === "banco" ? null : s.session.person);
export const myInstallments = (s) => (ownerOf(s) ? installmentsOf(s, ownerOf(s)) : s.installments);
export const lateInstallments = (s) => myInstallments(s).filter((i) => i.status === "late");
export const outstandingOf = (s, owner) => installmentsOf(s, owner).filter((i) => i.status !== "paid").reduce((a, i) => a + i.valueCents, 0);
export const outstandingCents = (s) => myInstallments(s).filter((i) => i.status !== "paid").reduce((a, i) => a + i.valueCents, 0);
export const limitOf = (s, owner) => s.accounts[owner]?.creditLimitCents ?? 0;
/** Installments of approved credit already count as debt, so a reserved credit is not subtracted twice. */
export const availableLimitOf = (s, owner) => Math.max(0, limitOf(s, owner) - outstandingOf(s, owner));
export const availableLimitCents = (s) => (ownerOf(s) ? availableLimitOf(s, ownerOf(s)) : 0);
export const monthlyDebtOf = (s, owner) =>
  s.credits.filter((c) => c.owner === owner && c.status === "active").reduce((a, c) => a + c.installmentCents, 0);
export const isBtgConnected = (s) => account(s)?.btg?.status === "connected";
export const creditBlockedReason = (s, amountCents) =>
  !isBtgConnected(s) ? "noAccount" : lateInstallments(s).length > 0 ? "late" : amountCents > availableLimitCents(s) ? "limit" : null;

/** Price-table installment using the demo CET (checkout credit). */
export function installmentCents(amountCents, count) {
  const i = MONTHLY_CET;
  return Math.round((amountCents * i) / (1 - Math.pow(1 + i, -count)));
}

export function nextId(prefix, existing) {
  const nums = existing.map((id) => Number(String(id).split("-").at(-1))).filter(Number.isFinite);
  const n = (nums.length ? Math.max(...nums) : 0) + 1;
  return `${prefix}${String(n).padStart(3, "0")}`;
}

// Notifications go to a party name; the mode tells which side of the account opens
export function notify(s, to, text, detail, icon = "bell", go = "", mode = null) {
  s.notifications.unshift({ id: `N${Date.now()}${Math.random().toString(16).slice(2, 6)}`, to, mode, icon, text, detail, go, read: false });
}
export const notifyClient = (s, c, text, detail, icon, go) => notify(s, clientParty(c), text, detail, icon, go, "contratante");
export const notifyProvider = (s, c, text, detail, icon, go) => notify(s, c.provider, text, detail, icon, go, "prestador");
export const notifyBank = (s, text, detail, icon, go) => notify(s, "banco", text, detail, icon, go);
export const myNotifications = (s) =>
  role(s) === "banco" ? s.notifications.filter((n) => n.to === "banco") : s.notifications.filter((n) => myNames(s).has(n.to));

/** Audit trail: who decided what, under which rule. Shown in the bank's compliance page. */
export function audit(s, actor, action, detail, ref = "") {
  s.audit.unshift({ at: today(), actor, action, detail, ref });
}

export function addLedger(s, contractId, label, amountCents, status = "Conciliado") {
  s.ledger.unshift({ date: today(), contractId, label, amountCents, status });
}

export const STAGE_STATUS = {
  refunded: ["Cancelado", "neutral", "arrow-left"],
  pending: ["A iniciar", "neutral", "lock-simple"],
  inProgress: ["Em execução", "info", "hourglass-medium"],
  awaitingApproval: ["Aprovar", "warn", "clock"],
  adjustRequested: ["Ajuste pedido", "warn", "chat-circle-text"],
  released: ["Liberado", "pos", "check"],
  disputed: ["Em disputa", "neg", "scales"],
  split: ["Dividido", "neutral", "scales"],
};

export function parseReais(text) {
  const clean = String(text ?? "").replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", ".");
  const value = Number(clean);
  return Number.isFinite(value) && value > 0 ? Math.round(value * 100) : null;
}
