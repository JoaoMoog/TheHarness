import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MAX_LIMIT_INCREASE_CENTS, recommendPayment } from "../../public/js/domain/pay-advice.js";

const base = { amountCents: 16_400_00, balanceCents: 0, cardAvailableCents: 0, preApprovedCents: 0, connected: true };

describe("recommendPayment", () => {
  it("recommends the balance when it covers the payment", () => {
    assert.equal(recommendPayment({ ...base, balanceCents: 20_000_00 }).method, "balance");
  });

  it("recommends the card only when its available limit covers the payment", () => {
    // Arrange
    const ctx = { ...base, balanceCents: 15_000_00, cardAvailableCents: 17_000_00, preApprovedCents: 20_000_00 };

    // Act
    const advice = recommendPayment(ctx);

    // Assert
    assert.equal(advice.method, "card");
    assert.match(advice.reason, /sem juros/);
  });
  it("does not recommend a card that requires a limit increase", () => {
    assert.equal(recommendPayment({ ...base, cardAvailableCents: base.amountCents - 1 }).method, "pix");
  });

  it("recommends the credit when the card would need a large increase", () => {
    // Arrange
    const ctx = { ...base, amountCents: 18_000_00, cardAvailableCents: 1_800_00, preApprovedCents: 20_000_00 };

    // Act / Assert
    assert.ok(18_000_00 - 1_800_00 > MAX_LIMIT_INCREASE_CENTS);
    assert.equal(recommendPayment(ctx).method, "credit");
  });

  it("recommends Pix when there is no BTG account connected", () => {
    assert.equal(recommendPayment({ ...base, connected: false, balanceCents: 99_000_00 }).method, "pix");
  });

  it("recommends Pix when nothing from the bank covers the payment", () => {
    assert.equal(recommendPayment({ ...base, cardAvailableCents: 1_00 }).method, "pix");
  });
});
