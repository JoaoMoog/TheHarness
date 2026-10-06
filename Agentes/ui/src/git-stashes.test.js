import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { createGitManagerHeader } from "./git-manager.js";
import {
  createStashState,
  STASH_PAGE,
  STASH_FILES_PAGE,
} from "./git-stashes.js";
test("Git modal header keeps refresh and close together after the title with accessible actions", () => {
  const { document } = new JSDOM("<body></body>").window;
  const el = (tag, cls, text) => {
    const node = document.createElement(tag);
    node.className = cls || "";
    if (text) node.textContent = text;
    return node;
  };
  let refresh = 0,
    close = 0;
  const button = (_, title, fn) => {
    const b = el("button");
    b.setAttribute("aria-label", title);
    b.onclick = fn;
    return b;
  };
  const result = createGitManagerHeader({
    el,
    button,
    refresh: () => refresh++,
    close: () => close++,
  });
  assert.equal(result.header.children.length, 2);
  assert.equal(result.header.firstElementChild.tagName, "H2");
  const group = result.header.lastElementChild;
  assert.equal(group.className, "git-manager-actions");
  assert.deepEqual([...group.children], [result.update, result.dismiss]);
  assert.equal(
    result.update.getAttribute("aria-label"),
    "Atualizar branches e stashes",
  );
  result.update.click();
  result.dismiss.click();
  assert.equal(refresh, 1);
  assert.equal(close, 1);
});
test("stash metadata is demand-only, one cache, released on collapse/close/project switch", async () => {
  const s = createStashState();
  let reads = 0;
  const read = async (p) => {
    reads++;
    assert.equal(p.root, "repo");
    return { paths: ["src/api.cs"] };
  };
  s.setRoot("repo");
  s.prune([{ oid: "a" }]);
  assert.equal(reads, 0);
  await s.toggle("a", read);
  assert.deepEqual(s.view.paths, ["src/api.cs"]);
  assert.equal(s.view.paths.length, 1);
  assert.equal(reads, 1);
  await s.toggle("a", read);
  assert.deepEqual(s.view.paths, []);
  assert.equal(reads, 1);
  await s.toggle("a", read);
  s.setRoot("other");
  assert.deepEqual(s.view.paths, []);
  s.clear();
  assert.equal(s.view.oid, "");
  assert.equal(STASH_PAGE, 50);
  assert.equal(STASH_FILES_PAGE, 100);
});
test("stash late replies and errors never revive closed cache or auto-retry", async () => {
  const s = createStashState();
  s.setRoot("one");
  let done,
    reads = 0;
  const first = s.toggle("a", () => {
    reads++;
    return new Promise((resolve) => (done = resolve));
  });
  await s.toggle("b", () => {
    reads++;
  });
  assert.equal(reads, 1);
  s.setRoot("two");
  done({ paths: ["old.cs"] });
  await first;
  assert.deepEqual(s.view.paths, []);
  assert.equal(s.view.oid, "");
  await s.toggle("b", async () => ({ paths: Array(2001).fill("huge") }));
  assert.match(s.view.error, /volumosa/);
  assert.deepEqual(s.view.paths, []);
  s.prune([{ oid: "other" }]);
  assert.equal(s.view.error, "");
  await s.toggle("a", async () => ({ paths: [42] }));
  assert.match(s.view.error, /inválida/);
});
