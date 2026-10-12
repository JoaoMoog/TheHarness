import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FLOAT_MONTHLY, INSURANCE_COMMISSION, TRANSACTION_FEE_CENTS, contractEconomics } from "../../public/js/domain/economics.js";

const contract = (extra = {}) => ({ id: "AV-1", totalCents: 16_000_00, paidInCents: 16_000_00, refundedCents: 0, arbitrationFeeCents: 64_00, insurance: null, stages: [], ...extra });

describe("contractEconomics", () => {
  it("lists what the bank earns on a card payment with insurance and who pays each part", () => {
    // Arrange
    const s = {
      contracts: [contract({ insurance: { paid: true, premiumCents: 400_00 } })],
      offerEvents: [
        { product: "limit", contractId: "AV-1", accepted: true, valueCents: 3_200_00, revenueCents: 1_758_40 },
        { product: "yield", contractId: "AV-1", accepted: true, valueCents: 16_000_00, revenueCents: 0 },
        { product: "credit", contractId: "AV-1", accepted: false, valueCents: 16_000_00, revenueCents: 0 },
      ],
    };

    // Act
    const e = contractEconomics(s, "AV-1");
    assert.ok(e);
    const by = Object.fromEntries(e.rows.map((r) => [r.source, r]));

    // Assert
    assert.equal(by.cardInterest.cents, 1_758_40);
    assert.equal(by.cardInterest.payer, "quem paga");
    assert.equal(by.insurance.cents, Math.round(400_00 * INSURANCE_COMMISSION));
    assert.equal(by.arbitration.cents, 64_00);
    assert.equal(by.transaction.cents, TRANSACTION_FEE_CENTS);
    assert.equal(by.float.cents, Math.round(16_000_00 * FLOAT_MONTHLY));
    assert.equal(e.totalCents, e.rows.reduce((a, r) => a + r.cents, 0));
    assert.equal(e.share, e.totalCents / 16_000_00);
  });

  it("charges the anticipation fee to the provider and leaves out what was not accepted", () => {
    // Arrange
    const s = {
      contracts: [contract()],
      offerEvents: [{ product: "anticipation", contractId: "AV-1", accepted: true, valueCents: 7_379_60, revenueCents: 220_40 }],
    };

    // Act
    const rows = contractEconomics(s, "AV-1")?.rows ?? [];

    // Assert
    assert.equal(rows.find((r) => r.source === "anticipation")?.payer, "prestador");
    assert.equal(rows.some((r) => r.source === "cardInterest" || r.source === "insurance"), false);
  });

  it("returns nothing for an unknown contract", () => {
    assert.equal(contractEconomics({ contracts: [], offerEvents: [] }, "X"), null);
  });
});
