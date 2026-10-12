import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { POINT_VALUE_CENTS, REFERRAL_POINTS, benefitsFor, pointsFor, redeemFor } from "../../public/js/domain/points.js";

describe("pointsFor", () => {
  it("gives 1 point for each R$ 10 released", () => {
    assert.equal(pointsFor(1_600_000), 1_600);
    assert.equal(pointsFor(999), 0);
    assert.equal(REFERRAL_POINTS, 500);
  });
});

describe("redeemFor", () => {
  it("turns points into a discount of up to 10% of the payment", () => {
    // Act
    const r = redeemFor(1_000, 1_000_000);

    // Assert
    assert.equal(POINT_VALUE_CENTS, 10);
    assert.deepEqual(r, { points: 1_000, cents: 10_000 });
  });

  it("uses only the points that fit in the 10% cap", () => {
    assert.deepEqual(redeemFor(50_000, 100_000), { points: 1_000, cents: 10_000 });
    assert.deepEqual(redeemFor(0, 100_000), { points: 0, cents: 0 });
  });
});

describe("benefitsFor", () => {
  it("gives cashback in building material, 90-day warranty and home assistance to a big finished renovation", () => {
    // Act
    const list = benefitsFor({ description: "Reforma da cozinha", totalCents: 2_000_000, status: "completed" });

    // Assert
    assert.deepEqual(list.map((b) => [b.key, b.ready]), [["cashback", true], ["warranty", true], ["assist", true]]);
    assert.equal(list[0].valueCents, 30_000);
  });

  it("keeps the benefits waiting while the service is not finished", () => {
    const list = benefitsFor({ description: "Pintura da sala", totalCents: 400_000, status: "active" });
    assert.deepEqual(list.map((b) => [b.key, b.ready]), [["cashback", false], ["warranty", false]]);
    assert.equal(list[0].valueCents, 20_000);
  });

  it("has no material cashback for a service that is not a renovation", () => {
    assert.deepEqual(benefitsFor({ description: "Projeto de interiores", totalCents: 100_000, status: "completed" }).map((b) => b.key), ["warranty"]);
  });
});
