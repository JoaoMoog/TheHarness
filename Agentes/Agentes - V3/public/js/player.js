// Plays the presenter guide by itself, one scenario at a time, for an audience that never saw the app. Each scenario
// opens with the problem and what the Aval does; each new screen gets a short tour; each step shows a balloon beside
// the phone and a cursor on the element before the click; money moments show where the money went; the scenario
// closes with its numbers. "Eu avanço" waits for the presenter (→, space, Enter or a slide clicker); "Automático"
// waits a reading time. The scenarios before the chosen one run fast behind a cover (the demo always starts empty).
import { actions as A, warn } from "./actions/core.js";
import { hideBalloon, showBalloon } from "./balloon.js";
import { addMetrics, demoMetrics, metricsDelta } from "./domain/metrics.js";
import { prepPlan, trackOf } from "./domain/presentation-prep.js";
import { currentStep, nameOf, needsScene, position, releaseGuide, setGuideActive, setGuideList } from "./guide.js";
import { CHAPTERS } from "./guide-steps.js";
import { momentBusy, muteMoments, showVault } from "./moments.js";
import { SPEEDS, card, controls, cover, demoPlay, featureMap, nowLine, picker } from "./player-views.js";
import { EXECUTIVE, EXECUTIVE_MIN, SCENARIOS, TRACKS, nextInTrack } from "./scenarios.js";
import { SLIDES } from "./slides.js";
import { getState, onReset, resetCount, update } from "./store.js";
import { TOURS } from "./tours.js";

/** Times at normal speed, in ms (automatic mode). In fast mode every wait is at most FAST. */
const MS = { slide: 14000, move: 1200, readMin: 5000, readMax: 12000, perChar: 60, after: 1800, scene: 2000, intro: 9000, summary: 9000, typeChar: 90, fast: 160 };
const RETRY_MS = 1600; // real time before acting again on a step that did not move
const MAX_ACTS = 3; // acts on the same step before asking the presenter
const NO_TARGET_MS = 8000; // real time with nothing to click before asking the presenter
const TICK_MS = 100;
const PARAMS = new URLSearchParams(location.search);
/** `?ritmo=8` runs everything 8x faster and `?modo=auto` starts automatic (for automated checks). */
const TEST_PACE = Math.max(1, Number(PARAMS.get("ritmo")) || 1);
const ROLE = { carlos: "prestador", voce: "contratante", marina: "" };
const SCENE_TEXT = {
  carlos: "Carlos é o prestador: ele cobra, faz o serviço e envia as entregas.",
  voce: "Ana é a contratante: ela paga, confere cada entrega e aprova.",
  marina: "Marina usa o mesmo app para receber e para pagar.",
  banco: "A visão do banco: operação, risco e o resultado das ofertas.",
};
const WA_TEXT = "Sem abrir o app: a conversa no WhatsApp do BTG Aval vira cobrança ou pagamento com Aval.";
const NEXT_KEYS =new Set(["ArrowRight", "PageDown", "Enter", " "]);
const PREV_KEYS = new Set(["ArrowLeft", "PageUp"]);
const STOP = Symbol("stop");

/** True while a presentation runs: only then the guide moves on, highlights and brings the next scene (main.js). */
export const presenting = () => p.on;

let p = {
  on: false, mode: PARAMS.get("modo") === "auto" ? "auto" : "manual", paused: false, stuck: false, speed: "normal", fast: false, skip: false, once: false,
  run: 0, ready: null, scenario: 0, list: null, listTitle: "", picker: false, prep: null, card: null, caption: null, summary: null, pillarsSeen: [],
};
const toursShown = new Set();

const root = document.getElementById("player") ?? document.body.appendChild(Object.assign(document.createElement("div"), { id: "player" }));
const cursor = Object.assign(document.createElement("div"), { className: "p-cursor", hidden: true });
document.body.append(cursor);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const factor = () => SPEEDS.find(([k]) => k === p.speed)[2] / TEST_PACE;
let guideActive = false;
const set = (patch) => {
  p = { ...p, ...patch };
  const active = p.on && !p.card && !p.paused;
  setGuideActive(active);
  render();
  // Coming back from a pause: what the presenter did by hand meanwhile counts, so the app re-checks the step.
  if (active && !guideActive) update(() => {});
  guideActive = active;
};
const holding = () => p.mode === "manual" && !p.fast;
const hint = () => (p.mode === "manual" ? "→ para continuar" : "");

/**
 * Waits a scaled time (or real time, for the app to answer). With `hold`, "Eu avanço" waits for the presenter instead.
 * Holds while paused, ends early on "Avançar"/"Próximo" and unwinds when the run was stopped.
 */
async function wait(ms, { real = false, hold = false } = {}) {
  const run = p.run;
  let left = real ? ms : p.fast ? Math.min(ms, MS.fast) : ms * factor();
  for (;;) {
    if (run !== p.run) throw STOP;
    if (p.skip && !real) { p = { ...p, skip: false }; return; }
    if (p.paused && !p.once) { syncCaption(); await sleep(TICK_MS); continue; }
    if (hold && holding()) { await sleep(TICK_MS); continue; }
    if (left <= 0) return;
    await sleep(Math.min(TICK_MS, left));
    left -= TICK_MS;
  }
}

function label(s, who) {
  if (who === "banco") return "Banco BTG";
  const name = nameOf(s, who);
  return ROLE[who] ? `${name} · ${ROLE[who]}` : name;
}
const readTime = (title, text = "") => Math.min(MS.readMax, Math.max(MS.readMin, MS.perChar * `${title} ${text}`.length));
/** The footer line; redraws only when it changed, so a click on the controls is never lost to a redraw. */
function caption(s, st, extra = {}) {
  const next = { who: st.as ?? label(s, st.who), do: st.do, ...extra };
  if (JSON.stringify(next) !== JSON.stringify(p.caption)) set({ caption: next });
}
/** While paused, the footer follows the step on screen (the presenter may have clicked it by hand). */
function syncCaption() {
  const s = getState();
  const st = currentStep(s);
  if (p.on && !p.fast && !p.card && st && !needsScene(s, st)) caption(s, st);
}
const sceneText = (s, who) => (who === "banco" ? "Agora no banco" : `Agora no celular de ${nameOf(s, who)}`);
const screenRoot = () => document.querySelector("#stage .device.main .device-inner") ?? document.querySelector("#stage .web");
const hitNow = () => document.querySelector(".guide-hit");

/** Slides the cursor to the middle of the element (to the box itself, for a checkbox row). */
async function moveTo(el, { quick = false } = {}) {
  const box = el.matches('input[type="checkbox"]') ? el : el.querySelector('input[type="checkbox"]');
  const r = (box ?? el).getBoundingClientRect();
  cursor.hidden = false;
  cursor.style.transitionDuration = `${Math.round((quick ? MS.move / 3 : MS.move) * factor())}ms`;
  cursor.style.transform = `translate(${r.left + r.width / 2}px, ${r.top + Math.min(r.height / 2, 28)}px)`;
  await wait(quick ? MS.move / 3 : MS.move);
}
function tap() {
  cursor.classList.remove("tap");
  void cursor.offsetWidth;
  cursor.classList.add("tap");
}

/** Types letter by letter in the highlighted field, then presses the button that uses it. */
async function typeInto(el, st) {
  const bind = (el.matches("input, textarea") ? el : el.querySelector("input, textarea"))?.dataset.bind;
  if (!bind) return;
  const field = () => document.querySelector(`#stage :is(.device.main, .device.whats) [data-bind="${CSS.escape(bind)}"]`);
  for (let i = p.fast ? st.type.length : 1; i <= st.type.length; i += 1) {
    const f = field();
    if (!f) return;
    f.value = st.type.slice(0, i);
    f.dispatchEvent(new Event("input", { bubbles: true }));
    await wait(MS.typeChar);
  }
  const next = st.then && document.querySelector(`#stage :is(.device.main, .device.whats) ${st.then}`);
  // Typing saves the draft silently; without a click after it, the app re-checks the step here.
  if (!next) { update(() => {}); return; }
  if (!p.fast) { await moveTo(next); tap(); }
  next.click();
}

async function perform(st) {
  const el = hitNow();
  if (!el) return;
  if (!p.fast) { await moveTo(el, { quick: true }); tap(); }
  hideBalloon();
  if (st.type) return typeInto(el, st);
  const box = el.matches('input[type="checkbox"]') ? el : el.querySelector('input[type="checkbox"]');
  (box ?? el).click();
}

/** Stops and hands the step to the presenter; continues when "Avançar"/"Continuar" is pressed. */
async function stuck() {
  set({ paused: true, stuck: true });
  await wait(0);
}

/** The first time a screen appears, a few balloons explain what each part of it means. */
async function tourScreen() {
  const screen = screenRoot();
  // The pitch opening tours the home itself, item by item with the features map: no screen tour on top of it.
  if (p.fast || !screen || CHAPTERS[position(getState()).chapter]?.solo) return;
  const path = location.hash.replace(/^#\/?/, "");
  const covered = Boolean(screen.querySelector(".sheet-layer, .fullsheet"));
  const tour = TOURS.find((t) => !toursShown.has(t.key) && t.route.test(path) && (t.when ? screen.querySelector(t.when) : !covered));
  if (!tour) return;
  toursShown.add(tour.key);
  const points = tour.points.filter(([sel]) => screen.querySelector(sel));
  if (!points.length) return;
  cursor.hidden = true;
  document.body.classList.add("touring");
  try {
    for (const [i, [sel, title, text]] of points.entries()) {
      const find = () => screenRoot()?.querySelector(sel);
      find()?.scrollIntoView({ block: "center" });
      set({ caption: { who: "Nesta tela", do: title } });
      showBalloon({ target: find, kicker: `Nesta tela · ${i + 1} de ${points.length}`, title, text, hint: hint(), tone: "tour" });
      await wait(readTime(title, text), { hold: true });
    }
  } finally {
    document.body.classList.remove("touring");
    hideBalloon();
  }
}

/** Another person or screen: the guide switches phones and a balloon says whose phone it is now. */
async function changeScene(st) {
  hideBalloon();
  await wait(400);
  const before = getState();
  const switching = st.who !== before.session.person;
  const toWa = Boolean(st.wa) && !(before.wa?.on && before.wa.active === st.wa);
  if (needsScene(before, currentStep(before))) A.guideGo();
  await wait(300);
  if (p.fast || (!switching && !toWa)) return;
  const s = getState();
  const title = toWa ? `Agora no WhatsApp de ${nameOf(s, st.wa)}` : sceneText(s, st.who);
  const where = toWa ? "#stage .wa-col .phone-label" : "#stage .phone-col.acting .phone-label";
  caption(s, st, { do: title });
  showBalloon({ target: () => document.querySelector(where) ?? document.querySelector("#stage .topbar"), kicker: toWa ? "WhatsApp" : "Troca de celular", title, text: toWa ? WA_TEXT : SCENE_TEXT[st.who] ?? "", tone: "scene" });
  await wait(MS.scene);
  hideBalloon();
}

/** One step: tour of a new screen, then the balloon and the cursor on the element, then the click. */
async function showStep(s, st) {
  await tourScreen();
  const hit = hitNow();
  if (!hit) return;
  hit.scrollIntoView({ block: "center" });
  caption(s, st);
  await moveTo(hit);
  showBalloon({ target: hitNow, kicker: st.as ?? label(s, st.who), title: st.do, text: st.why ?? "", hint: hint() });
  await wait(readTime(st.do, st.why), { hold: true });
}

/** Plays one chapter of the guide until its last step is done. */
async function playChapter(index) {
  releaseGuide();
  if (position(getState()).chapter !== index) { A.guideChapter({ index }); await wait(MS.after); }
  let lastKey = "";
  let acts = 0;
  let retried = false;
  let since = Date.now();
  for (;;) {
    const s = getState();
    const pos = position(s);
    const st = currentStep(s);
    if (pos.chapter !== index || !st) return;
    if (needsScene(s, st)) { await changeScene(st); since = Date.now(); continue; }
    const key = `${pos.chapter}:${pos.step}:${st.do}`;
    if (key !== lastKey) { lastKey = key; acts = 0; retried = false; since = Date.now(); }
    if (st.show) {
      if (!p.fast) await showStep(s, st);
      else await wait(MS.after);
      A.guideNext();
      continue;
    }
    if (acts > 0 && !retried) { await wait(RETRY_MS, { real: true }); retried = true; continue; }
    if (!hitNow()) {
      if (Date.now() - since > NO_TARGET_MS) { await stuck(); since = Date.now(); } else await wait(300, { real: true });
      continue;
    }
    if (acts >= MAX_ACTS) { await stuck(); acts = 0; continue; }
    if (!p.fast && acts === 0) await showStep(s, st);
    await perform(st);
    acts += 1;
    retried = false;
    if (p.once) set({ once: false });
    await wait(MS.after);
    while (!p.fast && momentBusy()) await wait(TICK_MS * 2, { real: true });
  }
}

/** True while the presentation itself restarts the demo, so it does not stop itself. */
let selfReset = false;
function restartDemo() {
  selfReset = true;
  try { A.resetDemo({ quiet: true }); } finally { selfReset = false; }
}
const readyAt = (index) => (index === null ? null : { index, resets: resetCount() });

/** Gets the demo to the start of a scenario: on from where the last one of its track ended, or from an empty demo. */
async function prepare(index) {
  const plan = prepPlan({ track: trackOf(TRACKS, index, p.list), index, ready: p.ready, resets: resetCount() });
  if (plan.reset) restartDemo();
  if (!plan.run.length) { set({ ready: readyAt(index) }); return; }
  hideBalloon();
  cursor.hidden = true;
  muteMoments(true);
  set({ fast: true, ready: null, card: null });
  for (const [i, chapter] of plan.run.entries()) {
    set({ prep: { index, done: chapter, step: i, total: plan.run.length } });
    await playChapter(chapter);
  }
  muteMoments(false);
  set({ fast: false, prep: null, ready: readyAt(index) });
}

/** Opening card, the scenario, then its numbers. Returns what the scenario changed; in a presentation, a scenario
 * that changes nothing (the bank) shows the numbers of the scenarios shown so far, never the ones run behind the cover. */
async function playOne(index, shownSoFar = null) {
  await prepare(index);
  cursor.hidden = true;
  hideBalloon();
  set({ scenario: index, card: "intro", caption: null });
  await wait(MS.intro, { hold: true });
  set({ card: null });
  const start = demoMetrics(getState());
  await playChapter(index);
  hideBalloon();
  cursor.hidden = true;
  const delta = metricsDelta(start, demoMetrics(getState()));
  const nothing = Object.values(delta).every((v) => v === 0);
  const totals = p.list && shownSoFar ? shownSoFar : demoMetrics(getState());
  const track = trackOf(TRACKS, index, p.list);
  set({ ready: readyAt(track[track.indexOf(index) + 1] ?? null), card: "summary", summary: nothing ? totals : delta, pillarsSeen: [...new Set([...p.pillarsSeen, ...SCENARIOS[index].pillars])] });
  if (p.list) {
    await wait(MS.summary, { hold: true });
    set({ card: null });
  }
  return delta;
}

function begin(patch) {
  toursShown.clear();
  setGuideActive(false);
  showVault(true);
  set({ on: true, paused: false, stuck: false, once: false, skip: false, run: p.run + 1, picker: false, card: "intro", caption: null, list: null, pillarsSeen: [], ...patch });
  setGuideList(patch.list ?? null);
  update(() => {}); // the app redraws with the guide awake
}
function finish(patch) {
  hideBalloon();
  setGuideActive(false);
  set({ on: false, caption: null, ...patch });
  if (patch.card !== "listEnd") setGuideList(null);
  cursor.hidden = true;
  showVault(false);
  update(() => {}); // and without it: clicking around no longer moves the guide or switches phones
}
async function guarded(fn) {
  try {
    await fn();
  } catch (error) {
    if (error === STOP) return;
    console.error(error);
    muteMoments(false);
    finish({ fast: false, prep: null, card: null });
  }
}

const runScenario = (index) => guarded(async () => {
  begin({});
  await playOne(index);
  finish({});
});

/** The opening slides, one at a time; Voltar, the dots and "Pular" move through them. */
async function runSlides() {
  let i = 0;
  while (i < SLIDES.length) {
    set({ card: "slides", slide: i, slideTo: null, slidesDone: false });
    await wait(MS.slide, { hold: true });
    if (p.slidesDone) break;
    i = p.slideTo ?? i + 1;
  }
  set({ card: null, slideTo: null, slidesDone: false });
}

/** A whole presentation: the opening slides, the scenarios in order (preparing the ones in between), and the numbers of it all. */
const runList = (list, title) => guarded(async () => {
  begin({ list, listTitle: title, card: "slides" });
  await runSlides();
  let shown = null;
  for (const index of list) shown = addMetrics(shown, await playOne(index, shown));
  finish({ card: "listEnd", summary: shown });
});

/** The slides alone: at the end ("Ir para a demonstração" or "Pular") the scenario list opens, to pick what to show. */
A.playSlides = () => guarded(async () => {
  begin({ list: EXECUTIVE, listTitle: "Abertura", card: "slides" });
  await runSlides();
  finish({ picker: true });
});
A.slidePrev = () => set({ slideTo: Math.max(0, (p.slide ?? 0) - 1), skip: true });
A.slideGo = ({ index }) => set({ slideTo: Number(index), skip: true });
A.slidesSkip = () => set({ slidesDone: true, skip: true });
A.openScenarios = () => set({ picker: true });
A.closeScenarios = () => set({ picker: false });
A.playScenario = ({ index }) => runScenario(Number(index));
A.playCurrent = () => runScenario(position(getState()).chapter);
A.playAll = () => runList(TRACKS.full, "O Aval completo");
A.playExecutive = () => runList(EXECUTIVE, `O Aval em ${EXECUTIVE_MIN} minutos`);
/** A scenario number in the footer: while playing it plays that scenario; otherwise the guide jumps to it. */
A.pickChapter = ({ index }) => (p.on ? runScenario(Number(index)) : A.guideChapter({ index }));
A.playerToggle = () => set({ paused: !p.paused, stuck: false });
A.playerNext = () => set({ skip: true, once: p.paused && p.mode === "auto", stuck: false, paused: p.mode === "manual" ? false : p.paused });
A.playerSpeed = ({ speed }) => set({ speed });
A.playerMode = ({ mode }) => set({ mode, paused: false });
/** Maximizes the whole presentation (slides and demo) or restores it; the browser may refuse without a click. */
A.toggleFullscreen = () => {
  const change = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
  change?.catch?.(() => warn("O navegador não permitiu a tela cheia. Use F11."));
};
A.playerStop = () => {
  muteMoments(false);
  finish({ run: p.run + 1, paused: false, stuck: false, fast: false, prep: null, card: null, picker: false, ready: null, list: null });
  // Free exploration goes back to the usual phones.
  if (getState().ui.solo) update((s) => { s.ui.solo = false; });
};

/** "Reiniciar demo" from the menu stops whatever is playing: what was prepared belongs to the demo that is gone. */
onReset(() => {
  if (selfReset) return;
  toursShown.clear();
  if (p.on || p.card) A.playerStop();
  else p = { ...p, ready: null };
});

document.addEventListener("keydown", (event) => {
  if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
  // Free exploration keeps native keyboard behavior; presentation shortcuts require an explicit start.
  if (!p.on && !p.card && !p.picker) return;
  if ((event.key === "f" || event.key === "F") && !event.ctrlKey && !event.metaKey && !event.altKey) { event.preventDefault(); return A.toggleFullscreen(); }
  if (event.key === "Escape" && (p.on || p.picker || p.card)) return A.playerStop();
  if (p.card === "slides" && PREV_KEYS.has(event.key)) { event.preventDefault(); return A.slidePrev(); }
  if (!NEXT_KEYS.has(event.key) || (!p.on && !p.card)) return;
  event.preventDefault();
  const next = nextInTrack(p.scenario);
  if (!p.on) return p.card === "summary" && next !== null ? runScenario(next) : undefined;
  if (p.mode === "auto" && event.key === " ") return A.playerToggle();
  A.playerNext();
});

/** The features map of a chapter that tours the app: the item on screen now and the ones already shown. */
function featuresNow() {
  const s = getState();
  const pos = position(s);
  const chapter = CHAPTERS[pos.chapter];
  if (!chapter?.solo) return null;
  const seen = chapter.steps.slice(0, pos.step).map((st) => st.feature).filter(Boolean);
  return { active: currentStep(s)?.feature ?? null, seen };
}

function render() {
  const covering = Boolean(p.prep) && !p.paused;
  document.body.classList.toggle("playing", p.on || Boolean(p.card));
  document.body.classList.toggle("paused", p.on && p.paused);
  document.body.classList.toggle("deck-on", p.card === "slides" || p.card === "listEnd");
  const introMs = Math.round(MS.intro * factor());
  const map = p.on && !p.card && !covering ? featuresNow() : null;
  root.innerHTML = [p.picker ? picker() : "", covering ? cover(p) : "", map ? featureMap(map) : "", p.card ? card(p, introMs) : "", p.on && !p.card ? nowLine(p) : "", controls(p)].join("");
  const menu = document.getElementById("demo-play");
  if (menu) menu.innerHTML = demoPlay(p);
}
/** The maximize buttons show the current state (also when Esc leaves full screen). */
document.addEventListener("fullscreenchange", () => render());
render();
