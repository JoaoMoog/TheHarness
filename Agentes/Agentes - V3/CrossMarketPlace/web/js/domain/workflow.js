// Lifecycle rules: approval, access requests, ratings, confirmed use and versions.
// Every function returns a new object; inputs are never changed.

export class WorkflowError extends Error {}

const fail = (message) => { throw new WorkflowError(message); };
const MIN_JUSTIFICATION = 10;
const MAX_HOURS = 1000;

const APPROVAL_FLOW = {
  rascunho: ["em_analise"],
  em_analise: ["aprovada", "rejeitada", "correcao"],
  correcao: ["em_analise"],
  rejeitada: ["rascunho"],
  aprovada: [],
};
const NEEDS_NOTE = new Set(["rejeitada", "correcao"]);

const entry = (from, to, { by, at, note = "" }) => ({ at, by, from, to, note: note.trim() });

export function transitionApproval(solution, to, ctx) {
  if (!(APPROVAL_FLOW[solution.approval] ?? []).includes(to)) fail(`Mudança de "${solution.approval}" para "${to}" não permitida.`);
  if (NEEDS_NOTE.has(to) && !(ctx.note ?? "").trim()) fail("Escreva uma justificativa para o publicador.");
  const submittedAt = to === "em_analise" ? ctx.at : solution.submittedAt;
  return { ...solution, approval: to, submittedAt, updatedAt: ctx.at, history: [...(solution.history ?? []), entry(solution.approval, to, ctx)] };
}

export function archiveSolution(solution, ctx) {
  if (solution.archived) fail("Esta solução já está arquivada.");
  return { ...solution, archived: true, updatedAt: ctx.at, history: [...(solution.history ?? []), entry(solution.approval, "arquivada", ctx)] };
}

export function createAccessRequest({ id, solution, requesterId, justification, at }) {
  if (solution.access === "direto") fail("Esta solução tem acesso direto; não precisa pedir.");
  if ((justification ?? "").trim().length < MIN_JUSTIFICATION) fail(`Conte em pelo menos ${MIN_JUSTIFICATION} caracteres como vai usar (justificativa).`);
  return { id, solutionId: solution.id, requesterId, justification: justification.trim(), status: "pendente", createdAt: at, decidedAt: null, decidedBy: null, decisionNote: "" };
}

export function decideAccess(request, decision, { by, at, note = "" }) {
  if (request.status !== "pendente") fail("Esta solicitação já foi decidida.");
  if (!["aprovada", "rejeitada"].includes(decision)) fail("Decisão inválida.");
  if (decision === "rejeitada" && !note.trim()) fail("Escreva uma justificativa para a recusa.");
  return { ...request, status: decision, decidedAt: at, decidedBy: by, decisionNote: note.trim() };
}

export function rateSolution(solution, { userId, stars, comment = "", at }) {
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) fail("A nota deve ser um número inteiro entre 1 e 5.");
  const others = (solution.ratings ?? []).filter((r) => r.userId !== userId);
  return { ...solution, ratings: [...others, { userId, stars, comment: comment.trim(), at }] };
}

export function confirmUse(solution, { userId, useful, reuse, hoursSaved, at }) {
  if (typeof hoursSaved !== "number" || Number.isNaN(hoursSaved) || hoursSaved < 0 || hoursSaved > MAX_HOURS) fail(`Informe o tempo economizado entre 0 e ${MAX_HOURS} horas.`);
  return { ...solution, uses: [...(solution.uses ?? []), { userId, useful: !!useful, reuse: !!reuse, hoursSaved, at }] };
}

const SEMVER = /^v?(\d+)\.(\d+)\.(\d+)$/;
const parts = (v) => { const m = SEMVER.exec(String(v).trim()); return m ? m.slice(1).map(Number) : null; };

export function compareSemver(a, b) {
  const pa = parts(a), pb = parts(b);
  if (!pa || !pb) fail("Versão inválida. Use o formato v1.2.3.");
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
  return 0;
}

export function addVersion(solution, { version, note, by, at }) {
  if (!parts(version)) fail("Versão inválida. Use o formato v1.2.3.");
  if (compareSemver(version, solution.version) <= 0) fail(`A nova versão precisa ser maior que ${solution.version}.`);
  const v = version.startsWith("v") ? version : `v${version}`;
  return { ...solution, version: v, updatedAt: at, versions: [{ version: v, note: note.trim(), date: at, by }, ...(solution.versions ?? [])] };
}
