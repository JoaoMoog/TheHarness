import { actions } from "./actions/index.js";
import { guide } from "./guide.js";
import { PEOPLE, SELF, getState, role, setDraft, subscribe, today, update } from "./store.js";
import { accountRoutes } from "./screens/account.js";
import { bankExtraRoutes } from "./screens/bank-extra.js";
import { bankInsightRoutes } from "./screens/bank-insights.js";
import { labsRoutes } from "./screens/labs.js";
import { businessRoutes } from "./screens/business.js";
import { clientActions, clientRoutes, clientSheets, liveUpdate } from "./screens/client.js";
import { commonRoutes } from "./screens/common.js";
import { creditLiveUpdate, creditRoutes } from "./screens/credit.js";
import { disputeRoutes, disputeSheets } from "./screens/dispute.js";
import { clientHome, providerHome } from "./screens/home.js";
import { menuRoutes } from "./screens/menu.js";
import { insuranceRoutes } from "./screens/insurance.js";
import { linkRoutes } from "./screens/link.js";
import { trustRoutes } from "./screens/trust.js";
import { moneyRoutes } from "./screens/money.js";
import { providerRoutes } from "./screens/provider.js";
import { webRoutes } from "./screens/web.js";
import { esc, icon } from "./ui.js";

const TOAST_MS = 3500;
const PUBLIC_ROUTES = new Set(["entrada", "biometria", "cadastro", "conta-analise", "nexo", "arbitragem", "link", "dividir"]);

const ALL_ACTIONS = { ...actions, ...clientActions };
const SHEETS = { ...clientSheets, ...disputeSheets };
const ROUTES = Object.entries({
  ...commonRoutes, ...clientRoutes, ...moneyRoutes, ...creditRoutes, ...accountRoutes, ...insuranceRoutes, ...disputeRoutes, ...providerRoutes, ...businessRoutes, ...linkRoutes, ...trustRoutes,
  ...labsRoutes, ...menuRoutes, ...webRoutes, ...bankExtraRoutes, ...bankInsightRoutes,
  inicio: (s) => (role(s) === "prestador" ? providerHome(s) : clientHome(s)),
}).map(([pattern, view]) => ({ parts: pattern.split("/"), view, pattern }));

const stage = document.getElementById("stage");
const presenter = document.getElementById("presenter");
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
  const isBank = role(s) === "banco";
  if (isBank && !path.startsWith("banco")) return "banco/visao";
  if (!isBank && path.startsWith("banco")) return "inicio";
  if (!isBank && !s.session.loggedIn && !PUBLIC_ROUTES.has(path.split("/")[0])) return "entrada";
  return match(path) ? path : isBank ? "banco/visao" : "inicio";
}

function renderPresenter(s) {
  const self = s.people?.[SELF];
  const people = [[SELF, self?.name ?? "Você", self ? "sua conta" : "criar conta"], ["marina", PEOPLE.marina.name, "contrata e presta"], ["carlos", PEOPLE.carlos.name, "Horizonte Reformas"], ["banco", "Banco", "operações Nexo"]];
  const current = s.session.person;
  presenter.innerHTML = `<div class="p-brand"><strong>Aval</strong><span>Protótipo navegável</span></div>
    <div class="p-roles" role="group" aria-label="Ver como">${people.map(([k, n, d]) => `<button type="button" class="${current === k ? "on" : ""}" data-action="switchRole" data-role="${k}" aria-pressed="${current === k}"><strong>${esc(n)}</strong><small>${esc(d)}</small></button>`).join("")}</div>
    <div class="p-clock" role="group" aria-label="Relógio da demonstração">${icon("calendar-blank")}<strong>Hoje ${today()}</strong><button type="button" data-action="advanceClock" data-days="1">+1 dia</button><button type="button" data-action="advanceClock" data-days="7">+7 dias</button></div>
    <div class="p-right"><button type="button" class="p-reset" data-action="resetDemo">${icon("arrows-left-right")}Reiniciar demo</button></div>`;
}

function toastHtml(s) {
  const t = s.ui.toast;
  return t ? `<div class="toast ${esc(t.tone)}" role="status">${esc(t.text)}</div>` : "";
}

let toastTimer = null;
function scheduleToast(s) {
  const t = s.ui.toast;
  if (!t || toastTimer?.id === t.id) return;
  clearTimeout(toastTimer?.handle);
  toastTimer = { id: t.id, handle: setTimeout(() => update((x) => { if (x.ui.toast?.id === t.id) x.ui.toast = null; }), TOAST_MS) };
}


function render() {
  const s = getState();
  const raw = currentPath();
  const path = guard(raw, s);
  if (path !== raw) {
    location.replace(`#/${path}`);
    return;
  }
  const route = match(path);
  const focused = document.activeElement?.dataset?.bind;
  const caret = document.activeElement?.selectionStart;
  const scroller = stage.querySelector(".content, .web-body");
  const scroll = path === lastPath && scroller ? scroller.scrollTop : 0;
  const view = route.view(s, route.params);
  renderPresenter(s);
  if (role(s) === "banco") {
    stage.className = "stage web-stage";
    stage.innerHTML = `${view}${toastHtml(s)}`;
  } else {
    const sheet = s.ui.sheet && SHEETS[s.ui.sheet.name] ? SHEETS[s.ui.sheet.name](s) : "";
    stage.className = "stage phone-stage";
    stage.innerHTML = `<div class="device"><div class="device-inner">${view}${sheet ? `<div class="sheet-layer">${sheet}</div>` : ""}${toastHtml(s)}</div></div>${guide(s)}`;
  }
  const nextScroller = stage.querySelector(".content, .web-body");
  if (nextScroller) nextScroller.scrollTop = scroll;
  if (focused) {
    const el = stage.querySelector(`[data-bind="${CSS.escape(focused)}"]`);
    if (el) {
      el.focus();
      if (typeof caret === "number" && el.setSelectionRange) el.setSelectionRange(caret, caret);
    }
  }
  if (path !== lastPath) document.title = `Aval · ${path.split("/")[0]}`;
  lastPath = path;
  scheduleToast(s);
}

document.addEventListener("click", (event) => {
  const target = event.target.closest("[data-action], [data-go]");
  if (!target || target.disabled) return;
  if (target.dataset.go) {
    location.hash = target.dataset.go;
    return;
  }
  const fn = ALL_ACTIONS[target.dataset.action];
  if (!fn) {
    console.warn(`Ação desconhecida: ${target.dataset.action}`);
    return;
  }
  Promise.resolve(fn({ ...target.dataset })).catch((error) => {
    console.error(error);
    update((s) => { s.ui.toast = { text: "Algo deu errado nesta ação. Tente de novo.", tone: "warn", id: Date.now() }; });
  });
});

document.addEventListener("input", (event) => {
  const el = event.target;
  if (!el.dataset?.bind) return;
  const value = el.type === "checkbox" ? el.checked : el.value;
  setDraft(el.dataset.bind, value, !el.dataset.rerender);
  liveUpdate(el.dataset.bind);
  creditLiveUpdate(el.dataset.bind, getState());
});

document.addEventListener("keydown", (event) => {
  const chatBox = event.target.closest?.(".chat-input");
  if (event.key === "Enter" && chatBox) {
    event.preventDefault();
    chatBox.querySelector(".send")?.click();
  }
  if (event.key === "Escape" && getState().ui.sheet) actions.closeSheet();
});

subscribe(render);
window.addEventListener("hashchange", () => {
  const sheet = getState().ui.sheet;
  if (sheet && sheet.route !== location.hash) update((s) => { s.ui.sheet = null; }, { silent: true });
  render();
});
render();
