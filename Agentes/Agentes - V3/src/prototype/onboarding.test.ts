import assert from "node:assert/strict";
import { test } from "node:test";
// @ts-expect-error Browser domain module.
import { createOnboarding } from "../../public/js/domain/onboarding.js";

test("first visit starts at zero; closing unfinished restarts; finish persists independently of account", () => {
  const memory = new Map<string, string>();
  const storage = { getItem: (key: string) => memory.get(key), setItem: (key: string, value: string) => memory.set(key, value) };
  const options = { storage, key: "onboarding" };
  const first = createOnboarding(options);
  first.next();
  assert.equal(first.step, 1);
  assert.equal(createOnboarding(options).step, 0);
  first.finish();
  assert.equal(createOnboarding(options).step, null);
  first.open();
  first.previous();
  assert.equal(first.step, 0);
  for (let i = 0; i < 10; i++) first.next();
  assert.equal(first.step, 3);
  assert.equal(createOnboarding(options).step, null);
  assert.equal(createOnboarding({ ...options, key: "other-environment" }).step, 0);
});

test("existing accounts skip the automatic presentation; isolated mock completion cannot write preferences", () => {
  let writes = 0;
  const storage = { getItem: () => null, setItem: () => { writes++; } };
  assert.equal(createOnboarding({ storage, key: "onboarding", existingAccount: true }).step, null);
  assert.equal(createOnboarding({ storage, key: "onboarding", preview: true }).step, null);
  const mock = createOnboarding({ storage, key: "onboarding", preview: true, previewStep: 2 });
  assert.equal(mock.step, 2);
  mock.finish();
  assert.equal(mock.step, null);
  assert.equal(writes, 0);
});

test("blocked preference storage still allows completing and replaying in the current session", () => {
  const storage = { getItem() { throw new Error("Blocked"); }, setItem() { throw new Error("Blocked"); } };
  const flow = createOnboarding({ storage, key: "onboarding" });
  assert.equal(flow.step, 0);
  flow.finish();
  assert.equal(flow.step, null);
  flow.open();
  assert.equal(flow.step, 0);
});
