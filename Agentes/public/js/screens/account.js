// Connect the Nexo account (consent, token), Open Finance, connected accounts and the Nexo Banking entry point.
import { CONSENT_SCOPES, OPEN_FINANCE_BANKS } from "../actions/index.js";
import { account, availableLimitCents, draft, isNexoConnected, myContracts, person } from "../store.js";
import { actionAttrs, appbar, btn, card, checkbox, chip, circle, esc, icon, kv, listCard, money, note, option, row, screen, timeline } from "../ui.js";
import { bkBanner, bkHeader, bkItem, bkSection, bkStrip, initialsOf, todayLabel } from "./nexo-kit.js";
import { shown } from "./chrome.js";

const stepper = (n) => `<div class="steps">${[1, 2, 3].map((i) => `<span class="${i <= n ? "on" : ""}"></span>`).join("")}</div>`;

function conectar(s) {
  const kind = draft("conectar.kind", "PF");
  const p = person(s);
  return screen({
    header: appbar({ title: "Conectar conta Nexo", tone: "ink" }),
    body: `${stepper(1)}<div class="center-block"><img src="/img/btg-logo-navy.png" alt="BTG Pactual" class="logo-md"><h2>Use sua conta Nexo no Aval</h2><p class="muted">Pague, receba e financie serviços sem sair do Nexo. O Aval só faz o que você autorizar.</p></div>
      <h3>Qual conta?</h3>
      ${option({ title: "Conta pessoal", sub: `${p.name} · ${p.clientDoc}`, selected: kind === "PF", action: "chooseNexoAccount", data: { kind: "PF" } })}
      ${option({ title: "Nexo Empresas", sub: `${p.providerName} · ${p.providerDoc}`, selected: kind === "PJ", action: "chooseNexoAccount", data: { kind: "PJ" } })}
      ${note("Quem presta serviço recebe na conta PJ ou MEI; quem contrata paga pela conta pessoal. Dá para conectar as duas.", "info", "info")}`,
    footer: `${btn("Continuar", { action: "reviewConsent" })}${btn("Não tenho conta Nexo", { kind: "text", go: "#/sem-conta" })}`,
  });
}

function permissoes() {
  const shareLimit = draft("conectar.limit", true);
  const scope = ([label, detail, required]) =>
    `<div class="consent">${icon(required ? "check-circle" : "hand-coins")}<div><strong>${esc(label)}</strong><small>${esc(detail)}</small></div>${required ? chip("Obrigatório") : ""}</div>`;
  return screen({
    header: appbar({ title: "Permissões" }),
    body: `${stepper(2)}<h2 class="title">O Aval vai acessar</h2>
      ${card(CONSENT_SCOPES.filter(([, , r]) => r).map(scope).join(""))}
      ${card(`${scope(CONSENT_SCOPES[3])}${checkbox("Compartilhar meu limite pré-aprovado", { bind: "conectar.limit", checked: shareLimit })}`)}
      ${card(`${kv("Validade", "12 meses")}${kv("Você pode revogar", "a qualquer momento, em Perfil")}${kv("Base legal", "LGPD · consentimento")}`)}
      ${note("O Aval nunca vê sua senha e nunca move dinheiro sem sua confirmação.", "info", "lock-simple")}`,
    footer: btn("Autorizar", { action: "confirmConsent" }),
  });
}

function token() {
  return screen({
    header: appbar({ title: "Confirmar" }),
    body: `${stepper(3)}<div class="center-block">${circle("fingerprint", "info", 80)}<h2>Confirme com o token Nexo</h2><p class="muted">Use a biometria do celular ou o código do token no app Nexo.</p></div>
      <div class="token">${[4, 8, 1, 5, 9, 2].map((n) => `<span>${n}</span>`).join("")}</div>
      <p class="small muted center">Código válido por 30 segundos</p>`,
    footer: btn("Confirmar com biometria", { action: "authorizeConnect", iconName: "fingerprint" }),
  });
}

function conectado(s) {
  const nexo = account(s).nexo;
  const hasLimit = nexo.scopes.includes("Limite pré-aprovado");
  return screen({
    header: appbar({ title: "Conta conectada" }),
    body: `<div class="center-block">${circle("seal-check", "pos", 72)}<h2>Conta Nexo conectada</h2><p class="muted">${esc(nexo.label)}</p></div>
      ${card(timeline([["Pagar com saldo e Pix", "Liberado", "ok"], ["Crédito para contratar", hasLimit ? "Liberado" : "Sem limite compartilhado", hasLimit ? "ok" : "next"], ["Receber e antecipar", "Liberado", "ok"]]))}`,
    footer: `${btn("Ir para o início", { go: "#/inicio" })}${btn("Trazer dados de outros bancos", { kind: "text", go: "#/open-finance" })}`,
  });
}

function semConta() {
  return screen({
    header: appbar({ title: "Sem conta Nexo" }),
    body: `<div class="center-block">${circle("bank", "info", 64)}<h2>Você ainda pode usar o Aval</h2><p class="muted">Sem conta, você paga à vista com Pix de qualquer banco e o dinheiro continua protegido em custódia.</p></div>
      ${listCard("", `${row({ icon: "check-circle", title: "Custódia por etapa", detail: "Disponível", tone: "pos" })}${row({ icon: "x", title: "Crédito para contratar", detail: "Precisa de conta Nexo", tone: "neutral" })}${row({ icon: "x", title: "Antecipação de recebíveis", detail: "Precisa de conta Nexo", tone: "neutral" })}`)}
      ${card(`<strong>Abra sua conta em minutos</strong><small class="muted">Conta digital Nexo, sem tarifa. Documento e selfie.</small>${btn("Abrir conta Nexo", { kind: "secondary small", go: "#/cadastro" })}`, "soft")}`,
    footer: btn("Seguir só à vista", { kind: "secondary", action: "useCashOnly" }),
  });
}

function openFinance(s) {
  const acc = account(s);
  const banks = draft("of.banks", ["Itaú"]);
  if (acc.openFinance.status === "shared") {
    return screen({
      header: appbar({ title: "Open Finance", tone: "ink" }),
      body: `${card(`<div class="row-between"><strong>Compartilhamento ativo</strong>${chip("Ativo", "pos")}</div>${kv("Instituições", acc.openFinance.banks.join(", "))}${kv("Desde", acc.openFinance.since)}${kv("Validade", acc.openFinance.expires)}`)}
        ${note("Os dados entram na análise de crédito e ajudam a aprovar valores maiores.", "info", "chart-line-up")}`,
      footer: btn("Encerrar compartilhamento", { kind: "secondary", action: "revokeOpenFinance" }),
    });
  }
  return screen({
    header: appbar({ title: "Open Finance", tone: "ink" }),
    body: `<div class="center-block">${circle("arrows-left-right", "info", 64)}<h2>Traga dados de outros bancos</h2><p class="muted">Renda, saldo e histórico de pagamento ajudam o Nexo a aprovar mais crédito para seus serviços.</p></div>
      <h3>De quais instituições?</h3>
      <div class="choice-list wrap">${OPEN_FINANCE_BANKS.map((b) => `<button type="button" class="pill-option ${banks.includes(b) ? "on" : ""}" data-action="toggleBank" data-bank="${esc(b)}">${esc(b)}</button>`).join("")}</div>
      ${card(`${kv("Dados", "Cadastro, contas e operações de crédito")}${kv("Finalidade", "Análise de crédito no Aval")}${kv("Prazo", "12 meses, revogável")}`)}
      ${note("Você será levado ao app de cada banco para confirmar. O Nexo é regulado pelo Banco Central.", "info", "shield-check")}`,
    footer: btn("Compartilhar dados", { action: "confirmOpenFinance" }),
  });
}

function openFinanceOk(s) {
  const acc = account(s);
  return screen({
    header: appbar({ title: "Open Finance", tone: "ink" }),
    body: `<div class="center-block">${circle("chart-line-up", "pos", 72)}<h2>Dados recebidos</h2><p class="muted">${esc(acc.openFinance.banks.join(", "))}</p><div class="amount dark">${money(acc.preApprovedCents)}</div><p class="muted">é o seu novo pré-aprovado para serviços</p></div>`,
    footer: `${btn("Simular crédito", { go: "#/credito" })}${btn("Ver meus créditos", { kind: "text", go: "#/creditos" })}`,
  });
}

const accountLine = ({ name, sub, go, action, empty: isEmpty = false }) =>
  `<button type="button" class="bk-acct" ${actionAttrs({ go, action })}><span class="bk-avatar ${isEmpty ? "empty" : ""}">${isEmpty ? "" : esc(initialsOf(name))}</span><span><strong>${esc(name)}</strong>${sub ? `<small>${esc(sub)}</small>` : ""}</span>${go || action ? icon("caret-right") : ""}</button>`;

/** "Gestão de contas" from Nexo Banking: blue header with tiles, then grey-titled groups of accounts. */
function contas(s) {
  const acc = account(s);
  const p = person(s);
  const connected = isNexoConnected(s);
  const shared = acc.openFinance.status === "shared";
  const tiles = [
    connected ? ["Permissões", "key", { go: "#/conectar/permissoes" }] : ["Conectar conta", "plus", { go: "#/conectar" }],
    ["Open Finance", "arrows-left-right", { go: "#/open-finance" }], ["Meus créditos", "piggy-bank", { go: "#/creditos" }],
  ];
  return screen({
    cls: "bk-flat",
    header: `<header class="bk-page-head"><div class="bk-page-top"><span></span><button type="button" data-action="back" aria-label="Fechar">${icon("x")}</button></div>
      <h1>Gestão de contas</h1><p>Gerencie as contas conectadas ao Aval e os dados que você compartilha.</p>
      <div class="bk-head-tiles">${tiles.map(([label, ic, target]) => `<button type="button" class="bk-tile" ${actionAttrs(target)}>${icon(ic)}<span>${esc(label)}</span></button>`).join("")}</div></header>`,
    body: `<h3 class="bk-band">Minhas contas</h3>
      ${connected ? accountLine({ name: p.name, sub: acc.nexo.label }) : accountLine({ name: "Conta pessoal não conectada", sub: "Modo à vista", go: "#/conectar", empty: true })}
      ${accountLine({ name: p.providerName, sub: acc.pj?.label ?? "Nexo Empresas" })}
      <h3 class="bk-band">Compartilhadas com o Aval</h3>
      ${shared ? accountLine({ name: acc.openFinance.banks.join(", "), sub: "Open Finance · compartilhando para crédito", go: "#/open-finance" }) : accountLine({ name: "Nenhuma conta", sub: "Traga dados de outros bancos e aumente o limite", go: "#/open-finance", empty: true })}
      ${connected ? `<div class="bk-pad">${note("Ao desconectar, o crédito e a antecipação ficam indisponíveis. A custódia dos serviços em andamento continua.", "warn", "warning-circle")}</div>` : ""}`,
    footer: connected ? btn("Desconectar conta pessoal", { kind: "secondary", action: "disconnectNexo" }) : btn("Conectar conta Nexo", { go: "#/conectar" }),
  });
}

/** Nexo Banking home mock: Aval lives inside the bank's super app, reached from the strip and the banner. */
function nexoBanking(s) {
  const acc = account(s);
  const ids = new Set(myContracts(s).map((c) => c.id));
  const activity = s.ledger.filter((l) => ids.has(l.contractId)).slice(0, 3).map((l) => bkItem({
    icon: "shield-check", label: l.amountCents < 0 ? "Aval · liberação da custódia" : "Aval · entrada na custódia", title: l.label,
    value: `${l.amountCents < 0 ? "−" : "+"} ${money(Math.abs(l.amountCents))}`, go: "#/extrato",
  }));
  return screen({
    cls: "bk", dark: true,
    body: `${bkHeader(s, {
      tabs: false, title: "Conta corrente", label: "Saldo atual", cents: acc?.balanceCents ?? 0, sub: "Você usou 0 de 10 dias sem juros no limite.",
      lines: [["Limite Aval para serviços", shown(s, availableLimitCents(s)), "#/financeiro"], ["Saldo Open Finance", acc?.openFinance.status === "shared" ? "Ver bancos" : "Conectar", "#/open-finance"]],
      cta: { label: "Ir para extrato", go: "#/extrato" },
    })}
      ${bkStrip([["Pix e transferir", "qr-code", "#/nexo"], ["Nexo Serviços", "storefront", "#/inicio"], ["Pagar", "receipt", "#/nexo"], ["Cartões", "credit-card", "#/nexo"]])}
      ${bkBanner({ text: "Precisa de um eletricista, pintor ou reforma? Encontre prestadores verificados no Nexo Serviços, com o dinheiro protegido pelo Aval.", cta: "Abrir Nexo Serviços", art: "storefront", go: "#/inicio" })}
      ${bkSection("Atividades", activity, { aside: `<span class="bk-day">${todayLabel()}</span>`, empty: "Nenhuma atividade hoje." })}`,
  });
}

export const accountRoutes = {
  conectar, "conectar/permissoes": permissoes, "conectar/token": token, "conectar/ok": conectado, "sem-conta": semConta,
  "open-finance": openFinance, "open-finance/ok": openFinanceOk, contas, nexo: nexoBanking,
};
