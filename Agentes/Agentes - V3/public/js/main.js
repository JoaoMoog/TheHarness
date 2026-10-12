import { actions } from "./actions/index.js";
import { PEOPLE, SELF, getState, role, setDraft, subscribe, today, update } from "./store.js";
import { assistantRoutes } from "./screens/assistant.js";
import { bankOfferRoutes } from "./screens/bank-offers.js";
import { checkoutRoutes } from "./screens/checkout.js";
import { dualOn, dualStage, fit } from "./screens/dual.js";
import { waColumn } from "./screens/whatsapp.js";
import { protectedRoutes } from "./screens/protected.js";
import { activePrompt, perksRoutes, perksSheets, promptOverlay } from "./screens/perks.js";
import { accountRoutes } from "./screens/account.js";
import { bankExtraRoutes } from "./screens/bank-extra.js";
import { bankInsightRoutes } from "./screens/bank-insights.js";
import { businessRoutes } from "./screens/business.js";
import { clientActions, clientRoutes, clientSheets, liveUpdate } from "./screens/client.js";
import { commonRoutes } from "./screens/common.js";
import { creditRoutes } from "./screens/credit.js";
import { disputeRoutes, disputeSheets } from "./screens/dispute.js";
import { home } from "./screens/home.js";
import { handoffRoutes, menuRoutes } from "./screens/menu.js";
import { insuranceRoutes } from "./screens/insurance.js";
import { trustRoutes } from "./screens/trust.js";
import { moneyRoutes } from "./screens/money.js";
import { providerRoutes } from "./screens/provider.js";
import { webRoutes } from "./screens/web.js";
import { searchRoutes } from "./screens/search.js";
import { esc, icon } from "./ui.js";
import { confirmSheets } from "./screens/confirm.js";
import { APP_MODE, syncSystemBars } from "./app-mode.js";
import { guardedPath } from "./session-policy.js";
import { VALIDATION } from "./runtime.js";
import { hasLocalAccount, locallyUnlocked } from "./local-auth.js";
import { credentialStorage, MOCK_ID } from "./mock-context.js";
import { createOnboarding } from "./domain/onboarding.js";
import { onboardingView } from "./screens/onboarding.js";
if (VALIDATION && MOCK_ID) await (await import("./mocks/activate.js")).activateMock();
const onboarding = createOnboarding({ storage: credentialStorage, key: VALIDATION ? "aval-validation-onboarding-v1" : "aval-local-onboarding-v1", existingAccount: hasLocalAccount(), preview: Boolean(MOCK_ID), previewStep: getState().ui.onboarding?.step ?? null });
const { bringScene, guide, highlightGuide, syncGuide, presenting } = VALIDATION
  && !MOCK_ID ? await import("./presentation-adapter.js")
  : { bringScene() {}, guide: () => "", highlightGuide() {}, syncGuide: () => false, presenting: () => false };

const TOAST_MS = 3500;

/** The Demo menu opens upward from the bar; Esc, a click outside or starting a presentation closes it. */
const toggleDemoMenu = () => document.body.classList.toggle("menu-open");
const CLOSES_MENU = '[data-action="playExecutive"], [data-action="playSlides"], [data-action="resetDemo"], [data-action="switchRole"]';
document.addEventListener("click", (event) => {
  if (!document.body.classList.contains("menu-open") || event.target.closest('[data-action="toggleDemoMenu"]')) return;
  if (!event.target.closest("#presenter") || event.target.closest(CLOSES_MENU)) document.body.classList.remove("menu-open");
});
document.addEventListener("keydown", (event) => { if (event.key === "Escape") document.body.classList.remove("menu-open"); });
const ALL_ACTIONS = { ...actions, ...clientActions, toggleDemoMenu,
  openOnboarding() { onboarding.open(); document.body.classList.remove("menu-open"); render(); },
  nextOnboarding() { onboarding.next(); render(); },
  previousOnboarding() { onboarding.previous(); render(); },
  finishOnboarding() { onboarding.finish(); render(); },
};
const SHEETS = { ...clientSheets, ...disputeSheets, ...perksSheets, ...confirmSheets };
const ROUTES = Object.entries({
  ...commonRoutes, ...searchRoutes, ...clientRoutes, ...moneyRoutes, ...checkoutRoutes, ...protectedRoutes, ...assistantRoutes, ...perksRoutes, ...creditRoutes, ...accountRoutes, ...insuranceRoutes, ...disputeRoutes,
  ...providerRoutes, ...businessRoutes, ...trustRoutes, ...menuRoutes, ...handoffRoutes, ...webRoutes, ...bankExtraRoutes, ...bankInsightRoutes, ...bankOfferRoutes,
  inicio: home,
}).map(([pattern, view]) => ({ parts: pattern.split("/"), view, pattern }));

const stage = document.getElementById("stage");
const presenter = document.getElementById("demo-app");
const dock = document.getElementById("dock-guide");

/** Each phone fits its half of the screen (or the whole stage with one phone), between the top bar and the footer. */
const DEVICE = { w: 410, h: 864, label: 56, pad: 40 };
function fitPhones() {
  if (APP_MODE || !stage.classList.contains("phone-stage")) return;
  const cols = Math.max(1, stage.querySelectorAll(".phone-col").length);
  const zoom = Math.min(1, (stage.clientHeight - DEVICE.label - DEVICE.pad) / DEVICE.h, (stage.clientWidth / cols - DEVICE.pad) / DEVICE.w);
  stage.style.setProperty("--phone-zoom", Math.max(0.4, zoom).toFixed(3));
}
window.addEventListener("resize", fitPhones);
// Stage mode hides the presenter bar while a presentation plays: the phones grow into the room it leaves.
new MutationObserver(fitPhones).observe(document.body, { attributes: true, attributeFilter: ["class"] });
let lastPath = "";

function match(path) {
  const segs = path.split("/").filter(Boolean);
  for (const r of ROUTES) {
    if (r.parts.length !== segs.length) continue;
    const params = {};
    const okMatch = r.parts.every((p, i) => (p.startsWith(":") ? ((params[p.slice(1)] = decodeURIComponent(segs[i])), true) : p === segs[i]));
    if (okMatch) return { ...r, params };
  }
  return null;
}

function currentPath() {
  return location.hash.replace(/^#\/?/, "") || "inicio";
}

/** Keeps each profile inside its own surface and sends logged-out users to the entry screen. */
function guard(path, s) {
  if (!VALIDATION && path.startsWith("banco")) return "inicio";
  const guarded = guardedPath(path, { ...s.session, loggedIn: s.session.loggedIn && (VALIDATION || locallyUnlocked()) });
  if (guarded !== path) return guarded;
  return match(path) ? path : s.session.loggedIn ? "inicio" : "entrada";
}

function renderPresenter(s) {
  const self = s.people?.[SELF];
  // The bank view is a desktop console: the APK keeps to the phone profiles.
  const people = [[SELF, self?.name ?? "Você", self ? "sua conta" : "criar conta"], ["marina", PEOPLE.marina.name, "paga e recebe"], ["carlos", PEOPLE.carlos.name, "Horizonte Reformas"], ["banco", "Banco", "operações BTG"]]
    .filter(([k]) => !APP_MODE || k !== "banco");
  const current = s.session.person;
  const toggle = (on, action, ic, label) => `<button type="button" class="dm-toggle ${on ? "on" : ""}" data-action="${action}" aria-pressed="${on}">${icon(ic)}<span>${label}</span><i aria-hidden="true"></i></button>`;
  presenter.innerHTML = `<div class="dm-head"><strong>Demo</strong><button type="button" class="icon-btn" data-action="toggleDemoMenu" aria-label="Fechar">${icon("x")}</button></div>
    <section class="dm-sec"><small>Ver como</small><div class="p-roles" role="group" aria-label="Ver como">${people.map(([k, n, d]) => `<button type="button" class="${current === k ? "on" : ""}" data-action="switchRole" data-role="${k}" aria-pressed="${current === k}"><strong>${esc(n)}</strong><small>${esc(d)}</small></button>`).join("")}</div></section>
    <section class="dm-sec"><small>Relógio</small><div class="p-clock" role="group" aria-label="Relógio da demonstração">${icon("calendar-blank")}<strong>Hoje ${today()}</strong><button type="button" data-action="advanceClock" data-days="1">+1 dia</button><button type="button" data-action="advanceClock" data-days="7">+7 dias</button></div></section>
    ${APP_MODE ? `<button type="button" class="dm-reset" data-action="resetDemo">${icon("arrows-clockwise")}Reiniciar demo</button>`
    : `<section class="dm-sec"><small>Tela</small>${toggle(s.ui.dual !== false, "toggleDual", "device-mobile", "Dois celulares")}${toggle(Boolean(s.wa?.on), "toggleWa", "chat-circle-text", "WhatsApp")}</section>`}`;
  if (!MOCK_ID) presenter.insertAdjacentHTML("beforeend", '<section class="dm-sec"><a class="link" href="./mocks.html">Catálogo de mocks</a></section>');
}

function toastHtml(s) {
  const t = s.ui.toast;
  return t ? `<div class="toast ${esc(t.tone)}" role="${t.tone === "warn" ? "alert" : "status"}" aria-live="${t.tone === "warn" ? "assertive" : "polite"}"><span>${esc(t.text)}</span><button type="button" data-action="dismissToast" aria-label="Fechar mensagem">${icon("x")}</button></div>` : "";
}

let toastTimer = null;
function scheduleToast(s) {
  const t = s.ui.toast;
  if (!t || toastTimer?.id === t.id) return;
  clearTimeout(toastTimer?.handle);
  if (t.tone === "warn") { toastTimer = { id: t.id, handle: null }; return; }
  toastTimer = { id: t.id, handle: setTimeout(() => update((x) => { if (x.ui.toast?.id === t.id) x.ui.toast = null; }), TOAST_MS) };
}


/** When the person acting changes, the one who acted before goes to the right phone. */
let lastPerson = null;
function trackSecond() {
  const now = getState().session.person;
  if (lastPerson && lastPerson !== now && lastPerson !== "banco" && now !== "banco") update((x) => { x.ui.second = lastPerson; }, { silent: true });
  lastPerson = now;
}

function render() {
  // Outside a presentation the app is free to explore: the guide neither moves on, nor highlights, nor switches phones.
  const live = presenting();
  const moved = live ? syncGuide() : false;
  trackSecond();
  const s = getState();
  const onboardingOpen = onboarding.step !== null;
  document.body.classList.toggle("onboarding-open", onboardingOpen);
  for (const el of [document.getElementById("presenter"), document.getElementById("dock")]) if (el) el.inert = onboardingOpen;
  const raw = currentPath();
  const path = guard(raw, s);
  if (path !== raw) {
    location.replace(`#/${path}`);
    return;
  }
  const route = match(path);
  const focused = document.activeElement?.dataset?.bind;
  const caret = document.activeElement?.selectionStart;
  const scroller = stage.querySelector(".device.main .content, .web-main");
  const scroll = path === lastPath && scroller ? scroller.scrollTop : 0;
  const secondScroll = stage.querySelector(".device.second .content")?.scrollTop ?? 0;
  const view = route.view(s, route.params);
  if (VALIDATION) renderPresenter(s);
  if (role(s) === "banco") {
    stage.className = "stage web-stage";
    stage.innerHTML = `${view}${toastHtml(s)}`;
  } else {
    const sheet = onboardingOpen ? onboardingView(onboarding.step) : s.ui.sheet && SHEETS[s.ui.sheet.name] ? SHEETS[s.ui.sheet.name](s) : "";
    const dual = !onboardingOpen && VALIDATION && s.session.loggedIn && !APP_MODE && dualOn(s);
    const prompt = null;
    const phone = `<div class="device main"><div class="device-inner">${view}${sheet ? `<div class="sheet-layer">${sheet}</div>` : ""}${prompt ? promptOverlay(prompt) : ""}${toastHtml(s)}</div></div>`;
    stage.className = `stage phone-stage${dual ? " dual" : ""}${s.wa?.on ? " triple" : ""}`;
    stage.innerHTML = dual ? dualStage(s, fit(phone), path, match) : `<section class="phone-col acting">${fit(phone)}</section>${APP_MODE || onboardingOpen ? "" : waColumn(s, fit)}`;
  }
  if (dock && VALIDATION) dock.innerHTML = guide(s, live);
  fitPhones();
  const nextScroller = stage.querySelector(".device.main .content, .web-main");
  if (nextScroller) nextScroller.scrollTop = scroll;
  const waLog = stage.querySelector(".device.whats .content");
  if (waLog) waLog.scrollTop = waLog.scrollHeight;
  const nextSecond = stage.querySelector(".device.second .content");
  if (nextSecond) nextSecond.scrollTop = secondScroll;
  if (focused) {
    const el = stage.querySelector(`[data-bind="${CSS.escape(focused)}"]`);
    if (el) {
      el.focus();
      if (typeof caret === "number" && el.setSelectionRange) el.setSelectionRange(caret, caret);
    }
  }
  if (path !== lastPath) document.title = `Aval · ${path.split("/")[0]}`;
  lastPath = path;
  const notice = stage.querySelector('.device.main > .device-inner > .toast');
  const activeScreen = stage.querySelector('.device.main .screen');
  if (notice && activeScreen) activeScreen.insertBefore(notice, activeScreen.querySelector('.footer'));
  for (const [bind, message] of Object.entries(s.ui.errors ?? {})) {
    const input = stage.querySelector(`[data-bind="${CSS.escape(bind)}"], [data-local="${CSS.escape(bind)}"]`);
    if (!input) continue;
    const id = `error-${bind.replace(/[^a-z0-9]/gi, "-")}`;
    input.setAttribute("aria-invalid", "true");
    input.setAttribute("aria-describedby", id);
    const error = document.createElement("small");
    error.id = id; error.className = "field-error"; error.setAttribute("role", "alert"); error.textContent = message;
    (input.closest("label") ?? input.parentElement).append(error);
  }
  stage.querySelectorAll('.pill-option, .bk-tabs button, .pay-tabs button').forEach((el) => el.setAttribute('aria-pressed', String(el.classList.contains('on'))));
  if (!VALIDATION) stage.querySelectorAll('[data-action="simulateDeadline"], [data-action="advanceClock"], [data-action="switchRole"]').forEach(el => el.remove());
  syncDialogFocus();
  scheduleToast(s);
  if (live) highlightGuide();
  bringScene(moved);
  if (APP_MODE) syncSystemBars(stage);
  if (!VALIDATION && s.session.loggedIn && s.session.person !== SELF) {
    const bar = stage.querySelector('.device.main .validation-bar span');
    if (bar) bar.textContent = `Simulação · ${PEOPLE[s.session.person]?.first ?? "contraparte"} · sem dinheiro real`;
    const back = stage.querySelector('[data-action="returnToSelf"]');
    if (back) back.textContent = "Voltar à minha conta";
  }
}

// Horizontal strips scroll by dragging with the mouse or with the wheel, like a finger on the phone.
const DRAG_THRESHOLD_PX = 6;
let drag = null;
document.addEventListener("pointerdown", (event) => {
  const strip = event.target.closest(".bk-strip");
  if (strip && event.pointerType === "mouse") drag = { strip, x: event.clientX, left: strip.scrollLeft, moved: false };
});
document.addEventListener("pointermove", (event) => {
  if (!drag) return;
  const dx = event.clientX - drag.x;
  if (Math.abs(dx) > DRAG_THRESHOLD_PX) { drag.moved = true; drag.strip.classList.add("dragging"); }
  if (drag.moved) drag.strip.scrollLeft = drag.left - dx;
});
document.addEventListener("pointerup", () => {
  if (!drag) return;
  drag.strip.classList.remove("dragging");
  if (drag.moved) {
    const swallow = (e) => { e.stopPropagation(); e.preventDefault(); };
    document.addEventListener("click", swallow, { capture: true, once: true });
    setTimeout(() => document.removeEventListener("click", swallow, { capture: true }), 0);
  }
  drag = null;
});
document.addEventListener("wheel", (event) => {
  const strip = event.target.closest(".bk-strip");
  if (!strip || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
  event.preventDefault();
  strip.scrollLeft += event.deltaY;
}, { passive: false });

document.addEventListener("click", (event) => {
  if (event.target.closest(".device.second")) return;
  const target = event.target.closest("[data-action], [data-go]");
  if (!target || target.disabled) return;
  if (onboarding.step !== null && !target.closest(".onboarding")) return;
  if (target.dataset.go) {
    location.hash = target.dataset.go;
    return;
  }
  const fn = ALL_ACTIONS[target.dataset.action];
  if (!VALIDATION && ["toggleDemoMenu", "switchRole", "advanceClock", "resetDemo", "simulateDeadline", "playExecutive", "playSlides"].includes(target.dataset.action)) return;
  if (!fn) {
    console.warn(`Ação desconhecida: ${target.dataset.action}`);
    return;
  }
  lastTrigger = { action: target.dataset.action, id: target.dataset.id, go: target.dataset.go };
  Promise.resolve().then(() => fn({ ...target.dataset })).catch((error) => {
    console.error(error);
    update((s) => { s.ui.toast = { text: "Algo deu errado nesta ação. Tente de novo.", tone: "warn", id: Date.now() }; });
  });
});

// The dots of a banner carousel follow the slide in view.
document.addEventListener("scroll", (event) => {
  const strip = event.target.closest?.(".bk-carousel");
  if (!strip) return;
  const index = Math.round(strip.scrollLeft / (strip.firstElementChild?.offsetWidth || 1));
  strip.nextElementSibling?.querySelectorAll("i").forEach((dot, i) => dot.classList.toggle("on", i === index));
}, true);

document.addEventListener("input", (event) => {
  const el = event.target;
  const binding = el.dataset?.bind ?? el.dataset?.local;
  if (!binding || el.closest(".device.second")) return;
  const value = el.type === "checkbox" ? el.checked : el.value;
  if (getState().ui.errors?.[binding]) {
    update((s) => { delete s.ui.errors[binding]; }, { silent: true });
    const errorId = el.getAttribute("aria-describedby");
    if (errorId) document.getElementById(errorId)?.remove();
    el.removeAttribute("aria-invalid"); el.removeAttribute("aria-describedby");
  }
  if (!el.dataset.bind) return; // Access codes never enter application drafts or persistence.
  setDraft(el.dataset.bind, value, !el.dataset.rerender);
  liveUpdate(el.dataset.bind);
});

document.addEventListener("keydown", (event) => {
  const chatBox = event.target.closest?.(".chat-input");
  if (event.key === "Enter" && chatBox) {
    event.preventDefault();
    chatBox.querySelector(".send")?.click();
  }
  if (event.key === "Escape" && onboarding.step !== null) { event.preventDefault(); onboardingBack(); }
  else if (event.key === "Escape" && getState().ui.sheet) actions.closeSheet();
  const dialog = stage.querySelector('.device.main [role="dialog"]');
  if (event.key === "Tab" && dialog) {
    const items = [...dialog.querySelectorAll('button:not([disabled]), input, textarea, select, [tabindex="0"]')];
    const first = items[0], last = items.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
});

let dialogOpen = false;
let lastTrigger = null;
let dialogTrigger = null;
function syncDialogFocus() {
  const dialog = stage.querySelector('.device.main [role="dialog"]');
  const screen = stage.querySelector('.device.main .screen');
  if (screen) screen.inert = Boolean(dialog) && !dialog.contains(screen);
  if (dialog?.classList.contains("onboarding")) {
    if (!dialogOpen) dialogTrigger = lastTrigger;
    dialog.querySelector("h1")?.focus();
  } else if (dialog && !dialogOpen) {
    dialogTrigger = lastTrigger;
    dialog.querySelector('button, input, textarea')?.focus();
  } else if (!dialog && dialogOpen) {
    const trigger = dialogTrigger && [...stage.querySelectorAll('[data-action], [data-go]')].find((el) =>
      el.dataset.action === dialogTrigger.action && el.dataset.id === dialogTrigger.id && el.dataset.go === dialogTrigger.go);
    (trigger ?? stage.querySelector('.device.main .content button, .device.main .footer button') ?? stage.querySelector('.device.main button'))?.focus();
  }
  dialogOpen = Boolean(dialog);
}
function onboardingBack() {
  if (onboarding.step > 0) onboarding.previous(); else onboarding.finish();
  render();
}
window.avalBack = () => {
  if (onboarding.step !== null) { onboardingBack(); return true; }
  if (document.body.classList.contains("menu-open")) { document.body.classList.remove("menu-open"); return true; }
  if (getState().ui.sheet) { actions.closeSheet(); return true; }
  return false;
};

subscribe(render);
let backgroundAt = null;
window.avalVisibility = (hidden) => {
  if (hidden) backgroundAt = Date.now();
  else if (backgroundAt != null) {
    const elapsed = Date.now() - backgroundAt;
    backgroundAt = null;
    if (elapsed >= 5 * 60 * 1000 && locallyUnlocked()) actions.lockSession();
  }
};
document.addEventListener("visibilitychange", () => window.avalVisibility(document.hidden));
window.addEventListener("hashchange", () => {
  const sheet = getState().ui.sheet;
  if (sheet && sheet.route !== location.hash) update((s) => { s.ui.sheet = null; }, { silent: true });
  if (getState().session.loggedIn && getState().session.person === SELF && !["entrada", "biometria", "cadastro"].includes(currentPath().split('/')[0])) {
    update((s) => { s.ui.resumeTo = location.hash; }, { silent: true });
  }
  render();
});
render();
