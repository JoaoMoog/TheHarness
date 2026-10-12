// Presenter guide in chapters: says what happens next, highlights where to click, moves on when the step is done
// and brings the next scene (switching person and screen) by itself.
import { actions as A, go } from "./actions/core.js";
import { CHAPTERS } from "./guide-steps.js";
import { SCENARIOS } from "./scenarios.js";
import { activePrompt } from "./screens/perks.js";
import { PEOPLE, SELF, getState, update } from "./store.js";
import { esc, icon } from "./ui.js";

const SCENE_DELAY_MS = 700;
const MODE = { carlos: "prestador", marina: "contratante", [SELF]: "contratante" };

const pathNow = () => location.hash.replace(/^#\/?/, "");
let automationActive = false;
let sceneTimer = null;
let sceneEpoch = 0;
export function cancelScene() {
  clearTimeout(sceneTimer);
  sceneTimer = null;
  sceneEpoch += 1;
}
/** Only the player can enable automation; loading the guide never starts it. */
export function setGuideActive(active) {
  automationActive = active;
  if (!active) cancelScene();
}
export const position = (s) => ({ chapter: 0, step: 0, ...(s.ui.guide ?? {}) });
export const stepAt = ({ chapter, step }) => CHAPTERS[chapter]?.steps[step] ?? null;
const routeOf = (st, s) => (typeof st.go === "function" ? st.go(s) : st.go) ?? null;
export const nameOf = (s, who) => (who === "banco" ? "o banco" : who === SELF ? s.people?.[SELF]?.first ?? "a cliente" : PEOPLE[who].first);

/** The notices prompt answers first: it covers the screen, so the guide points at it whatever the step. */
const PROMPT_STEP = { target: '[data-action="allowNotify"]', do: "Ative os avisos", why: "Aparece no primeiro pagamento, com um exemplo real." };
const promptOn = (s) => Boolean(activePrompt(s, pathNow()));
/** The step on screen now: the notices prompt, when it is open, stands in for the step. */
export const currentStep = (s) => {
  const st = stepAt(position(s));
  return st && promptOn(s) ? { ...st, ...PROMPT_STEP, who: s.session.person } : st;
};

/** The step needs another scene: another person, or a screen the step names. */
export function needsScene(s, st) {
  if (!st || promptOn(s)) return false;
  if (st.who !== s.session.person) return true;
  if (st.wa) return !(s.wa?.on && s.wa.active === st.wa);
  const route = routeOf(st, s);
  return Boolean(route) && !`#/${pathNow()}`.startsWith(route);
}

// The step the presenter went back to: it stays on screen even if already done, until the guide moves again.
let held = null;
const keyOf = ({ chapter, step }) => `${chapter}:${step}`;
/** The player takes over the guide: steps already done are skipped again. */
export const releaseGuide = () => { held = null; };

/** Moves past every step already done, except the one the presenter went back to. Returns true when it moved. */
export function syncGuide() {
  if (!automationActive) return false;
  const s = getState();
  const start = position(s);
  if (held === keyOf(start)) return false;
  const ctx = { s, path: pathNow() };
  let pos = start;
  for (let st = stepAt(pos); st && st.done(ctx); st = stepAt(pos)) pos = { ...pos, step: pos.step + 1 };
  if (pos.step === start.step) return false;
  update((x) => { x.ui.guide = pos; }, { silent: true });
  return true;
}

/** After the guide moved, the next scene comes by itself when it needs another person or screen. */
export function bringScene(moved) {
  if (!automationActive) { cancelScene(); return; }
  const s = getState();
  if (!moved || !needsScene(s, stepAt(position(s)))) return;
  cancelScene();
  const epoch = sceneEpoch;
  const stepKey = keyOf(position(s));
  const hash = location.hash;
  sceneTimer = setTimeout(() => {
    sceneTimer = null;
    if (!automationActive || epoch !== sceneEpoch || keyOf(position(getState())) !== stepKey || location.hash !== hash) return;
    A.guideGo();
  }, SCENE_DELAY_MS);
}

let lastHit = "";
/** Outlines the element of the current step; scrolls to it once per step. */
export function highlightGuide() {
  document.querySelectorAll(".guide-hit").forEach((el) => el.classList.remove("guide-hit"));
  if (!automationActive) return;
  const s = getState();
  const pos = position(s);
  const st = currentStep(s);
  if (!st?.target || needsScene(s, st)) return;
  const target = typeof st.target === "function" ? st.target(s) : st.target;
  const found = st.wa
    ? document.querySelector(`#stage .device.whats ${target}`)
    : document.querySelector(`#stage .device.main ${target}`) ?? document.querySelector(`#stage .web ${target}`) ?? document.querySelector(`#presenter ${target}`);
  const el = found?.matches("input, textarea, select") ? found.closest("label") ?? found : found;
  if (!el) return;
  el.classList.add("guide-hit");
  const key = `${pos.chapter}:${pos.step}`;
  if (key !== lastHit) el.scrollIntoView({ block: "center" });
  lastHit = key;
}

A.guideGo = () => {
  cancelScene();
  const s = getState();
  const st = stepAt(position(s));
  if (!st) return;
  const switching = st.who !== s.session.person;
  if (switching) {
    update((x) => {
      x.session = { person: st.who, mode: MODE[st.who] ?? x.session.mode, loggedIn: st.who !== SELF || Boolean(x.people?.[SELF]) };
      x.ui.sheet = null;
    });
  }
  update((x) => { x.ui.watch = st.watch ?? null; }, { silent: true });
  if (st.wa) A.waShow({ who: st.wa });
  const route = routeOf(st, getState());
  if (route) go(route);
  else if (switching) go(st.who === "banco" ? "#/banco/visao" : "#/inicio");
};
const move = (delta) => {
  cancelScene();
  update((s) => {
  const pos = position(s);
  const total = CHAPTERS[pos.chapter].steps.length;
  s.ui.guide = { ...pos, step: Math.min(total, Math.max(0, pos.step + delta)) };
  held = delta < 0 ? keyOf(s.ui.guide) : null;
  });
};
A.guideNext = () => move(1);
A.guidePrev = () => move(-1);
A.guideChapter = ({ index }) => {
  cancelScene();
  held = null;
  update((s) => {
    s.ui.guide = { chapter: Number(index), step: 0 };
    // The WhatsApp phone belongs to its scenario: it shows up there and goes away after.
    s.wa = { on: false, active: null, threads: {}, ...s.wa, on: Boolean(CHAPTERS[Number(index)]?.whatsapp) };
  });
  A.guideGo();
};

function stepCard(s, pos, st) {
  if (!st) {
    const next = SCENARIOS[pos.chapter + 1];
    return `<div class="dock-step g-step done"><p>${icon("check-circle")}Cenário concluído.</p>${next ? `<button type="button" class="g-go" data-action="pickChapter" data-index="${pos.chapter + 1}">Próximo: ${esc(next.title)}${icon("arrow-right")}</button>` : "<p>Fim da apresentação.</p>"}</div>`;
  }
  if (promptOn(s)) st = { ...st, ...PROMPT_STEP, who: s.session.person };
  const who = nameOf(s, st.who);
  const cta = needsScene(s, st)
    ? `<button type="button" class="g-go" data-action="guideGo">${st.who !== s.session.person ? `Ir para ${esc(who)}` : "Abrir a tela"}${icon("arrow-right")}</button>`
    : `<span class="g-hint">${icon("info")}${st.show ? "Mostre na tela" : "Clique no destaque"}</span>`;
  return `<div class="dock-step g-step"><span class="g-who">${esc(who)}</span><p class="g-do">${esc(st.do)}</p>
    <small>Passo ${pos.step + 1} de ${CHAPTERS[pos.chapter].steps.length}</small><div class="g-line">${st.why ? `<p class="g-why">${esc(st.why)}</p>` : ""}${cta}</div></div>`;
}

/** While a presentation plays a list of scenarios, the footer numbers only those, the way the audience counts them. */
let shownList = null;
export function setGuideList(list) {
  shownList = list;
  update(() => {});
}

/** The guide lives in the footer: the scenarios (chapters), the step on screen and the progress of the chapter. */
export function guide(s, live = automationActive) {
  if (!live) return `<div class="dock-step g-step dock-free"><p class="g-do">Exploração livre</p><p class="g-why">Navegue no seu ritmo. Nenhum cenário está em execução.</p></div>
    <div class="dock-right"><button type="button" class="dock-scenario" data-action="openScenarios">${icon("play")}Escolher cenário</button>
      <button type="button" class="dock-demo" data-action="toggleDemoMenu" aria-haspopup="true">${icon("sliders-horizontal")}Demo</button></div>`;
  const pos = position(s);
  const order = shownList ?? SCENARIOS.map((_, i) => i);
  // A scenario run behind the cover is not on the list: the footer already shows the next one of the list.
  const current = order.find((i) => i >= pos.chapter) ?? order.at(-1);
  const chapter = CHAPTERS[current];
  const steps = current === pos.chapter ? Math.min(pos.step, chapter.steps.length) : 0;
  const done = Math.round((steps / chapter.steps.length) * 100);
  const n = order.indexOf(current);
  const nav = (action, ic, label) => `<button type="button" class="g-nav" data-action="${action}" aria-label="${label}" title="${label}">${icon(ic)}</button>`;
  return `<div class="dock-progress" aria-hidden="true"><span style="width:${done}%"></span></div>
    <div class="dock-stepwrap">${nav("guidePrev", "caret-left", "Passo anterior (←)")}${stepCard(s, pos, stepAt(pos))}${nav("guideNext", "caret-right", "Próximo passo (→)")}</div>
    <div class="dock-right"><button type="button" class="dock-scenario" data-action="openScenarios" title="Escolher cenário"><span><small>Cenário ${n + 1} de ${order.length}</small><strong>${esc(SCENARIOS[current].title)}</strong></span>${icon("caret-up")}</button>
      <button type="button" class="dock-demo" data-action="toggleDemoMenu" aria-haspopup="true">${icon("sliders-horizontal")}Demo</button></div>`;
}
