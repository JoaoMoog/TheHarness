import { actions, clientServices } from "../actions/index.js";
import { account, canSee, contractById, draft, isNexoConnected, myNotifications, person, setDraft } from "../store.js";
import {
  actionAttrs, appbar, btn, busyNote, card, checkbox, chip, circle, empty, esc, field, icon, kv, money, note, percent, row, screen, signal, timeline,
} from "../ui.js";
import { bkFacts } from "./nexo-kit.js";

export const INTENT_LABEL = {
  approveStage: "Aprovar etapa", pay: "Pagar", openDispute: "Abrir disputa", viewStatement: "Ver extrato e limite",
  newService: "Contratar serviço", requestCredit: "Pedir crédito", other: "Outro assunto",
};
const NEEDS_SERVICE = ["approveStage", "pay", "openDispute"];

function entrada(s) {
  const first = person(s)?.first;
  const quick = [["Biometria", "fingerprint", { action: "login" }], ["App Nexo", "bank", { go: "#/nexo" }], ["Arbitragem", "gavel", { go: "#/arbitragem" }], ["Cadastro", "user", { go: "#/cadastro" }]];
  return screen({
    cls: "bk-login", dark: true,
    body: `<img src="/img/btg-logo-white.png" class="bk-login-logo" alt="BTG Pactual">
      <div class="bk-login-copy"><h1>Que bom te ver por aqui${first ? `, ${esc(first)}` : ""}!</h1><p>Nexo Serviços: encontre, contrate e pague prestadores verificados, com o dinheiro protegido pelo Aval até cada entrega ser aprovada.</p>
        <button type="button" class="bk-white" data-action="login">Entrar</button>
        <button type="button" class="bk-login-link" data-go="#/nexo">Entrar pelo app Nexo${icon("caret-right")}</button>
        <button type="button" class="bk-login-link" data-go="#/cadastro">Iniciar novo cadastro${icon("caret-right")}</button></div>
      <nav class="bk-login-quick" aria-label="Acesso rápido">${quick.map(([label, ic, target]) => `<button type="button" ${target.action ? `data-action="${target.action}"` : `data-go="${target.go}"`}>${icon(ic)}<span>${label}</span></button>`).join("")}</nav>`,
  });
}

function biometria() {
  return screen({
    header: appbar({ title: "Entrar" }),
    body: `<div class="center-block">${circle("fingerprint", "info", 72)}<h2>Use a biometria para entrar</h2><p class="muted">A mesma do app Nexo. Seus dados ficam protegidos no seu aparelho.</p></div>`,
    footer: `${btn("Confirmar biometria", { action: "biometricOk", iconName: "fingerprint" })}${btn("Usar senha", { kind: "text", action: "biometricOk" })}`,
  });
}

function cadastro(s) {
  const capture = (fieldName, label, ic, done) =>
    `<button type="button" class="capture ${done ? "done" : ""}" data-action="markCapture" data-field="${fieldName}">${icon(done ? "check-circle" : ic)}<span>${esc(label)}</span><small>${done ? "Enviado" : "Tocar para enviar"}</small></button>`;
  return screen({
    header: appbar({ title: "Criar conta" }),
    body: `<h2 class="title">Seus dados</h2>
      ${card(`${field("Nome completo", { bind: "signup.name", value: draft("signup.name") })}${field("Nome como está no documento", { bind: "signup.documentName", value: draft("signup.documentName") })}${field("Que serviços você presta ou contrata?", { bind: "signup.services", value: draft("signup.services"), multiline: true })}`)}
      <div class="grid-2">${capture("doc", "Foto do documento", "identification-card", draft("signup.doc"))}${capture("selfie", "Selfie com prova de vida", "camera", draft("signup.selfie"))}</div>
      ${card(`<div class="row-gap">${icon("gavel")}<strong>Cláusula compromissória</strong></div><p class="small">Disputas que a mediação não resolver vão para arbitragem profissional, custeada pelo seguro já incluído em toda operação. <button type="button" class="link" data-go="#/arbitragem">Como funciona</button></p>${checkbox("Li e aceito os termos do Aval e a cláusula compromissória.", { bind: "signup.arbitration", checked: draft("signup.arbitration") })}`)}
      ${note("O Nexo confere seus dados antes de liberar pagamentos e saques. Você já pode montar serviços enquanto isso.")}`,
    footer: btn("Enviar para análise", { action: "submitSignup", busy: s.ui.busy.signup }),
  });
}

function contaAnalise(s) {
  const acc = s.newAccount;
  if (!acc) {
    return screen({ header: appbar({ title: "Sua conta" }), body: empty("Nenhuma conta em análise. Crie uma conta para ver esta etapa."), footer: btn("Criar conta", { go: "#/cadastro" }) });
  }
  if (acc.status === "verified") {
    return screen({
      header: appbar({ title: "Sua conta" }),
      body: `<div class="center-block">${circle("seal-check", "pos", 72)}<h2>Conta liberada</h2><p class="muted">${esc(acc.name)}, você já pode pagar e receber pelo Aval.</p></div>`,
      footer: btn("Começar", { go: "#/inicio" }),
    });
  }
  if (acc.status === "refused") {
    const appeal = acc.appeal;
    const appealCard = appeal ? card(`<div class="row-between"><strong>Sua contestação</strong>${chip(appeal.status === "review" ? "Em revisão por uma pessoa" : "Recusa mantida", appeal.status === "review" ? "info" : "neg")}</div><p class="quote">“${esc(appeal.text)}”</p>`) : "";
    return screen({
      header: appbar({ title: "Sua conta" }),
      body: `<div class="center-block">${circle("warning-circle", "neg", 72)}<h2>Não conseguimos liberar sua conta</h2><p class="muted">${esc(acc.blockReason ?? "Dados do cadastro não conferem")}. Você pode contestar: uma pessoa do Nexo revisa.</p></div>${appealCard}`,
      footer: appeal ? btn("Falar com a central", { kind: "secondary", go: "#/perfil" }) : btn("Contestar decisão", { go: "#/contestar" }),
    });
  }
  return screen({
    header: appbar({ title: "Sua conta" }),
    body: `<div class="center-block">${circle("shield-check", "info", 64)}<h2>Estamos confirmando seus dados</h2><p class="muted">É uma checagem de segurança do Nexo. Costuma levar até 1 dia útil.</p></div>
      ${card(timeline([["Documento enviado", `${acc.submittedAt} · foto do documento`, "ok"], ["Selfie e prova de vida", acc.submittedAt, "ok"], ["Cláusula compromissória aceita", acc.arbitrationAcceptedAt ?? acc.submittedAt, "ok"], ["Análise de segurança", "Em andamento no Nexo", "now"], ["Conta liberada", "Você recebe um aviso", "next"]]))}
      ${note("Enquanto isso, você pode montar serviços e convidar prestadores. Pagamentos e saques ficam pausados.", "warn", "warning-circle")}`,
    footer: btn("Montar um serviço", { kind: "secondary", go: "#/novo/1" }),
  });
}

function avisos(s) {
  const mine = myNotifications(s);
  const side = (n) => (n.mode === "prestador" ? "Prestando" : n.mode === "contratante" ? "Contratando" : "Aval");
  const item = (n) => `<button type="button" class="bk-note ${n.read ? "" : "unread"}" ${actionAttrs({ action: "readNotification", data: { id: n.id, target: n.go ?? "" } })}><strong>${esc(n.text)}</strong>${n.detail ? `<span>${esc(n.detail)}</span>` : ""}<small>${esc(side(n))}</small></button>`;
  const group = (title, list, aside = "") => (list.length ? `<section class="bk-notes"><div class="bk-notes-head"><span>${title}</span>${aside}</div>${list.map(item).join("")}</section>` : "");
  const settings = `<button type="button" class="bk-link dark" data-go="#/perfil">${icon("gear")}Configurar</button>`;
  return screen({
    cls: "bk-paper", header: appbar({ title: "Notificações" }),
    body: mine.length === 0
      ? empty("Nenhum aviso por enquanto.")
      : `${group("Novas", mine.filter((n) => !n.read), settings)}${group("Anteriores", mine.filter((n) => n.read), mine.some((n) => !n.read) ? "" : settings)}`,
  });
}

const setting = (title, { detail = "", go, action } = {}) => {
  const clickable = Boolean(go || action);
  const tag = clickable ? "button" : "div";
  return `<${tag} ${clickable ? 'type="button"' : ""} class="bk-setting" ${actionAttrs({ go, action })}><span><strong>${esc(title)}</strong>${detail ? `<small>${esc(detail)}</small>` : ""}</span>${clickable ? icon("caret-right") : ""}</${tag}>`;
};

function perfil(s) {
  const p = person(s);
  const on = s.settings.aiEnabled;
  const acc = account(s);
  return screen({
    cls: "bk-paper", header: appbar({ title: "Perfil" }),
    body: `<section class="bk-profile"><span class="bk-avatar lg">${esc(p.initials)}</span><div><h2>${esc(p.name)}</h2><small>${esc(p.activity)} · ${isNexoConnected(s) ? "Conta Nexo conectada" : "Sem conta Nexo"}</small></div></section>
      ${bkFacts([["Quando contrata", `${p.clientName} · ${p.clientDoc}`], ["Quando presta", `${p.providerName} · ${p.providerDoc}`]])}
      <h3 class="bk-settings-title">Conta e dinheiro</h3>
      ${setting("Gestão de contas", { detail: isNexoConnected(s) ? acc.nexo.label : "Conectar conta Nexo", go: "#/contas" })}${setting("Open Finance", { detail: acc.openFinance.status === "shared" ? acc.openFinance.banks.join(", ") : "Traga dados de outros bancos", go: "#/open-finance" })}${setting("Meus créditos", { detail: "Pedidos, contratos e parcelas", go: "#/creditos" })}${setting("Aval Labs", { detail: "Custódia que rende, cofrinho e cartão 12x", go: "#/labs" })}
      <h3 class="bk-settings-title">Configurações</h3>
      ${setting("Segurança", { detail: "Biometria, token e aparelhos" })}${setting("Arbitragem e disputas", { detail: "Cláusula compromissória aceita", go: "#/arbitragem" })}${setting("Notificações", { go: "#/avisos" })}
      <div class="bk-setting"><span><strong>Aval IA nos seus serviços</strong><small>Lê textos e provas para conferir entregas. Os dados ficam no Nexo e não treinam modelos.</small></span><button type="button" class="toggle ${on ? "on" : ""}" role="switch" aria-checked="${on}" aria-label="Aval IA" data-action="toggleAi"><span></span></button></div>
      <h3 class="bk-settings-title">Precisa de ajuda?</h3>
      ${setting("Assistente Aval", { detail: "Peça em poucas palavras", go: "#/ia" })}${setting("Baixar meus dados", { detail: "LGPD · arquivo em até 48 horas", action: "downloadData" })}
      <div class="bk-menu-foot"><button type="button" class="bk-primary" data-action="logout">Sair do app${icon("sign-out")}</button><small>Versão do app: Aval 5.0 · protótipo</small></div>`,
  });
}

function chatMessage(m, s) {
  if (m.from === "user") return `<div class="bubble user">${esc(m.text)}</div>`;
  if (!m.result) return `<div class="bubble ia">${esc(m.text)}</div>`;
  const { value, routing, confidence } = m.result;
  const services = clientServices(s);
  const service = value.serviceId ? contractById(s, value.serviceId) : null;
  const confident = routing === "automatic";
  const needsService = NEEDS_SERVICE.includes(value.intent);
  const head = `<div class="row-between"><strong>${confident ? "Entendi o pedido" : value.serviceId || !needsService ? "Confirme o pedido" : "Qual serviço?"}</strong>${confident ? signal(`Aval IA · ${percent(confidence)}`) : signal("Confirme", "review")}</div>`;
  const target = `<div class="ia-target">${icon("arrow-right")}<span><strong>${esc(INTENT_LABEL[value.intent] ?? value.intent)}</strong>${service ? `<small>${esc(service.title)} · ${esc(service.provider)}</small>` : ""}</span></div>`;
  const choices = !confident && needsService
    ? `<div class="choice-list">${services.map((sv) => `<button type="button" class="pill-option" data-action="chatOpen" data-intent="${esc(value.intent)}" data-service="${esc(sv.id)}">${esc(sv.label)}</button>`).join("")}</div>`
    : btn(confident ? "Abrir" : "Confirmar e abrir", { action: "chatOpen", data: { intent: value.intent, service: value.serviceId ?? "" }, kind: confident ? "primary" : "secondary" });
  return `<div class="bubble ia card">${head}${target}${choices}</div>`;
}

function avalIa(s) {
  const suggestions = ["quero liberar a segunda etapa da reforma", "e pagar o pintor também", "quero financiar a reforma da cozinha", "quero reclamar do chuveiro que não liga"];
  const body = s.chat.length === 0
    ? `<div class="center-block">${circle("sparkle", "info", 56)}<h2>Peça em poucas palavras</h2><p class="muted">O Aval IA entende o pedido e abre a tela certa. Nenhuma ação acontece sem sua confirmação.</p></div><div class="choice-list">${suggestions.map((t) => `<button type="button" class="pill-option" data-action="chatSuggest" data-text="${esc(t)}">${esc(t)}</button>`).join("")}</div>`
    : `${s.chat.map((m) => chatMessage(m, s)).join("")}${s.ui.busy.chat ? busyNote("Aval IA entendendo o pedido") : ""}`;
  return screen({
    header: appbar({ title: "Aval IA" }),
    body: `<div class="chat">${body}</div>`,
    footer: `<div class="chat-input"><input id="chat-input" data-bind="chat.text" placeholder="Peça em poucas palavras" value="${esc(draft("chat.text", ""))}" aria-label="Mensagem para o Aval IA">${icon("microphone")}<button type="button" class="send" data-action="sendChat" aria-label="Enviar" ${s.ui.busy.chat ? "disabled" : ""}>${icon("paper-plane-tilt")}</button></div>`,
  });
}

function contrato(s, { id }) {
  const c = contractById(s, id);
  if (!canSee(c, s)) return screen({ header: appbar({ title: "Contrato" }), body: empty("Contrato não encontrado.") });
  return screen({
    header: appbar({ title: "Contrato" }),
    body: `${card(`<small class="muted">${esc(c.id)} · assinado em ${esc(c.signedAt)}</small><h2>${esc(c.title)}</h2>${kv("Contratante", c.client)}${kv("Prestador", c.provider)}${kv("Valor total", money(c.totalCents))}${c.address ? kv("Local", c.address) : ""}`)}
      ${card(`<h3>Etapas</h3>${c.stages.map((st, i) => kv(`${i + 1}. ${st.name} · até ${st.due}`, money(st.valueCents))).join("")}`)}
      ${card(`<h3>Proteções</h3>${kv("Seguro de arbitragem", `${money(c.arbitrationFeeCents ?? 0)} · incluído`)}${kv("Seguro Aval da obra", c.insurance ? `${c.insurance.policy} · ${money(c.insurance.premiumCents)}` : "Não contratado")}`)}
      ${card(`<h3>Cláusulas principais</h3><ol class="clauses"><li><strong>Custódia.</strong> O valor fica protegido no Nexo e só é liberado ao prestador quando cada etapa é aprovada.</li><li><strong>Confirmação tácita.</strong> Sem resposta em 7 dias após a entrega, a etapa é aprovada automaticamente.</li><li><strong>Entrada.</strong> Uma entrada combinada vai direto ao prestador e não fica protegida.</li><li><strong>Cláusula compromissória.</strong> Sem acordo na mediação, a decisão final é de uma câmara de arbitragem independente, custeada pelo seguro de arbitragem. Aceita pelas duas partes na assinatura.</li></ol>`)}`,
    footer: btn("Baixar PDF", { kind: "secondary", action: "downloadData" }),
  });
}

export const commonRoutes = {
  entrada, biometria, cadastro, "conta-analise": contaAnalise, avisos, perfil, ia: avalIa, "contrato/:id": contrato,
};

export const commonActions = {
  chatSuggest: ({ text }) => {
    setDraft("chat.text", text);
    actions.sendChat();
  },
};
