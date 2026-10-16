import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MAX_DISPUTE_RATE, MIN_COMPLETED, MIN_REPUTATION, anticipationEligibility } from "../../public/js/domain/anticipation.js";

const good = { completedServices: 37, reputation: 4.8, disputeRate: 0.03, lateInstallments: 0 };
const failing = (ctx: typeof good) => anticipationEligibility(ctx).filter(([, ok]) => !ok).map(([label]) => label);

describe("anticipationEligibility", () => {
  it("passes every requirement of the scope for an experienced provider in good standing", () => {
    // Arrange / Act
    const checks = anticipationEligibility(good);

    // Assert
    assert.equal(checks.length, 4);
    assert.ok(checks.every(([, ok]) => ok));
  });

  it("asks for more completed services below the minimum", () => {
    const labels = failing({ ...good, completedServices: MIN_COMPLETED - 1 });
    assert.equal(labels.length, 1);
    assert.match(labels[0] ?? "", /serviços concluídos/);
  });

  it("blocks a reputation below the minimum and a dispute rate above the maximum", () => {
    const labels = failing({ ...good, reputation: MIN_REPUTATION - 0.1, disputeRate: MAX_DISPUTE_RATE + 0.01 });
    assert.equal(labels.length, 2);
  });

  it("blocks anyone with a late installment, and explains how to unblock", () => {
    // Arrange
    const checks = anticipationEligibility({ ...good, lateInstallments: 1 });

    // Act
    const late = checks.find(([, ok]) => !ok);

    // Assert
    assert.ok(late);
    assert.match(late[2], /parcela/);
  });

  it("shows the provider's own numbers in each label", () => {
    const [completed, reputation] = anticipationEligibility(good);
    assert.match(completed?.[0] ?? "", /37/);
    assert.match(reputation?.[0] ?? "", /4,8/);
  });
});
