import assert from "node:assert/strict";
import { it } from "node:test";
// @ts-expect-error Browser module is intentionally plain JavaScript.
import { cancellationReason, cancellationAmount, settleCancellation } from "../../public/js/domain/cancellation.js";
const active = () => ({ kind: "individual", status: "active", paidInCents: 10000, refundedCents: 0,
  payment: { method: "pix" }, stages: [{ name: "Etapa", valueCents: 10000, status: "inProgress" }],
  cancellation: { requestedBy: "payer", amountCents: 10000, status: "pending" } });
it("requires the other party and refunds only once", () => {
  const c = active();
  assert.equal(settleCancellation(c, "payer"), false);
  assert.equal(c.refundedCents, 0);
  assert.equal(settleCancellation(c, "provider"), true);
  assert.equal(c.refundedCents, 10000);
  assert.equal(cancellationAmount(c), 0);
  assert.equal(settleCancellation(c, "provider"), false);
  assert.equal(c.refundedCents, 10000);
});
it("rejects a stale proposal after money has been released", () => {
  const c = active();
  c.stages[0]!.status = "released";
  assert.equal(settleCancellation(c, "provider"), false);
  assert.equal(c.refundedCents, 0);
});
it("preserves money already released when cancelling the remaining stage", () => {
  const c = active();
  c.stages = [{ name: "A", valueCents: 4000, status: "released" }, { name: "B", valueCents: 6000, status: "awaitingApproval" }];
  c.cancellation.amountCents = 6000;
  assert.equal(settleCancellation(c, "provider"), true);
  assert.equal(c.refundedCents, 6000);
  assert.equal(c.stages[0]!.status, "released");
});
it("does not silently unwind financing, insurance or an open dispute", () => {
  assert.match(cancellationReason({ ...active(), payment: { method: "credit" } }), /saldo ou Pix/);
  assert.match(cancellationReason({ ...active(), insurance: {} }), /seguro/);
  const c = active(); c.stages[0]!.status = "disputed";
  assert.match(cancellationReason(c), /disputa/);
});
