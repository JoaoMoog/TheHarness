import assert from "node:assert/strict";
import { test } from "node:test";
import { JUDGMENT_POLICY, noulConfidence, route } from "./policy.js";

test("noul confidence is |2p - 1|, so 0.5 means no confidence", () => {
  assert.equal(noulConfidence(0.5), 0);
  assert.equal(noulConfidence(0), 1);
  assert.ok(Math.abs(noulConfidence(0.9) - 0.8) < 1e-9);
});

test("routes to automatic when confidence meets the threshold", () => {
  // Arrange
  const confidence = JUDGMENT_POLICY.deliveryCoverage.threshold;

  // Act
  const result = route("deliveryCoverage", confidence);

  // Assert
  assert.equal(result, "automatic");
});

test("routes to human review when confidence is below the threshold", () => {
  const result = route("disputeReason", 0.5);
  assert.equal(result, "humanReview");
});

test("always routes fraud signals to human review, even at full confidence", () => {
  const result = route("fraudSignals", 1);
  assert.equal(result, "humanReview");
});

test("never gates queue priority, because it only orders work", () => {
  const result = route("queuePriority", 0);
  assert.equal(result, "automatic");
});

test("rejects confidence outside 0 to 1", () => {
  assert.throws(() => route("tacitConfirmation", 1.2), RangeError);
  assert.throws(() => route("tacitConfirmation", Number.NaN), RangeError);
});
