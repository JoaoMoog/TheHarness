import test from "node:test";
import assert from "node:assert/strict";
import { resolveMarkers, readyUrl } from "./workbench.js";
import { JSDOM } from "jsdom";
import { createTerminalTab, closeTerminalSession } from "./terminal-tabs.js";
import {
  groupGitChanges,
  gitFolderRows,
  gitFolderPage,
  createGitFolderState,
  GIT_FOLDER_LIMITS,
} from "./git-folders.js";
import { resetEmptyEditorView } from "./editor-view.js";

test("Git defaults open every known level; collapse choices survive redraw/status, not project switch", () => {
  const state = createGitFolderState();
  state.setRoot("one");
  const tree = groupGitChanges([{path: "src/pages/events/details/index.ts"}]);
  const rows = () => gitFolderRows(tree, state.sync(tree, 1));
  assert.equal(rows().filter(row => row.kind === "folder").length, 4);
  assert.equal(rows().at(-1).label, "index.ts");
  assert.ok(rows().filter(row => row.kind === "folder").every(row => row.expanded));
  state.collapse("src/pages", 1);
  assert.equal(rows().at(-1).path, "src/pages");
  state.invalidate();
  assert.equal(rows().at(-1).expanded, false);
  state.expand("src/pages", 1);
  assert.equal(rows().at(-1).label, "index.ts");
  state.collapseAll(1);
  assert.equal(rows().length, 1);
  assert.equal(rows()[0].expanded, false);
  assert.equal(gitFolderRows(tree, state.sync(tree, 0)).at(-1).label, "index.ts");
  state.invalidate();
  assert.equal(rows().length, 1);
  state.expandAll(1);
  assert.equal(rows().at(-1).label, "index.ts");
  const more = groupGitChanges([{path: "src/other/new.ts"}]);
  assert.equal(gitFolderRows(more, state.sync(more, 1)).at(-1).label, "new.ts");
  state.collapseAll(1);
  state.setRoot("two");
  assert.equal(rows().at(-1).label, "index.ts");
});

test("Git default expansion loads scoped new folders once, and collapse-all releases snapshots", async () => {
  const state = createGitFolderState();
  const base = [{path: "src/", directory: true}];
  let reads = 0, activeReads = 0;
  const read = async ({root, path}) => {
    assert.equal(root, "repo");
    assert.equal(path, "src/");
    reads++; activeReads++;
    assert.equal(activeReads, 1);
    await Promise.resolve();
    activeReads--;
    return {entries: [{path: "src/api/nested/index.ts"}]};
  };
  await state.loadExpanded("repo", base, read);
  await state.loadExpanded("repo", base, read);
  assert.equal(reads, 1);
  const tree = groupGitChanges(state.project(base).entries);
  assert.equal(gitFolderRows(tree, state.sync(tree, 1)).at(-1).label, "index.ts");
  state.collapseAll(1);
  assert.equal(state.project(base).entries[0], base[0]);
  await state.loadExpanded("repo", base, read);
  assert.equal(reads, 1);
  state.expandAll(1);
  await state.loadExpanded("repo", base, read);
  assert.equal(reads, 2);
});

test("Git bulk expansion bounds reads and presentation; failure does not retry on redraw", async () => {
  const state = createGitFolderState();
  const base = Array.from({length: 2000}, (_, i) => ({path: `dir-${i}/`, directory: true}));
  let reads = 0;
  const read = async ({path}) => { reads++; return {entries: [{path: `${path}file.ts`}]}; };
  await assert.rejects(state.loadExpanded("repo", base, read), /16 pastas/);
  assert.equal(reads, 16);
  await state.loadExpanded("repo", base, read);
  assert.equal(reads, 16);
  const tree = groupGitChanges(state.project(base).entries);
  assert.equal(gitFolderPage(gitFolderRows(tree, state.sync(tree, 1))).rows.length, 200);
  assert.equal(state.project(base).entries.length, 2000);
  state.collapseAll(1);
  assert.ok(state.project(base).entries.every(entry => entry.directory));
  state.expandAll(1);
  let errors = 0;
  const offline = async () => { errors++; throw Error("offline"); };
  await assert.rejects(state.loadExpanded("repo", base, offline), /offline/);
  await state.loadExpanded("repo", base, offline);
  assert.equal(errors, 1);
});

test("Git bulk expansion stops when hidden, collapsed, invalidated or switching project", async () => {
  for (const cancel of [state => state.collapseAll(1), state => state.invalidate(), state => state.setRoot("other")]) {
    const state = createGitFolderState();
    const base = [{path: "a/", directory: true}, {path: "b/", directory: true}];
    let finish, reads = 0;
    const pending = state.loadExpanded("repo", base, () => { reads++; return new Promise(resolve => finish = resolve); });
    await state.loadExpanded("repo", base, async () => assert.fail("parallel batch"));
    cancel(state);
    finish({entries: [{path: "a/nested/file.ts"}]});
    await pending;
    assert.equal(reads, 1);
    assert.equal(state.project(base).entries[0], base[0]);
    assert.equal(state.expanding, false);
  }
  const state = createGitFolderState();
  const base = [{path: "a/", directory: true}, {path: "b/", directory: true}];
  let visible = true, reads = 0;
  await state.loadExpanded("repo", base, async ({path}) => {
    reads++; visible = false; return {entries: [{path: `${path}file.ts`}]};
  }, {active: () => visible});
  assert.equal(reads, 1);
  assert.equal(state.expanding, false);
});

test("Git folders group only supplied changes and preserve actionable paths", () => {
  const entries = [
    { path: "README.md", x: " ", y: "M" },
    { path: "src/endpoint.ts", oldPath: "old/api.ts", x: "R", y: " " },
    { path: "src/api/health.ts", conflict: true, x: "U", y: "U" },
    { path: "src/another.ts", x: " ", y: "M" },
    { path: "new/group/", directory: true, x: "?", y: "?" },
    { path: "windows\\file.cs", x: " ", y: "M" },
  ];
  const groups = groupGitChanges(entries);
  const expanded = new Set(["src", "src/api", "new", "windows", "stale"]);
  const rows = gitFolderRows(groups, expanded);
  assert.equal(rows[0].label, "README.md");
  assert.equal(
    rows.find((r) => r.kind === "folder" && r.path === "src").count,
    3,
  );
  assert.equal(rows.find((r) => r.entry === entries[1]).label, "endpoint.ts");
  assert.equal(rows.find((r) => r.entry === entries[4]).label, "group");
  assert.equal(rows.find((r) => r.entry === entries[5]).label, "file.cs");
  assert.deepEqual(
    new Set(rows.filter((r) => r.entry).map((r) => r.entry)),
    new Set(entries),
  );
  assert.equal(entries[1].oldPath, "old/api.ts");
  assert.equal(entries[5].path, "windows\\file.cs");
  assert.equal(expanded.has("stale"), false);
  const collapsed = gitFolderRows(groups, new Set());
  assert.equal(collapsed.filter((r) => r.kind === "file").length, 1);
  assert.equal(collapsed.filter((r) => r.kind === "folder").length, 3);
});

test("Git folder headers and files share the 200-row page budget", () => {
  const entries = Array.from({ length: 2000 }, (_, i) => ({
    path: `folder-${i}/file.ts`,
  }));
  const groups = groupGitChanges(entries);
  const expanded = new Set(groups.folders.keys());
  const rows = gitFolderRows(groups, expanded);
  assert.equal(rows.length, 4000);
  const files = [];
  for (let i = 0; i < 20; i++) {
    const page = gitFolderPage(rows, i);
    assert.equal(page.pages, 20);
    assert.equal(page.rows.length, 200);
    files.push(
      ...page.rows.filter((r) => r.kind === "file").map((r) => r.entry),
    );
  }
  assert.deepEqual(new Set(files), new Set(entries));
  assert.equal(gitFolderPage(rows, 100).page, 19);
  assert.equal(gitFolderPage([], 100).page, 0);
  assert.equal(gitFolderPage([], 100).rows.length, 0);
  assert.equal(gitFolderPage(rows, -1).page, 0);
});

test("Git expansion is separate for prepared changes and folders with special names", () => {
  const groups = groupGitChanges([
    { path: "__proto__/file.ts" },
    { path: "src/file.ts" },
  ]);
  const prepared = new Set(["src"]);
  const changes = new Set();
  assert.equal(
    gitFolderRows(groups, prepared).filter((r) => r.kind === "file").length,
    1,
  );
  assert.equal(
    gitFolderRows(groups, changes).filter((r) => r.kind === "file").length,
    0,
  );
  changes.add("__proto__");
  assert.equal(
    gitFolderRows(groups, changes).find((r) => r.kind === "file").entry.path,
    "__proto__/file.ts",
  );
  assert.deepEqual([...prepared], ["src"]);
});

test("Git tree reveals one actual directory level at a time", () => {
  const entry = {
    path: "src/webparts/app/pages/Home/index.tsx",
    x: " ",
    y: "M",
  };
  const tree = groupGitChanges([entry]);
  const expanded = new Set();
  assert.deepEqual(
    gitFolderRows(tree, expanded).map((r) => r.label),
    ["src"],
  );
  const path = [
    "src",
    "src/webparts",
    "src/webparts/app",
    "src/webparts/app/pages",
    "src/webparts/app/pages/Home",
  ];
  path.forEach((p, i) => {
    expanded.add(p);
    const rows = gitFolderRows(tree, expanded);
    assert.equal(rows.at(-1).depth, i + 1);
    assert.equal(
      rows.at(-1).label,
      i === 4 ? "index.tsx" : path[i + 1].split("/").at(-1),
    );
  });
  assert.equal(gitFolderRows(tree, expanded).at(-1).entry, entry);
  expanded.delete("src/webparts");
  assert.deepEqual(
    gitFolderRows(tree, expanded).map((r) => r.label),
    ["src", "webparts"],
  );
});

test("new Git folders expand inline with bounded cache, no repeated reads, collapse releases", async () => {
  const folders = createGitFolderState();
  const directory = {
    path: "src/pages/events/",
    directory: true,
    x: "?",
    y: "?",
  };
  const base = [directory, { path: "README.md", x: " ", y: "M" }];
  let reads = 0;
  const result = {
    entries: [{ path: "src/pages/events/details/index.ts", x: "?", y: "?" }],
    partial: false,
  };
  const read = async (params) => {
    reads++;
    assert.deepEqual(params, { root: "repo", path: directory.path });
    return result;
  };
  assert.equal(await folders.load("repo", base, directory, read), true);
  assert.equal(await folders.load("repo", base, directory, read), true);
  assert.equal(reads, 1);
  folders.expanded[1].add("src");
  folders.expanded[1].add("src/pages");
  folders.expanded[1].add("src/pages/events");
  const projected = folders.project(base);
  assert.equal(projected.partial, false);
  assert.equal(projected.entries[0], result.entries[0]);
  const rows = gitFolderRows(
    groupGitChanges(projected.entries),
    folders.expanded[1],
  );
  assert.equal(rows.at(-1).label, "details");
  folders.expanded[0].add("src/pages");
  folders.collapse("src/pages", 1);
  assert.equal(folders.expanded[0].has("src/pages"), true);
  assert.equal(folders.expanded[1].has("src"), true);
  assert.equal(folders.expanded[1].has("src/pages/events"), false);
  assert.equal(folders.project(base).entries[0], directory);
  await folders.load("repo", base, directory, read);
  assert.equal(reads, 2);
  folders.invalidate();
  assert.equal(folders.project(base).entries[0], directory);
});

test("Git folder reads serialize and discard late responses after collapse or project switch", async () => {
  const folders = createGitFolderState();
  const entry = { path: "a/", directory: true };
  let finish;
  const read = () =>
    new Promise((resolve) => {
      finish = resolve;
    });
  const pending = folders.load("one", [entry], entry, read);
  await assert.rejects(folders.load("one", [entry], entry, read), /Aguarde/);
  folders.collapse("a");
  finish({ entries: [{ path: "a/file.ts" }] });
  assert.equal(await pending, false);
  assert.equal(folders.pending, null);
  const late = folders.load("one", [entry], entry, read);
  folders.setRoot("two");
  finish({ entries: [{ path: "a/file.ts" }] });
  assert.equal(await late, false);
  assert.equal(folders.project([entry]).entries[0], entry);
  await assert.rejects(
    folders.load("two", [entry], entry, async () => {
      throw Error("offline");
    }),
    /offline/,
  );
  assert.equal(folders.pending, null);
  await assert.rejects(
    folders.load("two", [entry], entry, async () => ({
      entries: [{ path: "outside/file.ts" }],
    })),
    /fora da pasta/,
  );
  assert.equal(folders.project([entry]).entries[0], entry);
});

test("Git tree bounds depth/nodes and loaded records while retaining full paths", async () => {
  const entries = Array.from({ length: 2000 }, (_, i) => ({
    path: `root-${i}/${"nested/".repeat(30)}file.ts`,
  }));
  const tree = groupGitChanges(entries);
  assert.equal(tree.compacted, true);
  assert.ok(tree.folders.size <= GIT_FOLDER_LIMITS.nodes);
  const rows = gitFolderRows(tree, new Set(tree.folders.keys()));
  assert.ok(rows.every((r) => r.depth <= 16));
  assert.deepEqual(
    new Set(rows.filter((r) => r.entry).map((r) => r.entry)),
    new Set(entries),
  );
  assert.equal(gitFolderPage(rows).rows.length, 200);
  const state = createGitFolderState();
  const dir = { path: "new/", directory: true };
  const base = [
    dir,
    ...Array.from({ length: 100 }, (_, i) => ({ path: `file-${i}.ts` })),
  ];
  await state.load("repo", base, dir, async () => ({
    entries: Array.from({ length: 2000 }, (_, i) => ({ path: `new/${i}.ts` })),
    partial: false,
  }));
  const projected = state.project(base);
  assert.equal(projected.entries.length, 2000);
  assert.equal(projected.partial, true);
});

test("Git new folder count and cache have explicit limits and empty results remain collapsible", async () => {
  const state = createGitFolderState();
  const base = Array.from({ length: 17 }, (_, i) => ({
    path: `folder-${i}/`,
    directory: true,
  }));
  const read = async ({ path }) => ({ entries: [{ path: `${path}file.ts` }] });
  for (const entry of base.slice(0, 16))
    await state.load("repo", base, entry, read);
  await assert.rejects(state.load("repo", base, base[16], read), /16 pastas/);
  state.collapse("folder-0");
  await state.load("repo", base, base[16], async () => ({ entries: [] }));
  const projected = state.project(base);
  const tree = groupGitChanges(projected.entries);
  assert.equal(tree.folders.get("folder-16").count, 0);
  state.expanded[1].add("folder-16");
  assert.equal(
    gitFolderRows(tree, state.expanded[1]).find((r) => r.path === "folder-16")
      .expanded,
    true,
  );
  state.collapse("folder-16");
  assert.equal(state.project(base).entries.at(-1), base[16]);
});

test("closing final view removes stale breadcrumb/title and releases preview DOM", () => {
  const dom = new JSDOM(
    `<main><div id="editor"></div><div id="diff"></div><div id="image-view"><img></div><div id="markdown-view"><h1>README</h1></div><div id="reveal-diff"></div><div id="conflict">Conflict</div><div id="crumb" title="repo/EventMapa.ts">EventMapa.ts</div><div id="encoding">UTF-8 BOM</div><div id="welcome" class="hidden"></div></main>`,
  );
  const document = dom.window.document;
  let model = "old";
  resetEmptyEditorView({
    document,
    editor: {
      setModel(value) {
        model = value;
      },
    },
  });
  assert.equal(model, null);
  assert.equal(
    document.getElementById("crumb").textContent,
    "Seu espaço de trabalho",
  );
  assert.equal(document.getElementById("crumb").hasAttribute("title"), false);
  assert.equal(
    document.getElementById("welcome").classList.contains("hidden"),
    false,
  );
  for (const id of [
    "editor",
    "diff",
    "image-view",
    "markdown-view",
    "reveal-diff",
    "conflict",
  ])
    assert.equal(
      document.getElementById(id).classList.contains("hidden"),
      true,
    );
  for (const id of ["image-view", "markdown-view", "conflict"])
    assert.equal(document.getElementById(id).childNodes.length, 0);
  assert.equal(document.getElementById("encoding").textContent, "UTF-8");
  dom.window.close();
});
test("merge choices preserve surrounding content and support diff3", () => {
  const text =
    "before\n<<<<<<< HEAD\nours\n||||||| base\nbase\n=======\ntheirs\n>>>>>>> other\nafter\n";
  assert.equal(resolveMarkers(text, "ours"), "before\nours\nafter\n");
  assert.equal(resolveMarkers(text, "theirs"), "before\ntheirs\nafter\n");
  assert.equal(resolveMarkers(text, "both"), "before\nours\ntheirs\nafter\n");
  assert.throws(() => resolveMarkers("<<<<<<< a\nx", "both"));
});
test("ready URLs handle ANSI, port patterns and explicit URI format", () => {
  assert.equal(
    readyUrl("Now listening on: http://localhost:51879", {
      uriFormat: "%s/swagger",
    }),
    "http://localhost:51879/swagger",
  );
  assert.equal(
    readyUrl(
      "\u001b[32mNow listening on: http://localhost:5001\u001b[0m\r\n",
      {},
    ),
    "http://localhost:5001",
  );
  assert.equal(
    readyUrl("port: 9000", {
      pattern: "port: (\\d+)",
      uriFormat: "http://localhost:%s/swagger",
    }),
    "http://localhost:9000/swagger",
  );
  assert.equal(readyUrl("still building", {}), null);
  assert.throws(() => readyUrl("port: 10", { pattern: "port: (\\d+)" }));
});

test("terminal tab exposes a separate accessible close button without selecting it", async () => {
  const dom = new JSDOM("<main></main>");
  const doc = dom.window.document;
  const selected = [],
    closed = [];
  const tab = createTerminalTab({
    document: doc,
    session: { id: 7, profile: ".NET · API", root: "repo", exit: null },
    active: false,
    icon: () => doc.createElement("span"),
    onSelect: (id) => selected.push(id),
    onClose: (id) => closed.push(id),
    onError: (e) => {
      throw e;
    },
  });
  doc.querySelector("main").append(tab);
  assert.equal(tab.querySelectorAll("button").length, 2);
  assert.equal(tab.querySelector("button button"), null);
  const close = tab.querySelector(".term-tab-close");
  assert.match(close.getAttribute("aria-label"), /parar API/);
  close.click();
  await Promise.resolve();
  assert.deepEqual(closed, [7]);
  assert.deepEqual(selected, []);
  tab.querySelector(".term-tab-select").click();
  assert.deepEqual(selected, [7]);
  dom.window.close();
});

function terminalFixture() {
  let disposals = 0,
    removes = 0,
    refreshes = 0;
  const session = {
    id: 1,
    profile: ".NET",
    root: "repo",
    exit: null,
    closed: false,
    term: { dispose: () => disposals++ },
    host: { remove: () => removes++ },
  };
  const other = { id: 2 };
  const state = { sessions: [session, other], selectedSession: 2 };
  return {
    state,
    session,
    refresh: () => refreshes++,
    counts: () => [disposals, removes, refreshes],
  };
}
test("closing terminal cancels safely, closes exactly once and preserves another selection", async () => {
  const f = terminalFixture();
  let requests = 0;
  const options = {
    ...f,
    id: 1,
    confirm: async () => false,
    close: async () => requests++,
  };
  assert.equal(await closeTerminalSession(options), false);
  assert.equal(f.session.closed, false);
  assert.equal(requests, 0);
  assert.deepEqual(f.counts(), [0, 0, 0]);
  let accept;
  options.confirm = () =>
    new Promise((resolve) => {
      accept = resolve;
    });
  const first = closeTerminalSession(options);
  assert.equal(await closeTerminalSession(options), false);
  accept(true);
  assert.equal(await first, true);
  assert.equal(requests, 1);
  assert.equal(f.state.selectedSession, 2);
  assert.deepEqual(
    f.state.sessions.map((s) => s.id),
    [2],
  );
  assert.deepEqual(f.counts(), [1, 1, 1]);
});
test("failed terminal close remains usable; last exited terminal closes without confirmation", async () => {
  const f = terminalFixture();
  const options = {
    ...f,
    id: 1,
    confirm: async () => true,
    close: async () => {
      throw Error("RPC failed");
    },
  };
  await assert.rejects(closeTerminalSession(options), /RPC failed/);
  assert.equal(f.session.closed, false);
  assert.equal(f.session.closing, false);
  assert.deepEqual(f.counts(), [0, 0, 0]);
  f.state.sessions = [f.session];
  f.state.selectedSession = 1;
  f.session.exit = 0;
  f.session.resizing = setTimeout(
    () => assert.fail("resize after dispose"),
    1000,
  );
  options.close = async () => {};
  options.confirm = async () => {
    assert.fail("exited terminal should not prompt");
  };
  assert.equal(await closeTerminalSession(options), true);
  assert.equal(f.session.resizing, null);
  assert.equal(f.state.sessions.length, 0);
  assert.equal(f.state.selectedSession, null);
  assert.deepEqual(f.counts(), [1, 1, 1]);
});
