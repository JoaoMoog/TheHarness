import { account, canSee, contractById, draft, isNexoConnected, myNotifications, person, setDraft } from "../store.js";
import {
  actionAttrs, appbar, btn, busyNote, card, checkbox, chip, circle, empty, esc, field, icon, kv, money, note, percent, row, screen, signal, timeline,
} from "../ui.js";
import { CONSENT_SCOPES, importedCustomer } from "../actions/index.js";
import { bkFacts } from "./nexo-kit.js";


function entrada(s) {
  const first = person(s)?.first;
  const registered = Boolean(person(s));
  const quick = registered
    ? [["Biometria", "fingerprint", { action: "login" }], ["App Nexo", "bank", { go: "#/nexo" }], ["Arbitragem", "gavel", { go: "#/arbitragem" }]]
    : [["Conta Nexo", "bank", { go: "#/cadastro" }], ["Arbitragem", "gavel", { go: "#/arbitragem" }]];
  const actionsHtml = registered
    ? `<button type="button" class="bk-white" data-action="login">Entrar</button>
        <button type="button" class="bk-login-link" data-go="#/nexo">Entrar pelo app Nexo${icon("caret-right")}</button>`
    : `<button type="button" class="bk-white" data-go="#/cadastro">Entrar com a conta Nexo</button>`;
  return screen({
    cls: "bk-login", dark: true,
    body: `<img src="/img/btg-logo-white.png" class="bk-login-logo" alt="BTG Pactual">
      <div class="bk-login-copy"><h1>Que bom te ver por aqui${first ? `, ${esc(first)}` : ""}!</h1><p>Aval: contrate e preste serviços por etapa, com o dinheiro protegido pelo Nexo até cada entrega ser aprovada.</p>
        ${actionsHtml}</div>
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

/** The Nexo app, opened by the redirect: the person sees what the Aval asks for and authorizes with biometrics. */
function cadastro() {
  const c = importedCustomer();
  const required = CONSENT_SCOPES.filter(([, , r]) => r).map(([label, detail]) => `<div class="consent">${icon("check-circle")}<div><strong>${esc(label)}</strong><small>${esc(detail)}</small></div></div>`).join("");
  return screen({
    header: `<div class="redirect-bar">${icon("lock-simple")}<span>Você está no app Nexo</span></div>${appbar({ title: "Autorizar o Aval", tone: "ink" })}`,
    body: `<div class="center-block"><img src="/img/btg-logo-navy.png" alt="BTG Pactual" class="logo-md"><h2>O Aval quer acessar a sua conta</h2><p class="muted">Ao autorizar, você volta para o Aval com os seus dados. Não precisa digitar nada.</p></div>
      ${card(`<div class="row-gap">${circle("user", "info")}<div><strong>${esc(c.name)}</strong><small class="muted">${esc(c.account)}</small></div></div>`)}
      <h3>O Aval vai acessar</h3>
      ${card(`${required}${checkbox("Compartilhar meu limite pré-aprovado", { bind: "conectar.limit", checked: draft("conectar.limit", true) })}`)}
      ${note("O Aval nunca vê a sua senha e nunca move dinheiro sem a sua confirmação. Dá para revogar a qualquer momento.", "info", "lock-simple")}`,
    footer: `${btn("Autorizar com biometria", { action: "nexoAuthorize", iconName: "fingerprint" })}${btn("Cancelar e voltar ao Aval", { kind: "text", go: "#/entrada" })}`,
  });
}

/** Back in the Aval: the data that came from the Nexo, and the Aval's own terms. */
function cadastroDados(s) {
  if (!draft("login.authorized")) return screen({ header: appbar({ title: "Conta Nexo" }), body: empty("Entre com a sua conta Nexo primeiro."), footer: btn("Entrar com a conta Nexo", { go: "#/cadastro" }) });
  const c = importedCustomer();
  return screen({
    header: appbar({ title: "Dados importados" }),
    body: `<div class="center-block">${circle("seal-check", "pos", 56)}<h2>Dados importados do Nexo</h2><p class="muted">Confira e aceite os termos do Aval para começar.</p></div>
      ${card(`${kv("Nome", c.name)}${kv("CPF", c.doc.replace("CPF ", ""))}${kv("Celular", c.phone)}${kv("E-mail", c.email)}${kv("Endereço", c.address)}${kv("Conta", c.account)}`)}
      ${card(`<div class="row-gap">${icon("gavel")}<strong>Cláusula compromissória</strong></div><p class="small">Disputas que a mediação não resolver vão para arbitragem profissional, custeada pelo seguro já incluído em toda operação.</p>${btn("Como funciona", { kind: "text small", go: "#/arbitragem" })}${checkbox("Li e aceito os termos do Aval e a cláusula compromissória.", { bind: "signup.arbitration", checked: draft("signup.arbitration") })}`)}`,
    footer: btn("Começar a usar o Aval", { action: "importNexoAccount" }),
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
  const side = (n) => (n.mode === "prestador" ? "Prestador" : n.mode === "contratante" ? "Contratante" : "Aval");
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
  const acc = account(s);
  return screen({
    cls: "bk-paper", header: appbar({ title: "Perfil" }),
    body: `<section class="bk-profile"><span class="bk-avatar lg">${esc(p.initials)}</span><div><h2>${esc(p.name)}</h2><small>${esc(p.activity)} · ${isNexoConnected(s) ? "Conta Nexo conectada" : "Sem conta Nexo"}</small></div></section>
      ${bkFacts([["Quando contrata", `${p.clientName} · ${p.clientDoc}`], ["Quando presta", `${p.providerName} · ${p.providerDoc}`]])}
      <h3 class="bk-settings-title">Conta e dinheiro</h3>
      ${setting("Gestão de contas", { detail: isNexoConnected(s) ? acc.nexo.label : "Conectar conta Nexo", go: "#/contas" })}${setting("Open Finance", { detail: acc.openFinance.status === "shared" ? acc.openFinance.banks.join(", ") : "Traga dados de outros bancos", go: "#/open-finance" })}${setting("Meus créditos", { detail: "Pedidos, contratos e parcelas", go: "#/creditos" })}${setting("Aval Labs", { detail: "Custódia que rende, cofrinho e cartão 12x", go: "#/labs" })}
      <h3 class="bk-settings-title">Configurações</h3>
      ${setting("Segurança", { detail: "Biometria, token e aparelhos" })}${setting("Arbitragem e disputas", { detail: "Cláusula compromissória aceita", go: "#/arbitragem" })}${setting("Notificações", { go: "#/avisos" })}
      <h3 class="bk-settings-title">Precisa de ajuda?</h3>
      ${setting("Baixar meus dados", { detail: "LGPD · arquivo em até 48 horas", action: "downloadData" })}
      <div class="bk-menu-foot"><button type="button" class="bk-primary" data-action="logout">Sair do app${icon("sign-out")}</button><small>Versão do app: Aval 5.0 · protótipo</small></div>`,
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
  entrada, biometria, cadastro, "cadastro/dados": cadastroDados, "conta-analise": contaAnalise, avisos, perfil, "contrato/:id": contrato,
};

