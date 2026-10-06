// Publication wizard: draft editing, structured import, saving and submitting for approval.
import { BASE_DATE } from "./ui/format.js";
import { getState, nextId, update } from "./store.js";
import { parseImport } from "./domain/importer.js";
import { findSimilar } from "./domain/similarity.js";
import { transitionApproval, WorkflowError } from "./domain/workflow.js";
import { can } from "./domain/permissions.js";

export const STEPS = ["Informações básicas", "Detalhes técnicos", "Documentação e materiais", "Revisão e envio"];
const SIMILAR_LIMIT = 0.3;
const VERSION = /^v?\d+\.\d+\.\d+$/;

const blank = (s) => ({
  id: null, step: 1, name: "", summary: "", purpose: "", category: "agentes", lifecycle: "piloto", version: "v0.1.0", access: "direto",
  repo: "", endpoint: "", tags: [], teamId: "risco", ownerId: s.userId, contacts: "risco-quant@btgpactual.com · Teams: #risco-quant",
  docs: [], howTo: "", isDifferent: false, diffNote: "", errors: {},
});

const fromSolution = (sol) => ({
  ...blank(getState()), id: sol.id, name: sol.name, summary: sol.summary, purpose: sol.purpose ?? "", category: sol.category, lifecycle: sol.lifecycle,
  version: sol.version, access: sol.access, repo: sol.links?.repo ?? "", endpoint: sol.links?.endpoint ?? "", tags: [...sol.tags], teamId: sol.teamId,
  ownerId: sol.ownerId, contacts: sol.contactText ?? blank(getState()).contacts, docs: [...(sol.docs ?? [])], howTo: (sol.howTo ?? []).join("\n"),
  isDifferent: !!sol.similarityNote, diffNote: sol.similarityNote ?? "",
});

export function startDraft(id = null) {
  const s = getState();
  if (!can(s.profile, "solution.publish")) throw new WorkflowError("Seu perfil não pode publicar soluções.");
  if (s.draft && (s.draft.id ?? null) === id) return;
  const sol = id ? s.solutions.find((x) => x.id === id) : null;
  if (id && !sol) throw new WorkflowError("Solução não encontrada.");
  if (sol && sol.ownerId !== s.userId && s.profile !== "admin") throw new WorkflowError("Só o responsável pode editar esta solução.");
  update((st) => { st.draft = sol ? fromSolution(sol) : blank(st); }, { silent: true });
}

export const setDraftField = (field, value, silent = true) => update((s) => { s.draft[field] = value; if (s.draft.errors) delete s.draft.errors[field]; }, { silent });

export function addTag(raw) {
  const tag = String(raw).replace(/^#/, "").trim().toLowerCase();
  if (!tag) return;
  update((s) => { if (!s.draft.tags.includes(tag)) s.draft.tags = [...s.draft.tags, tag]; });
}
export const removeTag = (tag) => update((s) => { s.draft.tags = s.draft.tags.filter((t) => t !== tag); });

export function addDoc(name) {
  const clean = String(name).trim();
  if (!clean) throw new WorkflowError("Informe o nome do arquivo.");
  update((s) => { s.draft.docs = [...s.draft.docs, { name: clean, size: `${300 + ((clean.length * 137) % 2100)} KB` }]; });
}
export const removeDoc = (name) => update((s) => { s.draft.docs = s.draft.docs.filter((d) => d.name !== name); });

export function importInto(text) {
  const result = parseImport(text);
  if (!result.ok) return result;
  const v = result.value;
  update((s) => {
    s.draft = { ...s.draft, name: v.name, summary: v.summary, category: v.category, tags: v.tags, purpose: v.purpose ?? s.draft.purpose,
      lifecycle: v.lifecycle ?? s.draft.lifecycle, access: v.access ?? s.draft.access, repo: v.repo ?? s.draft.repo, endpoint: v.endpoint ?? s.draft.endpoint,
      version: v.version ?? s.draft.version, errors: {} };
  });
  return result;
}

export function similarTo(draft) {
  return findSimilar({ id: draft.id, name: draft.name, summary: draft.summary, tags: draft.tags }, getState().solutions);
}

export function validate(draft, upToStep) {
  const e = {};
  if (upToStep >= 1) {
    if (draft.name.trim().length < 3) e.name = "Dê um nome com pelo menos 3 caracteres.";
    if (draft.summary.trim().length < 10) e.summary = "Descreva em pelo menos 10 caracteres o que a solução faz.";
  }
  if (upToStep >= 2) {
    if (!VERSION.test(draft.version.trim())) e.version = "Use o formato v1.2.3.";
    if (!draft.repo.trim() && !draft.endpoint.trim()) e.repo = "Informe ao menos o repositório ou o endpoint.";
    if (!draft.tags.length) e.tags = "Adicione ao menos uma tag.";
    if (!draft.contacts.trim()) e.contacts = "Informe um contato para dúvidas.";
  }
  if (upToStep >= 3 && !draft.docs.length) e.docs = "Anexe ao menos um documento (manual de uso, por exemplo).";
  if (upToStep >= 4) {
    const close = similarTo(draft).filter((r) => r.score >= SIMILAR_LIMIT);
    if (close.length && (!draft.isDifferent || draft.diffNote.trim().length < 10)) e.diffNote = "Explique para o aprovador por que a sua solução é diferente das parecidas.";
  }
  return e;
}

export function goToStep(step) {
  const draft = getState().draft;
  const target = Math.max(1, Math.min(STEPS.length, step));
  const errors = target > draft.step ? validate(draft, target - 1) : {};
  update((s) => { s.draft.errors = errors; if (!Object.keys(errors).length) s.draft.step = target; });
  if (Object.keys(errors).length) throw new WorkflowError("Revise os campos destacados antes de continuar.");
}

function toSolution(draft, existing, at) {
  const version = draft.version.startsWith("v") ? draft.version : `v${draft.version}`;
  const fresh = { approval: "rascunho", archived: false, usage: { views: 0, interests: 0, confirmed: 0, hours: 0 }, ratings: [], uses: [], history: [], versions: [{ version, note: "Primeira versão", date: at, by: draft.ownerId }] };
  return {
    ...(existing ?? fresh),
    id: draft.id, name: draft.name.trim(), summary: draft.summary.trim(), purpose: draft.purpose.trim(), category: draft.category,
    lifecycle: draft.lifecycle, version, access: draft.access, tags: draft.tags, teamId: draft.teamId, ownerId: draft.ownerId, contactText: draft.contacts.trim(),
    links: { ...(existing?.links ?? {}), repo: draft.repo.trim(), endpoint: draft.endpoint.trim(), docs: draft.docs[0] ? `${draft.docs[0].name} · ${draft.docs[0].size}` : "" },
    docs: draft.docs, howTo: draft.howTo.split("\n").map((l) => l.trim()).filter(Boolean), similarityNote: draft.isDifferent ? draft.diffNote.trim() : "",
    contacts: existing?.contacts ?? [draft.ownerId], updatedAt: at,
  };
}

export function saveDraft() {
  const draft = getState().draft;
  const errors = validate(draft, 1);
  if (Object.keys(errors).length) { update((s) => { s.draft.errors = errors; }); throw new WorkflowError("Dê ao menos nome e descrição para salvar o rascunho."); }
  const id = draft.id ?? nextId("sol");
  update((s) => {
    const i = s.solutions.findIndex((x) => x.id === id);
    const sol = toSolution({ ...s.draft, id }, i >= 0 ? s.solutions[i] : null, BASE_DATE);
    if (i >= 0) s.solutions[i] = sol; else s.solutions.unshift(sol);
    s.draft.id = id;
    s.draft.savedAt = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  });
  return "Rascunho salvo.";
}

export function submitDraft() {
  const draft = getState().draft;
  const errors = validate(draft, 4);
  if (Object.keys(errors).length) { update((s) => { s.draft.errors = errors; }); throw new WorkflowError("Há pendências antes de enviar. Veja os campos destacados."); }
  const current = draft.id ? getState().solutions.find((x) => x.id === draft.id) : null;
  if (current?.approval === "aprovada" || current?.approval === "em_analise") throw new WorkflowError("Esta solução já foi enviada. Use Nova versão para atualizar uma solução publicada.");
  saveDraft();
  const id = getState().draft.id;
  update((s) => {
    const i = s.solutions.findIndex((x) => x.id === id);
    const sol = s.solutions[i];
    const ctx = { by: s.userId, at: BASE_DATE };
    const reopened = sol.approval === "rejeitada" ? transitionApproval(sol, "rascunho", ctx) : sol;
    s.solutions[i] = transitionApproval(reopened, "em_analise", ctx);
    s.draft = null;
    s.seq += 1;
    s.notifications.unshift({ id: `n-${s.seq}`, text: `${sol.name} enviada para aprovação`, detail: "Prazo de análise: 2 dias úteis", at: BASE_DATE, read: false, kind: "info", go: "#/minha-area" });
  });
  return "Enviada para aprovação. Você acompanha o andamento em Minha área.";
}

export const discardDraft = () => update((s) => { s.draft = null; });
