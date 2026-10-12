import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { addMetrics, custodyCents, demoMetrics, metricsDelta, releasedCents } from "../../public/js/domain/metrics.js";

const stage = (status: string, valueCents: number, extra = {}) => ({ status, valueCents, ...extra });
const contract = (paidInCents: number, stages: object[], extra = {}) => ({ paidInCents, refundedCents: 0, stages, ...extra });

describe("releasedCents", () => {
  it("adds released stages, the provider part of a split and partial releases", () => {
    // Arrange
    const c = contract(30_000, [
      stage("released", 10_000),
      stage("split", 10_000, { split: { providerCents: 6_000 } }),
      stage("inProgress", 10_000, { partialReleasedCents: 2_000 }),
    ]);

    // Act / Assert
    assert.equal(releasedCents(c), 18_000);
    assert.equal(custodyCents(c), 12_000);
  });

  it("never reports negative custody", () => {
    assert.equal(custodyCents({ ...contract(0, [stage("released", 5_000)]), refundedCents: 0 }), 0);
  });
});

describe("demoMetrics", () => {
  it("is all zero for the empty demo", () => {
    const m = demoMetrics({ contracts: [], offerEvents: [], disputes: [], people: {} });
    assert.deepEqual(m, { payments: 0, guardedCents: 0, releasedCents: 0, anticipatedCents: 0, accounts: 0, offersShown: 0, offersAccepted: 0, revenueCents: 0, disputesClosed: 0 });
  });

  it("sums money kept, released and anticipated, accounts, offers, bank revenue and closed disputes", () => {
    // Arrange
    const s = {
      contracts: [
        contract(16_000_00, [stage("released", 8_000_00), stage("inProgress", 8_000_00, { anticipation: { netCents: 7_379_60 } })]),
        contract(3_000_00, [stage("pending", 3_000_00)], { participants: [{ btg: true }, { btg: false }] }),
      ],
      offerEvents: [
        { product: "insurance", accepted: true, valueCents: 400_00, revenueCents: 400_00 },
        { product: "credit", accepted: false, valueCents: 18_000_00, revenueCents: 0 },
        { product: "credit", accepted: true, valueCents: 18_000_00, revenueCents: 1_200_00 },
      ],
      disputes: [{ status: "closed" }, { status: "open" }],
      people: { voce: {} },
    };

    // Act
    const m = demoMetrics(s);

    // Assert
    assert.equal(m.payments, 2);
    assert.equal(m.guardedCents, 19_000_00);
    assert.equal(m.releasedCents, 8_000_00);
    assert.equal(m.anticipatedCents, 7_379_60);
    assert.equal(m.accounts, 2);
    assert.equal(m.offersShown, 3);
    assert.equal(m.offersAccepted, 2);
    assert.equal(m.revenueCents, 1_600_00);
    assert.equal(m.disputesClosed, 1);
  });

  it("tolerates a state without the optional lists", () => {
    assert.equal(demoMetrics({ contracts: [] }).offersShown, 0);
  });
});

describe("metricsDelta", () => {
  it("returns what changed between two snapshots", () => {
    const before = demoMetrics({ contracts: [], offerEvents: [], disputes: [], people: {} });
    const after = { ...before, guardedCents: 16_000_00, accounts: 1 };
    const d = metricsDelta(before, after);
    assert.equal(d.guardedCents, 16_000_00);
    assert.equal(d.accounts, 1);
    assert.equal(d.revenueCents, 0);
  });

  it("treats a missing snapshot as zero", () => {
    const after = demoMetrics({ contracts: [contract(1_00, [stage("pending", 1_00)])] });
    assert.equal(metricsDelta(null, after).guardedCents, 1_00);
  });
});

describe("addMetrics", () => {
  it("adds the numbers of the scenarios that were shown", () => {
    // Arrange
    const first = { ...demoMetrics({ contracts: [] }), guardedCents: 16_000_00, accounts: 1 };
    const second = { ...demoMetrics({ contracts: [] }), guardedCents: 18_000_00, revenueCents: 1_377_18 };

    // Act
    const total = addMetrics(first, second);

    // Assert
    assert.equal(total.guardedCents, 34_000_00);
    assert.equal(total.accounts, 1);
    assert.equal(total.revenueCents, 1_377_18);
  });

  it("treats a missing total as zero", () => {
    const only = { ...demoMetrics({ contracts: [] }), payments: 1 };
    assert.deepEqual(addMetrics(null, only), only);
  });
});

describe("demoMetrics offers", () => {
  it("does not count the automatic yield as an offer shown or accepted", () => {
    // Arrange
    const s = {
      contracts: [],
      offerEvents: [
        { product: "yield", accepted: true, valueCents: 16_000_00, revenueCents: 0 },
        { product: "insurance", accepted: true, valueCents: 400_00, revenueCents: 400_00 },
        { product: "credit", accepted: false, valueCents: 16_000_00, revenueCents: 0 },
      ],
    };

    // Act
    const m = demoMetrics(s);

    // Assert
    assert.equal(m.offersShown, 2);
    assert.equal(m.offersAccepted, 1);
  });
});
