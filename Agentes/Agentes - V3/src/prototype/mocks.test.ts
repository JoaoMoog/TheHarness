import assert from "node:assert/strict";
import { test } from "node:test";
// @ts-expect-error The prototype fixtures are browser JavaScript.
import { MOCKS, fixtureFor } from "../../public/js/mocks/fixtures.js";

test("each registered mock has an independent reproducible state and valid money totals", () => {
  assert.equal(new Set(MOCKS.map((mock: { id: string }) => mock.id)).size, MOCKS.length);
  for (const mock of MOCKS) {
    const first = fixtureFor(mock);
    const second = fixtureFor(mock);
    assert.deepEqual(first, second);
    first.ui.drafts.ag.description = "Changed by reviewer";
    assert.notEqual(first.ui.drafts.ag.description, second.ui.drafts.ag.description);
    for (const c of second.contracts) {
      assert.equal(c.stages.reduce((sum: number, st: { valueCents: number }) => sum + st.valueCents, 0), c.totalCents);
      assert.ok(c.refundedCents <= c.paidInCents);
      if (c.cancellation) assert.equal(c.insurance, null, "Cancellation must be available under the app's existing rules");
    }
    for (const claim of second.claims) {
      const dispute = second.disputes.find((d: { id: string }) => d.id === claim.disputeId);
      assert.equal(dispute.status, "closed");
      assert.equal(claim.capCents, dispute.proposal.providerCents);
      assert.equal(claim.payoutCents, claim.capCents - claim.deductibleCents);
    }
    for (const credit of second.credits) assert.equal(second.installments.filter((i: { creditId: string }) => i.creditId === credit.id).length, credit.count);
  }
});
