import test from "node:test";
import assert from "node:assert/strict";
import {
  assistantText,
  reasoningEfforts,
  installCopilotChat,
  isTerminalChatError,
  sameWorkspace,
} from "./copilot-chat.js";
import { JSDOM } from "jsdom";
import { emptyUsage, usageDelta, usageLabel } from "./chat-usage.js";
import { renderAssistant, pruneMessages, nearBottom } from "./chat-render.js";
import { quotaRows, resetLabel } from "./chat-quota.js";
test("Copilot streaming then final message does not duplicate content", () => {
  let text = assistantText("", {
    type: "assistant.message_delta",
    data: { deltaContent: "Olá " },
  });
  text = assistantText(text, {
    type: "assistant.message_delta",
    data: { deltaContent: "mundo" },
  });
  assert.equal(text, "Olá mundo");
  assert.equal(
    assistantText(text, {
      type: "assistant.message",
      data: { content: "Olá mundo!" },
    }),
    "Olá mundo!",
  );
});
test("terminal errors are distinguished from recoverable notices", () => {
  assert.equal(
    isTerminalChatError({ type: "session.error", data: { message: "quota" } }),
    true,
  );
  assert.equal(
    isTerminalChatError({ type: "session.error", data: { retriable: true } }),
    false,
  );
  assert.equal(isTerminalChatError({ type: "bridge.warning" }), false);
});
test("Enter sends; Shift+Enter is newline; held Enter, busy and IME do not send", async () => {
  await chatFixture(async ({ q, calls, runtime, tick }) => {
    const key = (props = {}) => {
      const e = {
        key: "Enter",
        preventDefault() {
          this.prevented = true;
        },
        ...props,
      };
      return e;
    };
    q("prompt").value = "first";
    const enter = key();
    await q("prompt").onkeydown(enter);
    assert.equal(enter.prevented, true);
    assert.equal(calls.filter((c) => c.method === "chat_send").length, 1);
    q("prompt").value = "next";
    const busy = key();
    await q("prompt").onkeydown(busy);
    assert.equal(busy.prevented, true);
    const shift = key({ shiftKey: true });
    await q("prompt").onkeydown(shift);
    assert.equal(shift.prevented, undefined);
    runtime.busy = false;
    await tick();
    for (const props of [
      { repeat: true },
      { isComposing: true },
      { keyCode: 229 },
    ])
      await q("prompt").onkeydown(key(props));
    assert.equal(calls.filter((c) => c.method === "chat_send").length, 1);
    await q("prompt").onkeydown(key({ ctrlKey: true }));
    assert.equal(calls.filter((c) => c.method === "chat_send").length, 2);
  });
});
test("explorer switch preserves chat workspace, context, totals and sends without clear", async () => {
  await chatFixture(async ({ q, calls, runtime, tick, chat }) => {
    const original = runtime.root;
    q("prompt").value = "analyze project";
    await q("send").onclick();
    runtime.metrics = { totalNanoAiu: 123, inputTokens: 500, outputTokens: 20 };
    runtime.events.push(
      {
        type: "assistant.message",
        data: { messageId: "answer", content: "Original project analysis" },
      },
      { type: "session.idle", data: {} },
    );
    await tick();
    const label = q("session-label").textContent;
    const total = q("total").textContent;
    runtime.root = "C:\\test\\another-repo";
    chat.update();
    assert.equal(q("workspace-notice").classList.contains("hidden"), false);
    assert.match(q("workspace-notice-text").textContent, /contexto mantido/);
    q("prompt").value = "modify the file from our analysis";
    await q("prompt").onkeydown({ key: "Enter", preventDefault() {} });
    assert.equal(
      calls.filter((c) => c.method === "chat_send").at(-1).params.root,
      original,
    );
    assert.equal(q("session-label").textContent, label);
    assert.equal(q("total").textContent, total);
    assert.match(q("messages").textContent, /Original project analysis/);
    assert.equal(q("error").classList.contains("hidden"), true);
    assert.equal(
      calls.some((c) => c.method === "chat_clear"),
      false,
    );
    await tick();
    q("search-query").value = "endpoint";
    await q("search").onclick();
    assert.equal(
      calls.find((c) => c.method === "chat_search").params.root,
      original,
    );
    q("mcp-config").value = '{"mcpServers":{"one":{"command":"fixture.exe"}}}';
    await q("mcp-connect").onclick();
    assert.equal(
      calls.find((c) => c.method === "chat_begin").params.root,
      original,
    );
    await q("return-workspace").onclick();
    chat.update();
    assert.equal(runtime.root, original);
    assert.equal(q("workspace-notice").classList.contains("hidden"), true);
    assert.equal(
      calls.some((c) => c.method === "chat_clear"),
      false,
    );
  });
});
test("Windows path casing and separator changes do not imply another workspace", () => {
  assert.equal(sameWorkspace("C:\\Repo\\Project", "c:/repo/project/"), true);
  assert.equal(sameWorkspace("C:\\Repo\\Project", "C:\\Repo\\Other"), false);
});
test("tool-only assistant events do not create empty replies; completion is readable and activity grouped", async () => {
  await chatFixture(async ({ q, runtime, tick, calls }) => {
    q("prompt").value = "Analise meu projeto";
    await q("send").onclick();
    runtime.busy = true;
    runtime.events.push(
      {
        type: "assistant.message",
        data: { messageId: "tools-only", content: "" },
      },
      {
        type: "tool.execution_start",
        data: {
          toolCallId: "a",
          toolName: "view",
          arguments: { path: "package.json" },
        },
      },
      {
        type: "tool.execution_complete",
        data: { toolCallId: "a", success: true, result: { content: "react" } },
      },
      {
        type: "assistant.message",
        data: { messageId: "more-tools", content: "   " },
      },
      {
        type: "tool.execution_start",
        data: {
          toolCallId: "b",
          toolName: "task_complete",
          arguments: { summary: "Projeto **React**. Build não validado." },
        },
      },
      {
        type: "tool.execution_complete",
        data: {
          toolCallId: "b",
          success: true,
          result: { content: "Projeto React" },
        },
      },
      {
        type: "bridge.task_complete",
        data: { summary: "Projeto **React**. Build não validado." },
      },
      { type: "session.idle", data: { mode: "autopilot", completed: true } },
    );
    runtime.busy = false;
    await tick();
    const replies = q("messages").querySelectorAll(".assistant");
    assert.equal(replies.length, 1);
    assert.match(replies[0].textContent, /Projeto React/);
    assert.equal(
      replies[0].querySelector(".chat-text strong").textContent,
      "React",
    );
    assert.equal(q("messages").querySelectorAll(".chat-activity").length, 1);
    assert.equal(
      q("messages").querySelector(".chat-activity > details").open,
      false,
    );
    assert.equal(q("send").classList.contains("hidden"), false);
    assert.equal(calls.filter((c) => c.method === "chat_send").length, 1);
  });
});
test("autopilot continuation remains pausable; completion summary does not duplicate final answer", async () => {
  await chatFixture(async ({ q, runtime, tick }) => {
    q("prompt").value = "Analyze";
    await q("send").onclick();
    runtime.busy = true;
    runtime.events.push({ type: "session.idle", data: { mode: "autopilot" } });
    await tick();
    assert.equal(q("abort").classList.contains("hidden"), false);
    runtime.events.push(
      {
        type: "assistant.message",
        data: { messageId: "final", content: "Analysis complete." },
      },
      { type: "bridge.task_complete", data: { summary: "Analysis complete." } },
    );
    await tick();
    assert.equal(q("messages").querySelectorAll(".assistant").length, 1);
  });
});
test("account quota popover reads SDK data, handles missing quota and closes outside", async () => {
  await chatFixture(async ({ q, runtime, calls, win }) => {
    runtime.quota = {
      available: true,
      quotaSnapshots: {
        ai_credits: {
          remainingPercentage: 96,
          usedRequests: 4,
          entitlementRequests: 100,
          resetDate: "2026-11-01T00:00:00Z",
        },
      },
    };
    await q("quota-refresh").onclick();
    assert.match(q("quota-content").textContent, /4% utilizado/);
    assert.match(q("quota-content").textContent, /Renova em/);
    assert.match(q("quota-details-content").textContent, /Reset informado:/);
    assert.equal(q("quota-content").querySelector("progress").value, 4);
    q("quota-menu").open = true;
    win.document
      .querySelector("#outside")
      .dispatchEvent(new win.Event("pointerdown", { bubbles: true }));
    assert.equal(q("quota-menu").open, false);
    runtime.quotaError = true;
    await q("quota-refresh").onclick();
    assert.match(q("quota-content").textContent, /Não significa saldo zero/);
    assert.equal(
      calls.some((c) => c.method === "chat_send" || c.method === "chat_clear"),
      false,
    );
  });
});
test("productivity controls keep notes and MCP subset explicit without inference or clear", async () => {
  await chatFixture(async ({ q, calls, runtime }) => {
    q("notes").value = "Preserve API contracts";
    await q("notes-save").onclick();
    assert.equal(
      calls.find((c) => c.method === "chat_notes").params.notes,
      "Preserve API contracts",
    );
    runtime.servers = [
      {
        name: "speedcode_one",
        managed: true,
        status: "connected",
        toolCount: 2,
        catalog: [
          { name: "read", enabled: true },
          { name: "write", enabled: true },
        ],
      },
    ];
    await q("mcp-refresh").onclick();
    const checks = q("mcp-servers").querySelectorAll("input");
    assert.equal(checks.length, 2);
    checks[1].checked = false;
    await [...q("mcp-servers").querySelectorAll("button")]
      .find((b) => b.textContent === "Aplicar seleção")
      .onclick();
    assert.deepEqual(
      calls.find((c) => c.method === "chat_mcp_tools").params.tools,
      ["read"],
    );
    assert.equal(
      calls.some((c) => ["chat_send", "chat_clear"].includes(c.method)),
      false,
    );
  });
});
test("selection reference is a confirmed snapshot and never writes the file", async () => {
  await chatFixture(async ({ q, calls, runtime }) => {
    const range = {
      startLineNumber: 2,
      startColumn: 1,
      endLineNumber: 2,
      endColumn: 5,
    };
    runtime.file = {
      root: runtime.root,
      path: "api.ts",
      dirty: true,
      model: { getValueInRange: () => "code", getFullModelRange: () => range },
    };
    runtime.selection = range;
    await q("selection").onclick();
    const call = calls.find((c) => c.method === "chat_snapshot");
    assert.equal(call.params.text, "code");
    assert.equal(call.params.startLine, 2);
    assert.equal(call.params.dirty, true);
    assert.match(q("attachments").textContent, /snapshot/);
    assert.equal(
      calls.some((c) => ["write", "save", "chat_send"].includes(c.method)),
      false,
    );
    await q("clear").onclick();
    assert.equal(q("notes").value, "");
    assert.equal(q("attachments").children.length, 0);
  });
});
test("quota units/unlimited/missing data and reset date never fabricated", () => {
  assert.deepEqual(quotaRows({ available: false }), []);
  const rows = quotaRows({
    available: true,
    quotaSnapshots: {
      premium_interactions: {
        remainingPercentage: 75,
        usedRequests: 25,
        entitlementRequests: 100,
      },
      chat: { entitlementRequests: -1, isUnlimitedEntitlement: true },
    },
  });
  assert.equal(rows[0].percent, 25);
  assert.equal(rows[0].name, "Solicitações premium");
  assert.equal(rows[1].percent, null);
  assert.match(rows[1].description, /ilimitada/);
  assert.match(resetLabel("2026-11-01"), /horário não informado/);
  assert.match(resetLabel(null), /não informado/);
  assert.match(
    resetLabel("2026-10-01T00:00:00Z", Date.parse("2026-10-04T00:00:00Z")),
    /próximo reset não confirmado/,
  );
  const noQuota = quotaRows({
    available: true,
    quotaSnapshots: {
      premium_interactions: {
        entitlementRequests: 0,
        remainingPercentage: 0,
        usedRequests: 0,
      },
    },
  })[0];
  assert.equal(noQuota.percent, null);
  assert.match(noQuota.description, /Sem cota incluída/);
});
async function chatFixture(fn, sendError = false, worktreeMode = false) {
  const saved = Object.fromEntries(
    ["window", "document", "Option", "setTimeout", "clearTimeout"].map((k) => [
      k,
      globalThis[k],
    ]),
  );
  const win = new JSDOM("", { url: "http://localhost" }).window;
  Object.defineProperty(win.document, "hidden", {
    value: false,
    configurable: true,
  });
  globalThis.window = win;
  globalThis.document = win.document;
  globalThis.Option = win.Option;
  let scheduled;
  let scheduledDelay;
  globalThis.setTimeout = (fn, delay) => {
    scheduled = fn;
    scheduledDelay = delay;
    return 1;
  };
  globalThis.clearTimeout = () => {
    scheduled = null;
  };
  win.confirm = () => true;
  win.document.body.innerHTML =
    '<div class="shell"><aside class="sidebar"></aside><div class="main"><button id="outside">Editor</button></div></div>';
  const calls = [],
    notifications = [],
    dialogs = [];
  const runtime = {
    root: "C:\\test\\project",
    events: [],
    busy: false,
    metrics: { available: false },
    session: null,
    servers: [],
  };
  const rpc = async (method, params) => {
    calls.push({ method, params });
    if (method === "chat_status")
      return { authenticated: true, login: "test-account" };
    if (method === "chat_models")
      return [
        { id: "auto", name: "Auto" },
        {
          id: "second",
          name: "Second",
          supportedReasoningEfforts: ["low", "high"],
        },
      ];
    if (method === "chat_send" && sendError)
      throw new Error("Session state not found");
    if (method === "chat_worktree_prepare") {
      if (runtime.worktreeError) throw new Error(runtime.worktreeError);
      return {
        root: "C:\\test\\tasks\\task-unique",
        status: "ready",
        repos: [
          {
            source: runtime.root,
            path: "C:\\test\\tasks\\task-unique\\project",
            branch: "speedcode/unique/project",
            base: params.base,
            commit: "abc123",
          },
        ],
      };
    }
    if (method === "chat_poll")
      return {
        events: runtime.events.splice(0),
        busy: runtime.busy,
        login: false,
        session: runtime.session,
        more: runtime.more === true,
      };
    if (method === "chat_send" || method === "chat_begin") {
      runtime.session ||= {
        id: "session-fixture",
        root: params.root,
        localContext: params.localContext,
      };
      return method === "chat_begin"
        ? runtime.session
        : { session: runtime.session };
    }
    if (method === "chat_model" && runtime.modelError)
      throw new Error("Model unavailable");
    if (method === "chat_mcp_list") return runtime.servers;
    if (method === "chat_mcp_connect") {
      for (const name of Object.keys(
        params.config.mcpServers ||
          params.config.servers || { [params.name]: params.config },
      )) {
        runtime.servers.push({
          name: `speedcode_${name}`,
          status: "connected",
          managed: true,
        });
      }
      return { failed: 0 };
    }
    if (method === "chat_mcp_action") {
      const server = runtime.servers.find((s) => s.name === params.name);
      if (params.action === "remove")
        runtime.servers = runtime.servers.filter((s) => s !== server);
      else
        server.status = {
          resume: "connected",
          pause: "paused",
          disable: "disabled",
        }[params.action];
    }
    if (method === "chat_clear") runtime.session = null;
    if (method === "chat_snapshot")
      return [
        {
          id: "snapshot-fixture",
          name: `${params.path} · snapshot`,
          dir: false,
          snapshot: true,
        },
      ];
    if (method === "chat_usage") return runtime.metrics;
    if (method === "chat_quota") {
      if (runtime.quotaError) throw new Error("Provider unavailable");
      return runtime.quota || { available: false };
    }
    return true;
  };
  const chat = installCopilotChat({
    rpc,
    root: () => runtime.root,
    showWorkspace: async (path) => {
      runtime.root = path;
    },
    currentFile: () => runtime.file || null,
    editorSelection: () => runtime.selection || null,
    changed: () => {},
    notify: (...args) => notifications.push(args),
    dialog: async (...args) => {
      dialogs.push(args);
      return win.confirm();
    },
  });
  const q = (name) => win.document.querySelector(`[data-${name}]`);
  runtime.worktreeDefault = q("worktree").checked;
  q("worktree").checked = worktreeMode;
  try {
    await chat.open();
    await fn({
      q,
      calls,
      win,
      notifications,
      dialogs,
      runtime,
      chat,
      tick: () => scheduled(),
      timerDelay: () => (scheduled ? scheduledDelay : null),
    });
  } finally {
    win.close();
    Object.assign(globalThis, saved);
  }
}
test("worktree defaults on, prepares once before send, locks base and survives explorer switches", async () => {
  await chatFixture(
    async ({ q, calls, runtime, tick, chat }) => {
      assert.equal(runtime.worktreeDefault, true);
      assert.equal(
        calls.some((c) => c.method === "chat_worktree_prepare"),
        false,
      );
      q("worktree-base").value = "origin/production";
      q("prompt").value = "modify endpoint";
      await q("send").onclick();
      const prep = calls.find((c) => c.method === "chat_worktree_prepare");
      assert.equal(prep.params.base, "origin/production");
      assert.equal(prep.params.root, "C:\\test\\project");
      assert.equal(
        calls.find((c) => c.method === "chat_send").params.root,
        "C:\\test\\tasks\\task-unique",
      );
      assert.equal(q("worktree").disabled, true);
      assert.equal(q("worktree-base").disabled, true);
      assert.match(q("worktree-info").textContent, /tarefa isolada/);
      runtime.root = "C:\\test\\another";
      chat.update();
      runtime.busy = false;
      await tick();
      q("prompt").value = "continue";
      await q("send").onclick();
      assert.equal(
        calls.filter((c) => c.method === "chat_worktree_prepare").length,
        1,
      );
      assert.equal(
        calls.filter((c) => c.method === "chat_send").at(-1).params.root,
        "C:\\test\\tasks\\task-unique",
      );
      await q("clear").onclick();
      assert.equal(q("worktree-info").children.length, 0);
      assert.equal(q("worktree").disabled, false);
      assert.equal(
        calls.some((c) => /remove|delete|prune/.test(c.method)),
        false,
      );
    },
    false,
    true,
  );
});
test("failed worktree preparation preserves prompt and never sends or falls back", async () => {
  await chatFixture(
    async ({ q, calls, runtime }) => {
      runtime.worktreeError = "Base origin/missing não encontrada";
      q("prompt").value = "keep my prompt";
      await q("send").onclick();
      assert.equal(q("prompt").value, "keep my prompt");
      assert.match(q("error-text").textContent, /origin\/missing/);
      assert.equal(
        calls.some((c) => c.method === "chat_send"),
        false,
      );
      assert.equal(q("worktree").disabled, false);
    },
    false,
    true,
  );
});
test("MCP begins in worktree before connecting, with no inference", async () => {
  await chatFixture(
    async ({ q, calls }) => {
      q("mcp-config").value =
        '{"mcpServers":{"one":{"command":"fixture.exe"}}}';
      await q("mcp-connect").onclick();
      assert.equal(
        calls.find((c) => c.method === "chat_begin").params.root,
        "C:\\test\\tasks\\task-unique",
      );
      assert.equal(
        calls.find((c) => c.method === "chat_mcp_connect").params.root,
        "C:\\test\\tasks\\task-unique",
      );
      assert.equal(
        calls.some((c) => c.method === "chat_send"),
        false,
      );
    },
    false,
    true,
  );
});
test("send failure has a local red alert, preserves input and connected status", async () => {
  await chatFixture(async ({ q, calls, notifications }) => {
    q("prompt").value = "teste";
    await q("send").onclick();
    assert.equal(q("error").classList.contains("hidden"), false);
    assert.equal(q("error").getAttribute("role"), "alert");
    assert.equal(q("error-text").textContent, "Session state not found");
    assert.equal(q("status").classList.contains("connected"), true);
    assert.equal(q("prompt").value, "teste");
    assert.equal(q("messages").children.length, 0);
    assert.equal(notifications.length, 0);
    assert.equal(
      calls.find((c) => c.method === "chat_send").params.autopilot,
      false,
    );
  }, true);
});
test("large streaming presentation remains bounded without clearing harness", () => {
  let text = "";
  for (let i = 0; i < 100; i++)
    text = assistantText(text, {
      type: "assistant.message_delta",
      data: { deltaContent: "x".repeat(8192) },
    });
  assert.ok(text.length < 129 * 1024);
  assert.match(text, /Visualização parcial/);
});
test("idle poll does not redraw chat; hidden idle stops polling and hidden busy drains slowly", async () => {
  await chatFixture(async ({ q, win, runtime, tick, timerDelay }) => {
    q("prompt").value = "test";
    await q("send").onclick();
    runtime.busy = false;
    await tick();
    await tick();
    const observer = new win.MutationObserver(() => {});
    observer.observe(q("messages").closest("aside"), {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    });
    await tick();
    assert.equal(observer.takeRecords().length, 0);
    observer.disconnect();
    Object.defineProperty(win.document, "hidden", {
      value: true,
      configurable: true,
    });
    win.document.dispatchEvent(new win.Event("visibilitychange"));
    assert.equal(timerDelay(), null);
    Object.defineProperty(win.document, "hidden", {
      value: false,
      configurable: true,
    });
    win.document.dispatchEvent(new win.Event("visibilitychange"));
    await tick();
    q("prompt").value = "continue";
    await q("send").onclick();
    runtime.busy = true;
    Object.defineProperty(win.document, "hidden", {
      value: true,
      configurable: true,
    });
    win.document.dispatchEvent(new win.Event("visibilitychange"));
    assert.ok(timerDelay() >= 1000);
    await tick();
    assert.ok(timerDelay() >= 1000);
  });
});
test("backlogged chat poll does not finalize usage until the last batch", async () => {
  await chatFixture(async ({ q, runtime, tick, calls }) => {
    q("prompt").value = "analyze";
    await q("send").onclick();
    const usageBefore = calls.filter((c) => c.method === "chat_usage").length;
    runtime.busy = false;
    runtime.more = true;
    runtime.events.push({
      type: "assistant.message",
      data: { messageId: "a", content: "first batch" },
    });
    await tick();
    assert.equal(q("send").disabled, true);
    assert.equal(
      calls.filter((c) => c.method === "chat_usage").length,
      usageBefore,
    );
    runtime.more = false;
    runtime.events.push({
      type: "assistant.message",
      data: { messageId: "b", content: "last batch" },
    });
    await tick();
    assert.equal(q("send").disabled, false);
    assert.match(q("messages").textContent, /last batch/);
    assert.equal(
      calls.some((c) => c.method === "chat_clear"),
      false,
    );
  });
});
test("Autopilot is opt-in and pause keeps the conversation, without clearing it", async () => {
  await chatFixture(async ({ q, calls, win }) => {
    win.confirm = () => false;
    q("mode").value = "autopilot";
    await q("mode").onchange();
    assert.equal(q("mode").value, "agent");
    win.confirm = () => true;
    q("mode").value = "autopilot";
    await q("mode").onchange();
    q("prompt").value = "tarefa";
    await q("send").onclick();
    assert.equal(
      calls.find((c) => c.method === "chat_send").params.autopilot,
      true,
    );
    assert.equal(q("abort").classList.contains("hidden"), false);
    await q("abort").onclick();
    assert.equal(q("mode").value, "agent");
    assert.equal(q("messages").querySelectorAll(".chat-message").length, 1);
    assert.match(q("activity").textContent, /Pausado/);
    assert.equal(
      calls.some((c) => c.method === "chat_clear"),
      false,
    );
  });
});
test("every popover dismisses on outside pointer, focus and Escape, not inside", async () => {
  await chatFixture(async ({ q, win }) => {
    for (const name of ["model-menu", "account-menu", "attach-menu"]) {
      const menu = q(name);
      menu.open = true;
      menu
        .querySelector(".chat-popover")
        .dispatchEvent(new win.PointerEvent("pointerdown", { bubbles: true }));
      assert.equal(menu.open, true);
      win.document
        .getElementById("outside")
        .dispatchEvent(new win.PointerEvent("pointerdown", { bubbles: true }));
      assert.equal(menu.open, false);
      menu.open = true;
      q("prompt").dispatchEvent(
        new win.FocusEvent("focusin", { bubbles: true }),
      );
      assert.equal(menu.open, false);
      menu.open = true;
      win.document.dispatchEvent(
        new win.KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
      assert.equal(menu.open, false);
    }
  });
});
test("chat docks beside main, resizes within limits and closes its splitter", async () => {
  await chatFixture(async ({ q, win }) => {
    const pane = win.document.querySelector(".copilot-chat");
    const splitter = win.document.querySelector(".chat-resize");
    assert.equal(pane.parentElement.className, "shell");
    assert.equal(pane.previousElementSibling, splitter);
    assert.equal(splitter.previousElementSibling.className, "main");
    const original = parseFloat(pane.style.width);
    splitter.dispatchEvent(
      new win.KeyboardEvent("keydown", { key: "ArrowLeft" }),
    );
    assert.equal(parseFloat(pane.style.width), original + 16);
    splitter.dispatchEvent(new win.KeyboardEvent("keydown", { key: "Home" }));
    assert.equal(pane.style.width, "320px");
    splitter.dispatchEvent(
      new win.KeyboardEvent("keydown", { key: "ArrowRight" }),
    );
    assert.equal(pane.style.width, "320px");
    assert.equal(win.localStorage.getItem("chatWidth"), "320");
    assert.equal(win.localStorage.length, 1);
    let captured = false;
    splitter.setPointerCapture = () => {
      captured = true;
    };
    splitter.hasPointerCapture = () => captured;
    splitter.releasePointerCapture = () => {
      captured = false;
    };
    splitter.onpointerdown({
      button: 0,
      clientX: 100,
      pointerId: 1,
      preventDefault() {},
    });
    splitter.onpointermove({ clientX: 0 });
    assert.equal(parseFloat(pane.style.width), 420);
    splitter.onpointercancel();
    assert.equal(splitter.onpointermove, null);
    assert.equal(captured, false);
    q("close").onclick();
    assert.equal(pane.classList.contains("hidden"), true);
    assert.equal(splitter.classList.contains("hidden"), true);
  });
});
test("explicit clear uses branded confirmation and cancel preserves conversation", async () => {
  await chatFixture(async ({ q, win, calls, dialogs }) => {
    assert.equal(q("clear").textContent, "Limpar sessão");
    q("prompt").value = "teste";
    await q("send").onclick();
    win.confirm = () => false;
    await q("clear").onclick();
    assert.equal(q("messages").children.length, 1);
    assert.equal(
      calls.some((c) => c.method === "chat_clear"),
      false,
    );
    assert.match(dialogs[0][0], /SpeedCode/);
    assert.equal(dialogs[0][2].confirm, "Limpar sessão");
    win.confirm = () => true;
    await q("clear").onclick();
    assert.equal(q("messages").children.length, 0);
    assert.equal(q("status").classList.contains("connected"), true);
  });
});
test("usage delta distinguishes absence from zero and is not a premium multiplier", () => {
  assert.match(usageLabel(usageDelta(emptyUsage(), {})), /não informados/);
  assert.match(
    usageLabel(usageDelta(emptyUsage(), { totalNanoAiu: 0 })),
    /0 AIU/,
  );
  assert.match(
    usageLabel(usageDelta(emptyUsage(), { premiumRequests: 2 })),
    /não informados.*2 solicitações/,
  );
  for (const invalid of [null, undefined, "1000", -1, NaN, Infinity])
    assert.equal(
      usageDelta(emptyUsage(), { totalNanoAiu: invalid }).totalNanoAiu,
      null,
    );
  assert.equal(
    usageDelta({ totalNanoAiu: 3 }, { totalNanoAiu: 2 }).totalNanoAiu,
    null,
  );
});
test("finished response shows per-turn runtime usage once, includes later turns without double counting", async () => {
  await chatFixture(async ({ q, win, runtime, tick }) => {
    q("prompt").value = "primeira";
    await q("send").onclick();
    runtime.metrics = {
      totalNanoAiu: 500000000,
      inputTokens: 20,
      outputTokens: 10,
      premiumRequests: 1,
    };
    runtime.events.push(
      { type: "assistant.message", data: { messageId: "a", content: "OK" } },
      { type: "session.idle" },
    );
    await tick();
    assert.match(
      win.document.querySelector(".chat-usage").textContent,
      /0,5 AIU.*20 tokens.*10 de saída/,
    );
    runtime.events.push({ type: "session.idle" });
    await tick();
    assert.equal(win.document.querySelectorAll(".chat-usage").length, 1);
    q("prompt").value = "segunda";
    await q("send").onclick();
    runtime.metrics = {
      totalNanoAiu: 700000000,
      inputTokens: 50,
      outputTokens: 15,
      premiumRequests: 2,
    };
    runtime.events.push(
      { type: "assistant.message", data: { messageId: "b", content: "OK2" } },
      { type: "session.idle" },
    );
    await tick();
    const footers = win.document.querySelectorAll(".chat-usage");
    assert.equal(footers.length, 2);
    assert.match(footers[1].textContent, /0,2 AIU.*30 tokens.*5 de saída/);
    assert.match(
      q("total").textContent,
      /Total da sessão.*0,7 AIU.*50 tokens.*15 de saída/,
    );
    await q("clear").onclick();
    assert.equal(win.document.querySelectorAll(".chat-usage").length, 0);
  });
});
test("model and effort changes keep session/history; failure restores choice without clear", async () => {
  await chatFixture(async ({ q, calls, runtime, tick }) => {
    q("prompt").value = "remember this";
    await q("send").onclick();
    runtime.busy = false;
    await tick();
    const label = q("session-label").textContent;
    q("model").value = "second";
    await q("model").onchange();
    assert.equal(q("model").value, "second", q("error-text").textContent);
    assert.deepEqual(
      [...q("effort").options].map((o) => o.value),
      ["", "low", "high"],
    );
    q("effort").value = "high";
    await q("effort").onchange();
    assert.equal(q("session-label").textContent, label);
    assert.equal(q("messages").querySelectorAll(".user").length, 1);
    assert.equal(calls.filter((c) => c.method === "chat_model").length, 2);
    runtime.modelError = true;
    q("effort").value = "low";
    await q("effort").onchange();
    assert.equal(q("effort").value, "high");
    assert.equal(
      calls.some((c) => c.method === "chat_clear"),
      false,
    );
  });
});
test("safe Markdown keeps code copy but strips scripts, images and unsafe navigation", async () => {
  await chatFixture(async ({ win }) => {
    const body = win.document.createElement("div");
    const opened = [],
      copied = [];
    renderAssistant(
      body,
      '**Hello**\n\n```js\nconst x = 1;\n```\n<script>bad()</script><img src="https://example.com/tracker" onerror="bad()">\n\n[bad](javascript:alert) [good](https://example.com/docs)',
      (url) => opened.push(url),
      (text) => copied.push(text),
      assert.fail,
    );
    assert.equal(body.querySelectorAll("script,img").length, 0);
    assert.equal(body.querySelector("strong").textContent, "Hello");
    assert.equal(body.querySelectorAll('a[href^="javascript:"]').length, 0);
    await body.querySelector(".chat-copy-code").onclick();
    assert.match(copied[0], /const x = 1;/);
    const links = [...body.querySelectorAll("a")];
    links
      .find((a) => a.textContent === "good")
      .onclick({ preventDefault() {} });
    assert.deepEqual(opened, ["https://example.com/docs"]);
  });
});
test("bounded presentation prunes old nodes without calling harness clear; scroll follows only near end", async () => {
  await chatFixture(async ({ q, calls, win, runtime, tick }) => {
    q("prompt").value = "new turn";
    await q("send").onclick();
    for (let i = 0; i < 200; i++) {
      const article = win.document.createElement("article");
      article.textContent = "old";
      q("messages").prepend(article);
    }
    runtime.events.push(
      {
        type: "assistant.message",
        data: { messageId: "a", content: "new response" },
      },
      { type: "session.idle" },
    );
    await tick();
    assert.ok(q("messages").children.length <= 160);
    assert.match(q("pruned").textContent, /Contexto do agente mantido/);
    assert.equal(
      calls.some((c) => c.method === "chat_clear"),
      false,
    );
    const log = win.document.createElement("div");
    for (const [key, value] of Object.entries({
      scrollHeight: 1000,
      clientHeight: 300,
      scrollTop: 100,
    }))
      Object.defineProperty(log, key, { value, configurable: true });
    assert.equal(nearBottom(log), false);
    Object.defineProperty(log, "scrollTop", { value: 690, configurable: true });
    assert.equal(nearBottom(log), true);
    const keep = log.appendChild(win.document.createElement("article"));
    keep.textContent = "keep";
    assert.equal(pruneMessages(log, new Set([keep]), 0, 0), 0);
  });
});
test("JSON MCP import supports multiple servers, pause/resume/disable/remove and cancel preserves peers/context", async () => {
  await chatFixture(async ({ q, win, runtime, calls }) => {
    q("mcp-config").value = JSON.stringify({
      mcpServers: { one: { command: "one.exe" }, two: { command: "two.exe" } },
    });
    await q("mcp-connect").onclick();
    assert.equal(runtime.servers.length, 2);
    assert.match(q("session-label").textContent, /session-/);
    const click = async (server, label) => {
      const row = [...q("mcp-servers").children].find((n) =>
        n.textContent.startsWith(server),
      );
      await [...row.querySelectorAll("button")]
        .find((b) => b.textContent === label)
        .onclick();
    };
    await click("one", "Pausar");
    assert.equal(runtime.servers[0].status, "paused");
    await click("one", "Retomar");
    assert.equal(runtime.servers[0].status, "connected");
    await click("one", "Desabilitar");
    assert.equal(runtime.servers[0].status, "disabled");
    win.confirm = () => false;
    await click("one", "Remover");
    assert.equal(runtime.servers.length, 2);
    win.confirm = () => true;
    await click("one", "Remover");
    assert.equal(runtime.servers.length, 1);
    assert.equal(runtime.servers[0].name, "speedcode_two");
    assert.equal(
      calls.some((c) => c.method === "chat_clear"),
      false,
    );
  });
});
test("disconnect preserves CLI credentials; clear resets Autopilot and context", async () => {
  await chatFixture(async ({ q, calls }) => {
    q("mode").value = "autopilot";
    q("prompt").value = "draft";
    await q("connect").onclick();
    assert.match(q("status").textContent, /Desconectado/);
    assert.equal(q("connect").textContent, "Conectar");
    assert.equal(q("prompt").value, "");
    assert.equal(q("mode").value, "agent");
    assert.equal(
      calls.some((c) => c.method === "chat_logout"),
      false,
    );
  });
});
test("efforts are sourced from model catalog, not an invented fixed list", () => {
  assert.deepEqual(reasoningEfforts({ id: "plain" }), []);
  assert.deepEqual(
    reasoningEfforts({ supportedReasoningEfforts: ["low", "high"] }),
    ["low", "high"],
  );
});
