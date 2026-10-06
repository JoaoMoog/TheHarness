// Provider tools: anticipation, card machine link, reminders. Plus reviews, moderated before going live.
import { pendingCount } from "../domain/split.js";
import { addLedger, contractById, draft, getState, nextId, notifyBank, notifyClient, setDraft, today, update } from "../store.js";
import { money } from "../ui.js";
import { actions as A, go, ok, warn } from "./core.js";
import { activateIfFunded } from "./payment.js";

const ANTICIPATION_SHARE = 0.95;
const ANTICIPATION_FEE = 0.029;
const MDR_RATE = 0.025;

export function anticipationCheck(s, c, idx) {
  const st = c.stages[idx];
  const openDispute = s.disputes.some((d) => d.contractId === c.id && d.status !== "closed");
  const allPaid = c.kind === "collective" ? c.participants.every((p) => p.paid) : c.status === "active" || c.status === "completed";
  const payersLeft = c.kind === "collective" ? c.participants.filter((p) => !p.paid).length : 0;
  return [
    ["Conta verificada", true, ""],
    ["Contrato assinado pelas partes", true, ""],
    ["Etapa com entrega enviada", st.status === "awaitingApproval", `Envie a entrega da etapa ${idx + 1} para liberar.`],
    ["Todos os participantes pagaram", allPaid, `${payersLeft} participante(s) ainda não pagaram.`],
    ["Sem disputa aberta no contrato", !openDispute, "Resolva a disputa antes de antecipar."],
    ["Etapa ainda não antecipada", !st.anticipation, "Esta etapa já foi antecipada."],
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
  if (anticipationCheck(s0, c, idx).some(([, okItem]) => !okItem)) return warn("Ainda há requisitos pendentes.");
  update((s) => {
    const ct = contractById(s, id);
    const share = Number(draft("antecipar.share", ANTICIPATION_SHARE));
    const values = anticipationValues(ct.stages[idx], share);
    ct.stages[idx].anticipation = { ...values, share, at: today() };
    s.ui.drafts.antecipar = undefined;
    addLedger(s, id, `Antecipação etapa ${idx + 1} · ${ct.provider}`, -values.netCents, "Pendente");
  });
  go(`#/antecipado/${id}/${stage}`);
};
A.generateLink = ({ id }) => {
  const c = contractById(getState(), id);
  if (pendingCount(c.participants ?? [])) return warn("Ainda há convidados sem responder ao convite.");
  const payer = c.participants?.find((p) => !p.paid && !p.me) ?? c.participants?.find((p) => !p.paid);
  if (!payer) return warn("Todos os participantes já pagaram.");
  setDraft("maq", { contractId: id, payer: payer.name, generatedAt: today() }, false);
};
A.simulateCardPayment = ({ id }) => {
  const payerName = draft("maq.payer");
  update((s) => {
    const c = contractById(s, id);
    const p = c.participants.find((x) => x.name === payerName);
    Object.assign(p, { paid: true, origin: "Cartão Elo · maquininha" });
    c.paidInCents += p.shareCents;
    s.ledger.unshift({ date: today(), contractId: id, label: `Entrada Elo · ${p.name}`, amountCents: p.shareCents, status: "Divergente", note: `Liquidado ${money(Math.round(p.shareCents * (1 - MDR_RATE)))}: taxa MDR descontada` });
    notifyClient(s, c, `${p.name} pagou`, `${c.title} · cartão Elo`, "credit-card", `#/coletivo/${id}`);
    activateIfFunded(s, c);
    s.ui.drafts.maq = undefined;
  });
  ok(`Pagamento de ${payerName} aprovado na maquininha.`);
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
