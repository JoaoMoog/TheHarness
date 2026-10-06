import test from "node:test";
import assert from "node:assert/strict";
import {
  PERFORMANCE,
  admitBuffer,
  dirtySince,
  refreshLoop,
} from "./performance-policy.js";
test("buffer admission bounds aggregate text, images and tabs without evicting work", () => {
  const buffers = new Map(
    Array.from({ length: 24 }, (_, i) => [
      i,
      { saved: "x", model: { getValueLength: () => 1 } },
    ]),
  );
  assert.equal(admitBuffer(buffers, 4), false);
  assert.equal(admitBuffer(buffers, 4, 0), true);
  const image = new Map([["a", { dataUrl: "x".repeat(1024) }]]);
  assert.equal(admitBuffer(image, PERFORMANCE.bufferBytes), false);
  assert.equal(buffers.size, 24);
});
test("dirty checkpoint is constant time and honors undo/save during concurrent edits", () => {
  let version = 1;
  const model = {
    getAlternativeVersionId: () => version,
    getValue() {
      throw Error("full text copy");
    },
  };
  assert.equal(dirtySince(model, 1), false);
  version = 2;
  const savingVersion = version;
  version = 3;
  assert.equal(dirtySince(model, savingVersion), true);
  version = 2;
  assert.equal(dirtySince(model, savingVersion), false);
});
test("refresh loop slows idle, suspends hidden and coalesces forced work", async () => {
  let time = 0,
    hidden = false,
    callback,
    delay,
    count = 0,
    finish;
  const loop = refreshLoop({
    run: async () => {
      count++;
      await new Promise((r) => (finish = r));
    },
    hidden: () => hidden,
    now: () => time,
    setTimer: (cb, ms) => {
      callback = cb;
      delay = ms;
      return 1;
    },
    clearTimer: () => {
      callback = null;
    },
  });
  assert.equal(delay, 10000);
  const first = callback();
  await loop.refresh();
  await loop.refresh();
  assert.equal(count, 1);
  finish();
  await first;
  assert.equal(count, 2);
  finish();
  await new Promise((r) => setImmediate(r));
  time = 61000;
  const idle = loop.refresh();
  finish();
  await idle;
  assert.equal(delay, 30000);
  hidden = true;
  loop.visibility();
  assert.equal(callback, null);
  time += 3000;
  hidden = false;
  const focus = loop.visibility();
  finish();
  await focus;
  loop.stop();
  assert.equal(callback, null);
});
