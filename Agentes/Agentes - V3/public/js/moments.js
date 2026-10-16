// The money moment of the presentation: when a payment is kept, released or anticipated, the amount flies between the
// phone and a BTG vault in the middle of the screen, with a large line saying what happened. It compares each state
// with the previous one; while the earlier scenarios run fast (muted) it only keeps the comparison up to date.
import { custodyCents, releasedCents } from "./domain/metrics.js";
import { getState, onReset, personOfName, subscribe } from "./store.js";
import { esc, icon, money } from "./ui.js";

const FLY_MS = 1200;
const SHOW_MS = 2800;
const STAGGER_MS = 700;
const VAULT_BOTTOM_PX = 48;

const vault = Object.assign(document.createElement("div"), { className: "mm-vault", hidden: true });
const banner = Object.assign(document.createElement("div"), { className: "mm-banner", hidden: true });
banner.setAttribute("role", "status");
document.body.append(vault, banner);

let seen = new Map();
let muted = false;
let keepVault = false;
let busyUntil = 0;
let bannerTimer = 0;

const sum = (list, fn) => list.reduce((acc, x) => acc + fn(x), 0);
const snapshotOf = (c) => ({ paid: c.paidInCents, released: releasedCents(c), advanced: sum(c.stages, (st) => st.anticipation?.netCents ?? 0) });
const firstOf = (name) => personOfName(name, getState())?.first ?? name;

/** Moments are silent while the earlier scenarios run fast behind the cover. */
export const muteMoments = (on) => { muted = on; };
/** True while a moment is on screen, so the presentation waits for it. */
export const momentBusy = () => Date.now() < busyUntil;

function center(el) {
  const r = el?.getBoundingClientRect();
  return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
}
const vaultPoint = () => center(vault);
const actingPhone = () => center(document.querySelector("#stage .device.main"));
const phoneOf = (first) => center([...document.querySelectorAll("#stage .phone-col")].find((col) => (col.getAttribute("aria-label") ?? "").includes(`de ${first}`))?.querySelector(".device")) ?? actingPhone();

/** The vault sits at the foot of the line between the two phones, clear of the balloons. */
function placeVault() {
  const el = document.getElementById("stage");
  const stage = el?.getBoundingClientRect();
  if (!stage) return;
  // Between the two phones; with the WhatsApp phone, between the second and the third, so no phone sits under it.
  const triple = el.classList.contains("triple");
  const at = triple ? 2 / 3 : 1 / 2;
  vault.classList.toggle("compact", triple);
  vault.style.left = `${stage.left + stage.width * at}px`;
  vault.style.top = `${stage.top + stage.height - VAULT_BOTTOM_PX}px`;
}

let keptCents = 0;
function updateVault(s) {
  keptCents = sum(s.contracts, (c) => (c.kind === "collective" ? c.paidInCents : custodyCents(c)));
  vault.innerHTML = `${icon("lock-simple")}<span><small>Guardado no BTG</small><strong>${money(keptCents)}</strong></span>`;
}
/** The vault shows up once money is kept: an empty one at R$ 0,00 means nothing to the audience. */
const vaultVisible = () => keepVault && keptCents > 0;

function fly(from, to, label) {
  if (!from || !to) return;
  const chip = Object.assign(document.createElement("div"), { className: "mm-chip", textContent: label });
  document.body.append(chip);
  const at = (p, scale) => `translate(${p.x}px, ${p.y}px) translate(-50%, -50%) scale(${scale})`;
  const frames = [
    { transform: at(from, 0.6), opacity: 0 },
    { transform: at(from, 1), opacity: 1, offset: 0.15 },
    { transform: at(to, 1), opacity: 1, offset: 0.85 },
    { transform: at(to, 0.5), opacity: 0 },
  ];
  chip.animate(frames, { duration: FLY_MS, easing: "cubic-bezier(.4, 0, .2, 1)" }).finished.finally(() => chip.remove());
}

function show({ kind, cents, text, sub, from, to }) {
  placeVault();
  vault.hidden = false;
  vault.classList.remove("pulse");
  void vault.offsetWidth;
  vault.classList.add("pulse");
  fly(from(), to(), money(cents));
  const ic = { keep: "lock-simple", release: "check-circle", advance: "lightning" }[kind];
  banner.className = `mm-banner ${kind}`;
  banner.innerHTML = `${icon(ic)}<div><strong>${esc(text)}</strong><small>${esc(sub)}</small></div>`;
  banner.hidden = false;
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => {
    banner.hidden = true;
    if (!vaultVisible()) vault.hidden = true;
  }, SHOW_MS);
}

/** What happened to one payment since the last state. */
function changesOf(c, was, now) {
  const provider = firstOf(c.provider);
  const kept = now.paid - was.paid;
  const released = now.released - was.released;
  const advanced = now.advanced - was.advanced;
  return [
    kept > 0 && { kind: "keep", cents: kept, text: `${money(kept)} guardados no BTG`, sub: `${c.title} · só sai quando quem paga aprovar`, from: actingPhone, to: vaultPoint },
    released > 0 && { kind: "release", cents: released, text: `${money(released)} liberados para ${provider}`, sub: `${c.title} · saiu do que estava guardado`, from: vaultPoint, to: () => phoneOf(provider) },
    advanced > 0 && { kind: "advance", cents: advanced, text: `${money(advanced)} antecipados para ${provider}`, sub: `${c.title} · o banco recebe quando o marco for liberado`, from: vaultPoint, to: () => phoneOf(provider) },
  ].filter(Boolean);
}

subscribe(() => {
  const s = getState();
  const next = new Map(s.contracts.map((c) => [c.id, snapshotOf(c)]));
  const restarted = next.size < seen.size;
  const events = muted || restarted ? [] : s.contracts.flatMap((c) => (seen.has(c.id) ? changesOf(c, seen.get(c.id), next.get(c.id)) : []));
  seen = next;
  updateVault(s);
  if (keepVault && !events.length && !momentBusy()) vault.hidden = !vaultVisible();
  if (!events.length) return;
  busyUntil = Date.now() + SHOW_MS + STAGGER_MS * events.length;
  events.forEach((e, i) => setTimeout(() => show(e), i * STAGGER_MS));
});

/** The vault stays on screen while a scenario plays; outside it, only during a moment. */
export function showVault(on) {
  keepVault = on;
  placeVault();
  updateVault(getState());
  vault.hidden = !vaultVisible();
}

/** A restarted demo has nothing kept and no moment on screen. */
onReset(() => {
  seen = new Map();
  busyUntil = 0;
  clearTimeout(bannerTimer);
  banner.hidden = true;
});
window.addEventListener("resize", placeVault);
const stageEl = document.getElementById("stage");
if (stageEl) new MutationObserver(placeVault).observe(stageEl, { attributes: true, attributeFilter: ["class"] });
