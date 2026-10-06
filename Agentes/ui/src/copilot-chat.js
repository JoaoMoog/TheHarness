import { dockChat, dismissChatMenus } from "./chat-layout.js";
import { emptyUsage, usageDelta, usageLabel } from "./chat-usage.js";
import { renderAssistant, nearBottom, pruneMessages } from "./chat-render.js";
import { quotaRows } from "./chat-quota.js";
import { editorSnapshot, diagnosticsText } from "./chat-productivity.js";
// Native IPC only. Tokens and transcripts are never stored in browser storage.
export function assistantText(previous, event) {
  const text =
    event.type === "assistant.message_delta"
      ? previous + (event.data?.deltaContent || "")
      : event.data?.content || previous;
  return text.length > 128 * 1024
    ? text.slice(0, 128 * 1024) +
        "\n[Visualização parcial: limite de texto; contexto do agente preservado.]"
    : text;
}
export function reasoningEfforts(model) {
  return model?.supportedReasoningEfforts || [];
}
export function isTerminalChatError(event) {
  return (
    event.type === "bridge.error" ||
    (event.type === "session.error" &&
      event.data?.recoverable !== true &&
      event.data?.retriable !== true)
  );
}
export function sameWorkspace(a, b) {
  const key = (path) =>
    (path || "").replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
  return key(a) === key(b);
}
export function installCopilotChat({
  rpc,
  root,
  currentFile,
  editorSelection,
  changed,
  notify,
  dialog,
  showWorkspace,
}) {
  const pane = document.createElement("aside");
  pane.className = "copilot-chat hidden";
  pane.setAttribute("aria-label", "Copilot Chat");
  pane.innerHTML = `<header><strong>Copilot Chat</strong><div class="chat-toolbar">
    <details data-quota-menu class="chat-menu chat-quota-menu"><summary title="Copilot: créditos da conta e reset" aria-label="Créditos Copilot"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M5 14v5l7 3 7-3v-5M8 3h8l3 4v5H5V7zM3 9H1v6h3m17-6h2v6h-3"/><rect x="5" y="7" width="6" height="6" rx="2"/><rect x="13" y="7" width="6" height="6" rx="2"/></svg></summary><div class="chat-popover chat-quota-options"><div class="chat-quota-heading"><strong>GitHub Copilot</strong><button data-quota-refresh title="Atualizar créditos" aria-label="Atualizar créditos">↻</button><button data-quota-account title="Gerenciar assinatura no GitHub">Gerenciar</button></div><div data-quota-content role="status">Abra para consultar.</div><details class="chat-quota-details"><summary>Detalhes de uso</summary><div data-quota-details-content></div><p class="chat-help">Cota da conta inclui outros clientes. AIU da sessão não é fatura. Plano e cobrança conforme o GitHub.</p></details></div></details>
    <button data-clear class="chat-clear" title="Limpar conversa, referências e contexto; manter edições no projeto">Limpar sessão</button>
    <button data-settings-toggle title="Contexto Rust e servidores MCP opcionais" aria-label="Ferramentas e MCP">⚙</button>
    <details data-account-menu class="chat-menu"><summary title="Opções da conta" aria-label="Opções da conta">⋯</summary><div class="chat-popover chat-account-options">
      <strong>Conta GitHub</strong><button data-login>Trocar conta / login GitHub</button><button data-refresh>Revalidar conexão</button><button data-logout>Sair da conta no CLI</button>
      <p class="chat-help">Login compartilhado com o Copilot CLI. Renovação de credenciais pelo CLI. Conversa em RAM; processamento remoto sujeito à política da organização.</p>
    </div></details><button data-close title="Fechar painel" aria-label="Fechar painel Copilot Chat">×</button></div></header>
    <div class="chat-auth"><span data-status role="status">Desconectado</span><button data-connect>Conectar</button></div>
    <div data-error class="chat-error hidden" role="alert"><span data-error-text></span><button data-dismiss-error aria-label="Dispensar erro">×</button></div>
    <div data-device class="chat-device hidden"></div>
    <p data-workspace class="chat-help chat-workspace"></p>
    <div data-workspace-notice class="chat-workspace-notice hidden" role="status"><span data-workspace-notice-text></span><button data-return-workspace>Voltar ao projeto do chat</button></div>
    <div class="chat-session-strip"><span data-session-label>Sessão nova · RAM</span><button data-compact title="Resumir contexto preservando requisitos e pendências; pode consumir créditos">Compactar</button></div>
    <div data-total class="chat-session-total hidden" role="status"></div>
    <div data-context-state class="chat-help"></div>
    <section data-settings class="chat-settings hidden" aria-label="Ferramentas e MCP opcionais">
      <header><strong>Contexto e ferramentas</strong><button data-settings-close aria-label="Fechar configurações do chat">×</button></header>
      <label><input type="checkbox" data-worktree checked> Alterar arquivos sempre em worktree</label>
      <details data-worktree-options class="chat-productivity"><summary>Base diferente · opcional</summary><div class="chat-search-row"><input data-worktree-base value="HEAD" maxlength="256" aria-label="Base Git da tarefa (opcional)" placeholder="HEAD ou origin/production"></div></details>
      <p class="chat-help">Não precisa pedir worktree nem informar branch: usa o último commit da branch atual de cada repo, sem trocar o original. Preparo uma vez no primeiro envio, busca ou conexão MCP, para manter o contexto consistente. Anexe todos os repos antes; não copia dependências ou arquivos não commitados.</p><div data-worktree-info></div>
      <label><input type="checkbox" data-local-context checked> Busca local Rust (nova sessão)</label>
      <label><input type="checkbox" data-rust-proxy checked> Proxy Rust: remover duplicações exatas (nova sessão)</label><p class="chat-help">Só resultados já autorizados de busca/leitura. Preserva código, instruções e evidências únicas; não garante economia de créditos.</p>
      <p class="chat-help">Busca sob demanda: arquivos relevantes e hashes; ferramentas nativas continuam disponíveis. Não garante economia de tokens.</p>
      <div class="chat-search-row"><input data-search-query placeholder="Rota, símbolo ou arquivo…" aria-label="Buscar contexto local"><button data-search>Buscar</button><button data-context-package title="Funções, instruções e arquivos candidatos">Contexto</button></div><div data-search-results></div>
      <details class="chat-productivity"><summary>Notas fixadas · só nesta sessão</summary><textarea data-notes aria-label="Notas de trabalho" maxlength="8192" placeholder="Requisitos, decisões e pendências que quero preservar…"></textarea><button data-notes-save>Fixar / atualizar notas</button><small data-notes-status>Não gravadas em disco.</small></details>
      <details class="chat-productivity"><summary>Diagnóstico e validação</summary><button data-diagnostics>Consultar runtime</button><pre data-diagnostics-content>Sem inferência. Não mede economia contra VS Code.</pre><strong>Meu checklist da tarefa</strong><label><input type="checkbox" data-check-diff> Revisei o diff</label><label><input type="checkbox" data-check-tests> Conferi os testes executados</label><label><input type="checkbox" data-check-limits> Conferi limitações e pendências</label></details>
      <strong>MCP opcional</strong><p class="chat-help">Plugue ferramentas do seu agente; o modelo continua Copilot. Configuração só nesta sessão. Use apenas servidores confiáveis.</p>
      <input data-mcp-name placeholder="Nome (só para configuração individual)" aria-label="Nome do servidor MCP" value="meu-agente">
      <textarea data-mcp-config aria-label="Configuração JSON dos servidores MCP" spellcheck="false" placeholder='{"mcpServers":{"meu-agente":{"command":"agent.exe","args":[],"tools":["*"]}}}'></textarea>
      <p class="chat-help">JSON mcpServers/servers ou configuração individual. Até 8 MCPs. tools omitido libera todas as ferramentas. env/headers: \${env:NOME}, nunca tokens literais. Remoto requer HTTPS. Configuração em RAM; limpeza da sessão remove os MCPs.</p>
      <div class="chat-settings-actions"><button data-mcp-connect>Adicionar MCPs do JSON</button><button data-mcp-refresh>Atualizar lista</button></div><div data-mcp-servers></div>
    </section>
    <p data-context-audit class="chat-help hidden"></p><p data-proxy-audit class="chat-help hidden"></p><p data-pruned class="chat-help hidden"></p>
    <div data-empty class="chat-empty"><span class="chat-empty-icon">✦</span><strong>Vamos trabalhar no seu código?</strong><p>Peça uma alteração, investigue um erro ou anexe contexto ao projeto.</p><small>Seu agente Copilot, sem sair do workspace.</small></div>
    <div data-messages class="chat-messages" role="log" aria-live="polite"></div>
    <button data-jump class="chat-jump hidden">Novas mensagens ↓</button>
    <div data-requests class="chat-requests"></div>
    <div class="chat-composer"><div data-attachments class="chat-attachments"></div>
    <textarea data-prompt aria-label="Mensagem para o Copilot" placeholder="Descreva a tarefa… Arraste arquivos ou pastas aqui." spellcheck="false"></textarea>
    <div class="chat-composer-controls">
      <details data-attach-menu class="chat-menu"><summary title="Adicionar contexto" aria-label="Adicionar contexto">＋</summary><div class="chat-popover chat-attach-options"><button data-attach>Anexar arquivo / imagem</button><button data-folder>Referenciar pasta</button><button data-current>Arquivo aberto</button><button data-selection>Seleção do editor</button><button data-buffer>Snapshot do buffer</button></div></details>
      <select data-mode aria-label="Modo do agente" title="Modo do agente"><option value="agent">Agente</option><option value="autopilot">Autopilot</option></select>
      <details data-model-menu class="chat-menu chat-model-menu"><summary data-model-label title="Escolher modelo" aria-label="Escolher modelo">Modelo ▾</summary><div class="chat-popover chat-model-options"><strong>Escolher modelo</strong><input data-model-search aria-label="Buscar modelo" placeholder="Buscar modelos…"><select data-model aria-label="Modelo Copilot" size="5"></select><p data-model-note class="chat-help"></p></div></details>
      <select data-effort aria-label="Esforço de raciocínio" title="Esforço de raciocínio"></select>
      <button data-send class="primary chat-send" title="Enviar (Enter); Shift+Enter quebra linha" aria-label="Enviar mensagem">↑</button><button data-abort class="chat-stop hidden" title="Pausar: cancela a rodada e preserva o contexto" aria-label="Pausar agente">■</button>
    </div></div><div class="chat-footer"><span data-activity>Contexto só nesta sessão</span><span title="Ctrl+Enter também envia. Comandos: /compact, /buscar termo, /clear">Enter envia · Shift+Enter nova linha</span></div>`;
  const showPanel = dockChat(pane, document.querySelector(".shell"));
  const closeMenus = dismissChatMenus(pane);
  const confirmAction = async (message, confirm = "Continuar") => {
    closeMenus();
    return (
      (await dialog("SpeedCode · Copilot Chat", message, { confirm })) === true
    );
  };
  const q = (n) => pane.querySelector(`[data-${n}]`);
  const make = (tag, text, cls = "") => {
    const e = document.createElement(tag);
    e.textContent = text;
    e.className = cls;
    return e;
  };
  const action = (text, fn) => {
    const e = make("button", text);
    e.onclick = () => Promise.resolve(fn()).catch(error);
    return e;
  };
  let visible = false,
    connected = false,
    busy = false,
    operating = false,
    active = false;
  let models = [],
    attachments = [],
    workspace = "",
    timer = null,
    polling = false,
    login = false,
    account = "",
    paused = false,
    textSize = 0;
  let turn = null;
  let epoch = 0;
  let latestUsage = null,
    sessionId = "",
    contextUsage = null,
    compacting = false,
    follow = true,
    pruned = 0;
  let selectedModel = "",
    selectedEffort = "";
  const chatRoot = () => workspace || root();
  let worktree = null;
  function renderWorktree() {
    q("worktree-info").replaceChildren();
    if (!worktree) return;
    for (const repo of worktree.repos || []) {
      const row = make("div", "", "chat-worktree-repo");
      row.append(
        make("strong", repo.source.split(/[\\/]/).pop()),
        make(
          "small",
          `Base: ${repo.base === "HEAD" ? repo.sourceBranch || "branch atual" : repo.base} · tarefa isolada`,
        ),
      );
      row.title = `${repo.path}\nBranch interna: ${repo.branch}\nCommit inicial: ${repo.commit}`;
      if (showWorkspace)
        row.append(
          action("Abrir worktree", () => run(() => showWorkspace(repo.path))),
        );
      q("worktree-info").append(row);
    }
    q("worktree-info").append(
      make(
        "p",
        "Arquivos preservados ao limpar/fechar. Comandos e MCP não são sandbox do sistema; revise permissões. Autopilot mantém aprovações humanas neste modo.",
        "chat-help",
      ),
    );
  }
  async function ensureWorktree() {
    if (!q("worktree").checked || worktree || active) return;
    if (!chatRoot())
      throw new Error("Abra um projeto Git antes de preparar a tarefa.");
    const task = await rpc("chat_worktree_prepare", {
      root: chatRoot(),
      base: q("worktree-base").value.trim() || "HEAD",
      attachments: attachments.map((a) => a.id),
    });
    if (!task?.root || task.status !== "ready")
      throw new Error(
        "Worktree não confirmada; nada enviado ao projeto original.",
      );
    worktree = task;
    workspace = task.root;
    renderWorktree();
    update();
  }
  let quotaLoading = false,
    quotaEpoch = 0,
    savedCharacters = 0;
  const dirtyResponses = new Set();
  const responses = new Map(),
    tools = new Map(),
    requests = new Map();
  const error = (e) => {
    q("error-text").textContent = e.message || String(e);
    q("error").classList.remove("hidden");
    // Local alert stays above the chat history, never behind the side panel.
  };
  const dismissError = () => q("error").classList.add("hidden");
  const run = async (fn) => {
    if (operating) return;
    operating = true;
    update();
    try {
      await fn();
    } catch (e) {
      error(e);
    } finally {
      operating = false;
      update();
    }
  };
  function update() {
    q("send").disabled =
      !connected || busy || operating || login || !q("model").value;
    q("abort").disabled = !busy;
    q("send").classList.toggle("hidden", busy);
    q("abort").classList.toggle("hidden", !busy);
    q("connect").textContent = login
      ? "Cancelar"
      : connected
        ? "Desconectar"
        : "Conectar";
    q("connect").disabled = operating;
    q("clear").disabled = operating;
    q("compact").disabled = !active || busy || operating;
    q("mcp-connect").disabled =
      !connected || busy || operating || !q("model").value;
    q("mcp-refresh").disabled = busy || operating;
    q("notes-save").disabled = busy || operating;
    q("diagnostics").disabled = busy || operating;
    q("mcp-connect").textContent = operating
      ? "Processando…"
      : "Adicionar MCPs do JSON";
    for (const button of q("mcp-servers").querySelectorAll("button"))
      button.disabled = busy || operating;
    q("local-context").disabled = active || busy || operating;
    q("rust-proxy").disabled = active || busy || operating;
    q("worktree").disabled = !!worktree || active || busy || operating;
    q("worktree-base").disabled =
      !q("worktree").checked || !!worktree || active || busy || operating;
    q("session-label").textContent = sessionId
      ? `Sessão ${sessionId.slice(0, 8)} · RAM`
      : "Sessão nova · RAM";
    q("session-label").title =
      sessionId ||
      "Criada ao enviar ou conectar MCP; mantida ao fechar painel/pausar.";
    q("context-state").textContent = compacting
      ? "Compactando contexto…"
      : contextUsage?.tokenLimit > 0
        ? `Janela de contexto: ${Math.round((contextUsage.currentTokens / contextUsage.tokenLimit) * 100)}% · ${contextUsage.currentTokens.toLocaleString("pt-BR")} / ${contextUsage.tokenLimit.toLocaleString("pt-BR")} tokens`
        : active
          ? "Contexto mantido · compactação automática ativa"
          : "";
    q("status").textContent = login
      ? "Aguardando autorização…"
      : connected
        ? `● Conectado${account ? " · " + account : ""}`
        : "○ Desconectado";
    q("status").classList.toggle("connected", connected && !login);
    q("activity").textContent = busy
      ? "Copilot trabalhando…"
      : paused
        ? "Pausado · envie uma mensagem para continuar"
        : "Contexto só nesta sessão";
    q("mode").disabled = busy || operating;
    q("model").disabled = busy || operating;
    q("effort").disabled =
      busy ||
      operating ||
      !reasoningEfforts(models.find((m) => m.id === q("model").value)).length;
    const path = workspace || root() || "";
    q("workspace").textContent = path
      ? worktree
        ? `⌁ Tarefa isolada · ${worktree.repos.length} projeto(s)`
        : `⌁ Projeto do chat: ${path.split(/[\\/]/).pop()}`
      : "Abra um projeto para começar";
    q("workspace").title = path;
    const mismatch =
      !!workspace &&
      !sameWorkspace(workspace, root()) &&
      !worktree?.repos?.some((r) => sameWorkspace(r.path, root()));
    q("workspace-notice").classList.toggle("hidden", !mismatch);
    q("workspace-notice-text").textContent = mismatch
      ? `Esta conversa continua em ${workspace.split(/[\\/]/).pop()}. O explorador está em ${root()?.split(/[\\/]/).pop() || "nenhum projeto"}. Mensagens e buscas usam o projeto do chat; contexto mantido.`
      : "";
    q("return-workspace").classList.toggle("hidden", !showWorkspace);
    q("return-workspace").disabled = operating;
    q("model-label").textContent =
      `${models.find((m) => m.id === q("model").value)?.name || q("model").value || "Modelo"} ▾`;
    q("empty").classList.toggle("hidden", q("messages").children.length > 0);
    q("messages").classList.toggle(
      "hidden",
      q("messages").children.length === 0,
    );
  }
  function efforts() {
    const m = models.find((m) => m.id === q("model").value);
    q("effort").replaceChildren(new Option("Padrão", ""));
    for (const e of reasoningEfforts(m)) q("effort").append(new Option(e, e));
    q("model-note").textContent = [
      m?.warningText?.text,
      ...(m?.warningMessages || []).map((x) => x.message || x.text),
      ...(m?.infoMessages || []).map((x) => x.message || x.text),
    ]
      .filter(Boolean)
      .join(" · ");
    update();
  }
  async function connect(refresh = false) {
    if (refresh) await clear(false);
    const s = await rpc(refresh ? "chat_refresh" : "chat_status");
    connected = s.authenticated === true;
    account = s.login || "";
    quotaEpoch++;
    q("quota-content").textContent = "Abra para consultar o Copilot.";
    if (connected) {
      models = await rpc("chat_models");
      q("model").replaceChildren();
      for (const m of models) {
        const o = new Option(m.name || m.id, m.id);
        o.disabled = m.policy?.state === "disabled";
        q("model").append(o);
      }
      // A native multi-row listbox (size > 1) starts with no selection in
      // WebView2, unlike a dropdown. Explicitly select an allowed model.
      q("model").value =
        models.find((m) => m.policy?.state !== "disabled")?.id || "";
      selectedModel = q("model").value;
      selectedEffort = "";
      q("model").size = Math.max(2, Math.min(7, models.length));
      if (!models.length)
        error(
          "Conta conectada, mas sem modelos disponíveis. Verifique licença/política.",
        );
      efforts();
    } else {
      models = [];
      q("model").replaceChildren();
      efforts();
    }
    update();
    schedule();
  }
  let lastPollSession = null;
  function schedule(delay = 350) {
    clearTimeout(timer);
    if (document.hidden && !busy && !login) return;
    if ((visible && active) || busy || login)
      timer = setTimeout(poll, document.hidden ? Math.max(delay, 1000) : delay);
  }
  document.addEventListener("visibilitychange", () => schedule(50));
  async function poll() {
    if (polling) return;
    polling = true;
    const generation = epoch;
    try {
      const result = await rpc("chat_poll");
      if (generation !== epoch) return;
      const stateChanged =
        login !== result.login ||
        busy !== result.busy ||
        JSON.stringify(result.session) !== JSON.stringify(lastPollSession);
      lastPollSession = result.session;
      login = result.login;
      acceptSession(result.session);
      for (const event of result.events) {
        if (generation !== epoch) return;
        await eventReceived(event);
      }
      if (busy && !result.busy && !result.more) await finishUsage();
      if (generation !== epoch) return;
      busy = result.busy || result.more === true;
      if (result.events.length || stateChanged || dirtyResponses.size) {
        flushResponses();
        pruneView();
        scrollMessages();
        update();
      }
    } catch (e) {
      if (generation === epoch) error(e);
    } finally {
      polling = false;
      schedule(busy || login ? 200 : 4000);
    }
  }
  function appendMessage(role, text) {
    const box = make("article", "", `chat-message ${role}`);
    let target = box;
    if (role === "tool") {
      target = make("details", "");
      target.append(
        make("summary", text.split("\n")[0].slice(0, 100) || "Ferramenta"),
      );
      box.append(target);
    }
    target.append(
      make(
        "strong",
        role === "user"
          ? "Você"
          : role === "assistant"
            ? "Copilot"
            : "Ferramenta",
      ),
    );
    const body = make(
      role === "assistant" ? "div" : "pre",
      text,
      role === "assistant" ? "chat-text streaming" : "",
    );
    target.append(body);
    if (role === "tool" && turn) {
      if (!turn.activities) {
        const article = make("article", "", "chat-activity");
        const details = make("details", "");
        const summary = make("summary", "Atividade do agente");
        details.append(summary);
        article.append(details);
        q("messages").append(article);
        turn.activities = article;
        turn.activityDetails = details;
        turn.activitySummary = summary;
        turn.activityCount = 0;
      }
      turn.activityDetails.append(box);
      turn.activitySummary.textContent = `Atividade do agente · ${++turn.activityCount} eventos`;
      if (turn.activityDetails.querySelectorAll("article").length > 128) {
        turn.activityDetails.querySelector("article").remove();
        turn.activitySummary.textContent +=
          " · prévia dos 128 mais recentes; contexto mantido";
      }
    } else q("messages").append(box);
    update();
    textSize += text.length;
    scrollMessages();
    return body;
  }
  function acceptSession(info) {
    if (!info?.id) return;
    sessionId = info.id;
    active = true;
    workspace = info.root;
    if (info.worktree) {
      worktree = info.worktree;
      q("worktree").checked = true;
      renderWorktree();
    }
    q("local-context").checked = info.localContext !== false;
    q("rust-proxy").checked = info.rustProxy !== false;
  }
  function scrollMessages() {
    if (follow) q("messages").scrollTop = q("messages").scrollHeight;
    else q("jump").classList.remove("hidden");
  }
  function flushResponses() {
    for (const record of dirtyResponses) {
      if (record.finished) {
        record.body.classList.remove("streaming");
        renderAssistant(
          record.body,
          record.text,
          (url) => rpc("browser_open", { url, external: true }),
          (text) => window.navigator.clipboard.writeText(text),
          error,
        );
        if (!record.copy) {
          record.copy = action("Copiar resposta", () =>
            window.navigator.clipboard.writeText(record.text),
          );
          record.copy.className = "chat-copy-response";
          record.body.parentElement.append(record.copy);
        }
      } else record.body.textContent = record.text;
    }
    dirtyResponses.clear();
  }
  function pruneView() {
    const protect = new Set();
    const latest = [...responses.values()].at(-1);
    if (latest && !latest.finished) protect.add(latest.body.closest("article"));
    if (turn?.footer) protect.add(turn.footer);
    if (busy && turn?.activities) protect.add(turn.activities);
    pruned += pruneMessages(q("messages"), protect);
    for (const [id, record] of responses)
      if (!record.body.isConnected) {
        responses.delete(id);
        dirtyResponses.delete(record);
      }
    for (const [id, body] of tools) if (!body.isConnected) tools.delete(id);
    textSize = q("messages").textContent.length;
    if (pruned) {
      q("pruned").classList.remove("hidden");
      q("pruned").textContent =
        `Visualização reduzida (${pruned} itens antigos) para poupar RAM. Contexto do agente mantido; limpeza só por sua ação.`;
    }
  }
  function showTotal(end) {
    q("total").classList.remove("hidden");
    if (
      end?.available !== false &&
      ["inputTokens", "totalNanoAiu", "outputTokens"].some(
        (k) => typeof end?.[k] === "number",
      )
    ) {
      latestUsage = end;
      q("total").textContent = `Total da sessão · ${usageLabel(end)}`;
    } else
      q("total").textContent = latestUsage
        ? `Última medição da sessão · ${usageLabel(latestUsage)} · atualização indisponível`
        : "Total da sessão · consumo não informado pelo Copilot";
    q("total").title =
      "Total cumulativo do runtime: rodadas + subagentes + compactação. Não somamos eventos duplicados. AIU do CLI não é fatura/saldo Enterprise.";
  }
  async function readUsage() {
    try {
      return await rpc("chat_usage");
    } catch {
      return null;
    }
  }
  async function finishUsage(final = true) {
    const current = turn,
      generation = epoch;
    if (!current || current.finalized) return;
    const end = await readUsage();
    if (generation !== epoch || current !== turn) return;
    if (!current.footer) {
      current.footer = make("p", "", "chat-usage");
      current.footer.title =
        "Métricas do runtime para esta rodada, incluindo ferramentas/subagentes. AIU = nano-AIU ÷ 10⁹. Não é fatura nem saldo: créditos cobrados seguem o plano/políticas do GitHub. Ausência de métricas não significa uso gratuito.";
      q("messages").append(current.footer);
    }
    current.footer.textContent = `Esta rodada · ${usageLabel(usageDelta(current.start, end))}`;
    showTotal(end);
    current.finalized = final;
    q("messages").append(current.footer);
  }
  function completion(text) {
    if (!text?.trim()) return;
    if ([...responses.values()].some((r) => r.text.includes(text))) return;
    const record = {
      body: appendMessage("assistant", ""),
      text,
      finished: true,
    };
    record.body.parentElement.classList.add("chat-conclusion");
    responses.set("task-conclusion", record);
    dirtyResponses.add(record);
  }
  async function eventReceived(event) {
    const d = event.data || {},
      type = event.type;
    if (d.queueOverflow) {
      appendMessage(
        "tool",
        "Parte da visualização antiga foi omitida por limite de memória. O contexto do agente não foi limpo.",
      );
    }
    if (type === "auth.code") {
      q("device").classList.remove("hidden");
      q("device").replaceChildren(
        make("p", "Copie o código e autorize no GitHub:"),
        make("code", event.code),
        action("Abrir autorização GitHub", () =>
          rpc("browser_open", { url: event.url, external: true }),
        ),
      );
    } else if (type === "auth.complete") {
      q("device").classList.add("hidden");
      login = false;
      if (event.success) await connect(true);
      else
        error(
          "Login cancelado, expirado ou recusado. Tente novamente; veja o Copilot CLI se o host requer outra autenticação.",
        );
    } else if (type === "request") {
      const card = make("section", "", "chat-request");
      requests.set(event.id, card);
      const permission = d.kind === "permission";
      card.append(
        make("strong", permission ? "Aprovação de ação" : "Pergunta do agente"),
      );
      card.append(
        make(
          "pre",
          permission
            ? JSON.stringify(d.request, null, 2).slice(0, 16000)
            : d.question,
        ),
      );
      const answer = async (params) => {
        await rpc("chat_answer", { id: event.id, ...params });
        card.remove();
        requests.delete(event.id);
      };
      if (permission)
        card.append(
          action("Permitir uma vez", () => answer({ approve: true })),
          action("Recusar", () => answer({ approve: false })),
        );
      else {
        for (const c of d.choices || [])
          card.append(action(c, () => answer({ answer: c })));
        if (d.allowFreeform !== false) {
          const input = make("input", "");
          input.placeholder = "Sua resposta";
          card.append(
            input,
            action("Responder", () => answer({ answer: input.value })),
          );
        }
      }
      q("requests").append(card);
      if (!visible)
        notify("Copilot Chat aguarda sua aprovação/resposta. Abra o painel.");
    } else if (type === "request.closed") {
      requests.get(event.id)?.remove();
      requests.delete(event.id);
    } else if (
      type === "assistant.message_delta" ||
      type === "assistant.message"
    ) {
      const id = d.messageId || "current";
      const incoming =
        type === "assistant.message_delta" ? d.deltaContent : d.content;
      if (!responses.has(id) && !incoming?.trim()) return;
      if (type === "assistant.message" && incoming?.trim()) {
        const conclusion = responses.get("task-conclusion");
        if (conclusion && incoming.includes(conclusion.text)) {
          conclusion.body.parentElement.remove();
          responses.delete("task-conclusion");
          dirtyResponses.delete(conclusion);
        }
      }
      if (!responses.has(id))
        responses.set(id, {
          body: appendMessage("assistant", ""),
          text: "",
          finished: false,
        });
      const record = responses.get(id),
        old = record.text;
      record.text = assistantText(old, event);
      textSize += Math.max(0, record.text.length - old.length);
      record.finished = type === "assistant.message";
      dirtyResponses.add(record);
    } else if (type === "tool.execution_start") {
      const text = `${d.toolName || "Ferramenta"}\n${JSON.stringify(d.arguments || {}, null, 2).slice(0, 8000)}`;
      tools.set(d.toolCallId, appendMessage("tool", text));
    } else if (type === "tool.execution_complete") {
      const e = tools.get(d.toolCallId) || appendMessage("tool", "");
      e.textContent += `\n${d.success === false ? "Falha" : "Concluído"}\n${JSON.stringify(d.result || d.error || {}, null, 2).slice(0, 16000)}`;
      changed();
    } else if (type === "bridge.task_complete") {
      completion(d.summary);
    } else if (
      type === "session.error" ||
      type === "bridge.error" ||
      type === "bridge.warning"
    ) {
      appendMessage("tool", d.message || JSON.stringify(d));
      if (type !== "bridge.warning") error(d.message || JSON.stringify(d));
      if (isTerminalChatError(event)) {
        await rpc("chat_abort");
        await finishUsage();
        busy = false;
      }
    } else if (type === "session.idle") {
      const completed =
        d.completed === true || d.aborted === true || d.mode !== "autopilot";
      await finishUsage(completed);
      if (completed) {
        busy = false;
        changed();
      }
    } else if (type === "assistant.reasoning_delta") {
      q("activity").textContent = "Copilot pensando…";
    } else if (type === "session.usage_info") {
      contextUsage = d;
    } else if (type === "session.compaction_start") {
      compacting = true;
    } else if (type === "session.compaction_complete") {
      compacting = false;
      if (d.success) {
        if (d.postCompactionTokens != null && d.tokenLimit)
          contextUsage = {
            currentTokens: d.postCompactionTokens,
            tokenLimit: d.tokenLimit,
          };
        notify(
          "Contexto resumido pelo Copilot. Decisões/pendências preservadas no resumo; detalhes antigos podem precisar ser relidos.",
        );
      } else error(d.error || "Compactação falhou; contexto não foi apagado.");
    } else if (type === "bridge.context") {
      q("context-audit").classList.remove("hidden");
      q("context-audit").textContent = d.policyUnavailable
        ? "Rust local: política não confirmada pelo runtime. Agente usa ferramentas nativas; busca manual continua disponível."
        : d.error
          ? `Contexto Rust: ${d.error}`
          : d.tool === "speedcode_search"
            ? `Busca Rust: ${d.results ?? 0} resultados · ${d.elapsedMs ?? 0} ms${d.complete === false ? " · cobertura parcial; ampliar busca" : ""}`
            : `Leitura Rust: ${d.path || "trecho verificado"}`;
    } else if (type === "bridge.proxy") {
      if (Number.isFinite(d.savedCharacters) && d.savedCharacters > 0)
        savedCharacters += d.savedCharacters;
      q("proxy-audit").textContent =
        `Proxy Rust · ${savedCharacters.toLocaleString("pt-BR")} caracteres duplicados removidos nesta sessão (não é medição de tokens/créditos).`;
      q("proxy-audit").classList.remove("hidden");
    }
  }
  function renderAttachments() {
    q("attachments").replaceChildren();
    for (const a of attachments)
      q("attachments").append(
        action(`${a.dir ? "📁" : "📎"} ${a.name} ×`, async () => {
          await rpc("chat_detach", { id: a.id });
          attachments = attachments.filter((x) => x.id !== a.id);
          renderAttachments();
        }),
      );
  }
  async function attach(params = {}) {
    attachments.push(...(await rpc("chat_attach", params)));
    renderAttachments();
  }
  async function clear(confirm = true) {
    if (
      confirm &&
      (worktree || active || q("prompt").value.trim() || attachments.length) &&
      !(await confirmAction(
        "Interromper o agente e limpar conversa, referências e contexto? Edições, branches e worktrees serão preservadas em disco.",
        "Limpar sessão",
      ))
    )
      return false;
    closeMenus();
    epoch++;
    savedCharacters = 0;
    await rpc("chat_clear");
    turn = null;
    latestUsage = null;
    sessionId = "";
    contextUsage = null;
    compacting = false;
    dirtyResponses.clear();
    follow = true;
    pruned = 0;
    for (const name of [
      "total",
      "context-audit",
      "proxy-audit",
      "pruned",
      "jump",
    ])
      q(name).classList.add("hidden");
    q("mcp-servers").replaceChildren();
    q("mcp-config").value = "";
    q("notes").value = "";
    q("notes-status").textContent = "Não gravadas em disco.";
    q("diagnostics-content").textContent =
      "Sem inferência. Não mede economia contra VS Code.";
    for (const name of ["check-diff", "check-tests", "check-limits"])
      q(name).checked = false;
    responses.clear();
    tools.clear();
    requests.clear();
    attachments = [];
    q("messages").replaceChildren();
    q("requests").replaceChildren();
    renderAttachments();
    workspace = "";
    worktree = null;
    renderWorktree();
    active = false;
    busy = false;
    paused = false;
    q("mode").value = "agent";
    q("prompt").value = "";
    dismissError();
    textSize = 0;
    update();
    return true;
  }
  async function send() {
    const prompt = q("prompt").value;
    if (!prompt.trim() || busy) return;
    if (prompt.trim() === "/clear") {
      await clear();
      return;
    }
    if (prompt.trim() === "/compact") {
      await compact();
      q("prompt").value = "";
      return;
    }
    if (prompt.trim().startsWith("/buscar ")) {
      q("search-query").value = prompt.trim().slice(8);
      q("settings").classList.remove("hidden");
      await searchLocal();
      q("prompt").value = "";
      return;
    }
    await ensureWorktree();
    const sendRoot = chatRoot();
    if (!sendRoot)
      throw new Error("Abra um projeto antes de enviar uma mensagem.");
    pruneView();
    const ids = attachments.map((a) => a.id);
    const startUsage = active ? await readUsage() : emptyUsage();
    const previousTurn = turn;
    turn = { start: startUsage, footer: null, finalized: false };
    responses.clear();
    tools.clear();
    follow = true;
    dismissError();
    const userMessage = appendMessage(
      "user",
      prompt +
        (attachments.length
          ? "\nReferências: " + attachments.map((a) => a.name).join(", ")
          : ""),
    );
    try {
      const result = await rpc("chat_send", {
        root: sendRoot,
        prompt,
        model: q("model").value,
        effort: q("effort").value,
        attachments: ids,
        autopilot: q("mode").value === "autopilot",
        localContext: q("local-context").checked,
        rustProxy: q("rust-proxy").checked,
      });
      acceptSession(result?.session);
    } catch (e) {
      turn = previousTurn;
      textSize -= userMessage.textContent.length;
      userMessage.parentElement.remove();
      throw e;
    }
    active = true;
    workspace ||= sendRoot;
    paused = false;
    busy = true;
    follow = true;
    attachments = [];
    renderAttachments();
    q("prompt").value = "";
    schedule(50);
  }
  const open = async () => {
    visible = true;
    showPanel(true);
    update();
    flushResponses();
    scrollMessages();
    if (!connected && !login) await run(() => connect());
    schedule();
  };
  q("close").onclick = () => {
    visible = false;
    closeMenus();
    showPanel(false);
    schedule();
  };
  async function loadQuota() {
    if (quotaLoading) return;
    if (!connected) {
      q("quota-content").textContent =
        "Conecte sua conta para consultar a cota.";
      return;
    }
    quotaLoading = true;
    const generation = quotaEpoch;
    q("quota-content").textContent = "Consultando cota da conta…";
    try {
      const data = await rpc("chat_quota");
      if (generation !== quotaEpoch) return;
      q("quota-content").replaceChildren();
      q("quota-details-content").replaceChildren();
      const rows = quotaRows(data);
      if (!rows.length)
        q("quota-content").textContent =
          "Cota não disponibilizada pelo Copilot. Não significa saldo zero.";
      for (const row of rows) {
        const item = make("section", "", "chat-quota-row");
        const heading = make("div", "", "chat-quota-heading");
        heading.append(make("strong", row.name), make("small", row.resetShort));
        const value = make("p", "", "chat-quota-value");
        value.append(
          make("strong", row.value),
          make("span", row.percent !== null ? " utilizado" : ""),
        );
        item.title = `${row.description}\n${row.reset}${row.overage ? `\n${row.overage}` : ""}`;
        item.append(heading, value);
        if (row.percent !== null) {
          const meter = make("progress", "");
          meter.max = 100;
          meter.value = row.percent;
          meter.setAttribute("aria-label", `${row.name}: percentual utilizado`);
          item.append(meter);
        }
        if (row.overage) item.append(make("small", row.overage));
        q("quota-content").append(item);
        q("quota-details-content").append(
          make(
            "p",
            `${row.name} · ${row.description}\n${row.reset}${row.overage ? `\n${row.overage}` : ""}`,
            "chat-help",
          ),
        );
      }
      if (
        data.observedAt &&
        Number.isFinite(new Date(data.observedAt).getTime())
      )
        q("quota-details-content").append(
          make(
            "small",
            `Consultado: ${new Date(data.observedAt).toLocaleString("pt-BR")}`,
          ),
        );
    } catch (e) {
      if (generation === quotaEpoch)
        q("quota-content").textContent =
          `Cota indisponível: ${e.message || String(e)}. Não significa saldo zero.`;
    } finally {
      quotaLoading = false;
    }
  }
  q("quota-menu").addEventListener("toggle", () => {
    if (q("quota-menu").open) loadQuota();
  });
  q("quota-refresh").onclick = () => loadQuota();
  q("quota-account").onclick = () =>
    run(() =>
      rpc("browser_open", {
        url: "https://github.com/settings/copilot",
        external: true,
      }),
    );
  const disconnect = async () => {
    if (
      active &&
      !(await confirmAction(
        "Desconectar e limpar conversa/contexto? Edições no projeto serão mantidas.",
        "Desconectar",
      ))
    )
      return;
    await clear(false);
    connected = false;
    quotaEpoch++;
    q("quota-content").textContent = "Conecte sua conta para consultar a cota.";
    login = false;
    account = "";
    q("device").classList.add("hidden");
    update();
  };
  const startLogin = async (host = "https://github.com") => {
    await clear(false);
    connected = false;
    await rpc("chat_login", { host });
    login = true;
    schedule(50);
  };
  q("connect").onclick = () =>
    run(async () => {
      dismissError();
      if (connected || login) await disconnect();
      else {
        await connect();
        if (!connected) await startLogin();
      }
    });
  q("refresh").onclick = () =>
    run(async () => {
      if (
        !active ||
        (await confirmAction(
          "Atualizar conexão vai limpar o contexto atual. Continuar?",
        ))
      )
        await connect(true);
    });
  q("login").onclick = () =>
    run(async () => {
      if (
        active &&
        !(await confirmAction("Login limpará o contexto atual. Continuar?"))
      )
        return;
      closeMenus();
      const host = await dialog(
        "SpeedCode · Login GitHub",
        "Use github.com ou o host da sua organização Enterprise Cloud.",
        {
          input: "https://empresa.ghe.com",
          initial: "https://github.com",
          confirm: "Iniciar login",
        },
      );
      if (host === null) return;
      q("account-menu").open = false;
      await startLogin(host);
    });
  q("logout").onclick = () =>
    run(async () => {
      if (
        !(await confirmAction(
          "Sair da conta compartilhada também afeta o Copilot CLI. Continuar?",
          "Sair da conta",
        ))
      )
        return;
      await rpc("chat_logout");
      await clear(false);
      connected = false;
      account = "";
      q("account-menu").open = false;
    });
  q("send").onclick = () => run(send);
  q("abort").onclick = () =>
    run(async () => {
      await rpc("chat_abort");
      await finishUsage();
      busy = false;
      paused = true;
      q("mode").value = "agent";
      requests.clear();
      q("requests").replaceChildren();
    });
  q("dismiss-error").onclick = dismissError;
  q("return-workspace").onclick = () =>
    run(async () => {
      if (workspace && showWorkspace)
        await showWorkspace(worktree?.repos?.[0]?.path || workspace);
    });
  q("messages").onscroll = () => {
    follow = nearBottom(q("messages"));
    if (follow) q("jump").classList.add("hidden");
  };
  q("jump").onclick = () => {
    follow = true;
    q("jump").classList.add("hidden");
    scrollMessages();
  };
  q("settings-toggle").onclick = () => {
    closeMenus();
    q("settings").classList.toggle("hidden");
  };
  q("settings-close").onclick = () => q("settings").classList.add("hidden");
  q("worktree").onchange = update;
  async function searchLocal(packageContext = false) {
    await ensureWorktree();
    const searchedRoot = chatRoot();
    if (!searchedRoot) throw new Error("Abra um projeto para buscar.");
    const result = await rpc(packageContext ? "chat_context" : "chat_search", {
      root: searchedRoot,
      query: q("search-query").value,
    });
    q("search-results").replaceChildren();
    for (const hit of result.results || []) {
      const row = make("div", "", "chat-search-result");
      row.append(
        action(`${hit.path}:${hit.startLine} · Anexar`, () =>
          attach({ root: searchedRoot, path: hit.path }),
        ),
        make("pre", hit.snippet),
      );
      if (packageContext)
        row.append(
          action("Referenciar trecho", () =>
            run(() =>
              attachSnapshot({
                root: searchedRoot,
                path: hit.path,
                text: hit.snippet,
                dirty: false,
                startLine: hit.startLine,
                startColumn: 1,
                endLine: hit.endLine,
                endColumn: (hit.snippet.split("\n").at(-1)?.length || 0) + 1,
              }),
            ),
          ),
          make(
            "small",
            `${hit.reason || "lexical"} · ${hit.unitComplete ? "unidade completa" : "trecho parcial"}${hit.parseErrors ? " · erro de sintaxe" : ""}`,
          ),
        );
      q("search-results").append(row);
    }
    q("search-results").append(
      make(
        "p",
        `${result.results?.length || 0} resultados · ${result.elapsedMs ?? 0} ms · ${result.cacheHits ?? 0} arquivos reaproveitados · ${result.bytesRead ?? 0} B indexados · ${result.verifiedBytes ?? 0} B revalidados${result.coverage?.complete === false ? " · cobertura parcial; refine ou use ferramentas nativas" : ""}${result.truncated ? " · resultados limitados" : ""}. Métricas locais, não créditos economizados.`,
        "chat-help",
      ),
    );
  }
  q("search").onclick = () => run(searchLocal);
  q("context-package").onclick = () => run(() => searchLocal(true));
  q("notes-save").onclick = () =>
    run(async () => {
      await rpc("chat_notes", { notes: q("notes").value });
      q("notes-status").textContent =
        "Fixadas em RAM · enviadas quando mudarem; incluídas ao compactar.";
    });
  q("diagnostics").onclick = () =>
    run(async () => {
      q("diagnostics-content").textContent = diagnosticsText(
        await rpc("chat_diagnostics"),
      );
    });
  async function refreshMcp() {
    const servers = await rpc("chat_mcp_list");
    q("mcp-servers").replaceChildren();
    for (const server of servers) {
      const row = make("div", "", "chat-mcp-server");
      const labels = {
        connected: "Conectado",
        paused: "Pausado",
        disabled: "Desabilitado",
        failed: "Falhou",
        pending: "Conectando",
        "needs-auth": "Requer autenticação",
        stopped: "Parado",
      };
      row.append(
        make(
          "span",
          `${server.name.replace(/^speedcode_/, "")} · ${labels[server.status] || server.status}`,
          server.status === "connected"
            ? "connected"
            : server.status === "failed"
              ? "failed"
              : "",
        ),
      );
      if (server.error) row.append(make("p", server.error, "chat-help failed"));
      if (server.toolCount != null)
        row.append(
          make("small", `${server.toolCount} ferramentas disponíveis`),
        );
      if (server.managed && Array.isArray(server.catalog)) {
        const details = make("details", "", "chat-productivity");
        details.append(make("summary", "Escolher ferramentas MCP"));
        for (const tool of server.catalog) {
          const label = make("label", "");
          const input = document.createElement("input");
          input.type = "checkbox";
          input.checked = tool.enabled === true;
          input.value = tool.name;
          input.disabled = busy;
          label.title = tool.description || "";
          label.append(input, document.createTextNode(tool.name));
          details.append(label);
        }
        details.append(
          action("Aplicar seleção", () =>
            run(async () => {
              await rpc("chat_mcp_tools", {
                name: server.name,
                tools: [...details.querySelectorAll("input:checked")].map(
                  (i) => i.value,
                ),
              });
              await refreshMcp();
            }),
          ),
        );
        row.append(details);
      }
      if (server.managed) {
        const controls = make("div", "", "chat-settings-actions");
        for (const [name, label] of server.status === "connected" ||
        server.status === "pending"
          ? [
              ["pause", "Pausar"],
              ["disable", "Desabilitar"],
              ["remove", "Remover"],
            ]
          : [
              ["resume", "Retomar"],
              ["disable", "Desabilitar"],
              ["remove", "Remover"],
            ]) {
          const button = action(label, () =>
            run(async () => {
              if (busy) throw new Error("Pause a rodada antes de alterar MCP.");
              if (
                name === "remove" &&
                !(await confirmAction(
                  "Remover a configuração temporária deste MCP? Conversa e outros servidores mantidos.",
                  "Remover MCP",
                ))
              )
                return;
              await rpc("chat_mcp_action", { name: server.name, action: name });
              await refreshMcp();
            }),
          );
          button.disabled = busy;
          controls.append(button);
        }
        row.append(controls);
      } else row.append(make("small", "Configurado no CLI · gerencie no CLI"));
      q("mcp-servers").append(row);
    }
    if (!servers.length)
      q("mcp-servers").append(
        make(
          "p",
          "Nenhum MCP nesta sessão. Servidores configurados no CLI podem aparecer após iniciar.",
          "chat-help",
        ),
      );
  }
  q("mcp-refresh").onclick = () => run(refreshMcp);
  q("mcp-connect").onclick = () =>
    run(async () => {
      const config = JSON.parse(q("mcp-config").value);
      if (!chatRoot())
        throw new Error("Abra um projeto antes de conectar MCP.");
      if (
        !(await confirmAction(
          "Conectar o MCP informado? Ele pode iniciar processos, acessar arquivos/rede e fornecer ferramentas ao Copilot. Confie no servidor e restrinja tools quando possível. Configuração temporária; conversa preservada.",
          "Conectar MCP",
        ))
      )
        return;
      const params = {
        root: chatRoot(),
        model: q("model").value,
        effort: q("effort").value,
        localContext: q("local-context").checked,
        rustProxy: q("rust-proxy").checked,
        name: q("mcp-name").value,
        config,
      };
      await ensureWorktree();
      params.root = chatRoot();
      const info = await rpc("chat_begin", params);
      acceptSession(info);
      const result = await rpc("chat_mcp_connect", params);
      q("mcp-config").value = "";
      await refreshMcp();
      schedule(50);
      if (result?.failed)
        error(
          `${result.failed} MCP(s) não conectaram. Confira executável/URL, ambiente, autenticação ou política corporativa. Use Retomar ou Remover na lista.`,
        );
    });
  async function compact() {
    if (!active || busy)
      throw new Error("Inicie uma sessão e pause a rodada antes de compactar.");
    if (
      !(await confirmAction(
        "Compactar a conversa em um resumo? O objetivo e pendências são preservados pelo harness, mas detalhes antigos podem precisar ser relidos. Pode consumir créditos; não desfaz edições.",
        "Compactar contexto",
      ))
    )
      return;
    compacting = true;
    update();
    try {
      const result = await rpc("chat_compact");
      showTotal(await readUsage());
      notify(
        `Contexto compactado: ${result.tokensRemoved ?? 0} tokens removidos da janela. Sessão mantida.`,
      );
    } finally {
      compacting = false;
      update();
    }
  }
  q("compact").onclick = () => run(compact);
  q("mode").onchange = () => {
    if (q("mode").value !== "autopilot") return;
    // Do not allow a send to opt in while the user is still deciding.
    q("mode").value = "agent";
    return run(async () => {
      if (
        await confirmAction(
          "Ativar Autopilot nesta sessão? O Copilot poderá continuar sozinho e aprovar ferramentas automaticamente, incluindo comandos, alterações e exclusões de arquivos. Isso pode consumir créditos adicionais. Políticas corporativas que exigem aprovação humana continuam valendo. Use apenas em um projeto confiável.",
          "Ativar Autopilot",
        )
      )
        q("mode").value = "autopilot";
    });
  };
  q("model-search").oninput = () => {
    const term = q("model-search").value.toLowerCase();
    for (const option of q("model").options)
      option.hidden = !option.text.toLowerCase().includes(term);
  };
  q("clear").onclick = () => run(() => clear());
  q("attach").onclick = () =>
    run(() => {
      q("attach-menu").open = false;
      return attach();
    });
  q("folder").onclick = () =>
    run(() => {
      q("attach-menu").open = false;
      return attach({ folder: true });
    });
  q("current").onclick = () =>
    run(() => {
      const file = currentFile();
      q("attach-menu").open = false;
      if (!file) throw new Error("Abra um arquivo primeiro.");
      if (file.dirty) return attachSnapshot(editorSnapshot(file));
      return attach({ root: file.root, path: file.path });
    });
  async function attachSnapshot(snapshot) {
    if (
      !(await confirmAction(
        `Referenciar ${snapshot.path} · ${snapshot.dirty ? "não salvo" : "snapshot"}?\nO arquivo não será gravado. Texto congelado agora; alterações posteriores exigem nova referência. Política Copilot será verificada antes de enviar.\n\n${snapshot.text.slice(0, 1000)}${snapshot.text.length > 1000 ? "\n… prévia parcial" : ""}`,
        "Referenciar trecho",
      ))
    )
      return;
    attachments.push(...(await rpc("chat_snapshot", snapshot)));
    renderAttachments();
  }
  q("selection").onclick = () =>
    run(() => {
      q("attach-menu").open = false;
      const selection = editorSelection?.();
      if (!selection) throw new Error("Selecione texto no editor primeiro.");
      return attachSnapshot(editorSnapshot(currentFile(), selection));
    });
  q("buffer").onclick = () =>
    run(() => {
      q("attach-menu").open = false;
      return attachSnapshot(editorSnapshot(currentFile()));
    });
  q("prompt").onkeydown = (e) => {
    // IME composition must not send accidentally; Shift+Enter is the only newline shortcut.
    if (
      e.key === "Enter" &&
      !e.shiftKey &&
      !e.isComposing &&
      e.keyCode !== 229
    ) {
      e.preventDefault();
      if (!e.repeat && !q("send").disabled) return run(send);
    }
  };
  q("prompt").ondragover = (e) => {
    if (e.dataTransfer.types.includes("application/x-speedcode-path")) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    }
  };
  q("prompt").ondrop = (e) => {
    const value = e.dataTransfer.getData("application/x-speedcode-path");
    if (!value) return;
    e.preventDefault();
    run(() => attach(JSON.parse(value)));
  };
  for (const field of [q("model"), q("effort")]) {
    field.onchange = () =>
      run(async () => {
        if (field === q("model")) efforts();
        try {
          if (active) {
            await rpc("chat_model", {
              root: workspace,
              model: q("model").value,
              effort: q("effort").value,
            });
            showTotal(await readUsage());
          }
          selectedModel = q("model").value;
          selectedEffort = q("effort").value;
        } catch (e) {
          q("model").value = selectedModel;
          efforts();
          q("effort").value = selectedEffort;
          throw e;
        } finally {
          q("model-menu").open = false;
          update();
        }
      });
  }
  update();
  return { open, hasActive: () => active || busy || login, update };
}
