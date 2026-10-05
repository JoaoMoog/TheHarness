import assert from "node:assert/strict";
import { test } from "node:test";
import { AV_2026_001, sumStages, totalFinanced } from "./av-2026-001.js";

test("stage values add up to the contract total", () => {
  assert.equal(sumStages(AV_2026_001), AV_2026_001.totalCents);
});

test("installment plan matches the demo numbers", () => {
  const { installments } = AV_2026_001.payment;
  assert.equal(installments.count, 6);
  assert.equal(installments.valueCents, 215_302);
  assert.equal(totalFinanced(AV_2026_001), 1_291_812);
});

test("custody balance equals the total minus released stages", () => {
  const released = AV_2026_001.stages
    .filter((stage) => stage.status === "released")
    .reduce((acc, stage) => acc + stage.valueCents, 0);
  assert.equal(AV_2026_001.totalCents - released, 840_000);
});
