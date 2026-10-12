import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { creditDecision, priceInstallment, simulateCredit } from "../../public/js/domain/credit.js";

const base = {
  amountCents: 1_500_000,
  count: 12,
  graceDays: 0,
  incomeCents: 1_250_000,
  monthlyDebtCents: 215_302,
  availableLimitCents: 1_138_792,
  hasLate: false,
  reputation: 4.9,
  openFinanceShared: false,
};

describe("priceInstallment", () => {
  it("pays back more than the principal", () => {
    const installment = priceInstallment(1_000_000, 0.0199, 12);
    assert.ok(installment * 12 > 1_000_000);
    assert.ok(installment < 1_000_000 / 12 + 20_000);
  });

  it("grows when there is a grace period", () => {
    assert.ok(priceInstallment(1_000_000, 0.0199, 12, 60) > priceInstallment(1_000_000, 0.0199, 12, 0));
  });
});

describe("simulateCredit", () => {
  it("reports IOF, total and a yearly CET above the nominal rate", () => {
    const sim = simulateCredit({ amountCents: 1_000_000, count: 12, graceDays: 0, monthlyRate: 0.0199 });
    assert.ok(sim.iofCents > 0);
    assert.equal(sim.totalCents, sim.installmentCents * 12);
    const nominalYear = Math.pow(1.0199, 12) - 1;
    assert.ok(sim.cetYear > nominalYear);
  });

  it("rejects terms outside the product", () => {
    assert.throws(() => simulateCredit({ amountCents: 1_000_000, count: 2, graceDays: 0, monthlyRate: 0.02 }), RangeError);
    assert.throws(() => simulateCredit({ amountCents: 1_000_000, count: 12, graceDays: 90, monthlyRate: 0.02 }), RangeError);
    assert.throws(() => simulateCredit({ amountCents: 0, count: 12, graceDays: 0, monthlyRate: 0.02 }), RangeError);
  });
});

describe("creditDecision", () => {
  it("denies while an installment is late", () => {
    const d = creditDecision({ ...base, hasLate: true });
    assert.equal(d.status, "denied");
    assert.equal(d.reason, "late");
    assert.equal(d.approvedCents, 0);
  });

  it("approves a lower amount when the request is above the limit", () => {
    const d = creditDecision(base);
    assert.equal(d.status, "approvedLower");
    assert.equal(d.reason, "limit");
    assert.ok(d.approvedCents < base.amountCents);
    assert.equal(d.approvedCents % 10_000, 0);
  });

  it("approves in full when Open Finance data widens the limit", () => {
    const d = creditDecision({ ...base, openFinanceShared: true });
    assert.equal(d.status, "approved");
    assert.equal(d.approvedCents, base.amountCents);
    assert.ok(d.simulation.installmentCents > 0);
  });

  it("caps the amount by income commitment", () => {
    const d = creditDecision({ ...base, openFinanceShared: true, incomeCents: 1_000_000 });
    assert.equal(d.status, "approvedLower");
    assert.equal(d.reason, "income");
    assert.ok(d.simulation.installmentCents + base.monthlyDebtCents <= 1_000_000 * 0.3);
  });

  it("denies when current debt already uses the income commitment", () => {
    const d = creditDecision({ ...base, openFinanceShared: true, incomeCents: 500_000 });
    assert.equal(d.status, "denied");
    assert.equal(d.reason, "income");
  });

  it("denies when the approvable amount is below the product minimum", () => {
    const d = creditDecision({ ...base, availableLimitCents: 20_000 });
    assert.equal(d.status, "denied");
    assert.equal(d.reason, "limit");
  });

  it("charges a lower rate for better reputation", () => {
    const good = creditDecision({ ...base, openFinanceShared: true, reputation: 4.9 });
    const weak = creditDecision({ ...base, openFinanceShared: true, reputation: 4.0 });
    assert.ok(good.monthlyRate < weak.monthlyRate);
  });
});
