import { account, canSee, contractById, draft, isBtgConnected, myNotifications, person, setDraft } from "../store.js";
import {
  actionAttrs, appbar, btgBrand, btn, milestoneRows, busyNote, card, checkbox, chip, circle, empty, esc, field, icon, kv, money, note, percent, row, screen, signal, timeline,
} from "../ui.js";
import { CONSENT_SCOPES, importedCustomer } from "../actions/index.js";
import { freshAccount } from "../seed.js";
import { bkFacts } from "./btg-kit.js";


function entrada(s) {
  const first = person(s)?.first;
  const registered = Boolean(person(s));
  const quick = registered
    ? [["Biometria", "fingerprint", { action: "login" }], ["App BTG", "bank", { go: "#/btg" }], ["Arbitragem", "gavel", { go: "#/arbitragem" }], ["Ajuda", "question", { go: "#/ajuda" }]]
    : [["Conta BTG", "bank", { go: "#/cadastro" }], ["Arbitragem", "gavel", { go: "#/arbitragem" }], ["Ajuda", "question", { go: "#/ajuda" }]];
  const actionsHtml = registered
    ? `<button type="button" class="bk-white" data-action="login">Entrar</button>
        <button type="button" class="bk-login-link" data-go="#/btg">Entrar pelo app BTG${icon("caret-right")}</button>`
    : `<button type="button" class="bk-white" data-go="#/cadastro">Entrar com a conta BTG</button>`;
  return screen({
    cls: "bk-login", dark: true,
    body: `<img src="/img/btg-logo-white.png" class="bk-login-logo" alt="BTG Pactual">
      <div class="bk-login-copy"><h1>Que bom te ver por aqui${first ? `, ${esc(first)}` : ""}!</h1><p>Pague o que combinou. O dinheiro fica guardado até a entrega.</p>
        ${actionsHtml}</div>
      <nav class="bk-login-quick" aria-label="Acesso rápido">${quick.map(([label, ic, target]) => `<button type="button" ${target.action ? `data-action="${target.action}"` : `data-go="${target.go}"`}>${icon(ic)}<span>${label}</span></button>`).join("")}</nav>`,
  });
}

function biometria() {
  return screen({
    header: appbar({ title: "Entrar" }),
    body: `<div class="center-block">${circle("fingerprint", "info", 72)}<h2>Use a biometria para entrar</h2><p class="muted">A mesma do app BTG. Seus dados ficam protegidos no seu aparelho.</p></div>`,
    footer: `${btn("Confirmar biometria", { action: "biometricOk", iconName: "fingerprint" })}${btn("Usar senha", { kind: "text", action: "biometricOk" })}`,
  });
}

/** The BTG app, opened by the redirect: the person sees what the Aval asks for and authorizes with biometrics. */
/** One icon per consent scope, in the order of CONSENT_SCOPES. */
const SCOPE_ICONS = ["identification-card", "receipt", "qr-code"];

function cadastro() {
  const c = importedCustomer();
  const initials = c.name.split(" ").filter(Boolean).map((w) => w[0]).slice(0, 2).join("");
  const scopes = CONSENT_SCOPES.map((scope, i) => [...scope, SCOPE_ICONS[i]]);
  const row = ([label, detail, ic]) => `<li><span class="cs-ic">${icon(ic)}</span><span><strong>${esc(label)}</strong><small>${esc(detail)}</small></span></li>`;
  return screen({
    cls: "cs", header: `<div class="redirect-bar">${icon("lock-simple")}<span>Você está no app BTG</span></div>${appbar({ title: "Autorizar o Aval" })}`,
    body: `<section class="cs-hero"><div class="cs-link">${btgBrand("banking")}<span class="cs-dots" aria-hidden="true">${icon("arrows-left-right")}</span>${btgBrand("aval")}</div>
        <h2>Conectar sua conta ao Aval</h2><p>Você volta para o Aval com os seus dados. Não precisa digitar nada.</p></section>
      <section class="cs-account"><span class="cs-avatar">${esc(initials)}</span><span><strong>${esc(c.name)}</strong><small>${esc(c.account)}</small></span></section>
      <h3 class="bk-settings-title">O Aval vai acessar</h3><ul class="cs-list">${scopes.map(row).join("")}</ul>
      <p class="cs-safe">${icon("lock-simple")}O Aval nunca vê a sua senha e não move dinheiro sem a sua confirmação. Dá para revogar quando quiser.</p>`,
    footer: `${btn("Autorizar com biometria", { action: "btgAuthorize", iconName: "fingerprint" })}${btn("Cancelar e voltar ao Aval", { kind: "text", go: "#/entrada" })}`,
  });
}

/** Back in the Aval: the data that came from the BTG, and the Aval's own terms. */
function cadastroDados(s) {
  if (!draft("login.authorized")) return screen({ header: appbar({ title: "Conta BTG" }), body: empty("Entre com a sua conta BTG primeiro."), footer: btn("Entrar com a conta BTG", { go: "#/cadastro" }) });
  const c = importedCustomer();
  const limits = freshAccount();
  const data = [["user", "Nome", c.name], ["identification-card", "CPF", c.doc.replace("CPF ", "")], ["device-mobile", "Celular", c.phone], ["paper-plane-tilt", "E-mail", c.email], ["map-pin", "Endereço", c.address], ["bank", "Conta", c.account]];
  const row = ([ic, label, value]) => `<li><span class="cs-ic">${icon(ic)}</span><span><small>${esc(label)}</small><strong>${esc(value)}</strong></span></li>`;
  const limit = (label, cents) => `<div><small>${esc(label)}</small><strong>${money(cents)}</strong></div>`;
  return screen({
    cls: "cs", header: appbar({ title: "Dados importados" }),
    body: `<section class="cs-hero"><span class="cs-done">${icon("check")}</span><h2>Conta conectada</h2><p>Os dados vieram da sua conta BTG. Confira e aceite os termos para começar.</p></section>
      <h3 class="bk-settings-title">Seus dados</h3><ul class="cs-list cs-data">${data.map(row).join("")}</ul>
      <h3 class="bk-settings-title">Seus limites no Aval</h3>
      <section class="cs-limits limits-card"><div class="cs-limit-row">${limit("Para pagar parcelado", limits.creditLimitCents)}${limit("Para antecipar, se prestar serviços", limits.anticipationLimitCents)}</div>
        <p>São só seus, aprovados pelo BTG. Não é um limite dividido com quem você contrata.</p></section>
      <h3 class="bk-settings-title">Termos</h3>
      <section class="cs-terms"><div class="cs-terms-head"><span class="cs-ic">${icon("gavel")}</span><span><strong>Cláusula compromissória</strong><small>Se a mediação não resolver, a decisão é de uma arbitragem, custeada pelo seguro já incluído.</small></span></div>
        <button type="button" class="link-btn" data-go="#/arbitragem">Como funciona${icon("caret-right")}</button>
        ${checkbox("Li e aceito os termos do Aval e a cláusula compromissória.", { bind: "signup.arbitration", checked: draft("signup.arbitration") })}</section>`,
    footer: btn("Começar a usar o Aval", { action: "importBtgAccount" }),
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
      body: `<div class="center-block">${circle("warning-circle", "neg", 72)}<h2>Não conseguimos liberar sua conta</h2><p class="muted">${esc(acc.blockReason ?? "Dados do cadastro não conferem")}. Você pode contestar: uma pessoa do BTG revisa.</p></div>${appealCard}`,
      footer: appeal ? btn("Falar com a central", { kind: "secondary", go: "#/perfil" }) : btn("Contestar decisão", { go: "#/contestar" }),
    });
  }
  return screen({
    header: appbar({ title: "Sua conta" }),
    body: `<div class="center-block">${circle("shield-check", "info", 64)}<h2>Estamos confirmando seus dados</h2><p class="muted">É uma checagem de segurança do BTG. Costuma levar até 1 dia útil.</p></div>
      ${card(timeline([["Documento enviado", `${acc.submittedAt} · foto do documento`, "ok"], ["Selfie e prova de vida", acc.submittedAt, "ok"], ["Cláusula compromissória aceita", acc.arbitrationAcceptedAt ?? acc.submittedAt, "ok"], ["Análise de segurança", "Em andamento no BTG", "now"], ["Conta liberada", "Você recebe um aviso", "next"]]))}
      ${note("Enquanto isso, você pode montar serviços e convidar prestadores. Pagamentos e saques ficam pausados.", "warn", "warning-circle")}`,
    footer: btn("Pagar", { kind: "secondary", action: "startPayment" }),
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
    body: `<section class="bk-profile"><span class="bk-avatar lg">${esc(p.initials)}</span><div><h2>${esc(p.name)}</h2><small>${esc(p.activity)} · ${isBtgConnected(s) ? "Conta BTG conectada" : "Sem conta BTG"}</small></div></section>
      ${bkFacts([["Quando contrata", `${p.clientName} · ${p.clientDoc}`], ["Quando presta", `${p.providerName} · ${p.providerDoc}`]])}
      <h3 class="bk-settings-title">Conta e dinheiro</h3>
      ${setting("Gestão de contas", { detail: isBtgConnected(s) ? acc.btg.label : "Conectar conta BTG", go: "#/no-app-btg/conta" })}${setting("Open Finance", { detail: acc.openFinance.status === "shared" ? acc.openFinance.banks.join(", ") : "Traga dados de outros bancos", go: "#/no-app-btg/open-finance" })}${setting("Empréstimos dos pagamentos", { detail: "Contratos e parcelas", go: "#/creditos" })}
      <h3 class="bk-settings-title">Configurações</h3>
      ${setting("Segurança", { detail: "Biometria, token e aparelhos" })}${setting("Arbitragem e disputas", { detail: "Cláusula compromissória aceita", go: "#/arbitragem" })}${setting("Avisos dos pagamentos", { detail: s.ui.prompts?.[s.session.person] === "on" ? "Ligados: só quando o dinheiro mexer" : "Desligados", action: "toggleNotify" })}${setting("Notificações", { go: "#/avisos" })}
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
      ${card(`<h3>Marcos</h3>${milestoneRows(c.stages, { due: true })}`)}
      ${card(`<h3>Seguros</h3>${kv("Seguro de arbitragem", `${money(c.arbitrationFeeCents ?? 0)} · incluído`)}${kv("Seguro Aval da obra", c.insurance ? `${c.insurance.policy} · ${money(c.insurance.premiumCents)}` : "Não contratado")}`)}
      ${card(`<h3>Cláusulas principais</h3><ol class="clauses"><li><strong>Valor guardado.</strong> O valor fica guardado no BTG e só é liberado ao prestador quando cada marco é aprovado.</li><li><strong>Confirmação tácita.</strong> Sem resposta em 7 dias após a entrega, o marco é aprovado automaticamente.</li><li><strong>Entrada.</strong> Uma entrada combinada vai direto ao prestador e não fica guardada.</li><li><strong>Cláusula compromissória.</strong> Sem acordo na mediação, a decisão final é de uma câmara de arbitragem independente, custeada pelo seguro de arbitragem. Aceita pelas duas partes na assinatura.</li></ol>`)}`,
    footer: btn("Baixar PDF", { kind: "secondary", action: "downloadData" }),
  });
}

export const commonRoutes = {
  entrada, biometria, cadastro, "cadastro/dados": cadastroDados, "conta-analise": contaAnalise, avisos, perfil, "contrato/:id": contrato,
};

