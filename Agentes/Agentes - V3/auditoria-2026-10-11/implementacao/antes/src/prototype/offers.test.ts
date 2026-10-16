import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CDI_RATE, funnelOf, limitIncreaseCents, offersFor, soldOffers, yieldCents } from "../../public/js/domain/offers.js";

describe("offersFor at checkout", () => {
  const checkout = { moment: "checkout", role: "payer", totalCents: 500_000, balanceCents: 900_000, cardAvailableCents: 800_000, preApprovedCents: 1_000_000 } as const;

  it("offers the pre-approved credit and the insurance, credit below the balance when the balance covers it", () => {
    const offers = offersFor(checkout);
    assert.deepEqual(offers.map((o) => o.product), ["insurance", "credit"]);
  });

  it("puts the credit first when the balance does not cover the payment", () => {
    const offers = offersFor({ ...checkout, balanceCents: 100_000 });
    assert.equal(offers[0].product, "credit");
    assert.equal(offers[0].valueCents, 500_000);
  });

  it("leaves the credit out when the pre-approved limit is too small", () => {
    assert.ok(!offersFor({ ...checkout, preApprovedCents: 200_000 }).some((o) => o.product === "credit"));
  });

  it("offers a limit increase only when the card does not cover the total", () => {
    assert.ok(!offersFor({ ...checkout, moment: "card" }).some((o) => o.product === "limit"));
    const [offer] = offersFor({ ...checkout, moment: "card", cardAvailableCents: 320_000 });
    assert.deepEqual(offer, { product: "limit", priority: 1, valueCents: 180_000 });
  });
});

describe("offersFor after the money is guarded", () => {
  it("shows the yield to the payer and the anticipation to the provider", () => {
    assert.deepEqual(offersFor({ moment: "guarded", role: "payer", totalCents: 500_000 }).map((o) => o.product), ["yield"]);
    assert.deepEqual(offersFor({ moment: "guarded", role: "payee", totalCents: 500_000, anticipableCents: 240_000 }), [{ product: "anticipation", priority: 1, valueCents: 240_000 }]);
    assert.deepEqual(offersFor({ moment: "guarded", role: "payee", totalCents: 500_000, anticipableCents: 0 }), []);
  });

  it("offers nothing to someone outside the payment", () => {
    assert.deepEqual(offersFor({ moment: "checkout", role: null, totalCents: 1 }), []);
  });
});

describe("limitIncreaseCents", () => {
  it("covers what is missing, rounded up to whole hundreds of reais", () => {
    assert.equal(limitIncreaseCents(500_000, 320_000), 180_000);
    assert.equal(limitIncreaseCents(500_001, 320_000), 190_000);
    assert.equal(limitIncreaseCents(100_000, 320_000), 0);
  });
});

describe("yieldCents", () => {
  it("grows with compound interest over the days the money stays guarded", () => {
    const expected = Math.round(1_000_000 * ((1 + CDI_RATE) ** (30 / 365) - 1));
    assert.equal(yieldCents(1_000_000, 30), expected);
    assert.equal(yieldCents(1_000_000, 0), 0);
    assert.equal(yieldCents(1_000_000, 365, 0.1), 100_000);
  });
});

describe("funnelOf", () => {
  it("counts shown and accepted offers, conversion and revenue per product", () => {
    // Arrange
    const events = [
      { product: "credit" as const, accepted: true, valueCents: 500_000, revenueCents: 40_000 },
      { product: "credit" as const, accepted: false, valueCents: 300_000, revenueCents: 0 },
      { product: "yield" as const, accepted: true, valueCents: 480_000, revenueCents: 0 },
    ];

    // Act
    const funnel = funnelOf(events);

    // Assert
    assert.deepEqual(funnel.find((f) => f.product === "credit"), { product: "credit", shown: 2, accepted: 1, conversion: 0.5, valueCents: 500_000, revenueCents: 40_000 });
    assert.deepEqual(funnel.find((f) => f.product === "limit"), { product: "limit", shown: 0, accepted: 0, conversion: 0, valueCents: 0, revenueCents: 0 });
    assert.equal(funnel.length, 5);
  });
});

describe("soldOffers", () => {
  it("leaves out the yield, which every payment gets without choosing", () => {
    // Arrange
    const events = [
      { product: "credit" as const, accepted: true, valueCents: 500_000, revenueCents: 40_000 },
      { product: "insurance" as const, accepted: false, valueCents: 40_000, revenueCents: 0 },
      { product: "yield" as const, accepted: true, valueCents: 480_000, revenueCents: 0 },
    ];

    // Act
    const sold = soldOffers(events);

    // Assert
    assert.deepEqual(sold.map((e) => e.product), ["credit", "insurance"]);
  });
});
