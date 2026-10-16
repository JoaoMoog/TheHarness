import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { prepPlan, trackOf } from "../../public/js/domain/presentation-prep.js";

const EXEC = [9, 10, 11, 12];
const FULL = [0, 1, 2, 3];

describe("prepPlan", () => {
  it("starts empty and runs the earlier scenarios of the track when nothing is ready", () => {
    // Act
    const plan = prepPlan({ track: EXEC, index: 11, ready: null, resets: 0 });

    // Assert
    assert.deepEqual(plan, { reset: true, run: [9, 10] });
  });

  it("reuses the demo when the scenario is the one already ready", () => {
    const plan = prepPlan({ track: EXEC, index: 11, ready: { index: 11, resets: 2 }, resets: 2 });
    assert.deepEqual(plan, { reset: false, run: [] });
  });

  it("continues from the scenario ready when it comes earlier in the same track", () => {
    const plan = prepPlan({ track: EXEC, index: 12, ready: { index: 10, resets: 1 }, resets: 1 });
    assert.deepEqual(plan, { reset: false, run: [10, 11] });
  });

  it("starts over when the demo restarted after the scenario was prepared", () => {
    const plan = prepPlan({ track: EXEC, index: 11, ready: { index: 11, resets: 1 }, resets: 2 });
    assert.deepEqual(plan, { reset: true, run: [9, 10] });
  });

  it("starts over when the scenario ready comes later in the track", () => {
    const plan = prepPlan({ track: EXEC, index: 10, ready: { index: 12, resets: 0 }, resets: 0 });
    assert.deepEqual(plan, { reset: true, run: [9] });
  });

  it("never reuses a scenario prepared in another track", () => {
    const plan = prepPlan({ track: EXEC, index: 10, ready: { index: 2, resets: 0 }, resets: 0 });
    assert.deepEqual(plan, { reset: true, run: [9] });
  });

  it("the first scenario of a track starts from an empty demo", () => {
    assert.deepEqual(prepPlan({ track: FULL, index: 0, ready: null, resets: 0 }), { reset: true, run: [] });
  });
});

describe("trackOf", () => {
  const tracks = { executive: EXEC, full: FULL };

  it("prefers the list being played when it has the scenario", () => {
    assert.deepEqual(trackOf(tracks, 10, [10, 12]), [10, 12]);
  });

  it("falls back to the track that holds the scenario", () => {
    assert.deepEqual(trackOf(tracks, 11, null), EXEC);
    assert.deepEqual(trackOf(tracks, 2, null), FULL);
  });

  it("plays a scenario outside every track by itself", () => {
    assert.deepEqual(trackOf(tracks, 40, null), [40]);
  });
});
