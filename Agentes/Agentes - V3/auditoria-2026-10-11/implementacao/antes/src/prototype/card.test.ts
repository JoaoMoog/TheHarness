import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CARD_RULES, cardBlockedReason, cardPlan, cardPlans } from "../../public/js/domain/card.js";

describe("cardPlan", () => {
  it("charges exactly the amount in one installment", () => {
    // Arrange
    const amount = 450_000;

    // Act
    const plan = cardPlan(amount, 1);

    // Assert
    assert.deepEqual(plan, { count: 1, installmentCents: 450_000, totalCents: 450_000, interestFree: true });
  });

  it("splits without interest up to the interest-free count", () => {
    const plan = cardPlan(450_000, CARD_RULES.interestFreeUpTo);
    assert.equal(plan.interestFree, true);
    assert.equal(plan.totalCents, 450_000);
    assert.equal(plan.installmentCents, 150_000);
  });

  it("rounds the interest-free installment up so the installments cover the amount", () => {
    const plan = cardPlan(100_000, 3);
    assert.equal(plan.installmentCents, 33_334);
    assert.equal(plan.totalCents, 100_000);
  });

  it("charges interest after the interest-free count", () => {
    const plan = cardPlan(450_000, CARD_RULES.interestFreeUpTo + 1);
    assert.equal(plan.interestFree, false);
    assert.ok(plan.totalCents > 450_000);
    assert.equal(plan.totalCents, plan.installmentCents * plan.count);
  });

  it("costs more in total the longer the plan", () => {
    assert.ok(cardPlan(450_000, 12).totalCents > cardPlan(450_000, 6).totalCents);
  });

  it("rejects counts outside 1 to the maximum and non-integer counts", () => {
    for (const count of [0, CARD_RULES.maxCount + 1, 2.5]) {
      assert.throws(() => cardPlan(450_000, count), RangeError);
    }
  });

  it("rejects an amount that is not a positive whole number of cents", () => {
    for (const amount of [0, -100, 10.5, Number.NaN]) {
      assert.throws(() => cardPlan(amount, 1), RangeError);
    }
  });
});

describe("cardPlans", () => {
  it("offers every count up to the maximum for a large amount", () => {
    assert.deepEqual(cardPlans(450_000).map((p) => p.count), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it("drops counts whose installment would fall below the minimum", () => {
    const plans = cardPlans(12_000);
    assert.ok(plans.every((p) => p.installmentCents >= CARD_RULES.minInstallmentCents || p.count === 1));
    assert.deepEqual(plans.map((p) => p.count), [1, 2]);
  });

  it("always offers one installment, even below the minimum", () => {
    assert.deepEqual(cardPlans(3_000).map((p) => p.count), [1]);
  });
});

describe("cardBlockedReason", () => {
  it("needs a connected BTG account", () => {
    assert.equal(cardBlockedReason({ totalCents: 100_000, availableCents: 1_000_000, connected: false }), "noAccount");
  });

  it("blocks when the plan total passes the available card limit", () => {
    assert.equal(cardBlockedReason({ totalCents: 1_000_001, availableCents: 1_000_000, connected: true }), "limit");
  });

  it("allows a plan that fits the available limit", () => {
    assert.equal(cardBlockedReason({ totalCents: 1_000_000, availableCents: 1_000_000, connected: true }), null);
  });
});
