import "./style.css";
import * as monaco from "monaco-editor/editor/editor.api.js";
import "monaco-editor/languages/definitions/register.all.js";
import "monaco-editor/features/register.all.js";
import EditorWorker from "monaco-editor/editor/editor.worker.js?worker";
import FormatWorker from "./editor-format.worker.js?worker";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import logo from "../../assets/speedcode.svg";
import { resolveMarkers, readyUrl } from "./workbench.js";
import { createTerminalTab, closeTerminalSession } from "./terminal-tabs.js";
import {
  groupGitChanges,
  gitFolderRows,
  gitFolderPage,
  createGitFolderState,
} from "./git-folders.js";
import { resetEmptyEditorView } from "./editor-view.js";
import { createGitManagerHeader } from "./git-manager.js";
import {
  createStashState,
  STASH_PAGE,
  STASH_FILES_PAGE,
} from "./git-stashes.js";
import {
  revealPlan,
  revealAncestors,
  createNavigationGate,
} from "./git-navigation.js";
import { installCopilotChat } from "./copilot-chat.js";
import { previewKind, renderMarkdownPreview } from "./markdown-preview.js";
import {
  PERFORMANCE,
  admitBuffer,
  dirtySince,
  refreshLoop,
} from "./performance-policy.js";
self.MonacoEnvironment = {
  getWorker: () => new EditorWorker(),
};
const pending = new Map();
const navigationGate = createNavigationGate();
let sequence = 0;
window.__reply = ({ id, result, error }) => {
  const p = pending.get(id);
  if (p) {
    pending.delete(id);
    error ? p.reject(new Error(error)) : p.resolve(result);
  }
};
function rpc(method, params = {}) {
  return new Promise((resolve, reject) => {
    if (pending.size >= PERFORMANCE.pendingRequests)
      return reject(
        new Error("Operações pendentes no limite; aguarde a conclusão."),
      );
    const id = ++sequence;
    const message = JSON.stringify({ id, method, params });
    if (new TextEncoder().encode(message).length > PERFORMANCE.requestBytes)
      return reject(
        new Error(
          "Pedido excede 8 MiB; reduza o conteúdo. Trabalho não salvo preservado.",
        ),
      );
    pending.set(id, { resolve, reject });
    if (!window.ipc) {
      pending.delete(id);
      reject(
        new Error("Abra o executável desktop para acessar seus arquivos."),
      );
      return;
    }
    try {
      window.ipc.postMessage(message);
    } catch (e) {
      pending.delete(id);
      reject(e);
    }
  });
}
const paths = {
  play: "M7 3l14 9-14 9z",
  browser: "M3 4h18v16H3z M3 8h18 M6 6h1 M9 6h1",
  image: "M3 3h18v18H3z M3 17l6-6 5 5 3-3 4 4 M15 7h1",
  folder: "M3 5h6l2 2h10v13H3z",
  file: "M6 3h8l5 5v13H6z M14 3v6h5",
  git: "M6 3v12a3 3 0 0 0 6 0V9a3 3 0 0 1 6 0v2 M6 3a2 2 0 1 0 0 .01 M18 11a2 2 0 1 0 0 .01",
  terminal: "m4 6 6 6-6 6 M13 18h7",
  plus: "M12 4v16 M4 12h16",
  minus: "M4 12h16",
  trash: "M4 7h16 M10 11v6 M14 11v6 M5 7l1 14h12l1-14 M9 7V4h6v3",
  close: "m6 6 12 12 M18 6 6 18",
  refresh:
    "M20 7v5h-5 M4 17v-5h5 M5 8a8 8 0 0 1 13-3l2 3 M4 16l2 3a8 8 0 0 0 13-3",
  chevron: "m9 5 7 7-7 7",
  down: "m5 9 7 7 7-7",
  expandAll: "m5 8 7-5 7 5 M5 16l7 5 7-5 M12 3v18",
  collapseAll:
    "M7 3h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z M3 8v11a2 2 0 0 0 2 2h11 M9 10h6",
  save: "M4 3h14l3 3v15H3V3z M7 3v7h10V3 M7 21v-7h10v7",
  search: "M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14 M15 15l6 6",
  split: "M3 3h18v18H3z M12 3v18",
  robot: "M6 7h12v13H6z M12 3v4 M9 12h1 M14 12h1 M9 16h6 M3 10v6 M21 10v6",
  up: "M12 20V4 m-6 6 6-6 6 6",
  check: "m4 12 5 5L20 6",
  settings:
    "M12 3v3 M12 18v3 M3 12h3 M18 12h3 M6 6l2 2 M16 16l2 2 M6 18l2-2 M16 8l2-2 M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8",
};
function icon(name, size = 18) {
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  s.setAttribute("viewBox", "0 0 24 24");
  s.setAttribute("width", size);
  s.setAttribute("height", size);
  s.setAttribute("fill", "none");
  s.setAttribute("stroke", "currentColor");
  s.setAttribute("stroke-width", "1.6");
  s.setAttribute("stroke-linecap", "round");
  s.setAttribute("stroke-linejoin", "round");
  const p = document.createElementNS(s.namespaceURI, "path");
  p.setAttribute("d", paths[name] || paths.file);
  s.append(p);
  return s;
}
const $ = (id) => document.getElementById(id);
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}
function button(name, title, fn, label) {
  const b = el("button", "", label);
  b.title = title;
  b.setAttribute("aria-label", title);
  if (name) b.prepend(icon(name, 16));
  b.onclick = () => Promise.resolve(fn()).catch(fail);
  return b;
}
function fileIcon(path, dir = false) {
  if (dir) {
    const i = icon("folder", 17);
    i.classList.add("folder-icon");
    return i;
  }
  const ext = path.split(".").at(-1).toLowerCase();
  if (isImage(path)) return icon("image", 17);
  if (
    [
      "ts",
      "tsx",
      "js",
      "jsx",
      "rs",
      "py",
      "md",
      "json",
      "css",
      "html",
      "toml",
      "ps1",
    ].includes(ext)
  ) {
    return el(
      "span",
      `letter-icon file-icon ${ext}`,
      { json: "{}", html: "<>", toml: "T", ps1: "PS" }[ext] ||
        ext.slice(0, 2).toUpperCase(),
    );
  }
  const i = icon("file", 17);
  i.classList.add("file-icon");
  return i;
}
let noticeTimer;
function notify(message, error = false) {
  $("message").textContent = message;
  let n = $("notice");
  n.textContent = message;
  n.className = `notice${error ? " error" : ""}`;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(
    () => n.classList.add("hidden"),
    error ? 14000 : 4000,
  );
}
function fail(e) {
  notify(e.message || String(e), true);
}
const state = {
  repos: [],
  root: "",
  view: "files",
  buffers: new Map(),
  current: null,
  git: { entries: [] },
  sessions: [],
  selectedSession: null,
  split: false,
  expanded: new Set([""]),
  trees: new Map(),
  generated: false,
  gitBusy: false,
  refreshing: false,
  diagnostics: {},
  diff: null,
};
let copilotChat;
function modal(
  title,
  message,
  { input, initial = "", confirm = "Continuar", cancel = "Cancelar" } = {},
) {
  return new Promise((resolve) => {
    const previousFocus = document.activeElement;
    let settled = false;
    const back = el("div", "modal-backdrop"),
      box = el("section", "modal");
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    box.setAttribute("aria-label", title);
    box.append(el("h2", "", title));
    if (message) box.append(el("p", "", message));
    let field;
    if (input) {
      field = el("input");
      field.placeholder = input;
      field.setAttribute("aria-label", input);
      field.value = initial;
      box.append(field);
    }
    const footer = el("footer");
    const done = (value) => {
      if (settled) return;
      settled = true;
      back.remove();
      previousFocus?.focus();
      resolve(value);
    };
    footer.append(
      button(null, cancel, () => done(null), cancel),
      button(null, confirm, () => done(field ? field.value : true), confirm),
    );
    footer.lastChild.className = "primary";
    box.append(footer);
    back.append(box);
    document.body.append(back);
    (field || footer.lastChild).focus();
    back.onkeydown = (e) => {
      e.stopPropagation();
      if (e.key === "Escape") {
        e.preventDefault();
        done(null);
      }
      if (e.key === "Enter" && field) {
        e.preventDefault();
        done(field.value);
      }
      if (e.key === "Tab") {
        const fields = [...box.querySelectorAll("input, button")];
        const index = fields.indexOf(document.activeElement);
        e.preventDefault();
        fields[
          (index + (e.shiftKey ? -1 : 1) + fields.length) % fields.length
        ].focus();
      }
    };
  });
}
function layout() {
  const app = $("app");
  app.innerHTML = `<header class="top"><div class="brand"><img src="${logo}" alt="SpeedCode"><span>SpeedCode</span><span class="tag">WORKBENCH</span></div><div class="spacer"></div><button class="quick" id="quick"><span>Buscar arquivo…</span><kbd>Ctrl P</kbd></button><div class="spacer"></div><div id="top-agents"></div></header><div class="shell"><nav class="activity" id="activity"></nav><aside class="sidebar"><div class="side-title"><span id="side-title">EXPLORADOR</span><span id="side-actions"></span></div><div class="repo-row"><select id="repos" aria-label="Repositório ativo"></select><span id="open-folder"></span></div><div id="files-view" class="scroll"><div class="toolbar" id="file-tools"></div><label class="toggle"><input type="checkbox" id="generated">Mostrar pastas geradas</label><div id="tree"></div></div><div id="git-view" class="scroll hidden"></div><div id="sessions-view" class="scroll hidden"></div></aside><div class="sidebar-resize" id="sidebar-resize" role="separator" aria-orientation="vertical" aria-label="Redimensionar explorador" tabindex="0" title="Arraste para redimensionar"></div><main class="main"><div id="tabs" class="tabs"></div><div class="crumb"><span id="crumb">Seu espaço de trabalho</span><div class="spacer"></div><span id="editor-tools"></span></div><div id="conflict" class="conflict-bar hidden"></div><div class="editor-area"><div id="editor" class="editor-host hidden"></div><div id="diff" class="editor-host hidden"></div><div id="welcome" class="welcome"><img src="${logo}" alt=""><h1>Um espaço para código e agentes.</h1><p>Abra seu projeto, acompanhe as alterações e trabalhe com seus agentes em terminais integrados.</p><div class="actions" id="welcome-actions"></div><p><kbd>Ctrl P</kbd> buscar arquivo &nbsp; <kbd>Ctrl S</kbd> salvar &nbsp; <kbd>Ctrl F</kbd> localizar</p></div></div><div class="resize" id="resize"></div><section class="term-panel"><div class="term-toolbar"><span class="heading">TERMINAIS</span><div class="term-tabs" id="term-tabs"></div><div id="term-actions"></div></div><div class="term-views" id="term-views"><div class="term-empty" id="term-empty">PowerShell e agentes, aqui dentro.<span id="term-empty-action"></span></div></div></section></main></div><footer class="status"><span id="branch">◈ workspace</span><span id="message" class="message">Pronto para começar</span><span id="encoding">UTF-8</span><span id="session-count">0 sessões</span></footer><div id="notice" class="notice hidden"></div>`;
  for (const [view, name, title] of [
    ["files", "folder", "Explorador"],
    ["git", "git", "Controle de versão"],
    ["sessions", "robot", "Agentes e sessões"],
  ]) {
    $("activity").append(button(name, title, () => setView(view)));
  }
  $("activity").append(el("div", "spacer"));
  $("activity").append(
    button("settings", "Diagnóstico dos CLIs", showDiagnostics),
  );
  $("open-folder").append(button("plus", "Abrir pasta", openFolder));
  $("branch").setAttribute("role", "button");
  $("branch").tabIndex = 0;
  $("branch").title = "Branches e stashes";
  $("branch").onclick = () => openGitManager().catch(fail);
  $("branch").onkeydown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openGitManager().catch(fail);
    }
  };
  copilotChat = installCopilotChat({
    rpc,
    dialog: modal,
    root: () => state.root,
    currentFile: () => state.buffers.get(state.current),
    editorSelection: () => {
      const b = state.buffers.get(state.current);
      if (!b?.model || editor.getModel() !== b.model) return null;
      const s = editor.getSelection();
      return s && !s.isEmpty() ? s : null;
    },
    showWorkspace: async (path) => {
      if (!state.repos.some((r) => r.path === path)) {
        state.repos.push({ path, name: path.split(/[\\/]/).pop() });
        renderRepos();
      }
      await selectRepo(path);
    },
    changed: () => {
      gitSignature = "";
      reconcile().catch(fail);
    },
    notify,
  });
  $("top-agents").append(
    button(
      "robot",
      "Chat integrado com o harness Copilot",
      () => copilotChat.open(),
      "Copilot Chat",
    ),
  );
  const runView = el("div", "scroll hidden");
  runView.id = "run-view";
  $("sessions-view").after(runView);
  $("activity").insertBefore(
    button("play", "Executar .NET (F5)", () => setView("run")),
    $("activity").children[3],
  );
  const media = el("div", "image-view hidden");
  media.id = "image-view";
  $("editor").after(media);
  const markdown = el("div", "markdown-preview hidden");
  markdown.id = "markdown-view";
  markdown.setAttribute("aria-label", "Prévia Markdown");
  $("editor").after(markdown);
  $("top-agents").prepend(
    button("browser", "Abrir navegador no SpeedCode", openBrowser),
  );
  const preview = button(
    "browser",
    "Visualizar HTML no navegador do SpeedCode",
    previewCurrent,
    "Prévia HTML",
  );
  preview.id = "preview-current";
  preview.classList.add("hidden");
  $("editor-tools").append(preview);
  const reveal = button(
    "folder",
    "Abrir arquivo e revelar no explorador",
    () => {
      const source = state.diff?.git;
      if (source) return revealGitFile(source.entry, source.root);
    },
    "Mostrar arquivo",
  );
  reveal.id = "reveal-diff";
  reveal.classList.add("hidden");
  $("editor-tools").prepend(reveal);
  $("crumb").ondblclick = () => {
    const source = state.diff?.git;
    if (source) revealGitFile(source.entry, source.root).catch(fail);
  };
  $("repos").onchange = () => selectRepo($("repos").value);
  $("quick").onclick = quickOpen;
  $("welcome-actions").append(
    button("folder", "Abrir pasta", openFolder, "Abrir projeto"),
    button(
      "terminal",
      "Novo PowerShell",
      () => newTerminal("powershell"),
      "Novo terminal",
    ),
  );
  $("welcome-actions").firstChild.classList.add("primary");
  for (const [profile, label] of [
    ["powershell", "PowerShell"],
    ["copilot", "Copilot"],
    ["kiro", "Kiro"],
  ]) {
    $("top-agents").append(
      button(
        profile === "powershell" ? "terminal" : "robot",
        `Nova sessão ${label}`,
        () => newTerminal(profile),
        label,
      ),
    );
  }
  $("file-tools").append(
    button("plus", "Novo arquivo", () => createEntry(false)),
    button("folder", "Nova pasta", () => createEntry(true)),
    button("refresh", "Atualizar arquivos", refreshTree),
  );
  $("generated").onchange = (e) => {
    state.generated = e.target.checked;
    refreshTree();
  };
  $("editor-tools").append(
    button("refresh", "Recarregar arquivo", reloadCurrent),
    button("save", "Salvar (Ctrl+S)", saveCurrent, "Salvar"),
  );
  $("term-actions").append(
    button("plus", "Novo PowerShell", () => newTerminal("powershell")),
    button("split", "Dividir terminais", () => {
      state.split = !state.split;
      renderTerminals();
    }),
    button("close", "Encerrar sessão selecionada", () =>
      closeTerminal(state.selectedSession),
    ),
  );
  $("term-empty-action").append(
    button(
      "plus",
      "Novo PowerShell",
      () => newTerminal("powershell"),
      "Abrir PowerShell",
    ),
  );
  $("resize").onpointerdown = (e) => {
    const initial = e.clientY,
      height = $("term-views").parentElement.offsetHeight;
    const move = (ev) => {
      document.documentElement.style.setProperty(
        "--terminal-height",
        `${Math.max(110, Math.min(innerHeight - 220, height + initial - ev.clientY))}px`,
      );
      fitTerminals();
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  const sidebar = $("sidebar-resize");
  sidebar.onpointerdown = (e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth =
      $("app").style.getPropertyValue("--sidebar-width") || "275px";
    const initial = Number.parseFloat(startWidth);
    sidebar.setPointerCapture(e.pointerId);
    sidebar.onpointermove = (move) => {
      const width = Math.max(
        210,
        Math.min(500, initial + move.clientX - startX),
      );
      $("app").style.setProperty("--sidebar-width", `${width}px`);
      localStorage.setItem("sidebarWidth", String(width));
    };
    sidebar.onpointerup = () => {
      sidebar.onpointermove = null;
      sidebar.onpointerup = null;
    };
  };
  sidebar.onkeydown = (e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const width = Math.max(
      210,
      Math.min(
        500,
        (Number(localStorage.getItem("sidebarWidth")) || 275) +
          (e.key === "ArrowRight" ? 16 : -16),
      ),
    );
    $("app").style.setProperty("--sidebar-width", `${width}px`);
    localStorage.setItem("sidebarWidth", String(width));
  };
  const savedWidth = Number(localStorage.getItem("sidebarWidth"));
  if (savedWidth)
    $("app").style.setProperty(
      "--sidebar-width",
      `${Math.max(210, Math.min(500, savedWidth))}px`,
    );
  setView("files");
}
layout();
monaco.editor.defineTheme("speedcode", {
  base: "vs-dark",
  inherit: true,
  rules: [],
  colors: {
    "editor.background": "#10151e",
    "editorLineNumber.foreground": "#53657e",
    "editor.lineHighlightBackground": "#182233",
    "editor.selectionBackground": "#345d7b",
    "editorCursor.foreground": "#79dacc",
    "editorGutter.background": "#10151e",
  },
});
const editor = monaco.editor.create($("editor"), {
  theme: "speedcode",
  automaticLayout: true,
  fontFamily: "'Cascadia Code', Consolas, monospace",
  fontSize: 13,
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  padding: { top: 12 },
  renderWhitespace: "selection",
  wordWrap: "off",
  formatOnType: false,
  formatOnPaste: false,
  stickyScroll: { enabled: false },
  cursorBlinking: "solid",
  largeFileOptimizations: true,
  // WebView2's native EditContext/TSF path can keep the browser/STA busy in idle.
  // Use Monaco's supported textarea path, retaining IME, shortcuts and accessibility.
  editContext: false,
});
let formatting = false;
async function formatCurrent() {
  const b = state.buffers.get(state.current);
  if (!b?.model || formatting) return;
  const model = b.model,
    version = model.getVersionId(),
    text = model.getValue();
  if (new TextEncoder().encode(text).length > 512 * 1024)
    return notify("Formatação limitada a 512 KiB; buffer preservado.", true);
  formatting = true;
  notify("Formatando buffer…");
  try {
    const ext = b.path.split(".").at(-1).toLowerCase();
    const formatted = ["cs", "py", "pyi"].includes(ext)
      ? (await rpc("format_code", { root: b.root, path: b.path, text })).text
      : await new Promise((resolve, reject) => {
          const worker = new FormatWorker();
          const finish = (error, result) => {
            clearTimeout(timer);
            worker.terminate();
            error ? reject(error) : resolve(result);
          };
          const timer = setTimeout(
            () =>
              finish(
                new Error("Formatação excedeu 30 segundos; buffer preservado."),
              ),
            30000,
          );
          worker.onmessage = ({ data }) =>
            finish(data.error ? new Error(data.error) : null, data.text);
          worker.onerror = () =>
            finish(new Error("Falha no formatador; buffer preservado."));
          worker.postMessage({
            path: b.path,
            text,
            options: model.getOptions(),
          });
        });
    if (
      model.isDisposed() ||
      model.getVersionId() !== version ||
      editor.getModel() !== model
    )
      return notify(
        "O arquivo mudou durante a formatação; resultado não aplicado.",
        true,
      );
    if (formatted !== text) {
      editor.pushUndoStop();
      editor.executeEdits("format-document", [
        { range: model.getFullModelRange(), text: formatted },
      ]);
      editor.pushUndoStop();
    }
    notify(
      "Código formatado no editor. Ctrl+S para salvar; Ctrl+Z para desfazer.",
    );
  } finally {
    formatting = false;
  }
}
editor.addAction({
  id: "speedcode.format",
  label: "Formatar documento (Shift+Alt+F)",
  keybindings: [monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF],
  contextMenuGroupId: "1_modification",
  contextMenuOrder: 1,
  run: () => formatCurrent().catch(fail),
});
editor.addAction({
  id: "speedcode.comment",
  label: "Comentar/descomentar linhas (Ctrl+/)",
  keybindings: [],
  contextMenuGroupId: "1_modification",
  contextMenuOrder: 2,
  run: () => editor.getAction("editor.action.commentLine").run(),
});
editor.addAction({
  id: "speedcode.reindent",
  label: "Reindentar linhas",
  contextMenuGroupId: "1_modification",
  contextMenuOrder: 3,
  run: () =>
    ["python"].includes(editor.getModel()?.getLanguageId())
      ? formatCurrent().catch(fail)
      : editor.getAction("editor.action.reindentlines").run(),
});
editor.addAction({
  id: "speedcode.comment.add",
  label: "Comentar linhas (Ctrl+K, Ctrl+C)",
  keybindings: [
    monaco.KeyMod.chord(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK,
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyC,
    ),
  ],
  run: () => editor.getAction("editor.action.addCommentLine").run(),
});
editor.addAction({
  id: "speedcode.comment.remove",
  label: "Descomentar linhas (Ctrl+K, Ctrl+U)",
  keybindings: [
    monaco.KeyMod.chord(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK,
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyU,
    ),
  ],
  run: () => editor.getAction("editor.action.removeCommentLine").run(),
});
let diff = null;
function diffEditor() {
  return (diff ||= monaco.editor.createDiffEditor($("diff"), {
    theme: "speedcode",
    automaticLayout: true,
    readOnly: true,
    originalEditable: false,
    fontSize: 13,
    minimap: { enabled: false },
    renderSideBySide: true,
    scrollBeyondLastLine: false,
    maxComputationTime: 1000,
    renderIndicators: false,
    hideUnchangedRegions: { enabled: false },
    stickyScroll: { enabled: false },
    diffAlgorithm: "legacy",
    cursorBlinking: "solid",
    editContext: false,
  }));
}
function language(path) {
  const e = path.split(".").at(-1).toLowerCase();
  return (
    {
      rs: "rust",
      js: "javascript",
      jsx: "javascript",
      ts: "typescript",
      tsx: "typescript",
      json: "json",
      md: "markdown",
      py: "python",
      pyi: "python",
      ps1: "powershell",
      html: "html",
      css: "css",
      toml: "ini",
      yml: "yaml",
      yaml: "yaml",
      sh: "shell",
      cs: "csharp",
      go: "go",
    }[e] || "plaintext"
  );
}
function setView(v) {
  state.view = v;
  ["files", "git", "sessions", "run"].forEach((x, i) => {
    $(`${x}-view`).classList.toggle("hidden", x !== v);
    $("activity").children[i].classList.toggle("active", x === v);
  });
  $("side-title").textContent = {
    files: "EXPLORADOR",
    git: "CONTROLE DE VERSÃO",
    sessions: "AGENTES E SESSÕES",
    run: "EXECUTAR .NET",
  }[v];
  if (v === "git") {
    loadExpandedGitFolders().catch(fail);
    refreshGit().catch(fail);
    refreshGitExtras().catch(fail);
  }
  if (v === "sessions") renderSessions();
  if (v === "run") loadLaunch().catch(fail);
}
async function openFolder() {
  state.repos = await rpc("browse");
  renderRepos();
  if (state.repos.length) await selectRepo(state.repos.at(-1).path);
}
function renderRepos() {
  $("repos").replaceChildren();
  for (const r of state.repos) {
    const o = el("option", "", r.name);
    o.value = r.path;
    o.title = r.path;
    $("repos").append(o);
  }
  $("repos").value = state.root;
}
async function selectRepo(root) {
  closeGitManager();
  stashState.setRoot(root);
  navigationGate.invalidate();
  state.revealedPath = null;
  state.root = root;
  copilotChat?.update();
  state.git = { entries: [], available: false };
  gitFolders.setRoot(root);
  gitExpansionNotice = "";
  gitPages = [0, 0];
  gitSignature = "";
  gitLog = "";
  renderGit();
  localStorage.setItem("lastRepo", root);
  state.expanded = new Set([""]);
  state.trees.clear();
  renderRepos();
  await Promise.all([refreshTree(), refreshGit()]);
  if (state.view === "run") await loadLaunch();
  if (state.view === "git") await refreshGitExtras();
  notify(`Projeto ativo: ${root}`);
}
async function loadDir(path) {
  const root = state.root;
  const rows = await rpc("tree", {
    root,
    path,
    showGenerated: state.generated,
  });
  if (root !== state.root) return false;
  if (
    path &&
    !state.expanded.has(path) &&
    state.expanded.size >= PERFORMANCE.expandedDirectories
  )
    throw new Error(
      "Limite de 16 pastas abertas; recolha uma pasta para expandir outra.",
    );
  const retained = [...state.trees]
    .filter(([key]) => key !== path)
    .reduce((sum, [, list]) => sum + list.length, 0);
  if (retained + rows.length > PERFORMANCE.cachedTreeRows)
    throw new Error(
      "Explorador no limite de 8.000 itens em memória; recolha pastas ou use Ctrl+P.",
    );
  if (JSON.stringify(state.trees.get(path)) === JSON.stringify(rows))
    return false;
  state.trees.set(path, rows);
  return true;
}
async function refreshTree() {
  if (!state.root) return;
  const changes = [];
  for (const path of [...state.expanded]) {
    changes.push(
      await loadDir(path).catch((e) => {
        state.expanded.delete(path);
        state.trees.delete(path);
        return true;
      }),
    );
  }
  if (changes.some(Boolean)) renderTree();
}
function renderTree() {
  const tree = $("tree");
  tree.replaceChildren();
  if (!state.root) {
    tree.append(
      el("p", "empty", "Abra uma pasta para explorar seus arquivos."),
    );
    return;
  }
  let count = 0;
  const badges = new Map((state.git.entries || []).map((e) => [e.path, e]));
  function branch(path, depth) {
    for (const entry of state.trees.get(path) || []) {
      if (count++ >= 1000) {
        if (count === 1001)
          tree.append(
            el(
              "p",
              "empty",
              "Explorador limitado a 1.000 itens visíveis. Recolha pastas ou use Ctrl+P.",
            ),
          );
        return;
      }
      if (entry.truncated) {
        tree.append(
          el(
            "p",
            "empty",
            "Pasta com mais de 1.000 itens. Use Ctrl+P para localizar arquivos.",
          ),
        );
        continue;
      }
      const row = el("button", "tree-row");
      row.dataset.path = entry.path;
      row.draggable = true;
      row.ondragstart = (e) => {
        e.dataTransfer.setData(
          "application/x-speedcode-path",
          JSON.stringify({ root: state.root, path: entry.path }),
        );
        e.dataTransfer.setData(
          "text/plain",
          `${state.root}\\${entry.path.replaceAll("/", "\\")}`,
        );
        e.dataTransfer.effectAllowed = "copy";
      };
      row.style.paddingLeft = `${8 + depth * 15}px`;
      row.title = entry.path;
      row.setAttribute("aria-label", entry.path);
      row.append(
        icon(
          entry.dir
            ? state.expanded.has(entry.path)
              ? "down"
              : "chevron"
            : "file",
          entry.dir ? 12 : 0,
        ),
        fileIcon(entry.name, entry.dir),
        el("span", "name", entry.name),
      );
      const changed = badges.get(entry.path);
      if (changed)
        row.append(
          el(
            "span",
            `change ${changed.x === "?" ? "new" : ""}`,
            changed.x === "?" ? "U" : changed.y.trim() || changed.x,
          ),
        );
      if (
        state.current === `${state.root}|${entry.path}` ||
        state.revealedPath === entry.path
      )
        row.classList.add("current");
      row.onclick = async () => {
        try {
          if (entry.dir) {
            if (state.expanded.has(entry.path)) {
              for (const path of [...state.trees.keys()])
                if (path === entry.path || path.startsWith(entry.path + "/")) {
                  state.expanded.delete(path);
                  state.trees.delete(path);
                }
            } else {
              await loadDir(entry.path);
              state.expanded.add(entry.path);
            }
            renderTree();
          } else await openFile(entry.path);
        } catch (e) {
          fail(e);
        }
      };
      row.oncontextmenu = async (e) => {
        e.preventDefault();
        const dest = await modal("Renomear", entry.path, {
          input: "Novo caminho relativo",
          initial: entry.path,
          confirm: "Renomear",
        });
        if (dest && dest !== entry.path) {
          try {
            if (
              [...state.buffers.values()].some(
                (b) =>
                  b.root === state.root &&
                  (b.path === entry.path ||
                    b.path.startsWith(entry.path + "/")),
              )
            ) {
              throw new Error(
                "Feche as abas deste arquivo/pasta antes de renomear.",
              );
            }
            await rpc("rename", {
              root: state.root,
              path: entry.path,
              destination: dest,
            });
            await refreshTree();
            await refreshGit();
          } catch (e) {
            fail(e);
          }
        }
      };
      tree.append(row);
      if (entry.dir && state.expanded.has(entry.path))
        branch(entry.path, depth + 1);
    }
  }
  branch("", 0);
}
async function createEntry(directory) {
  if (!state.root) return notify("Abra um projeto primeiro.");
  const path = await modal(
    directory ? "Nova pasta" : "Novo arquivo",
    "Informe o caminho relativo ao repositório. Pastas pai devem existir.",
    {
      input: directory ? "src/nova-pasta" : "src/novo-arquivo.ts",
      confirm: "Criar",
    },
  );
  if (!path) return;
  await rpc("create", { root: state.root, path, directory });
  await refreshTree();
  await refreshGit();
  if (!directory) await openFile(path);
}
let openingFile = false;
async function openFile(path, root = state.root) {
  if (openingFile) {
    notify("Aguarde a abertura do arquivo.");
    return false;
  }
  navigationGate.invalidate();
  state.revealedPath = null;
  openingFile = true;
  try {
    await openFileOnce(path, root);
    return true;
  } finally {
    openingFile = false;
  }
}
async function openFileOnce(path, root) {
  $("markdown-view").classList.add("hidden");
  $("markdown-view").replaceChildren();
  $("markdown-view")._markdownGeneration = null;
  const key = `${root}|${path}`;
  let b = state.buffers.get(key);
  if (isImage(path)) {
    if (!b) {
      b = {
        key,
        root,
        path,
        kind: "image",
        ...(await rpc("read_image", { root, path })),
      };
      if (!admitBuffer(state.buffers, b.dataUrl.length * 2))
        throw new Error(
          "Limite de abas/memória atingido. Feche abas; nada foi descartado.",
        );
      state.buffers.set(key, b);
    }
    state.current = key;
    clearDiff();
    editor.setModel(null);
    $("editor").classList.add("hidden");
    $("welcome").classList.add("hidden");
    showImage(b);
    $("crumb").textContent = path;
    renderTabs();
    updateConflict();
    return;
  }
  $("image-view").classList.add("hidden");
  if (!b) {
    const data = await rpc("read", { root, path });
    if (!admitBuffer(state.buffers, data.text.length * 4))
      throw new Error(
        "Limite de 24 abas ou 32 MiB de conteúdo atingido. Feche abas; nada foi descartado.",
      );
    const lightweight = data.text.length > PERFORMANCE.syntaxChars;
    const model = monaco.editor.createModel(
      data.text,
      lightweight ? "plaintext" : language(path),
      monaco.Uri.parse(
        `inmemory://workspace/${encodeURIComponent(root)}/${path}`,
      ),
    );
    b = {
      key,
      root,
      path,
      model,
      ...data,
      saved: data.text,
      savedVersion: model.getAlternativeVersionId(),
      dirty: false,
      conflict: false,
    };
    delete b.text; // retain one saved snapshot, not the initial RPC text as well
    model.onDidChangeContent(() => {
      if (
        model.getValueLength() > PERFORMANCE.syntaxChars &&
        model.getLanguageId() !== "plaintext"
      ) {
        monaco.editor.setModelLanguage(model, "plaintext");
        notify(
          "Buffer grande: destaque sintático suspenso para poupar CPU; texto preservado.",
        );
      }
      const dirty = dirtySince(model, b.savedVersion);
      if (dirty !== b.dirty) {
        b.dirty = dirty;
        renderTabs();
        updateConflict();
      }
    });
    state.buffers.set(key, b);
    if (lightweight)
      notify(
        "Arquivo grande: texto simples para poupar CPU. Edição e salvamento disponíveis.",
      );
  }
  state.current = key;
  clearDiff();
  editor.setModel(b.model);
  $("editor").classList.remove("hidden");
  $("welcome").classList.add("hidden");
  $("crumb").textContent = path.replaceAll("/", "  ›  ");
  $("crumb").title = root + "/" + path;
  $("encoding").textContent = `UTF-8${b.bom ? " BOM" : ""} · ${b.eol}`;
  editor.focus();
  renderTabs();
  renderTree();
  updateConflict();
}
function renderTabs() {
  updatePreviewButton();
  const tabs = $("tabs");
  tabs.replaceChildren();
  for (const [key, b] of state.buffers) {
    const tab = el(
      "button",
      `tab${key === state.current && !state.diff ? " active" : ""}`,
    );
    tab.title = b.root + "/" + b.path;
    tab.append(
      fileIcon(b.path),
      el("span", "label", b.path.split("/").at(-1)),
      el("span", "close", b.dirty ? "●" : "×"),
    );
    tab.onclick = (e) => {
      if (e.target === tab.lastChild) closeBuffer(key);
      else openFile(b.path, b.root).catch(fail);
    };
    tabs.append(tab);
  }
  if (state.diff) {
    const tab = el(
      "button",
      "tab active",
      `Diff · ${state.diff.path.split("/").at(-1)}   ×`,
    );
    tab.onclick = () => {
      clearDiff();
      const b = state.buffers.get(state.current);
      if (b) openFile(b.path, b.root).catch(fail);
      else {
        state.current = null;
        resetEmptyEditorView({ document, editor });
      }
      renderTabs();
      updateConflict();
    };
    tabs.append(tab);
  }
}
async function closeBuffer(key) {
  const b = state.buffers.get(key);
  if (!b) return;
  if (
    b.dirty &&
    !(await modal(
      "Alterações não salvas",
      `Fechar ${b.path} e descartar somente o buffer?`,
      { confirm: "Descartar buffer" },
    ))
  )
    return;
  state.buffers.delete(key);
  if (state.current === key) {
    editor.setModel(null);
    state.current = null;
    $("editor").classList.add("hidden");
  }
  b.model?.dispose();
  if (!state.current && !state.diff) resetEmptyEditorView({ document, editor });
  renderTabs();
  updateConflict();
}
async function saveCurrent() {
  if (state.diff)
    return notify(
      "Diff é somente leitura. Abra o arquivo no explorador para editar.",
    );
  const b = state.buffers.get(state.current);
  if (!b || b.kind === "image") return;
  const text = b.model.getValue();
  const savedVersion = b.model.getAlternativeVersionId();
  try {
    const r = await rpc("save", {
      root: b.root,
      path: b.path,
      text,
      hash: b.hash,
    });
    b.hash = r.hash;
    b.stamp = r.stamp;
    b.saved = text;
    b.savedVersion = savedVersion;
    b.dirty = !b.model.isDisposed() && dirtySince(b.model, savedVersion);
    b.conflict = false;
    renderTabs();
    updateConflict();
    notify(`Salvo: ${b.path}`);
    await refreshGit();
  } catch (e) {
    if (e.message.startsWith("CONFLICT")) {
      b.conflict = true;
      updateConflict();
    }
    throw e;
  }
}
async function reloadCurrent() {
  const b = state.buffers.get(state.current);
  if (!b) return;
  if (b.kind === "image") {
    const data = await rpc("read_image", { root: b.root, path: b.path });
    if (!admitBuffer(state.buffers, data.dataUrl.length * 2, b.key))
      throw new Error(
        "Imagem atualizada excede orçamento das abas. Feche abas antes de recarregar.",
      );
    Object.assign(b, data);
    showImage(b);
    return;
  }
  if (
    b.dirty &&
    !(await modal(
      "Recarregar arquivo",
      `Descartar o buffer de ${b.path} e carregar a versão do disco?`,
      { confirm: "Recarregar" },
    ))
  )
    return;
  const d = await rpc("read", { root: b.root, path: b.path });
  if (!admitBuffer(state.buffers, d.text.length * 4, b.key))
    throw new Error(
      "Arquivo atualizado excede orçamento das abas. Feche abas antes de recarregar.",
    );
  b.saved = d.text;
  b.hash = d.hash;
  b.stamp = d.stamp;
  b.model.setValue(d.text);
  monaco.editor.setModelLanguage(
    b.model,
    d.text.length > PERFORMANCE.syntaxChars ? "plaintext" : language(b.path),
  );
  b.savedVersion = b.model.getAlternativeVersionId();
  b.dirty = false;
  b.conflict = false;
  renderTabs();
  updateConflict();
}
function updateConflict() {
  const box = $("conflict"),
    b = state.buffers.get(state.current);
  box.replaceChildren();
  box.classList.toggle("hidden", !b?.conflict);
  if (b?.conflict) {
    box.append(
      el("span", "", "O arquivo mudou no disco. Seu buffer foi preservado."),
      button(
        null,
        "Comparar buffer com disco",
        async () => {
          const d = await rpc("read", { root: b.root, path: b.path });
          showDiff(
            b.path,
            d.text,
            b.model.getValue(),
            "Disco → buffer não salvo",
          );
        },
        "Comparar",
      ),
      button(null, "Recarregar arquivo", reloadCurrent, "Recarregar"),
    );
  }
  if (
    b &&
    !state.diff &&
    b.root === state.root &&
    state.git.entries.some((e) => e.path === b.path && e.conflict)
  ) {
    box.classList.remove("hidden");
    box.append(
      el(
        "span",
        "",
        "Conflito Git: edite o resultado, remova os marcadores e salve.",
      ),
      button(
        null,
        "Comparar versões",
        () => showMergeDiff({ path: b.path }),
        "Atual × Recebido",
      ),
      button(
        "check",
        "Salvar e marcar resolvido",
        () => resolveConflict({ path: b.path }),
        "Marcar resolvido",
      ),
    );
    if (b.kind !== "image")
      for (const [choice, label] of [
        ["ours", "Aceitar atual"],
        ["theirs", "Aceitar recebido"],
        ["both", "Aceitar ambos"],
      ])
        box.append(
          button(
            null,
            label,
            () => {
              b.model.setValue(resolveMarkers(b.model.getValue(), choice));
              notify("Revise o resultado, salve e marque resolvido.");
            },
            label,
          ),
        );
  }
}
function clearDiff() {
  navigationGate.invalidate();
  $("reveal-diff").classList.add("hidden");
  $("markdown-view").classList.add("hidden");
  $("markdown-view")._markdownGeneration = null;
  if (state.diff) {
    diff.setModel(null);
    state.diff.models?.forEach((m) => m.dispose());
    state.diff = null;
    diff.dispose();
    diff = null;
  }
  $("diff").classList.add("hidden");
}
function showDiff(path, original, modified, label) {
  if (
    [original, modified].some(
      (text) =>
        text.length > PERFORMANCE.diffChars || text.split("\n").length > 10000,
    )
  )
    throw new Error(
      "Diff grande: limite de 512 Ki caracteres/10.000 linhas por lado. Use git diff no terminal; arquivos preservados.",
    );
  clearDiff();
  $("image-view").classList.add("hidden");
  const models = [
    monaco.editor.createModel(original, language(path)),
    monaco.editor.createModel(modified, language(path)),
  ];
  state.diff = { path, models };
  diffEditor().setModel({ original: models[0], modified: models[1] });
  $("editor").classList.add("hidden");
  $("welcome").classList.add("hidden");
  $("diff").classList.remove("hidden");
  $("crumb").textContent = `${path}  ·  ${label}`;
  renderTabs();
}
async function gitDiff(entry, staged) {
  if (entry.conflict) return openMerge(entry);
  const root = state.root;
  const token = navigationGate.begin();
  const data = await rpc("git_diff", {
    root,
    path: entry.path,
    oldPath: entry.oldPath,
    staged,
  });
  if (root !== state.root || !navigationGate.current(token)) return;
  showDiff(entry.path, data.original, data.modified, data.label);
  state.diff.git = { root, entry, staged };
  $("reveal-diff").classList.remove("hidden");
}
async function revealGitFile(entry, root = state.root) {
  if (root !== state.root)
    return notify("Selecione o projeto deste diff antes de navegar.");
  navigationGate.invalidate();
  const plan = revealPlan(entry.path);
  let opened = false;
  if (!entry.directory) {
    try {
      opened = await openFile(plan.path, root);
      if (!opened) return;
    } catch (error) {
      notify(
        `Não foi possível abrir o arquivo no disco: ${error.message}`,
        true,
      );
    }
  }
  if (root !== state.root) return;
  const token = navigationGate.begin();
  setView("files");
  try {
    const complete = await revealAncestors(plan, {
      active: () => root === state.root && navigationGate.current(token),
      expanded: state.expanded,
      load: loadDir,
      limit: PERFORMANCE.expandedDirectories,
    });
    if (!complete) return;
    state.revealedPath = plan.path;
  } catch (error) {
    notify(error.message, true);
  }
  if (root !== state.root || !navigationGate.current(token)) return;
  renderTree();
  const rows = [...$("tree").querySelectorAll(".tree-row")];
  const row =
    rows.find((r) => r.dataset.path === plan.path) ||
    rows.find((r) => r.dataset.path === plan.ancestors.at(-1));
  row?.scrollIntoView({ block: "nearest" });
  if (
    !rows.some((r) => r.dataset.path === plan.path) &&
    opened &&
    entry.x !== "D" &&
    entry.y !== "D"
  )
    notify(
      "Arquivo aberto; caminho não visível devido aos filtros/limites do explorador.",
    );
}
let gitSignature = "";
let gitPages = [0, 0];
const gitFolders = createGitFolderState();
let gitExpansionNotice = "";
async function loadExpandedGitFolders() {
  const root = state.root;
  if (!root || !state.git.available) return;
  try {
    await gitFolders.loadExpanded(
      root,
      state.git.entries,
      (params) => rpc("git_group", params),
      {
        active: () =>
          root === state.root && state.view === "git" && !document.hidden,
        changed: renderGit,
      },
    );
  } catch (error) {
    if (root === state.root) gitExpansionNotice = error.message;
  } finally {
    if (root === state.root && state.view === "git") renderGit();
    if (
      gitFolders.needsExpansion &&
      !gitFolders.expanding &&
      state.view === "git" &&
      !document.hidden
    )
      loadExpandedGitFolders().catch(fail);
  }
}
function focusGitFolder(path, section) {
  for (const folder of $("git-view").querySelectorAll(".git-folder"))
    if (
      folder.dataset.path === path &&
      folder.dataset.section === String(section)
    ) {
      folder.focus({ preventScroll: true });
      break;
    }
}
async function toggleGitFolder(item, section) {
  const root = state.root;
  const expanded = gitFolders.expanded[section];
  if (expanded.has(item.path)) {
    gitFolders.collapse(item.path, section);
    renderGit();
    focusGitFolder(item.path, section);
    return;
  }
  if (item.entry?.directory) {
    const loading = gitFolders.load(
      root,
      state.git.entries,
      item.entry,
      (params) => rpc("git_group", params),
    );
    renderGit();
    try {
      if (!(await loading) || root !== state.root) return;
    } finally {
      if (root === state.root) {
        renderGit();
        focusGitFolder(item.path, section);
      }
    }
  }
  if (root !== state.root) return;
  gitFolders.expand(item.path, section);
  renderGit();
  focusGitFolder(item.path, section);
  if (gitFolders.needsExpansion && state.view === "git")
    loadExpandedGitFolders().catch(fail);
}
async function refreshGit() {
  if (!state.root || state.refreshing) return;
  state.refreshing = true;
  const root = state.root;
  try {
    const data = await rpc("git_status", { root });
    if (root !== state.root) return;
    state.git = data;
    const sig = data.signature || JSON.stringify(data);
    const changed = sig !== gitSignature;
    if (changed) {
      gitSignature = sig;
      gitFolders.invalidate();
      gitExpansionNotice = "";
      gitPages = [0, 0];
      renderGit();
      if (state.view === "git") loadExpandedGitFolders().catch(fail);
      renderTree();
      updateConflict();
      if (state.view === "git") refreshGitExtras().catch(fail);
    }
    $("branch").textContent = data.available
      ? `⑂ ${data.branch}`
      : "◈ pasta sem Git";
    $("activity").children[1].title =
      `Controle de versão · ${data.entries.length} alterações`;
    if (state.diff?.git && state.diff.git.root === root) {
      const currentDiff = state.diff;
      const { entry, staged } = currentDiff.git;
      const stamp = await rpc("file_stamp", { root, path: entry.path });
      if (
        !changed &&
        stamp === currentDiff.diskStamp &&
        Date.now() - (currentDiff.checkedAt || 0) < 60000
      )
        return;
      currentDiff.diskStamp = stamp;
      currentDiff.checkedAt = Date.now();
      const d = await rpc("git_diff", {
        root,
        path: entry.path,
        oldPath: entry.oldPath,
        staged,
      });
      const [a, b] = state.diff === currentDiff ? currentDiff.models : [];
      if (a && b) {
        if (a.getValue() !== d.original) a.setValue(d.original);
        if (b.getValue() !== d.modified) b.setValue(d.modified);
      }
    }
  } finally {
    state.refreshing = false;
  }
}
let gitLog = "",
  commitMessage = "";
function renderGit() {
  const box = $("git-view");
  const scrollTop = box.scrollTop;
  box.replaceChildren();
  if (!state.git.available) {
    box.append(
      el(
        "p",
        "empty",
        "Esta pasta não é um repositório Git. Abra a raiz de um repositório existente. Arquivos e terminais continuam disponíveis.",
      ),
    );
    return;
  }
  box.append(
    button("git", "Branches e stash", openGitManager, state.git.branch),
  );
  renderGitExtras();
  if (state.git.mergeInProgress) {
    const merge = el("div", "merge-card");
    merge.append(
      el("strong", "", "Merge em andamento"),
      el(
        "p",
        "",
        "Resolva cada arquivo e complete o merge. O push fica para depois.",
      ),
      button(
        "check",
        "Completar merge",
        () => extraGit("git_merge_continue"),
        "Completar merge",
      ),
      button(
        "close",
        "Abortar merge",
        async () => {
          if (
            await modal(
              "Abortar merge?",
              "O Git tentará restaurar o estado anterior ao pull. Salve seu trabalho antes.",
              { confirm: "Abortar merge" },
            )
          )
            await extraGit("git_merge_abort");
        },
        "Abortar",
      ),
    );
    box.append(merge);
  }
  const tools = el("div", "git-tools");
  for (const [a, t] of [
    ["fetch", "Fetch"],
    ["pull", "Pull"],
    ["push", "Push"],
  ]) {
    const b = button(
      a === "push" ? "up" : a === "fetch" ? "refresh" : "down",
      t,
      () => gitAction(a),
      t,
    );
    b.disabled = state.gitBusy;
    tools.append(b);
  }
  if (!state.git.upstream)
    tools.append(
      button(
        "up",
        "Publicar esta branch em um remoto",
        () => gitAction("publish"),
        "Publicar branch",
      ),
    );
  tools.append(
    button("refresh", "Atualizar Git", () => {
      gitSignature = ""; // Explicit refresh releases scoped folder snapshots too.
      return refreshGit();
    }),
  );
  box.append(tools);
  const commit = el("div", "commit-box"),
    input = el("textarea");
  input.placeholder = "Mensagem do commit";
  input.setAttribute("aria-label", "Mensagem do commit");
  input.value = commitMessage;
  input.oninput = () => (commitMessage = input.value);
  commit.append(
    input,
    button(
      "check",
      "Commit de arquivos preparados",
      () => gitAction("commit"),
      state.gitBusy ? "Git em andamento…" : "Commit dos preparados",
    ),
  );
  box.append(commit);
  gitFolders.setRoot(state.root);
  const { entries, partial } = gitFolders.project(state.git.entries);
  if (state.git.partial || partial)
    box.append(
      el(
        "p",
        "scm-notice error",
        "Lista parcial: até 2.000 caminhos. Ações em todos bloqueadas; use o terminal para o restante.",
      ),
    );
  const notice = el(
    "p",
    "scm-notice",
    "Dependências e ignorados ocultos · Alterações por pasta",
  );
  notice.title =
    "Clique numa pasta para expandir ou recolher. node_modules não é enumerado e as regras Git de ignore são respeitadas.";
  box.append(notice);
  if (gitExpansionNotice) box.append(el("p", "scm-notice", gitExpansionNotice));
  for (const [title, staged, items] of [
    [
      "Preparados",
      true,
      entries.filter((e) => e.x !== " " && e.x !== "?" && !e.conflict),
    ],
    [
      "Alterações",
      false,
      entries.filter((e) => e.y !== " " || e.x === "?" || e.conflict),
    ],
  ]) {
    const head = el("div", "group-title", `${title} · ${items.length}`);
    const section = staged ? 0 : 1;
    const tree = groupGitChanges(items);
    const expanded = gitFolders.sync(tree, section);
    if (items.length || (!staged && entries.length)) {
      const actions = el("span", "git-group-actions");
      const expand = button(
        "expandAll",
        `Expandir tudo · ${title}`,
        async () => {
          gitFolders.expandAll(section);
          gitExpansionNotice = "";
          gitPages[section] = 0;
          renderGit();
          if (!staged) await loadExpandedGitFolders();
        },
      );
      const collapse = button("collapseAll", `Recolher tudo · ${title}`, () => {
        gitFolders.collapseAll(section);
        gitExpansionNotice = "";
        gitPages[section] = 0;
        renderGit();
      });
      expand.disabled = !tree.folders.size || !!gitFolders.pending;
      collapse.disabled = !tree.folders.size;
      actions.append(expand, collapse);
      if (items.length)
        actions.append(
          button(
            staged ? "minus" : "plus",
            staged ? "Retirar todos do stage" : "Preparar todas as alterações",
            () => gitAction(staged ? "unstage_all" : "stage_all"),
          ),
        );
      if (!staged)
        actions.append(
          button(
            "trash",
            "Descartar todas as alterações (incluindo arquivos novos)",
            () => gitAction("discard_all"),
          ),
        );
      for (const b of [...actions.children].slice(2))
        b.disabled = state.gitBusy || !!(state.git.partial || partial);
      head.append(actions);
    }
    box.append(head);
    const visible = gitFolderRows(tree, expanded);
    if (tree.compacted)
      box.append(
        el(
          "p",
          "scm-notice",
          "Árvore extensa: caminhos profundos compactados; nomes completos no tooltip.",
        ),
      );
    const { page, pages, rows } = gitFolderPage(visible, gitPages[section]);
    gitPages[section] = page;
    if (pages > 1) {
      const pager = el("div", "git-tools");
      const previous = button(
        "chevron",
        "Página anterior",
        () => {
          gitPages[section]--;
          renderGit();
        },
        "Anterior",
      );
      previous.disabled = page === 0;
      const next = button(
        "chevron",
        "Próxima página",
        () => {
          gitPages[section]++;
          renderGit();
        },
        "Próxima",
      );
      next.disabled = page + 1 >= pages;
      pager.append(previous, el("span", "", `${page + 1}/${pages}`), next);
      box.append(pager);
    }
    for (const item of rows) {
      if (item.kind === "folder") {
        const folder = button(null, `Pasta ${item.path}`, () =>
          toggleGitFolder(item, section),
        );
        folder.className = "git-folder";
        folder.dataset.path = item.path;
        folder.dataset.section = section;
        folder.style.paddingLeft = `${4 + Math.min(item.depth, 10) * 12}px`;
        folder.disabled = gitFolders.pending === item.path;
        folder.setAttribute("aria-expanded", String(item.expanded));
        folder.title = `${item.path} · ${item.count} alterações`;
        folder.append(
          el("span", "git-folder-arrow", item.expanded ? "▾" : "▸"),
          fileIcon(item.path, true),
          el("span", "file-label", item.label),
          el(
            "span",
            "git-folder-count",
            folder.disabled ? "…" : String(item.count),
          ),
        );
        box.append(folder);
        continue;
      }
      const entry = item.entry;
      const row = el("div", "git-file"),
        open = button(null, entry.path, () => {});
      row.style.paddingLeft = `${8 + Math.min(item.depth, 10) * 12}px`;
      const root = state.root;
      open.title = `${entry.path} · Clique: diff; duplo clique: arquivo e explorador`;
      open.onclick = (event) => {
        if (event.detail > 1 || root !== state.root) return;
        Promise.resolve(
          entry.directory
            ? toggleGitFolder(
                { path: entry.path.replace(/\/$/, ""), entry },
                section,
              )
            : gitDiff(entry, staged),
        ).catch(fail);
      };
      open.ondblclick = () => revealGitFile(entry, root).catch(fail);
      open.append(
        fileIcon(entry.path, entry.directory),
        el("span", "file-label", item.label),
        el(
          "span",
          entry.conflict ? "error" : "change",
          entry.conflict
            ? "!"
            : entry.x === "?"
              ? "U"
              : staged
                ? entry.x
                : entry.y,
        ),
      );
      row.append(open);
      if (entry.directory) {
        box.append(row);
        continue;
      }
      if (entry.conflict) {
        row.append(
          button("file", "Editar resolução", () => openMerge(entry)),
          button("check", "Marcar resolvido", () => resolveConflict(entry)),
        );
        box.append(row);
        continue;
      }
      row.append(
        button(
          staged ? "minus" : "plus",
          staged ? "Retirar do stage" : "Preparar arquivo",
          () => gitAction(staged ? "unstage" : "stage", entry),
        ),
      );
      row.append(
        button(
          "trash",
          "Descartar alterações deste arquivo",
          () => gitAction("discard", entry),
          "",
        ),
      );
      box.append(row);
    }
  }
  if (!entries.length && !state.git.partial && !partial)
    box.append(
      el(
        "p",
        "empty",
        "Nenhuma alteração visível. Dependências e ignorados não entram nesta lista.",
      ),
    );
  if (gitLog) box.append(el("pre", "git-log", gitLog));
  box.scrollTop = scrollTop;
}
async function gitAction(action, entry = {}) {
  if (state.gitBusy) return;
  if (action === "publish" || (action === "push" && !state.git.upstream))
    return publishBranch();
  const root = state.root;
  if (
    action === "pull" &&
    [...state.buffers.values()].some((b) => b.root === root && b.dirty)
  )
    return notify("Salve os buffers antes do pull.", true);
  if (
    state.git.entries.some((e) => e.conflict) &&
    ["stage_all", "discard_all"].includes(action)
  )
    return notify(
      "Resolva os conflitos individualmente antes desta ação.",
      true,
    );
  if (
    ["discard", "discard_all"].includes(action) &&
    !(await modal(
      action === "discard_all"
        ? "Descartar todas as alterações?"
        : "Descartar alteração?",
      action === "discard_all"
        ? "As alterações locais e arquivos novos não preparados serão removidos. Esta ação não pode ser desfeita."
        : `As alterações locais em ${entry.path} serão descartadas. Esta ação não pode ser desfeita.`,
      {
        confirm:
          action === "discard_all" ? "Descartar tudo" : "Descartar arquivo",
      },
    ))
  )
    return;
  if (
    ["push", "publish", "pull"].includes(action) &&
    !(await modal(
      `Git ${action}`,
      `Repositório: ${root}\n${action === "pull" ? "Atualizar a branch com merge (sem rebase). Se houver conflitos, resolva-os no painel Git." : "Enviar os commits desta branch ao remoto configurado."}`,
      { confirm: action === "pull" ? "Executar pull" : "Executar push" },
    ))
  )
    return;
  state.gitBusy = true;
  renderGit();
  try {
    const r = await rpc("git_action", {
      root,
      action,
      path: entry.path || "",
      oldPath: entry.oldPath,
      message: commitMessage,
    });
    gitLog = r.output || `Git ${action}: concluído`;
    if (action === "commit") commitMessage = "";
    notify(`Git ${action}: concluído`);
  } catch (e) {
    gitLog = e.message;
    fail(e);
  } finally {
    state.gitBusy = false;
    gitSignature = "";
    await refreshGit();
    renderGit();
    await refreshTree();
    await refreshGitExtras();
  }
}
let lastHashCheck = 0,
  reconcileFlight = null;
function reconcile(force = false) {
  if (reconcileFlight) return reconcileFlight;
  reconcileFlight = reconcileOnce(force).finally(() => {
    reconcileFlight = null;
  });
  return reconcileFlight;
}
async function reconcileOnce(force = false) {
  const verify = force || Date.now() - lastHashCheck > 60000;
  if (verify) lastHashCheck = Date.now();
  let changed = false;
  for (const b of state.buffers.values()) {
    if (b.kind === "image") continue;
    try {
      const d = await rpc("read_if_changed", {
        root: b.root,
        path: b.path,
        stamp: b.stamp,
        hash: b.hash,
        force: verify,
      });
      if (d.unchanged) {
        b.stamp = d.stamp;
        continue;
      }
      if (d.hash !== b.hash) {
        changed = true;
        if (b.dirty) {
          b.conflict = true;
        } else {
          if (!admitBuffer(state.buffers, d.text.length * 4, b.key)) {
            if (!b.conflict)
              notify(
                "Arquivo externo cresceu além do orçamento das abas. Buffer preservado; feche abas e recarregue.",
                true,
              );
            b.conflict = true;
            continue;
          }
          const pos = state.current === b.key ? editor.saveViewState() : null;
          b.saved = d.text;
          b.hash = d.hash;
          b.stamp = d.stamp;
          b.model.setValue(d.text);
          monaco.editor.setModelLanguage(
            b.model,
            d.text.length > PERFORMANCE.syntaxChars
              ? "plaintext"
              : language(b.path),
          );
          b.savedVersion = b.model.getAlternativeVersionId();
          b.dirty = false;
          if (pos) editor.restoreViewState(pos);
        }
      }
    } catch {
      if (!b.conflict) {
        b.conflict = true;
        changed = true;
      }
    }
  }
  if (changed) {
    renderTabs();
    updateConflict();
  }
  await refreshGit();
  await refreshTree();
}
async function newTerminal(profile, launchParams = null) {
  if (!state.root) return notify("Abra um projeto primeiro.");
  const root = state.root;
  const data = await rpc(launchParams ? "launch_start" : "terminal_start", {
    root,
    profile,
    cols: 100,
    rows: 24,
    ...launchParams,
  });
  const term = new Terminal({
    fontFamily: "'Cascadia Mono', Consolas, monospace",
    fontSize: 12,
    cursorBlink: false,
    scrollback: PERFORMANCE.terminalScrollback,
    allowProposedApi: false,
    theme: {
      background: "#10151e",
      foreground: "#d6deed",
      cursor: "#79dacc",
      selectionBackground: "#345d7b",
    },
  });
  const fit = new FitAddon();
  term.loadAddon(fit);
  const host = el("div", "term-view");
  host.ondragover = (e) => {
    if (!e.dataTransfer.types.includes("text/plain")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    host.classList.add("drop-target");
  };
  host.ondragleave = (e) => {
    if (!host.contains(e.relatedTarget)) host.classList.remove("drop-target");
  };
  host.ondrop = (e) => {
    e.preventDefault();
    host.classList.remove("drop-target");
    const path = e.dataTransfer.getData("text/plain");
    if (!path) return;
    // Leave the path at the prompt; never submit or execute on drop.
    term.paste(`'${path.replaceAll("'", "''")}' `);
    term.focus();
    notify(
      "Caminho inserido no terminal — pressione Enter quando quiser enviá-lo.",
    );
  };
  $("term-views").append(host);
  term.open(host);
  const s = { ...data, term, fit, host, closed: false, exit: null };
  s.browserTarget = launchParams?.browserTarget;
  s.output = "";
  s.decoder = new TextDecoder();
  state.sessions.push(s);
  state.selectedSession = s.id;
  s.inputQueue = Promise.resolve();
  term.onData((data) => {
    s.inputQueue = s.inputQueue
      .then(() => rpc("terminal_input", { id: s.id, data }))
      .catch(fail);
  });
  term.onResize(({ cols, rows }) => {
    s.resize = { cols: Math.min(cols, 500), rows: Math.min(rows, 200) };
    if (s.resizing) return;
    s.resizing = setTimeout(async () => {
      s.resizing = null;
      if (!s.closed)
        await rpc("terminal_resize", { id: s.id, ...s.resize }).catch(() => {});
    }, 100);
  });
  renderTerminals();
  renderSessions();
  pollTerminal(s);
  term.focus();
  notify(`${profile} integrado · ${root}`);
}
async function pollTerminal(s) {
  let idle = 0;
  while (!s.closed) {
    try {
      const data = await rpc("terminal_poll", { id: s.id });
      if (s.closed) break; // Do not write a late response into a disposed xterm.
      if (data.data) {
        const bytes = Uint8Array.from(atob(data.data), (c) => c.charCodeAt(0));
        serverReady(s, s.decoder.decode(bytes, { stream: true }));
        await new Promise((resolve) => s.term.write(bytes, resolve));
      }
      if (data.exit !== null) {
        s.exit = data.exit;
        renderTerminals();
        renderSessions();
        if (!data.data) {
          s.term.write(`\r\n[Processo encerrado: ${data.exit}]\r\n`);
          break;
        }
      }
      idle = data.data ? 0 : Math.min(idle + 1, 10);
      await new Promise((r) =>
        setTimeout(
          r,
          data.data
            ? 5
            : document.hidden || s.host.classList.contains("hidden")
              ? 1000
              : Math.min(500, 65 + idle * 45),
        ),
      );
    } catch (e) {
      if (!s.closed) {
        s.term.write(`\r\n${e.message}\r\n`);
        s.exit = "erro";
        renderTerminals();
      }
      break;
    }
  }
}
function fitTerminals() {
  for (const s of state.sessions)
    if (!s.host.classList.contains("hidden"))
      try {
        s.fit.fit();
      } catch {}
}
function renderTerminals() {
  const tabs = $("term-tabs");
  tabs.replaceChildren();
  const chosen = state.sessions.find((s) => s.id === state.selectedSession);
  const second = state.split ? state.sessions.find((s) => s !== chosen) : null;
  for (const s of state.sessions) {
    const tab = createTerminalTab({
      document,
      session: s,
      active: s.id === state.selectedSession,
      icon,
      onSelect: () => {
        state.selectedSession = s.id;
        renderTerminals();
        s.term.focus();
      },
      onClose: closeTerminal,
      onError: fail,
    });
    tabs.append(tab);
    s.host.classList.toggle("hidden", s !== chosen && s !== second);
    s.host.title = s.root;
  }
  $("term-empty").classList.toggle("hidden", state.sessions.length > 0);
  $("session-count").textContent =
    `${state.sessions.filter((s) => s.exit === null).length} sessões ativas`;
  requestAnimationFrame(fitTerminals);
}
async function closeTerminal(id) {
  return closeTerminalSession({
    state,
    id,
    confirm: (s) =>
      modal(
        "Encerrar sessão",
        `${s.profile} · ${s.root}\nO processo e seus filhos serão encerrados.`,
        { confirm: "Encerrar sessão" },
      ),
    close: (id) => rpc("terminal_close", { id }),
    refresh: () => {
      renderTerminals();
      renderSessions();
    },
  });
}
function renderSessions() {
  const box = $("sessions-view");
  box.replaceChildren();
  const profiles = el("div", "profile-row");
  for (const p of ["powershell", "copilot", "kiro"])
    profiles.append(
      button("plus", `Nova sessão ${p}`, () => newTerminal(p), p),
    );
  box.append(profiles);
  if (!state.sessions.length)
    box.append(
      el(
        "p",
        "empty",
        "Abra uma sessão para cada agente. Cada terminal mantém o diretório do projeto onde foi criado.",
      ),
    );
  for (const s of state.sessions) {
    const card = el("div", "session-card");
    card.append(
      el("strong", "", `${s.profile} #${s.id}`),
      el("p", "", s.root),
      el(
        "p",
        "",
        s.exit === null ? "Processo em execução" : `Encerrado · ${s.exit}`,
      ),
      button(
        "terminal",
        "Focar sessão",
        () => {
          state.selectedSession = s.id;
          renderTerminals();
          s.term.focus();
        },
        "Focar",
      ),
      button("close", "Encerrar sessão", () => closeTerminal(s.id), "Encerrar"),
    );
    box.append(card);
  }
}
async function showDiagnostics() {
  state.diagnostics = await rpc("diagnostics");
  await modal(
    "CLIs disponíveis",
    Object.entries(state.diagnostics)
      .map(([k, v]) => `${k}: ${v || "não encontrado"}`)
      .join("\n\n"),
    { confirm: "OK", cancel: "Fechar" },
  );
}
async function quickOpen() {
  if (!state.root) return openFolder();
  const back = el("div", "modal-backdrop"),
    box = el("div", "modal"),
    input = el("input"),
    results = el("div", "results");
  input.placeholder = "Nome ou caminho relativo do arquivo";
  box.append(input, results);
  back.append(box);
  document.body.append(back);
  input.focus();
  let candidates = [];
  for (const rows of state.trees.values())
    candidates.push(...rows.filter((e) => !e.dir && e.path).map((e) => e.path));
  for (const b of state.buffers.values())
    if (b.root === state.root) candidates.push(b.path);
  candidates = [...new Set(candidates)];
  const draw = () => {
    results.replaceChildren();
    for (const path of candidates
      .filter((p) => p.toLowerCase().includes(input.value.toLowerCase()))
      .slice(0, 50))
      results.append(
        button(
          "file",
          path,
          () => {
            back.remove();
            return openFile(path);
          },
          path,
        ),
      );
    if (input.value && !candidates.includes(input.value))
      results.append(
        button(
          "file",
          "Abrir caminho digitado",
          () => {
            back.remove();
            return openFile(input.value);
          },
          `Abrir: ${input.value}`,
        ),
      );
  };
  input.oninput = draw;
  back.onkeydown = (e) => {
    if (e.key === "Escape") back.remove();
    if (e.key === "Enter") {
      const first = results.querySelector("button");
      if (first) first.click();
    }
  };
  back.onclick = (e) => {
    if (e.target === back) back.remove();
  };
  draw();
}
function isImage(path) {
  return /\.(png|jpe?g|gif|webp|bmp|ico|svg)$/i.test(path);
}
function showImage(b) {
  const box = $("image-view");
  box.replaceChildren();
  box.classList.remove("hidden");
  const tools = el("div", "image-tools"),
    canvas = el("div", "image-canvas"),
    img = el("img");
  img.alt = b.path;
  const info = el("span", "", `${b.mime} · ${(b.size / 1024).toFixed(1)} KiB`);
  let scale = 1;
  const zoom = (n) => {
    scale = n;
    img.style.maxWidth = "none";
    img.style.maxHeight = "none";
    img.style.width = `${img.naturalWidth * scale}px`;
  };
  tools.append(
    button(
      null,
      "Ajustar imagem",
      () => {
        img.style.width = "auto";
        img.style.maxWidth = "100%";
        img.style.maxHeight = "100%";
        scale = 1;
      },
      "Ajustar",
    ),
    button(null, "Tamanho real", () => zoom(1), "100%"),
    button("plus", "Ampliar", () => zoom(Math.min(8, scale * 1.25))),
    button("minus", "Reduzir", () => zoom(Math.max(0.1, scale / 1.25))),
    info,
  );
  img.onload = () => {
    info.textContent += ` · ${img.naturalWidth} × ${img.naturalHeight}`;
  };
  img.onerror = () => {
    info.textContent = "Não foi possível decodificar esta imagem.";
  };
  img.src = b.dataUrl;
  canvas.append(img);
  box.append(tools, canvas);
  $("encoding").textContent = "Imagem · somente leitura";
}
window.__previewError = (message) => fail(new Error(message));
async function openBrowser() {
  const url = await modal(
    "Navegador do SpeedCode",
    "Abre uma janela de navegador pertencente ao SpeedCode, sem acesso aos comandos do workspace.",
    {
      input: "http://localhost:5000",
      initial: "http://localhost:5000",
      confirm: "Abrir",
    },
  );
  if (url) await rpc("browser_open", { url });
}
async function previewHtml() {
  const b = state.buffers.get(state.current);
  if (!b || !/\.html?$/i.test(b.path))
    return notify("Abra um arquivo .html ou .htm para visualizar.");
  if (b.dirty) await saveCurrent();
  await rpc("browser_open", { root: b.root, path: b.path });
}
function updatePreviewButton() {
  const b = state.buffers.get(state.current);
  const kind = !state.diff && previewKind(b?.path);
  const control = $("preview-current");
  if (!control) return;
  control.classList.toggle("hidden", !kind);
  const showing = !$("markdown-view").classList.contains("hidden");
  const label =
    kind === "markdown"
      ? showing
        ? "Voltar ao código"
        : "Prévia Markdown"
      : "Prévia HTML";
  control.replaceChildren(
    icon(kind === "markdown" ? "file" : "browser", 16),
    document.createTextNode(label),
  );
  control.title =
    kind === "markdown"
      ? "Alternar texto e prévia Markdown (inclui alterações não salvas)"
      : "Visualizar HTML no navegador do SpeedCode";
  control.setAttribute("aria-label", label);
}
async function previewCurrent() {
  const b = state.buffers.get(state.current);
  if (!b || state.diff) return;
  if (previewKind(b.path) === "html") return previewHtml();
  if (previewKind(b.path) !== "markdown") return;
  const body = $("markdown-view");
  if (!body.classList.contains("hidden")) {
    body.classList.add("hidden");
    body._markdownGeneration = null;
    body.replaceChildren();
    $("editor").classList.remove("hidden");
    editor.layout();
    editor.focus();
    updatePreviewButton();
    return;
  }
  $("editor").classList.add("hidden");
  $("welcome").classList.add("hidden");
  body.classList.remove("hidden");
  updatePreviewButton();
  await renderMarkdownPreview(body, b.model.getValue(), {
    path: b.path,
    readImage: (path) =>
      rpc("read_image", { root: b.root, path, maxBytes: 2 * 1024 * 1024 }),
    openLocal: (path) => openFile(path, b.root),
    openExternal: (url) => rpc("browser_open", { url, external: true }),
  });
}
let launchData = null,
  launchRoot = "",
  selectedLaunch = null;
async function loadLaunch(importFile = false) {
  if (!state.root) return;
  const root = state.root;
  const data = await rpc(importFile ? "launch_import" : "launch_list", {
    root,
  });
  if (root !== state.root) return;
  if (launchRoot !== root) selectedLaunch = null;
  launchRoot = root;
  launchData = data;
  if (!data.configs.some((c) => c.index === selectedLaunch && c.supported))
    selectedLaunch = data.configs.find((c) => c.supported)?.index ?? null;
  renderRun();
}
function renderRun() {
  const box = $("run-view");
  box.replaceChildren();
  box.append(
    el(
      "p",
      "empty",
      "Execução .NET no terminal integrado. Sem breakpoints ou attach. Configurações de launch.json são código executável: importe apenas arquivos confiáveis.",
    ),
  );
  const tools = el("div", "profile-row");
  tools.append(
    button(
      "folder",
      "Importar launch.json",
      () => loadLaunch(true),
      "Importar JSON",
    ),
    button("refresh", "Atualizar configurações", () => loadLaunch()),
  );
  box.append(tools);
  if (!launchData) return;
  box.append(el("p", "config-source", launchData.source));
  const select = el("select");
  select.setAttribute("aria-label", "Configuração .NET");
  for (const c of launchData.configs) {
    const o = el(
      "option",
      "",
      `${c.name}${c.supported ? "" : " · não suportado"}`,
    );
    o.value = c.index;
    o.disabled = !c.supported;
    select.append(o);
  }
  select.value = selectedLaunch ?? "";
  select.onchange = () => (selectedLaunch = Number(select.value));
  box.append(select);
  const browser = el("select");
  browser.id = "run-browser";
  browser.setAttribute("aria-label", "Abrir navegador ao iniciar");
  for (const [v, name] of [
    ["config", "Navegador conforme serverReadyAction"],
    ["integrated", "Navegador do SpeedCode"],
    ["none", "Não abrir navegador"],
  ]) {
    const o = el("option", "", name);
    o.value = v;
    browser.append(o);
  }
  browser.value = localStorage.getItem("runBrowser") || "config";
  browser.onchange = () => localStorage.setItem("runBrowser", browser.value);
  box.append(browser);
  box.append(
    button("play", "Executar configuração (F5)", startLaunch, "Executar · F5"),
    button(
      "close",
      "Parar execução (Shift F5)",
      stopLaunch,
      "Parar · Shift F5",
    ),
  );
  if (!launchData.configs.length)
    box.append(
      el(
        "p",
        "empty",
        "Nenhuma configuração. Crie .vscode/launch.json ou importe seu arquivo existente. tasks.json deve estar ao lado dele.",
      ),
    );
  else
    box.append(
      el(
        "p",
        "empty",
        "coreclr/clr: program .dll/.exe. dotnet: projectPath .csproj. preLaunchTask: tasks shell/process finitas. Variáveis: workspaceFolder, workspaceRoot, workspaceFolderBasename, env:NAME.",
      ),
    );
}
async function startLaunch() {
  if (!state.root) return notify("Abra um projeto primeiro.");
  if (launchRoot !== state.root || !launchData) await loadLaunch();
  if (selectedLaunch === null)
    return notify("Selecione ou importe uma configuração .NET compatível.");
  const dirty = [...state.buffers.values()].filter(
    (b) => b.root === state.root && b.dirty,
  );
  if (dirty.length)
    return notify(
      "Salve os arquivos alterados antes de executar a aplicação.",
      true,
    );
  await newTerminal(".NET", {
    index: selectedLaunch,
    hash: launchData.hash,
    browserTarget:
      $("run-browser")?.value || localStorage.getItem("runBrowser") || "config",
  });
}
async function stopLaunch() {
  const s =
    state.sessions.find(
      (s) => s.id === state.selectedSession && s.profile.startsWith(".NET"),
    ) ||
    [...state.sessions]
      .reverse()
      .find(
        (s) =>
          s.root === state.root &&
          s.profile.startsWith(".NET") &&
          s.exit === null,
      );
  if (s) await closeTerminal(s.id);
  else notify("Nenhuma execução .NET ativa neste projeto.");
}
function serverReady(s, chunk) {
  if (
    s.browserOpened ||
    !s.profile.startsWith(".NET") ||
    s.browserTarget === "none"
  )
    return;
  if (!s.ready && s.browserTarget !== "integrated") return;
  s.output = (s.output + chunk).slice(-65536);
  try {
    const url = readyUrl(s.output, s.ready || {});
    if (!url) return;
    s.browserOpened = true;
    const external =
      s.browserTarget !== "integrated" &&
      !["openInSpeedCode", "openInAgentDesk"].includes(s.ready?.action);
    rpc("browser_open", { url, external }).catch(fail);
  } catch (e) {
    s.browserOpened = true;
    fail(e);
  }
}
let branches = [],
  stashes = [],
  extrasRoot = "",
  extrasLoading = false;
const stashState = createStashState();
let gitManager = null,
  stashPage = 0,
  stashFilesPage = 0,
  branchPages = [0, 0],
  stashDiffLoading = false;
function closeGitManager() {
  if (!gitManager) return;
  const focus = gitManager.focus;
  gitManager.back.remove();
  gitManager = null;
  stashState.clear();
  branches = [];
  stashes = [];
  extrasRoot = "";
  focus?.focus();
}
async function openGitManager() {
  if (gitManager || !state.git.available) return;
  stashState.setRoot(state.root);
  stashPage = stashFilesPage = 0;
  branchPages = [0, 0];
  const back = el("div", "modal-backdrop"),
    box = el("section", "modal git-manager"),
    content = el("div", "git-manager-body");
  const { header, update, dismiss } = createGitManagerHeader({
    el,
    button,
    refresh: refreshGitExtras,
    close: closeGitManager,
  });
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-modal", "true");
  box.setAttribute("aria-label", "Branches e stashes");
  content.id = "git-extras";
  box.append(header, content);
  back.append(box);
  gitManager = {
    back,
    box,
    update,
    root: state.root,
    focus: document.activeElement,
  };
  back.onclick = (e) => {
    if (e.target === back) closeGitManager();
  };
  back.onkeydown = (e) => {
    if (e.target.closest(".modal") !== box) return;
    if (e.key === "Escape") {
      e.stopPropagation();
      closeGitManager();
    }
    if (e.key === "Tab") {
      const fields = [
        ...box.querySelectorAll("button:not(:disabled),summary,input,select"),
      ].filter((node) => node.getClientRects().length);
      if (!fields.length) return;
      const i = fields.indexOf(document.activeElement);
      if (
        i < 0 ||
        (e.shiftKey && i === 0) ||
        (!e.shiftKey && i === fields.length - 1)
      ) {
        e.preventDefault();
        fields[e.shiftKey ? fields.length - 1 : 0].focus();
      }
    }
  };
  document.body.append(back);
  renderGitExtras();
  dismiss.focus();
  await refreshGitExtras();
}
async function refreshGitExtras() {
  if (extrasLoading || !gitManager || !state.root || !state.git.available)
    return;
  extrasLoading = true;
  const root = state.root;
  const owner = gitManager;
  owner.update.disabled = true;
  owner.box.setAttribute("aria-busy", "true");
  try {
    const [bs, ss] = await Promise.all([
      rpc("git_branches", { root }),
      rpc("git_stashes", { root }),
    ]);
    if (root === state.root && owner === gitManager) {
      branches = bs;
      stashes = ss;
      extrasRoot = root;
      stashState.prune(stashes);
      renderGitExtras();
    }
  } finally {
    extrasLoading = false;
    owner.update.disabled = false;
    owner.box.setAttribute("aria-busy", "false");
  }
}
function choiceDialog(title, options, withName = false) {
  return new Promise((resolve) => {
    const back = el("div", "modal-backdrop"),
      box = el("section", "modal"),
      select = el("select"),
      field = el("input"),
      check = el("input"),
      label = el("label");
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    box.append(
      el("h2", "", title),
      el(
        "p",
        "",
        withName
          ? "Selecione a base. Remotas refletem o último Fetch. A nova branch será publicada no primeiro Push. A troca preserva alterações compatíveis; o Git bloqueia sobrescritas. Salve edições do editor primeiro."
          : "O Push criará esta branch no remoto escolhido e configurará o acompanhamento, sem force push.",
      ),
    );
    select.setAttribute("aria-label", withName ? "Branch base" : "Remoto");
    for (const o of options) {
      const option = el("option", "", o.label);
      option.value = o.value;
      select.append(option);
    }
    box.append(select);
    if (withName) {
      field.placeholder = "Nome da nova branch";
      field.setAttribute("aria-label", "Nome da branch");
      check.type = "checkbox";
      check.checked = true;
      label.append(
        check,
        document.createTextNode(" Trocar para a nova branch"),
      );
      box.append(field, label);
    }
    const done = (value) => {
      back.remove();
      resolve(value);
    };
    const footer = el("footer");
    footer.append(
      button(null, "Cancelar", () => done(null), "Cancelar"),
      button(
        null,
        "Confirmar",
        () =>
          done({
            value: select.value,
            name: field.value,
            switch: check.checked,
          }),
        withName ? "Criar" : "Publicar",
      ),
    );
    box.append(footer);
    back.append(box);
    document.body.append(back);
    (withName ? field : select).focus();
    back.onkeydown = (e) => {
      if (e.key === "Escape") done(null);
    };
  });
}
async function createBranch() {
  if (state.gitBusy) return;
  const root = state.root;
  const bases = await rpc("git_branches", { root });
  if (!bases.length)
    return notify("Ainda não há branch com commit para usar como base.", true);
  const result = await choiceDialog(
    "Criar branch",
    bases.map((b) => ({
      value: b.ref,
      label: `${b.remote ? "Remota" : "Local"} · ${b.name}${b.current ? " (atual)" : ""}`,
    })),
    true,
  );
  if (!result) return;
  if (root !== state.root)
    return notify("O repositório mudou. Abra a criação novamente.", true);
  if (
    result.switch &&
    [...state.buffers.values()].some((b) => b.root === root && b.dirty)
  )
    return notify(
      "Salve as edições abertas no editor antes de trocar de branch.",
      true,
    );
  await extraGit("git_branch_create", {
    ref: result.value,
    name: result.name,
    switch: result.switch,
  });
}
async function publishBranch() {
  const root = state.root;
  const remotes = await rpc("git_remotes", { root });
  if (!remotes.length)
    return notify(
      "Cadastre um remoto Git primeiro (git remote add origin URL).",
      true,
    );
  const result = await choiceDialog(
    `Publicar ${state.git.branch || "branch atual"}`,
    remotes.map((r) => ({ value: r, label: r })),
  );
  if (!result) return;
  if (root !== state.root)
    return notify("O repositório mudou. Tente novamente.", true);
  await extraGit("git_publish", { remote: result.value });
}
function renderGitExtras() {
  if (gitManager && gitManager.root !== state.root) closeGitManager();
  const box = $("git-extras");
  if (!box) return;
  box.replaceChildren();
  const branchSection = el("details", "git-section"),
    stashSection = el("details", "git-section");
  const root = state.root;
  const manager = gitManager;
  branchSection.open = gitManager.branchesOpen !== false;
  branchSection.ontoggle = () => {
    if (gitManager === manager && branchSection.isConnected)
      manager.branchesOpen = branchSection.open;
  };
  branchSection.append(
    el("summary", "", "Branches locais e remotas"),
    el(
      "p",
      "empty",
      "Clique para trocar. Alterações compatíveis são preservadas; o Git bloqueia sobrescritas. Remotas refletem o último Fetch.",
    ),
  );
  branchSection.append(
    button(
      "plus",
      "Criar branch baseada em local ou remota",
      createBranch,
      "Criar branch…",
    ),
  );
  if (extrasRoot === state.root)
    for (const remote of [false, true]) {
      branchSection.append(
        el("div", "group-title", remote ? "Remotas · último Fetch" : "Locais"),
      );
      const items = branches.filter((b) => b.remote === remote),
        section = Number(remote);
      branchPages[section] = Math.min(
        branchPages[section],
        Math.max(0, Math.ceil(items.length / 100) - 1),
      );
      appendGitPager(
        branchSection,
        items.length,
        100,
        branchPages[section],
        (page) => {
          branchPages[section] = page;
          renderGitExtras();
        },
      );
      for (const b of items.slice(
        branchPages[section] * 100,
        (branchPages[section] + 1) * 100,
      )) {
        const row = el("div", "branch-row");
        const pick = button(
          "git",
          b.ref,
          async () => {
            if (b.current || root !== state.root) return;
            if (
              [...state.buffers.values()].some(
                (x) => x.root === state.root && x.dirty,
              )
            )
              return notify(
                "Salve as edições abertas no editor antes de trocar de branch.",
                true,
              );
            await extraGit("git_switch", { ref: b.ref });
          },
          `${b.current ? "● " : ""}${b.name}`,
        );
        pick.disabled = b.current;
        row.append(pick);
        if (!remote && !b.current)
          row.append(
            button("trash", "Excluir apenas branch local", async () => {
              if (
                await modal(
                  "Excluir branch local?",
                  `${b.name}\nNão apaga a branch remota. O Git recusará branches não mescladas.`,
                  { confirm: "Excluir local" },
                )
              )
                if (root === state.root)
                  await extraGit("git_branch_delete", { ref: b.ref });
            }),
          );
        branchSection.append(row);
      }
    }
  stashSection.append(
    el(
      "summary",
      "",
      `Stash · ${extrasRoot === state.root ? stashes.length : 0}`,
    ),
    button(
      "plus",
      "Criar stash incluindo arquivos novos",
      async () => {
        if (
          [...state.buffers.values()].some(
            (x) => x.root === state.root && x.dirty,
          )
        )
          return notify("Salve os buffers antes de criar stash.", true);
        const message = await modal(
          "Criar stash",
          "Guarda até 200 arquivos alterados visíveis, incluindo preparados e novos. node_modules e ignorados permanecem no disco. Salve os buffers primeiro.",
          {
            input: "Descrição",
            initial: "SpeedCode stash",
            confirm: "Guardar",
          },
        );
        if (message !== null && root === state.root)
          await extraGit("git_stash_create", { message });
      },
      "Criar stash",
    ),
  );
  stashSection.open = gitManager.stashesOpen !== false;
  stashSection.ontoggle = () => {
    if (gitManager !== manager || !stashSection.isConnected) return;
    manager.stashesOpen = stashSection.open;
    if (!stashSection.open) stashState.clear();
  };
  if (extrasRoot === state.root) {
    stashPage = Math.min(
      stashPage,
      Math.max(0, Math.ceil(stashes.length / STASH_PAGE) - 1),
    );
    appendGitPager(
      stashSection,
      stashes.length,
      STASH_PAGE,
      stashPage,
      (page) => {
        stashPage = page;
        stashState.clear();
        renderGitExtras();
      },
    );
    if (!stashes.length)
      stashSection.append(
        el("p", "empty", "Nenhum stash criado neste repositório."),
      );
    for (const s of stashes.slice(
      stashPage * STASH_PAGE,
      (stashPage + 1) * STASH_PAGE,
    )) {
      const card = el("div", "stash-card");
      const header = el("div", "stash-header"),
        expanded = stashState.view.oid === s.oid;
      const toggle = button(
        null,
        `Ver arquivos de ${s.message}`,
        async () => {
          if (root !== state.root || state.gitBusy) return;
          stashFilesPage = 0;
          const task = stashState.toggle(s.oid, (params) =>
            rpc("git_stash_files", params),
          );
          renderGitExtras();
          await task;
          renderGitExtras();
        },
        `${expanded ? "▾" : "▸"} ${s.selector} · ${s.message}`,
      );
      toggle.classList.add("stash-name");
      toggle.setAttribute("aria-expanded", String(expanded));
      header.append(
        toggle,
        button(
          "check",
          "Aplicar sem remover stash",
          async () => {
            if (
              await modal(
                "Aplicar stash?",
                `${s.message}\nO stash será mantido. Podem ocorrer conflitos. Salve buffers antes de aplicar.`,
                { confirm: "Aplicar" },
              )
            )
              if (root === state.root)
                await extraGit("git_stash_apply", { oid: s.oid });
          },
          "Aplicar",
        ),
        button(
          "trash",
          "Remover stash",
          async () => {
            if (
              await modal("Remover stash permanentemente?", s.message, {
                confirm: "Remover",
              })
            )
              if (root === state.root)
                await extraGit("git_stash_drop", { oid: s.oid });
          },
          "Remover",
        ),
      );
      for (const action of header.querySelectorAll("button"))
        action.disabled = state.gitBusy;
      card.append(header);
      if (expanded) {
        const view = stashState.view;
        if (view.loading)
          card.append(el("p", "empty", "Lendo nomes dos arquivos…"));
        else if (view.error) card.append(el("p", "empty", view.error));
        else {
          appendGitPager(
            card,
            view.paths.length,
            STASH_FILES_PAGE,
            stashFilesPage,
            (page) => {
              stashFilesPage = page;
              renderGitExtras();
            },
          );
          if (!view.paths.length)
            card.append(el("p", "empty", "Sem arquivos alterados."));
          for (const path of view.paths.slice(
            stashFilesPage * STASH_FILES_PAGE,
            (stashFilesPage + 1) * STASH_FILES_PAGE,
          )) {
            const file = button(
              "file",
              path,
              async () => {
                if (stashDiffLoading) return;
                const owner = gitManager;
                stashDiffLoading = true;
                file.disabled = true;
                try {
                  const d = await rpc("git_stash_diff", {
                    root,
                    oid: s.oid,
                    path,
                  });
                  if (
                    root !== state.root ||
                    gitManager !== owner ||
                    stashState.view.oid !== s.oid
                  )
                    return;
                  closeGitManager();
                  showDiff(
                    path,
                    d.original,
                    d.modified,
                    `${s.selector} · ${s.message}`,
                  );
                } finally {
                  stashDiffLoading = false;
                  file.disabled = false;
                }
              },
              path,
            );
            file.classList.add("stash-file");
            card.append(file);
          }
        }
      }
      stashSection.append(card);
    }
  } else box.append(el("p", "empty", "Carregando branches e stashes…"));
  box.append(branchSection, stashSection);
}
function appendGitPager(box, total, size, page, change) {
  if (total <= size) return;
  const pages = Math.ceil(total / size),
    row = el("div", "stash-pager");
  const prev = button(null, "Página anterior", () => change(page - 1), "←"),
    next = button(null, "Próxima página", () => change(page + 1), "→");
  prev.disabled = page <= 0;
  next.disabled = page >= pages - 1;
  row.append(prev, el("span", "", `${page + 1} / ${pages} · ${total}`), next);
  box.append(row);
}
async function extraGit(method, params = {}) {
  if (state.gitBusy) return;
  const root = state.root;
  if (
    ["git_switch", "git_stash_apply", "git_merge_abort"].includes(method) &&
    [...state.buffers.values()].some((b) => b.root === root && b.dirty)
  )
    return notify("Salve os buffers antes desta operação.", true);
  state.gitBusy = true;
  if (method.startsWith("git_stash_")) stashState.clear();
  renderGit();
  try {
    const r = await rpc(method, { root, ...params });
    gitLog = r.output || "Operação concluída.";
    notify(gitLog);
  } catch (e) {
    gitLog = e.message;
    fail(e);
  } finally {
    state.gitBusy = false;
    gitSignature = "";
    await reconcile();
    await refreshGitExtras();
    renderGit();
  }
}
async function showMergeDiff(entry) {
  const data = await rpc("git_conflict", {
    root: state.root,
    path: entry.path,
  });
  showDiff(
    entry.path,
    data.ours,
    data.theirs,
    "Atual (ours) → Recebido (theirs) · edite o arquivo para resolver",
  );
}
async function openMerge(entry) {
  try {
    await openFile(entry.path);
  } catch (e) {
    if (
      await modal(
        "Conflito com arquivo ausente ou binário",
        `${e.message}\nCompare no terminal ou resolva a exclusão. Aceitar exclusão só funciona se o arquivo já estiver ausente.`,
        { confirm: "Marcar exclusão resolvida" },
      )
    )
      await extraGit("git_resolve", { path: entry.path, acceptDeletion: true });
    return;
  }
  const b = state.buffers.get(state.current);
  if (b.kind === "image")
    return notify(
      "Conflito binário: escolha a versão pelo terminal Git e depois marque resolvido.",
      true,
    );
  updateConflict();
}
async function resolveConflict(entry) {
  const key = `${state.root}|${entry.path}`,
    b = state.buffers.get(key);
  if (b?.dirty) {
    await openFile(entry.path);
    await saveCurrent();
  }
  await extraGit("git_resolve", { path: entry.path });
}
window.requestClose = async () => {
  const dirty = [...state.buffers.values()].filter((b) => b.dirty),
    active = state.sessions.filter((s) => s.exit === null);
  if (
    (dirty.length || active.length || copilotChat?.hasActive()) &&
    !(await modal(
      "Fechar SpeedCode",
      `${dirty.length} arquivo(s) não salvo(s) e ${active.length} terminal(is) ativo(s).${copilotChat?.hasActive() ? "\nO contexto do Copilot Chat também será apagado." : ""}\nFechar descarta esses buffers e encerra os processos.`,
      { confirm: "Fechar e encerrar" },
    ))
  )
    return;
  for (const s of state.sessions) s.closed = true;
  await rpc("exit");
};
window.addEventListener("keydown", (e) => {
  if (e.key === "F5") {
    e.preventDefault();
    (e.shiftKey ? stopLaunch() : startLaunch()).catch(fail);
  }
  if (e.ctrlKey && e.key.toLowerCase() === "s") {
    e.preventDefault();
    saveCurrent().catch(fail);
  }
  if (e.ctrlKey && e.key.toLowerCase() === "p") {
    e.preventDefault();
    quickOpen().catch(fail);
  }
  if (e.ctrlKey && e.key === "`") {
    e.preventDefault();
    const s = state.sessions.find((x) => x.id === state.selectedSession);
    if (s) s.term.focus();
    else newTerminal("powershell").catch(fail);
  }
});
new ResizeObserver(fitTerminals).observe($("term-views"));
const refreshPolicy = refreshLoop({
  run: reconcile,
  hidden: () => document.hidden,
  active: () => state.sessions.some((s) => !s.closed && s.exit === null),
});
for (const event of ["keydown", "pointerdown"])
  window.addEventListener(event, () => refreshPolicy.touch(), {
    passive: true,
  });
window.addEventListener("focus", () => refreshPolicy.refresh());
document.addEventListener("visibilitychange", () => {
  refreshPolicy.visibility();
  if (!document.hidden && state.view === "git" && gitFolders.needsExpansion)
    loadExpandedGitFolders().catch(fail);
});
window.addEventListener("pagehide", () => refreshPolicy.stop());
(async () => {
  state.repos = await rpc("repos");
  renderRepos();
  const last = localStorage.getItem("lastRepo");
  if (state.repos.length)
    await selectRepo(
      state.repos.find((r) => r.path === last)?.path || state.repos[0].path,
    );
  state.diagnostics = await rpc("diagnostics");
})().catch(fail);
