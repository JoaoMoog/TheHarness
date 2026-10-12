import { hasLocalAccount } from "../local-auth.js";
import { account, canSee, contractById, draft, isBtgConnected, myNotifications, person, setDraft } from "../store.js";
import {
  actionAttrs, appbar, btgBrand, btn, milestoneRows, busyNote, card, checkbox, chip, circle, empty, esc, field, icon, kv, money, note, percent, row, screen, signal, timeline,
} from "../ui.js";
import { bkFacts } from "./btg-kit.js";


function entrada(s) {
  const registered = hasLocalAccount();
  return screen({ cls: "bk-login", dark: true,
    body: `<img src="/img/btg-logo-white.png" class="bk-login-logo" alt="Aval">
      <div class="bk-login-copy"><h1>Pague o que combinou.</h1><p>Combine o serviço, acompanhe a entrega e confira as condições de liberação.</p>
      <button type="button" class="bk-white" data-go="${registered ? '#/biometria' : '#/cadastro'}">${registered ? 'Entrar na minha conta' : 'Criar conta neste aparelho'}</button>
      <p class="small">Pagamentos simulados. Sua conta e seus combinados ficam neste aparelho.</p>${btn("Conhecer o Aval", { action: "openOnboarding", kind: "text light" })}</div>`,
  });
}

const pinField = (label, key, autocomplete) => `<label class="field"><span>${label}</span><input type="password" inputmode="numeric" maxlength="6" minlength="6" autocomplete="${autocomplete}" data-local="${key}" placeholder="6 números"></label>`;
function biometria() {
  if (!hasLocalAccount()) return cadastro();
  return screen({ header: appbar({ title: "Entrar na minha conta" }),
    body: `<h2>Seu código de acesso</h2><p>Use o código de 6 números criado neste aparelho.</p>${pinField('Código de acesso', 'login.pin', 'current-password')}
      <details><summary>Esqueci meu código</summary><p>Não há recuperação por e-mail. Esta versão guarda a conta somente neste aparelho. Não limpe os dados do aplicativo: isso apaga também seus combinados.</p></details>`,
    footer: `${btn("Entrar", { action: "localLogin" })}${btn("Voltar", { kind: "text", go: "#/entrada" })}`,
  });
}
function cadastro() {
  if (hasLocalAccount()) return biometria();
  return screen({ header: appbar({ title: "Criar conta local" }),
    body: `<h2>Como podemos chamar você?</h2>${field('Seu nome', { bind: 'signup.name', value: draft('signup.name', ''), placeholder: 'Nome e sobrenome' })}
      ${pinField('Crie um código de acesso', 'signup.pin', 'new-password')}${pinField('Repita o código', 'signup.confirm', 'new-password')}
      ${note('Este aplicativo simula pagamentos. Não conectamos bancos, não cobramos e não movimentamos dinheiro.')}
      <p class="small muted">Sua conta fica somente neste aparelho. Reinstalar o aplicativo ou limpar seus dados apaga a conta e os combinados. O código não é uma senha bancária.</p>`,
    footer: btn('Criar minha conta', { action: 'localSignup' }),
  });
}
const cadastroDados = cadastro;

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
    body: `<section class="bk-profile"><span class="bk-avatar lg">${esc(p.initials)}</span><div><h2>${esc(p.name)}</h2><small>${esc(p.activity)} · ${isBtgConnected(s) ? "Conta simulada" : "Sem conta BTG"}</small></div></section>
      ${bkFacts([["Quando contrata", `${p.clientName} · ${p.clientDoc}`], ["Quando presta", `${p.providerName} · ${p.providerDoc}`]])}
      <h3 class="bk-settings-title">Conta e dinheiro</h3>
      ${setting("Gestão de contas", { detail: isBtgConnected(s) ? acc.btg.label : "Conectar conta BTG", go: "#/no-app-btg/conta" })}${setting("Open Finance", { detail: acc.openFinance.status === "shared" ? acc.openFinance.banks.join(", ") : "Traga dados de outros bancos", go: "#/no-app-btg/open-finance" })}${setting("Empréstimos dos pagamentos", { detail: "Contratos e parcelas", go: "#/creditos" })}
      <h3 class="bk-settings-title">Configurações</h3>
      ${setting("Segurança", { detail: "Biometria, token e aparelhos" })}${setting("Arbitragem e disputas", { detail: "Cláusula compromissória aceita", go: "#/arbitragem" })}${setting("Avisos dos pagamentos", { detail: s.ui.prompts?.[s.session.person] === "on" ? "Ligados: só quando o dinheiro mexer" : "Desligados", action: "toggleNotify" })}${setting("Notificações", { go: "#/avisos" })}
      <h3 class="bk-settings-title">Precisa de ajuda?</h3>
      ${setting("Baixar meus dados", { detail: "Exportação ainda indisponível", action: "downloadData" })}
      <div class="bk-menu-foot"><button type="button" class="bk-primary" data-action="logout">Sair da conta${icon("sign-out")}</button><small>Aval 1.1.0 · validação</small></div>`,
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

