import { cancellationAmount, cancellationReason, settleCancellation } from "../domain/cancellation.js";
import { canSee, contractById, getState, personOfName, update, addLedger, notifyClient, notifyProvider } from "../store.js";
import { actions as A, go, warn } from "./core.js";

A.requestCancellation = ({ id }) => {
  const s0 = getState(), c = contractById(s0, id);
  if (!canSee(c, s0)) return warn("Combinado não encontrado.");
  const reason = cancellationReason(c);
  if (reason) return warn(reason);
  if (c.cancellation?.status === "pending") return;
  update(s => {
    const ct = contractById(s, id);
    ct.cancellation = { status: "pending", requestedBy: s.session.person, amountCents: cancellationAmount(ct), requestedAt: new Date().toISOString() };
    notifyClient(s, ct, "Cancelamento proposto", "Aguardando aceite das duas partes. Nenhuma devolução foi concluída.", "clock", `#/servico/${id}`);
    notifyProvider(s, ct, "Cancelamento proposto", "Confira a proposta antes de aceitar.", "clock", `#/servico/${id}`);
  });
};
A.answerCancellation = ({ id, accept }) => {
  const s0 = getState(), c = contractById(s0, id);
  if (!canSee(c, s0) || c.cancellation?.status !== "pending" || c.cancellation.requestedBy === s0.session.person) return warn("A outra parte precisa responder ao pedido.");
  if (accept !== "yes") { update(s => { contractById(s, id).cancellation.status = "declined"; }); return; }
  let completed = false;
  update(s => {
    const ct = contractById(s, id);
    completed = settleCancellation(ct, s.session.person);
    if (!completed) return;
    const amount = ct.cancellation.amountCents;
    const payer = personOfName(ct.client, s);
    if (amount && payer && (ct.payment?.method === "balance" || ct.payment?.origin === "Saldo conta BTG")) s.accounts[payer.id].balanceCents += amount;
    if (amount) addLedger(s, id, `Devolução simulada para ${ct.client}`, -amount, "Devolução");
    notifyClient(s, ct, "Cancelamento concluído", "Consulte o registro da devolução simulada.", "check-circle", `#/devolucao/${id}`);
    notifyProvider(s, ct, "Cancelamento concluído", "O valor ainda guardado foi devolvido na simulação.", "check-circle", `#/devolucao/${id}`);
  });
  if (completed) go(`#/devolucao/${id}`);
  else warn("As condições mudaram. Confira o combinado antes de cancelar.");
};
