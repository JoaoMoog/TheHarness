// Provider tools: anticipation and reminders. Plus reviews, moderated before going live.
import { anticipationEligibility } from "../domain/anticipation.js";
import { addLedger, contractById, draft, getState, installmentsOf, nextId, notifyBank, personOfName, setDraft, today, update } from "../store.js";
import { actions as A, go, ok, warn } from "./core.js";
import { acceptOffer } from "./offers.js";

const ANTICIPATION_SHARE = 0.95;
const ANTICIPATION_FEE = 0.029;

/** The provider's own track record, read by the scope's eligibility rules (domain/anticipation.js). */
export function providerRecord(s, c) {
  const who = personOfName(c.provider, s);
  const acc = who ? s.accounts[who.id] : null;
  return {
    completedServices: acc?.completedServices ?? 0, reputation: acc?.reputation ?? 0, disputeRate: acc?.disputeRate ?? 0,
    lateInstallments: who ? installmentsOf(s, who.id).filter((i) => i.status === "late").length : 0,
  };
}

export function anticipationCheck(s, c, idx) {
  const st = c.stages[idx];
  const who = personOfName(c.provider, s);
  const used = s.contracts.filter((ct) => ct.provider === c.provider).flatMap((ct) => ct.stages)
    .filter((stage) => stage.anticipation && !["released", "split"].includes(stage.status))
    .reduce((total, stage) => total + stage.anticipation.grossCents, 0);
  const free = Math.max(0, (s.accounts[who?.id]?.anticipationLimitCents ?? 0) - used);
  const openDispute = s.disputes.some((d) => d.contractId === c.id && d.status !== "closed");
  const allPaid = c.kind === "collective" ? c.participants.every((p) => p.paid) : c.status === "active" || c.status === "completed";
  const payersLeft = c.kind === "collective" ? c.participants.filter((p) => !p.paid).length : 0;
  return [
    ["Conta verificada", true, ""],
    ...anticipationEligibility(providerRecord(s, c)),
    ["Contrato assinado pelas partes", true, ""],
    ["Marco com entrega enviada", st.status === "awaitingApproval", `Envie a entrega do marco ${idx + 1} para liberar.`],
    ["Todos os participantes pagaram", allPaid, `${payersLeft} participante(s) ainda não pagaram.`],
    ["Sem disputa aberta no contrato", !openDispute, "Resolva a disputa antes de antecipar."],
    ["Sem cancelamento pendente", c.cancellation?.status !== "pending", "Aguarde a decisão sobre o cancelamento."],
    ["Marco ainda não antecipado", !st.anticipation, "Este marco já foi antecipado."],
    ["Limite disponível para esta antecipação", anticipationValues(st).grossCents <= free, "O valor solicitado ultrapassa seu limite livre de antecipação."],
  ];
}
export const ANTICIPATION_SHARES = [0.5, 0.75, ANTICIPATION_SHARE];
/** Up to 95% of a delivered stage can be anticipated; the provider may take less. */
export function anticipationValues(st, share = ANTICIPATION_SHARE) {
  const grossCents = Math.round(st.valueCents * Math.min(share, ANTICIPATION_SHARE));
  const feeCents = Math.round(grossCents * ANTICIPATION_FEE);
  return { grossCents, feeCents, netCents: grossCents - feeCents };
}
A.confirmAnticipation = ({ id, stage }) => {
  const idx = Number(stage);
  const s0 = getState();
  const c = contractById(s0, id);
  if (!c || !c.stages[idx]) return warn("Etapa não encontrada.");
  if (anticipationCheck(s0, c, idx).some(([, okItem]) => !okItem)) return warn("Ainda há requisitos pendentes.");
  update((s) => {
    const ct = contractById(s, id);
    const share = Number(draft("antecipar.share", ANTICIPATION_SHARE));
    const values = anticipationValues(ct.stages[idx], share);
    ct.stages[idx].anticipation = { ...values, share, at: today() };
    s.ui.drafts.antecipar = undefined;
    addLedger(s, id, `Antecipação do marco ${idx + 1} · ${ct.provider}`, -values.netCents, "Pendente");
    acceptOffer(s, "anticipation", id, { valueCents: values.netCents, revenueCents: values.feeCents });
  });
  go(`#/antecipado/${id}/${stage}`);
};
A.remind = ({ id, name }) => {
  update((s) => notifyBank(s, "Lembrete enviado", `${name} · ${id}`, "bell"));
  ok(`Lembrete enviado para ${name}.`);
};

A.setStars = ({ n }) => setDraft("review.stars", Number(n), false);
A.toggleTag = ({ tag }) => {
  const tags = draft("review.tags", ["Pontualidade", "Qualidade"]);
  setDraft("review.tags", tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag], false);
};
A.publishReview = ({ id }) => {
  const comment = draft("review.comment").trim();
  if (!comment) return warn("Escreva um comentário.");
  update((s) => {
    const c = contractById(s, id);
    s.reviews.unshift({
      id: nextId("RV-", s.reviews.map((r) => r.id)), contractId: id, provider: c.provider, stars: draft("review.stars"),
      tags: draft("review.tags", ["Pontualidade", "Qualidade"]), comment, status: "published",
    });
    c.reviewed = true;
    s.ui.drafts.review = undefined;
  });
  ok("Avaliação publicada.");
  go("#/servicos");
};
