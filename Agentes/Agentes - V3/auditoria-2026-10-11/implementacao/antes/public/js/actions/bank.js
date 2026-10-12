// Bank console: KYC, reviews, collections and reconciliation. People decide; rules order the queue.
import { audit, getState, notify, peopleOf, update } from "../store.js";
import { actions as A, ok } from "./core.js";

A.bankDecideAccount = ({ decision }) => {
  const acc = getState().newAccount;
  const approved = decision === "approve";
  update((s) => {
    s.newAccount.status = approved ? "verified" : "refused";
    audit(s, "Luiza Prado · analista", "KYC", `${acc.name} · ${approved ? "aprovada" : "recusada"}${acc.appeal ? " após contestação" : ""}`, "KYC-NEW");
    if (!approved) s.newAccount.blockReason = "Dados do cadastro não conferem";
    if (acc.appeal) s.newAccount.appeal = { ...acc.appeal, status: approved ? "accepted" : "kept" };
    const owner = peopleOf(s)[acc.by]?.clientName ?? acc.name;
    notify(s, owner, approved ? "Conta liberada" : "Conta não aprovada", acc.name, "shield-check", "#/conta-analise", "contratante");
  });
  ok(approved ? "Conta aprovada." : "Conta recusada.");
};
A.bankDecideReview = ({ id, decision }) => {
  update((s) => { s.reviews.find((r) => r.id === id).status = decision === "publish" ? "published" : "hidden"; });
  ok(decision === "publish" ? "Avaliação publicada." : "Avaliação ocultada.");
};
A.bankCharge = ({ id }) => {
  const inst = getState().installments.find((i) => i.id === id);
  update((s) => notify(s, peopleOf(s)[inst?.owner]?.clientName ?? "", "Cobrança da parcela", "Pix pré-preenchido enviado pelo BTG", "receipt", "#/financeiro", "contratante"));
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
