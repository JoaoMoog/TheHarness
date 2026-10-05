// Bank console: work queue, policy, KYC, reviews, collections and reconciliation.
import { fetchPolicy, fetchQueue } from "../api.js";
import { PEOPLE, audit, getState, notify, update } from "../store.js";
import { actions as A, ok, resolveOnServer } from "./core.js";
import { disputeQueueIds } from "./dispute.js";

A.loadServerQueue = async () => {
  update((s) => { s.ui.busy.queue = true; });
  try {
    const { items } = await fetchQueue();
    update((s) => { s.serverQueue = items; s.ui.queueLoadedAt = Date.now(); delete s.ui.busy.queue; });
  } catch {
    update((s) => { s.ui.queueLoadedAt = Date.now(); s.ui.queueError = true; delete s.ui.busy.queue; });
  }
};
A.loadPolicy = async () => {
  try {
    const policy = await fetchPolicy();
    update((s) => { s.policy = policy; });
  } catch {
    update((s) => { s.policy = {}; });
  }
};

/** Low-confidence readings that belong to a case the bank already sees (dispute, KYC, review). */
export function linkedQueueIds(s) {
  return new Set([
    s.newAccount?.fraud?.queueId,
    s.newAccount?.appeal?.reading?.queueId,
    ...s.contracts.flatMap((c) => c.stages.map((st) => st.fraudCheck?.reading?.queueId)),
    ...s.reviews.map((r) => r.moderation?.queueId),
    ...s.disputes.flatMap(disputeQueueIds),
  ].filter(Boolean));
}

A.bankResolve = async ({ id, decision }) => {
  await resolveOnServer(id, decision);
  ok(`${id}: ${decision}.`);
  await A.loadServerQueue();
};
A.bankDecideAccount = async ({ decision }) => {
  const acc = getState().newAccount;
  const approved = decision === "approve";
  update((s) => {
    s.newAccount.status = approved ? "verified" : "refused";
    audit(s, "Luiza Prado · analista", "KYC", `${acc.name} · ${approved ? "aprovada" : "recusada"}${acc.appeal ? " após contestação" : ""}`, "KYC-NEW");
    if (!approved) s.newAccount.blockReason = (acc.fraud?.value?.present ?? []).length ? "Sinais de fraude no cadastro" : "Dados do cadastro não conferem";
    if (acc.appeal) s.newAccount.appeal = { ...acc.appeal, status: approved ? "accepted" : "kept" };
    const owner = PEOPLE[acc.by]?.clientName ?? acc.name;
    notify(s, owner, approved ? "Conta liberada" : "Conta não aprovada", acc.name, "shield-check", "#/conta-analise", "contratante");
  });
  ok(approved ? "Conta aprovada." : "Conta recusada.");
  if (!acc.fraudClosed) {
    update((s) => { s.newAccount.fraudClosed = true; }, { silent: true });
    await resolveOnServer(acc.fraud?.queueId, approved ? "Conta aprovada" : "Conta recusada");
  }
  if (acc.appeal?.status === "review") await resolveOnServer(acc.appeal.reading?.queueId, approved ? "Contestação aceita" : "Recusa mantida");
  await A.loadServerQueue();
};
A.bankDecideReview = async ({ id, decision }) => {
  const review = getState().reviews.find((r) => r.id === id);
  update((s) => { s.reviews.find((r) => r.id === id).status = decision === "publish" ? "published" : "hidden"; });
  ok(decision === "publish" ? "Avaliação publicada." : "Avaliação ocultada.");
  await resolveOnServer(review.moderation?.queueId, decision === "publish" ? "Publicada" : "Ocultada");
  await A.loadServerQueue();
};
A.bankCharge = ({ id }) => {
  const inst = getState().installments.find((i) => i.id === id);
  update((s) => notify(s, PEOPLE[inst?.owner]?.clientName ?? "", "Cobrança da parcela", "Pix pré-preenchido enviado pelo Nexo", "receipt", "#/financeiro", "contratante"));
  ok(`Pix de cobrança enviado (${id}).`);
};
A.bankLimit = ({ name, decision }) => {
  update((s) => { s.bankNotes[name] = decision; });
  ok(`Limite de ${name}: ${decision}.`);
};
A.bankReconcile = ({ index }) => {
  update((s) => { s.ledger[Number(index)].status = "Conciliado"; });
  ok("Movimento conciliado.");
};
