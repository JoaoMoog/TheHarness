// Click, change and submit handlers keyed by data-action. Each returns nothing; errors surface as toasts in main.js.
import { getState, resetDemo, update } from "./store.js";
import { DEFAULT_FILTERS } from "./seed/index.js";
import * as act from "./actions.js";
import * as pub from "./publishing.js";
import { IMPORT_SAMPLE, toast } from "./ui/overlays.js";
import { WorkflowError } from "./domain/workflow.js";

const setFilters = (patch) => update((s) => { s.filters = { ...s.filters, ...patch, page: patch.page ?? 1 }; });
const value = (id) => document.getElementById(id)?.value ?? "";
const radio = (name) => document.querySelector(`input[name="${name}"]:checked`)?.value;
const SIMULATED = "Simulação: no protótipo esta ação não tem efeito.";

export const HANDLERS = {
  // Discovery
  favorite: (el) => toast(act.toggleFavorite(el.dataset.id)),
  filterCategory: (el, c) => { setFilters({ ...DEFAULT_FILTERS, categories: [el.dataset.category] }); c.go("#/catalogo"); },
  searchTag: (el, c) => { setFilters({ ...DEFAULT_FILTERS, q: el.dataset.tag }); c.go("#/catalogo"); },
  homeSearch: (form, c) => { setFilters({ ...DEFAULT_FILTERS, q: new FormData(form).get("q")?.toString().trim() ?? "" }); c.go("#/catalogo"); },
  catalogSearch: (form) => setFilters({ q: new FormData(form).get("q")?.toString().trim() ?? "" }),
  clearQuery: () => setFilters({ q: "" }),
  homeSort: (el, c) => { c.ui.homeSort = el.dataset.sort; c.render(); },
  toggleFilter: (el) => { const { key, value: v } = el.dataset; const list = getState().filters[key]; setFilters({ [key]: list.includes(v) ? list.filter((x) => x !== v) : [...list, v] }); },
  removeFilter: (el) => { const { key, value: v } = el.dataset; setFilters(key === "minRating" ? { minRating: 0 } : { [key]: getState().filters[key].filter((x) => x !== v) }); },
  clearFilters: () => setFilters({ ...DEFAULT_FILTERS }),
  setMinRating: (el) => setFilters({ minRating: Number(el.dataset.value) }),
  setSort: (el) => setFilters({ sort: el.value }),
  setPage: (el) => { setFilters({ page: Number(el.dataset.page) }); window.scrollTo({ top: 0 }); },
  toggleAllTeams: () => setFilters({ showAllTeams: !getState().filters.showAllTeams, page: getState().filters.page }),
  retry: (el, c) => { c.render(); toast(getState().sim.fail ? "Ainda falhando. Desative a falha simulada no menu de perfil." : "Dados carregados."); },

  // Header
  openMenu: (el, c) => { c.ui.menu = c.ui.menu === el.dataset.menu ? null : el.dataset.menu; c.render(); },
  setProfile: (el, c) => { c.ui.menu = null; act.setProfile(el.dataset.profile); toast(`Perfil simulado: ${el.textContent.trim()}`); },
  toggleSim: (el) => update((s) => { s.sim = { ...s.sim, [el.dataset.key]: el.checked }; }),
  resetDemo: (el, c) => { c.ui.menu = null; resetDemo(); toast("Demonstração reiniciada."); c.go("#/inicio"); },
  markRead: (el, c) => { c.ui.menu = null; act.markAllRead(); },

  // Modals
  openModal: (el, c) => { const d = el.dataset; c.ui.modal = { type: d.modal, id: d.id, request: d.request, stars: Number(d.stars ?? 0) }; c.render(); },
  closeModal: (el, c, ev) => { if (el.dataset.self && ev.target !== el) return; c.ui.modal = null; c.render(); },
  pickStar: (el, c) => { c.ui.modal = { ...c.ui.modal, stars: Number(el.dataset.stars), comment: value("m-comment") }; c.render(); },
  pickRadio: (el, c) => { const key = el.name === "m-useful" ? "useful" : "reuse"; c.ui.modal = { ...c.ui.modal, [key]: el.value, hours: value("m-hours") }; c.render(); },
  submitRequest: (el, c) => c.modalAction(() => act.requestAccess(c.ui.modal.id, value("m-justification")), { text: value("m-justification") }),
  submitUse: (el, c) => c.modalAction(() => act.registerUse(c.ui.modal.id, { useful: radio("m-useful") !== "nao", reuse: radio("m-reuse") !== "nao", hoursSaved: Number(value("m-hours")) }), { hours: value("m-hours") }),
  submitRate: (el, c) => c.modalAction(() => { if (!c.ui.modal.stars) throw new WorkflowError("Escolha uma nota de 1 a 5 estrelas."); return act.rate(c.ui.modal.id, c.ui.modal.stars, value("m-comment")); }, { comment: value("m-comment") }),
  submitReject: (el, c) => c.modalAction(() => act.decideRequest(c.ui.modal.request, "rejeitada", value("m-note")), { note: value("m-note") }),
  approveRequest: (el) => toast(act.decideRequest(el.dataset.request, "aprovada")),
  submitVersion: (el, c) => c.modalAction(() => act.publishVersion(c.ui.modal.id, value("m-version").trim(), value("m-vnote")), { version: value("m-version"), note: value("m-vnote") }),
  submitArchive: (el, c) => c.modalAction(() => act.archive(c.ui.modal.id)),
  openAccess: (el) => toast(act.openDirectAccess(el.dataset.id)),
};

Object.assign(HANDLERS, {
  // Approvals
  selectApproval: (el, c) => { c.ui.selected = el.dataset.id; c.render(); },
  decideApproval: (el) => toast(act.decideApproval(el.dataset.id, el.dataset.to, value("parecer"))),

  // Publishing wizard
  newDraft: (el, c) => { pub.startDraft(null); c.render(); },
  startImport: (el, c) => {
    pub.startDraft(getState().draft?.id ?? null);
    c.ui.modal = { type: "import", text: "" };
    if (location.hash.startsWith("#/publicar")) c.render(); else c.go("#/publicar");
  },
  importSample: (el, c) => { c.ui.modal = { ...c.ui.modal, text: IMPORT_SAMPLE, errors: null }; c.render(); },
  submitImport: (el, c) => {
    const text = value("m-import");
    const result = pub.importInto(text);
    if (!result.ok) { c.ui.modal = { ...c.ui.modal, text, errors: result.errors }; c.render(); return; }
    c.ui.modal = null; c.render(); toast("Dados importados. Revise e complete as etapas.");
  },
  draftCategory: (el) => pub.setDraftField("category", el.dataset.value, false),
  removeTag: (el) => pub.removeTag(el.dataset.tag),
  addDoc: () => { pub.addDoc(value("f-doc")); toast("Documento anexado."); },
  removeDoc: (el) => pub.removeDoc(el.dataset.name),
  goStep: (el) => { pub.goToStep(Number(el.dataset.step)); window.scrollTo({ top: 0 }); },
  saveDraft: () => toast(pub.saveDraft()),
  submitDraft: (el, c) => { const msg = pub.submitDraft(); toast(msg); c.go("#/minha-area"); },
  discardDraft: (el, c) => { pub.discardDraft(); toast("Rascunho descartado."); c.go("#/inicio"); },

  // Team and simulated-only actions
  teamFilter: (el, c) => { c.ui.teamFilter = el.dataset.value; c.render(); },
  guide: () => toast("Guia: 1) confira se já existe algo parecido; 2) descreva o problema que resolve; 3) anexe o manual; 4) envie para aprovação."),
  contact: (el) => toast(`Simulação: abrindo conversa no Teams com ${el.dataset.name}.`),
  prefs: () => toast(SIMULATED),
  period: () => toast("Simulação: os números mostram 2026; outros períodos não estão disponíveis no protótipo."),
  export: () => toast("Simulação: relatório exportado em CSV."),
  manage: (el) => toast(`Simulação: cadastro de ${el.dataset.what.toLowerCase()}.`),
  noop: () => {},
});
