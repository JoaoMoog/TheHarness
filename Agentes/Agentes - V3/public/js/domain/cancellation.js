import { custodyCents } from "./metrics.js";

// Product rule for this local simulation: bilateral cancellation of the remaining protected amount.
export function cancellationReason(c) {
  if (!c || !["active", "awaitingPayment"].includes(c.status)) return "Este combinado já foi encerrado.";
  if (c.kind !== "individual" || c.parent) return "Use a disputa para tratar este tipo de combinado.";
  if (c.insurance || c.stages.some(st => st.anticipation || st.status === "disputed")) return "Há seguro, antecipação ou disputa. Resolva essa condição antes de cancelar.";
  if (c.payment && !["balance", "pix"].includes(c.payment.method)) return "Este cancelamento simulado está disponível para pagamentos com saldo ou Pix.";
  return null;
}
export function cancellationAmount(c) {
  return c.status === "awaitingPayment" ? 0 : custodyCents(c);
}
export function settleCancellation(c, actor) {
  const request = c.cancellation;
  if (cancellationReason(c) || request?.status !== "pending" || request.requestedBy === actor) return false;
  if (request.amountCents !== cancellationAmount(c)) return false;
  c.refundedCents = (c.refundedCents ?? 0) + request.amountCents;
  c.status = "completed";
  c.completionReason = "cancelled";
  c.stages.forEach(st => { if (!["released", "split"].includes(st.status)) st.status = "refunded"; });
  request.status = "accepted";
  request.acceptedBy = actor;
  request.completedAt = new Date().toISOString();
  return true;
}
