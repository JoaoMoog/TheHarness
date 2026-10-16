// User actions. Each one validates through the domain rules and returns a confirmation message.
import { BASE_DATE } from "./ui/format.js";
import { getState, nextId, update } from "./store.js";
import { addVersion, archiveSolution, confirmUse, createAccessRequest, decideAccess, rateSolution, transitionApproval, WorkflowError } from "./domain/workflow.js";
import { userById } from "./seed/people.js";
import { can } from "./domain/permissions.js";

const now = () => BASE_DATE;
const me = () => getState().userId;
const findIndex = (s, id) => { const i = s.solutions.findIndex((x) => x.id === id); if (i < 0) throw new WorkflowError("Solução não encontrada."); return i; };
const solutionOf = (id) => getState().solutions.find((x) => x.id === id);
const requireCan = (action, message) => { if (!can(getState().profile, action)) throw new WorkflowError(message); };

function replaceSolution(id, fn) {
  update((s) => { const i = findIndex(s, id); s.solutions[i] = fn(s.solutions[i]); });
}

function notify(s, text, detail, kind = "info", go = "#/minha-area") {
  s.seq += 1;
  s.notifications.unshift({ id: `n-${s.seq}`, text, detail, at: now(), read: false, kind, go });
}

export function toggleFavorite(id) {
  const isFav = getState().favorites.includes(id);
  update((s) => {
    s.favorites = isFav ? s.favorites.filter((f) => f !== id) : [...s.favorites, id];
    if (!isFav) { const i = findIndex(s, id); s.solutions[i] = { ...s.solutions[i], usage: { ...s.solutions[i].usage, interests: s.solutions[i].usage.interests + 1 } }; }
  });
  return isFav ? "Removida dos favoritos." : "Adicionada aos favoritos.";
}

export function recordView(id) {
  update((s) => { const i = s.solutions.findIndex((x) => x.id === id); if (i >= 0) s.solutions[i].usage.views += 1; }, { silent: true });
}

export function openDirectAccess(id) {
  const sol = solutionOf(id);
  if (sol.access !== "direto") throw new WorkflowError("Esta solução exige autorização. Faça um pedido de acesso.");
  return `Acesso liberado. Abrindo ${sol.links?.app || sol.links?.repo || "a solução"}…`;
}

export function requestAccess(id, justification) {
  const sol = solutionOf(id);
  const pending = getState().requests.some((r) => r.solutionId === id && r.requesterId === me() && r.status === "pendente");
  if (pending) throw new WorkflowError("Você já tem um pedido pendente para esta solução.");
  const request = createAccessRequest({ id: nextId("r"), solution: sol, requesterId: me(), justification, at: now() });
  update((s) => {
    s.requests.unshift(request);
    const i = findIndex(s, id); s.solutions[i].usage.interests += 1;
    notify(s, `Pedido de acesso enviado: ${sol.name}`, `Aguardando ${userById(sol.ownerId).name}`, "info", "#/acessos/enviadas");
  });
  return "Pedido enviado. Você acompanha o andamento em Solicitações de acesso.";
}

export function decideRequest(requestId, decision, note = "") {
  requireCan("access.decide", "Seu perfil não pode decidir pedidos de acesso.");
  update((s) => {
    const i = s.requests.findIndex((r) => r.id === requestId);
    s.requests[i] = decideAccess(s.requests[i], decision, { by: me(), at: now(), note });
  });
  return decision === "aprovada" ? "Acesso aprovado. O solicitante foi avisado." : "Pedido recusado. O solicitante recebe a sua justificativa.";
}

export function registerUse(id, { useful, reuse, hoursSaved }) {
  replaceSolution(id, (sol) => confirmUse(sol, { userId: me(), useful, reuse, hoursSaved, at: now() }));
  return "Uso confirmado. Obrigado! Isso entra nos indicadores de impacto.";
}

export function rate(id, stars, comment) {
  const had = (solutionOf(id).ratings ?? []).some((r) => r.userId === me());
  replaceSolution(id, (sol) => rateSolution(sol, { userId: me(), stars, comment, at: now() }));
  return had ? "Sua avaliação foi atualizada." : "Avaliação registrada.";
}

const APPROVAL_MESSAGES = {
  aprovada: ["Publicação aprovada. Ela já aparece no catálogo.", "aprovada", "ok"],
  correcao: ["Correção solicitada ao publicador.", "voltou para correção", "warn"],
  rejeitada: ["Publicação recusada. O publicador recebe a justificativa.", "foi recusada", "danger"],
};

export function decideApproval(id, to, note = "") {
  requireCan("approvals.decide", "Seu perfil não pode aprovar publicações.");
  const sol = solutionOf(id);
  replaceSolution(id, (s) => transitionApproval(s, to, { by: me(), at: now(), note }));
  const [message, verb, kind] = APPROVAL_MESSAGES[to];
  update((s) => notify(s, `${sol.name} ${verb}`, note || "Aprovações", kind, `#/solucao/${id}`));
  return message;
}

export function archive(id) {
  replaceSolution(id, (s) => archiveSolution(s, { by: me(), at: now() }));
  return "Solução arquivada. Ela sai do catálogo, mas o histórico é mantido.";
}

export function publishVersion(id, version, note) {
  replaceSolution(id, (s) => addVersion(s, { version, note, by: me(), at: now() }));
  return `Versão ${version} publicada.`;
}

export function setProfile(profile) {
  update((s) => { s.profile = profile; });
}

export function markAllRead() {
  update((s) => { s.notifications = s.notifications.map((n) => ({ ...n, read: true })); });
}
