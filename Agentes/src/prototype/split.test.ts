import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { equalBps, formatBps, parseContact, parsePercent, pendingCount, rebalance, sharesFromBps, splitShares } from "../../public/js/domain/split.js";

describe("splitShares", () => {
  it("splits evenly when the total divides by the number of people", () => {
    // Arrange
    const names = ["Ana", "Bruno", "Carla"];

    // Act
    const shares = splitShares(900_000, names);

    // Assert
    assert.deepEqual(shares, [
      { name: "Ana", shareCents: 300_000 },
      { name: "Bruno", shareCents: 300_000 },
      { name: "Carla", shareCents: 300_000 },
    ]);
  });

  it("needs at least two people", () => {
    assert.throws(() => splitShares(100_000, ["Ana"]), RangeError);
  });
});

describe("parsePercent", () => {
  it("reads whole and decimal percentages, with comma or dot, as basis points", () => {
    assert.equal(parsePercent("50"), 5000);
    assert.equal(parsePercent("33,33"), 3333);
    assert.equal(parsePercent(" 12.5 % "), 1250);
  });

  it("rejects zero, more than 100%, more than two decimals and text", () => {
    for (const text of ["0", "100,01", "10,123", "abc", "", "-5"]) assert.equal(parsePercent(text), null);
  });
});

describe("equalBps", () => {
  it("splits 100% evenly, the last one taking the rounding", () => {
    assert.deepEqual(equalBps(3), [3333, 3333, 3334]);
    assert.deepEqual(equalBps(1), [10000]);
  });
});

describe("sharesFromBps", () => {
  it("turns percentages into cents that add up to the total", () => {
    const shares = sharesFromBps(800_000, [5000, 3000, 2000]);
    assert.deepEqual(shares, [400_000, 240_000, 160_000]);
  });

  it("gives the leftover cents to the last person", () => {
    const shares = sharesFromBps(100_000, [3333, 3333, 3334]);
    assert.equal(shares.reduce((a, b) => a + b, 0), 100_000);
    assert.equal(shares[2], 33_340);
  });

  it("rejects percentages that do not add up to 100%", () => {
    assert.throws(() => sharesFromBps(100_000, [5000, 4000]), RangeError);
  });
});

describe("rebalance", () => {
  const people = [
    { name: "Ana", status: "accepted", paid: false, bps: 5000, shareCents: 0 },
    { name: "Bruno", status: "pending", paid: false, bps: 3000, shareCents: 0 },
    { name: "Carla", status: "pending", paid: false, bps: 2000, shareCents: 0 },
  ];

  it("keeps the chosen percentages and computes each share, without changing the input", () => {
    const next = rebalance(900_000, people);
    assert.deepEqual(next.map((p) => p.shareCents), [450_000, 270_000, 180_000]);
    assert.equal(people[0].shareCents, 0);
  });

  it("spreads the share of someone who left in proportion to the others", () => {
    const next = rebalance(800_000, people.slice(0, 2));
    assert.deepEqual(next.map((p) => p.bps), [6250, 3750]);
    assert.deepEqual(next.map((p) => p.shareCents), [500_000, 300_000]);
  });

  it("splits evenly when nobody chose percentages", () => {
    const plain = people.map(({ bps, ...p }) => p);
    assert.deepEqual(rebalance(900_000, plain).map((p) => p.shareCents), [300_000, 300_000, 300_000]);
  });

  it("gives the whole total to the organizer when everyone else left", () => {
    assert.deepEqual(rebalance(900_000, [people[0]]).map((p) => [p.bps, p.shareCents]), [[10000, 900_000]]);
  });

  it("refuses to change shares after someone has paid", () => {
    assert.throws(() => rebalance(900_000, [{ ...people[0], paid: true }, people[1]]), RangeError);
  });
});

describe("formatBps", () => {
  it("shows percentages the Brazilian way, without useless zeros", () => {
    assert.equal(formatBps(5000), "50%");
    assert.equal(formatBps(6250), "62,5%");
    assert.equal(formatBps(3333), "33,33%");
  });
});

describe("parseContact", () => {
  it("reads a Brazilian mobile number as WhatsApp and an e-mail as a link", () => {
    assert.deepEqual(parseContact("11988881001"), { channel: "whatsapp", contact: "(11) 98888-1001" });
    assert.deepEqual(parseContact("  Ana.Lima@Exemplo.com "), { channel: "email", contact: "ana.lima@exemplo.com" });
  });

  it("rejects text that is neither a mobile number nor an e-mail", () => {
    for (const text of ["", "João", "1234", "ana@", "1133334444"]) assert.equal(parseContact(text), null);
  });
});

describe("pendingCount", () => {
  it("counts who still has to answer the invite", () => {
    assert.equal(pendingCount([{ status: "accepted" }, { status: "pending" }, { status: "pending" }]), 2);
  });
});
