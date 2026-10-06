import test from "node:test";
import assert from "node:assert/strict";
import { revealPlan, createNavigationGate, revealAncestors } from "./git-navigation.js";

test("file and rename destination reveal only ancestors; Windows separators supported", () => {
  assert.deepEqual(revealPlan("src\\pages\\home.ts").ancestors, ["", "src", "src/pages"]);
  assert.deepEqual(revealPlan("README.md").ancestors, [""]);
  assert.equal(revealPlan("new/location/file.ts").path, "new/location/file.ts");
  assert.equal(revealPlan("src/folder/").path, "src/folder");
});
test("unsafe and absolute paths are rejected", () => {
  for (const path of ["", "../x", "a/../x", "/x", "C:\\x", "a//x", "a/./x"])
    assert.throws(() => revealPlan(path));
});
test("revealing uses bounded serial directory reads, not a recursive search", async () => {
  const calls = [], expanded = new Set([""]);
  const result = await revealAncestors(revealPlan("src/pages/file.ts"), {
    active: () => true, expanded, limit: 16,
    load: async (path) => { calls.push(path); },
  });
  assert.equal(result, true);
  assert.deepEqual(calls, ["", "src", "src/pages"]);
  assert.equal(expanded.size, 3);
  await assert.rejects(revealAncestors(revealPlan("other/file.ts"), {
    active: () => true, expanded, limit: 3, load: async () => {},
  }), /Limite/);
});
test("project/navigation change cancels pending reveal and late diff", async () => {
  const gate = createNavigationGate(), token = gate.begin(), expanded = new Set([""]);
  let calls = 0;
  const result = await revealAncestors(revealPlan("src/pages/file.ts"), {
    active: () => gate.current(token), expanded, limit: 16,
    load: async () => { calls++; gate.invalidate(); },
  });
  assert.equal(result, false);
  assert.equal(calls, 1);
  assert.equal(expanded.size, 1);
  assert.equal(gate.current(token), false);
});
