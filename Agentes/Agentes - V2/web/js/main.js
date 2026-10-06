// Entry point: renders the current route and wires delegated events.
import { getState, subscribe } from "./store.js";
import { LOADABLE, parseHash, resolveView } from "./router.js";
import { HANDLERS } from "./handlers.js";
import { recordView } from "./actions.js";
import { startDraft, addTag, setDraftField } from "./publishing.js";
import { renderHeader } from "./ui/header.js";
import { renderModal, toast } from "./ui/overlays.js";
import { WorkflowError } from "./domain/workflow.js";

const LOADING_MS = 900;
const app = document.getElementById("app");
const overlay = document.getElementById("overlay-root");
const ui = { menu: null, modal: null, loading: false, homeSort: "atualizacao", selected: null, teamFilter: "todas" };
let route = parseHash(location.hash);

const footer = '<footer class="wrap" style="padding:24px var(--gutter) 40px;color:var(--text-3);font-size:13px">CrossMarketPlace v2 · protótipo navegável com dados fictícios · padrão visual Orquestra (aproximado) · BTG Pactual</footer>';

function render({ focusMain = false } = {}) {
  const s = getState();
  const active = document.activeElement?.id;
  const scroll = window.scrollY;
  const view = resolveView(s, route, ui);
  app.innerHTML = `${renderHeader(s, route.name, { hero: view.hero ?? "", menu: ui.menu })}${view.strip ?? ""}${view.band ?? ""}<main id="conteudo" tabindex="-1"><div class="wrap">${view.body}</div></main>${footer}`;
  overlay.innerHTML = renderModal(ui.modal, s);
  if (ui.modal) {
    const first = overlay.querySelector("textarea, input:not([type=radio]), .stars button, button.btn.primary");
    if (!overlay.contains(document.activeElement)) first?.focus();
  } else if (focusMain) {
    window.scrollTo({ top: 0 });
    document.getElementById("conteudo")?.focus({ preventScroll: true });
  } else {
    window.scrollTo({ top: scroll });
    if (active) document.getElementById(active)?.focus({ preventScroll: true });
  }
}

const go = (hash) => { if (location.hash === hash) render({ focusMain: true }); else location.hash = hash; };

function guard(fn) {
  try {
    fn();
  } catch (error) {
    if (error instanceof WorkflowError) toast(error.message, "error");
    else { console.error(error); toast("Algo deu errado nesta ação. Tente de novo.", "error"); }
  }
}

/** Runs a modal submit: closes on success, keeps the typed values and shows the error otherwise. */
function modalAction(fn, keep = {}) {
  try {
    const message = fn();
    ui.modal = null;
    render();
    if (message) toast(message);
  } catch (error) {
    if (!(error instanceof WorkflowError)) throw error;
    ui.modal = { ...ui.modal, ...keep, error: error.message };
    render();
  }
}

const ctx = { ui, render: () => render(), go, modalAction };

function onRoute() {
  route = parseHash(location.hash);
  ui.menu = null;
  ui.selected = route.name === "aprovacoes" ? ui.selected : null;
  if (route.name === "publicar") guard(() => startDraft(route.params[0] ?? null));
  if (route.name === "solucao" && route.params[0]) recordView(route.params[0]);
  const s = getState();
  ui.loading = s.sim.slow && LOADABLE.has(route.name);
  render({ focusMain: true });
  if (ui.loading) setTimeout(() => { ui.loading = false; render(); }, LOADING_MS);
}

function dispatch(el, ev) {
  const fn = HANDLERS[el.dataset.action];
  if (!fn) return;
  guard(() => fn(el, ctx, ev));
}

document.addEventListener("click", (ev) => {
  const target = ev.target.closest("[data-action], [data-go]");
  if (ui.menu && !ev.target.closest(".menu") && !ev.target.closest('[data-action="openMenu"]')) { ui.menu = null; if (!target) { render(); return; } }
  if (!target || target.matches("input, select, label")) return;
  if (target.closest("label") && target.dataset.action === "pickRadio") return;
  if (target.dataset.action) { ev.preventDefault(); dispatch(target, ev); return; }
  ev.preventDefault();
  if (ui.modal) ui.modal = null;
  go(target.dataset.go);
});

document.addEventListener("change", (ev) => {
  const el = ev.target;
  if (el.dataset.action) { dispatch(el, ev); return; }
  if (el.dataset.field) guard(() => setDraftField(el.dataset.field, el.type === "checkbox" ? el.checked : el.value, !el.dataset.rerender));
  if (el.dataset.field && !el.dataset.rerender && ["name", "summary"].includes(el.dataset.field)) render();
});

document.addEventListener("input", (ev) => {
  const el = ev.target;
  if (el.dataset.field && el.type !== "checkbox" && el.type !== "radio" && el.tagName !== "SELECT") guard(() => setDraftField(el.dataset.field, el.value, true));
});

document.addEventListener("submit", (ev) => {
  const form = ev.target.closest("form[data-submit]");
  if (!form) return;
  ev.preventDefault();
  guard(() => HANDLERS[form.dataset.submit]?.(form, ctx, ev));
});

document.addEventListener("keydown", (ev) => {
  if (ev.key === "Escape" && (ui.modal || ui.menu)) { ui.modal = null; ui.menu = null; render(); return; }
  if (ev.key === "Enter" && ev.target.dataset?.tagInput) { ev.preventDefault(); const v = ev.target.value; guard(() => addTag(v)); document.getElementById("f-tag")?.focus(); }
});

subscribe(() => render());
window.addEventListener("hashchange", onRoute);
onRoute();
