// Protected payment screens: write down what was agreed, send it (app, WhatsApp, QR), open the link, check and accept,
// pay together, and the list of payments on the home.
import { UNDO_MS, agreementDraft, chargeableStages, otherPeople } from "../actions/index.js";
import { brToIso, daysBetween, toIso } from "../domain/dates.js";
import { yieldCents } from "../domain/offers.js";
import { TEMPLATES, roleOf, securityCode, timelineOf } from "../domain/protected.js";
import { SELF, canSee, contractById, draft, mySplitInvites, myNames, now, parseDdMm } from "../store.js";
import { appbar, btn, card, checkbox, circle, empty, esc, field, icon, kv, milestoneRows, money, note, option, row, screen, timeline } from "../ui.js";
import { bkItem, bkSection } from "./btg-kit.js";
import { splitEditor } from "./split.js";
import { switchRow } from "./confirm.js";
import { RECIPIENT_KINDS, recipientChannels, recipientLabel } from "../domain/charge-recipient.js";

const LINK_HOST = "aval.invalid/p/";
const stepBar = (n, total = 3) => `<div class="steps">${Array.from({ length: total }, (_, i) => `<span class="${i < n ? "on" : ""}"></span>`).join("")}</div>`;
/** A charge starts with its payer; both paths show three steps. */
const isCharge = () => draft("ag.from") === "provider";
const titleFor = () => (draft("ag.from") === "provider" ? "Cobrar" : "Pagar");
const RELEASE_LABEL = { single: "Valor único", stages: "Por marcos" };
const PROTECTION = [
  ["lock-simple", "Fica guardado no banco"],
  ["check-circle", "Sai quando quem paga aprova"],
  ["clock", "Após 7 dias da entrega sem resposta, libera automaticamente"],
];
const protectionCard = () => card(`<strong>Como o Aval funciona</strong>${PROTECTION.map(([ic, t]) => `<div class="protect-line">${circle(ic, "info", 32)}<strong>${esc(t)}</strong></div>`).join("")}`);

/** The description, typed by the person, with an AI button that improves it. */
const descriptionField = () => `<label class="field ai-field"><span>${isCharge() ? "Descrição da cobrança" : "Descrição do serviço"}</span><div class="ai-wrap">
  <textarea data-bind="ag.description" rows="3" placeholder="Ex.: pintar a sala e o quarto">${esc(draft("ag.description", ""))}</textarea>
  <button type="button" class="ai-btn" data-action="improveDescription" aria-label="Melhorar a descrição com IA" title="Melhorar com IA">${icon("sparkle")}</button></div></label>`;

/** The service address by CEP: the search fills street, district, city and state; the person types the number. */
function addressFields() {
  const value = (k) => draft(`ag.${k}`, "");
  const cep = `<div class="cep-row">${field("CEP", { bind: "ag.cep", value: value("cep"), inputmode: "numeric", placeholder: "00000-000" })}${btn("Buscar", { kind: "secondary small", action: "lookupCep", iconName: "magnifying-glass" })}</div>`;
  if (!draft("ag.addressOpen") && !value("street")) return `${cep}<button type="button" class="link-btn" data-action="openAddress">Não sei o CEP</button>`;
  const pair = (a, b) => `<div class="field-row">${a}${b}</div>`;
  return `${cep}${field("Rua", { bind: "ag.street", value: value("street") })}
    ${pair(field("Número", { bind: "ag.number", value: value("number"), inputmode: "numeric" }), field("Complemento", { bind: "ag.complement", value: value("complement"), placeholder: "Apto, bloco" }))}
    ${field("Bairro", { bind: "ag.district", value: value("district") })}
    ${pair(field("Cidade", { bind: "ag.city", value: value("city") }), field("UF", { bind: "ag.uf", value: value("uf") }))}`;
}

function combinado1() {
  const provider = isCharge();
  if (provider && !draft("ag.payer")) return chargeRecipientScreen();
  return screen({
    header: appbar({ title: titleFor() }),
    body: `${stepBar(provider ? 2 : 1)}${provider ? payerCard() : card(row({ icon: "qr-code", title: "Ler QR do prestador", detail: "Recebeu a cobrança por QR? O combinado já vem preenchido.", go: "#/ler-qr" }))}<h2 class="title">${provider ? "Dados da cobrança" : "O que vocês combinaram?"}</h2>
      ${draft("ag.improved") ? `<div class="ai-done">${icon("sparkle")}<span>Melhorado pela IA.</span><button type="button" data-action="undoImprove">Desfazer</button></div>` : ""}
      ${card(`${descriptionField()}${field(provider ? "Valor da cobrança (R$)" : "Valor combinado (R$)", { bind: "ag.total", value: draft("ag.total", ""), inputmode: "decimal" })}${field("Prazo de entrega", { bind: "ag.dueIso", type: "date", value: draft("ag.dueIso", brToIso(draft("ag.dueDate", ""))), min: toIso(now()) })}`)}
      <h3 class="form-title">Endereço do serviço</h3>${card(addressFields(), "address-card")}
      ${provider ? card(switchRow({ ic: "calendar-blank", title: "Repetir todo mês", on: Boolean(draft("ag.repeat")), kind: "repeat", off: "toggleRepeat" })) : ""}`,
    footer: btn("Continuar", { action: "agreementNext", data: { step: 1 } }),
  });
}

function combinado2() {
  const ag = agreementDraft();
  const pills = Object.entries(TEMPLATES).filter(([k]) => k !== "unica")
    .map(([k, [label]]) => `<button type="button" class="pill-option ${ag.template === k ? "on" : ""}" data-action="chooseAgTemplate" data-key="${k}">${esc(label)}</button>`).join("");
  return screen({
    header: appbar({ title: titleFor() }),
    body: `${stepBar(2)}<h2 class="title">Como o dinheiro é liberado?</h2>
      ${card(`<div class="row-gap">${circle("sparkle", "info", 32)}<strong>Não sabe como dividir?</strong></div>${btn(ag.custom ? "Ajustar com o assistente" : "Montar com o assistente", { kind: "secondary", action: "openStages", data: { key: "novo" }, iconName: "sparkle" })}`, "ai-card")}
      ${option({ title: "Valor único", sub: "Sai tudo no fim", selected: !ag.custom && ag.release === "single", action: "chooseRelease", data: { release: "single" } })}
      ${option({ title: "Por marcos", sub: "Sai a cada marco aprovado", selected: !ag.custom && ag.release === "stages", action: "chooseRelease", data: { release: "stages" } })}
      ${!ag.custom && ag.release === "stages" ? `<h3>Modelo de marcos</h3><div class="choice-list wrap">${pills}</div>` : ""}
      ${ag.custom ? note("Marcos montados com o assistente.", "pos", "sparkle") : ""}
      ${card(`${milestoneRows(ag.stages, { single: ag.release === "single" })}${kv("Total", money(ag.totalCents ?? 0))}`)}
      ${protectionCard()}`,
    footer: btn("Continuar", { action: "agreementNext", data: { step: 2 } }),
  });
}

function combinado3(s) {
  const ag = agreementDraft();
  if (ag.from === "provider" && !draft("ag.payer")) return chargeRecipientScreen(s);
  const channel = draft("ag.channel", "app");
  const chosen = draft("ag.person");
  const people = otherPeople(s).map((p) => option({ title: ag.from === "provider" ? p.clientName : p.providerName, sub: p.phone, selected: chosen === p.id, action: "chooseAgPerson", data: { id: p.id } })).join("");
  const payer = draft("ag.payer");
  const channels = (ag.from === "provider" ? [
    ["app", "No app", "Aviso neste ambiente de teste"],
    ["whatsapp", "Link no WhatsApp", "Mensagem de teste com o link"],
    ["email", "Link por e-mail", "Mensagem de teste com o link"],
    ["link", "Link de cobrança", "Copie e compartilhe o link de teste"],
    ["qr", "QR code", "Leitura na hora"],
  ].filter(([key]) => recipientChannels(payer, Boolean(payer?.personId)).includes(key)) : [
    ["app", "No app", "Aviso no app"],
    ["whatsapp", "Link no WhatsApp", "Mensagem com o link"],
    ["qr", "QR code", "Leitura na hora"],
  ]);
  const detail = ag.from === "provider" ? payerCard() : channel === "app" ? `<h3>Quem recebe</h3>${people}`
    : channel === "whatsapp" ? card(field("Celular com DDD", { bind: "ag.contact", value: draft("ag.contact", ""), inputmode: "tel", placeholder: "(11) 99999-9999" }))
      : note("Depois de enviar, mostre o QR.", "info", "qr-code");
  return screen({
    header: appbar({ title: titleFor() }),
    body: `${stepBar(3)}<h2 class="title">${ag.from === "provider" ? "Como compartilhar?" : "Como enviar?"}</h2>
      ${channels.map(([k, t, d]) => option({ title: t, sub: d, selected: channel === k, action: "chooseChannel", data: { channel: k } })).join("")}
      ${detail}
      ${ag.from === "provider" ? proposalCard(ag) : ""}
      ${card(`<small class="muted">${esc(ag.release ? RELEASE_LABEL[ag.release] : ag.proposal ? "Marcos sugeridos · quem paga decide" : "Marcos: quem paga define")} · até ${esc(ag.dueDate)}</small><h3>${esc(ag.description)}</h3><div class="amount dark">${money(ag.totalCents ?? 0)}</div><small class="muted">${esc(ag.address)}</small>`)}`,
    footer: btn(`${ag.from === "provider" ? "Enviar cobrança" : "Enviar combinado"} de ${money(ag.totalCents ?? 0)}`, { action: "sendAgreement", iconName: "paper-plane-tilt" }),
  });
}

function payerCard() {
  const payer = draft("ag.payer");
  if (!payer) return "";
  return card(`<strong>Quem vai pagar</strong>${payer.name ? `<p>${esc(payer.name)}</p>` : ""}${kv(recipientLabel(payer), payer.contact)}
    ${btn("Alterar", { kind: "text", go: "#/cobrar/destinatario" })}`);
}

function chargeRecipientScreen(s) {
  if (!isCharge()) return screen({ header: appbar({ title: "Cobrar" }), body: empty("Comece uma nova cobrança."), footer: btn("Nova cobrança", { action: "newCharge" }) });
  const kind = draft("ag.recipientKind", "phone");
  const options = Object.entries(RECIPIENT_KINDS).map(([key, label]) => `<button type="button" class="pill-option ${key === kind ? "on" : ""}" data-action="chooseChargeIdentifier" data-kind="${key}" aria-pressed="${key === kind}">${esc(label)}</button>`).join("");
  const help = kind === "phone" ? "Informe o número com DDD." : kind === "document" ? "Informe o CPF ou CNPJ, com ou sem pontuação." : "Informe o e-mail de quem vai pagar.";
  const placeholder = kind === "phone" ? "(11) 99999-9999" : kind === "document" ? "CPF ou CNPJ" : "nome@exemplo.com";
  return screen({
    header: appbar({ title: "Cobrar", close: "#/inicio" }),
    body: `${stepBar(1)}<h2 class="title">Quem você vai cobrar?</h2><p>Identifique quem vai pagar antes de preencher a cobrança.</p>
      ${card(`<div class="choice-list wrap" role="group" aria-label="Tipo de identificação">${options}</div>
        ${field(RECIPIENT_KINDS[kind], { bind: "ag.recipientInput", value: draft("ag.recipientInput", ""), placeholder, inputmode: kind === "phone" ? "tel" : kind === "email" ? "email" : "text" })}<small class="muted">${help}</small>`)}
      ${note("Esta identificação será mantida até a revisão da cobrança. Nenhuma mensagem será enviada nesta simulação.", "info", "user")}
      ${chargeableStages(s).length ? btn("Ver marcos a cobrar", { kind: "text", go: "#/cobrar" }) : ""}`,
    footer: btn("Continuar", { action: "chargeRecipientNext" }),
  });
}

/** Whoever charges may suggest the stages (material up front, for example); the payer sees it and decides. */
function proposalCard(ag) {
  const list = ag.proposal ? milestoneRows(ag.proposal.stages) : "";
  return card(`<div class="row-gap">${circle("sparkle", "info", 32)}<strong>${ag.proposal ? "Sua sugestão de marcos" : "Sugerir marcos (opcional)"}</strong></div>${list}
    ${btn(ag.proposal ? "Alterar a sugestão" : "Sugerir com o assistente", { kind: ag.proposal ? "text" : "secondary", action: "openStages", data: { key: "novo" }, iconName: "sparkle" })}`, "ai-card");
}

/** The code that proves the link came from the BTG: it also shows in the BTG app, and the BTG never asks for it. */
const codeCard = (inv) => card(`<div class="row-gap">${circle("shield-check", "pos", 32)}<strong>Código de segurança ${esc(securityCode(inv.token))}</strong></div>
  <p class="small muted">O mesmo código aparece em Avisos no app Aval. Se não aparecer, não pague. O BTG nunca pede senha ou código por mensagem.</p>`, "code-card");

const creatorName = (inv) => (inv.from === "provider" ? inv.provider : inv.client);
const verb = (inv) => (inv.from === "provider" ? "cobra" : "quer pagar");

function combinadoEnviado(s, { id }) {
  const inv = s.invites.find((i) => i.id === id);
  if (!inv) return screen({ header: appbar({ title: "Enviado" }), body: empty("Pagamento não encontrado.") });
  if (inv.status === "cancelled") return screen({ header: appbar({ title: inv.from === "provider" ? "Cobrança cancelada" : "Combinado cancelado" }), body: note("Convite cancelado antes do pagamento. Nenhum valor foi cobrado."), footer: btn("Ir para o início", { go: "#/inicio" }) });
  const other = inv.from === "provider" ? inv.client : inv.provider;
  const message = `${creatorName(inv)} ${verb(inv)} ${money(inv.totalCents)} com Aval: ${inv.title}. Confira e aceite: ${LINK_HOST}${inv.token} · Código de segurança ${securityCode(inv.token)}, o mesmo que aparece no app do BTG.`;
  const identified = inv.recipient ? card(`<strong>Quem vai pagar</strong>${inv.client ? `<p>${esc(inv.client)}</p>` : ""}${kv(recipientLabel(inv.recipient), inv.recipient.contact)}`) : "";
  const body = inv.channel === "qr"
    ? `<div class="center-block"><div class="qr big">${icon("qr-code")}</div><h2>Mostre este QR</h2><p class="muted">${esc(inv.title)} · ${money(inv.totalCents)}</p></div>`
    : ["whatsapp", "email", "link"].includes(inv.channel)
      ? `<div class="center-block">${circle("link", "pos", 64)}<h2>${inv.channel === "link" ? "Link de teste criado" : "Mensagem de teste preparada"}</h2><p>${inv.channel === "link" ? "Compartilhamento simulado. Nenhuma mensagem foi enviada." : `Nenhuma mensagem foi enviada ${inv.channel === "email" ? "por e-mail" : "ao WhatsApp"}.`}</p></div><div class="wa-bubble"><p>${esc(message)}</p><small>${esc(inv.contact)}</small></div>`
      : `<div class="center-block">${circle("bell", "info", 64)}<h2>Enviado para ${esc(other ?? "")}</h2><p class="muted">Aviso criado neste ambiente de teste. Nenhum dinheiro foi movimentado.</p></div>`;
  const opener = "Simular a resposta da outra pessoa";
  const copyLink = inv.channel === "link" ? btn("Copiar link de teste", { kind: "secondary", action: "copied", data: { text: `${LINK_HOST}${inv.token}` }, iconName: "link" }) : "";
  const open = inv.status === "sent" ? btn(opener, { action: "openAgreementLink", data: { token: inv.token }, iconName: "link" }) : "";
  const undo = inv.status === "sent" && Date.now() - (inv.sentAtMs ?? 0) < UNDO_MS
    ? `<div class="undo-bar" role="status"><span>Enviado.</span><button type="button" data-action="undoAgreement" data-token="${esc(inv.token)}">Desfazer</button></div>`
    : inv.status === "sent" ? btn(inv.from === "provider" ? "Cancelar cobrança" : "Cancelar combinado", { kind: "text", action: "cancelAgreement", data: { token: inv.token } }) : "";
  return screen({
    header: appbar({ title: "Enviado", close: "#/inicio" }),
    body: `${identified}${body}`,
    footer: `${undo}${copyLink}${open}${btn("Ir para o início", { kind: "text", go: "#/inicio" })}`,
  });
}

const agreementFacts = (inv, privateData = true) => card(`<small class="muted">${esc(creatorName(inv))} ${verb(inv)}</small><h3>${esc(inv.title)}</h3><div class="amount dark">${money(inv.totalCents)}</div>
  <p class="small">${esc(inv.description)}</p>${kv("Prazo de entrega", inv.dueDate)}${privateData ? kv("Endereço", inv.address) : ""}${kv("Liberação", inv.release ? RELEASE_LABEL[inv.release] : "Quem paga define")}
  ${inv.release === "stages" ? milestoneRows(inv.stages, { due: true }) : ""}`);

/** Whoever pays a charge defines how the money is released, with the assistant's suggestion. */
function stagesChoice(s, token) {
  const chosen = s.ui.drafts.stg?.[token]?.chosen;
  const inv = s.invites.find((i) => i.token === token);
  const suggested = !chosen && inv?.proposal ? `<small class="muted">Sugestão de ${esc(inv.provider)}</small>${milestoneRows(inv.proposal.stages)}` : "";
  const list = chosen ? milestoneRows(chosen.stages, { single: chosen.release === "single" }) : "";
  return card(`<div class="row-gap">${circle("sparkle", "info", 32)}<strong>Como o dinheiro é liberado</strong></div>${list}${suggested}
    ${option({ title: "Valor único", sub: "Uma entrega ao final", selected: chosen?.release === "single", action: "chooseManualStages", data: { token, release: "single" } })}
    ${Object.entries(TEMPLATES).filter(([key]) => key !== "unica").map(([key, [label]]) => option({ title: label, sub: "Modelo de etapas", selected: chosen?.release === "stages" && chosen.stages[0]?.name === TEMPLATES[key][1][0][0], action: "chooseManualStages", data: { token, release: "stages", template: key } })).join("")}
    ${btn(chosen ? "Alterar com o assistente" : "Definir com o assistente", { kind: chosen ? "text" : "secondary", action: "openStages", data: { key: token }, iconName: "sparkle" })}`, "ai-card");
}

/** Cobrar: a new charge to anyone, or the release of a stage of a service in progress. */
function cobrar(s) {
  const stages = chargeableStages(s).map(({ c, st, i }) => option({ title: `${c.title} · ${c.stages.length > 1 ? `marco ${i + 1}` : "entrega"}`, sub: `${st.name} · ${c.client} · pede a liberação`, value: money(st.valueCents), action: "chargeStage", data: { id: c.id, stage: i } })).join("");
  return screen({
    header: appbar({ title: "Cobrar" }),
    body: `<h2 class="title">O que você quer cobrar?</h2>
      ${option({ title: "Nova cobrança", sub: "Descreva o que está cobrando e informe o valor", action: "newCharge" })}
      <h3>Marco de um serviço em andamento</h3>${stages}
      ${note("Cobrar um marco envia a entrega para quem paga aprovar. O dinheiro dela já está guardado.", "info", "lock-simple")}`,
  });
}

/** The page behind the WhatsApp link, the QR or the app notice: check what was agreed and accept. */
function linkPage(s, { token }) {
  const inv = s.invites.find((i) => i.token === token);
  if (!inv) return screen({ header: appbar({ title: "Pagamento Aval" }), body: empty("Este link não existe mais.") });
  if (["cancelled", "canceled"].includes(inv.status)) return screen({ header: appbar({ title: inv.from === "provider" ? "Cobrança cancelada" : "Combinado cancelado" }), body: note("Este convite foi cancelado antes do pagamento. Nenhum valor foi cobrado por este convite.", "info"), footer: btn("Voltar ao início", { go: "#/inicio" }) });
  const signedIn = s.session.loggedIn && (s.session.person !== SELF || Boolean(s.people?.[SELF]));
  if (!signedIn) {
    return screen({
      header: appbar({ title: "Pagamento Aval" }),
      body: `${agreementFacts(inv, false)}${inv.channel === "app" ? "" : codeCard(inv)}${protectionCard()}${note("Entre com a conta BTG para pagar.", "info", "bank")}`,
      footer: btn("Entrar com a conta BTG", { action: "enterBtgForLink", data: { token }, iconName: "bank" }),
    });
  }
  const done = inv.contractId ? contractById(s, inv.contractId) : null;
  let footer = "";
  let status = "";
  if (inv.status === "declined") status = note("Este pagamento foi recusado.", "neutral", "x");
  else if (done) {
    status = note("Combinado aceito.", "pos", "check-circle");
    footer = btn("Ver pagamento", { go: done.status === "awaitingPayment" && roleOf(done, myNames(s)) === "payer" ? `#/pagar/${done.id}` : `#/servico/${done.id}` });
  } else if (inv.createdBy === s.session.person) status = note("Aguardando a outra pessoa conferir e aceitar.", "info", "clock");
  else {
    status = `${inv.from === "provider" ? stagesChoice(s, token) : ""}${checkbox(inv.from === "provider" ? "Conferi a cobrança: descrição, valor, prazo e as regras do Aval." : "Confiro o combinado: valor, prazo, marcos e as regras do Aval.", { bind: "ag.accept", checked: draft("ag.accept") })}${arbitrationConsent()}`;
    footer = `${btn(inv.from === "provider" ? "Aceitar e pagar" : "Aceitar combinado", { action: "acceptAgreement", data: { token } })}${btn("Recusar", { kind: "text", action: "declineAgreement", data: { token } })}`;
  }
  return screen({ header: appbar({ title: "Pagamento Aval" }), body: `${agreementFacts(inv)}${protectionCard()}${status}`, footer });
}

/** The arbitration clause gets its own box and its own consent, apart from the agreement. */
const arbitrationConsent = () => card(`<strong>Cláusula de arbitragem</strong><p class="small muted">Se a mediação do BTG não resolver, um árbitro decide no lugar da Justiça, em semanas. A decisão vale para os dois lados.</p>${btn("Ler a cláusula", { kind: "text", go: "#/arbitragem", iconName: "gavel" })}${checkbox("Li e aceito a cláusula de arbitragem.", { bind: "ag.arbitration", checked: draft("ag.arbitration") })}`);

function lerQr() {
  return screen({
    header: appbar({ title: "Ler QR" }),
    body: `<div class="qr-camera">${icon("qr-code")}</div><p class="center muted">Aponte a câmera para o QR que a outra pessoa mostra.</p>`,
    footer: btn("Ler o QR", { action: "scanQr", iconName: "qr-code" }),
  });
}

function dividirPagamento(s, { id }) {
  const c = contractById(s, id);
  if (!canSee(c, s) || c.kind === "collective") return screen({ header: appbar({ title: "Pagar em conjunto" }), body: empty("Este pagamento já não pode ser dividido.") });
  return screen({
    header: appbar({ title: "Pagar em conjunto" }),
    body: `${card(`<small class="muted">${esc(c.provider)}</small><h3>${esc(c.title)}</h3><div class="amount dark">${money(c.totalCents)}</div>`)}
      ${splitEditor(s)}
      ${note("Começa quando todos pagarem.", "info", "users-three")}`,
    footer: btn("Enviar convites", { action: "confirmSplitPayment", data: { id }, iconName: "paper-plane-tilt" }),
  });
}

const TIMELINE_STATE = { done: "ok", current: "now", next: "", alert: "now alert" };
/** The timeline of a payment: agreed, paid and guarded, each stage, the end. */
export function timelineCard(s, c) {
  const steps = timelineOf(c, now(s)).map((st) => [st.label, st.detail, TIMELINE_STATE[st.state]]);
  return card(`<strong>Linha do tempo</strong>${timeline(steps)}`);
}

/** One contextual bank offer inside the flow: what it is, the condition already priced, and one button. */
export const offerCard = ({ ic, title, text, cta = "", go, action, data, tone = "info" }) =>
  `<section class="offer-card ${tone}">${circle(ic, tone, 40)}<div><strong>${esc(title)}</strong><small>${esc(text)}</small>${cta ? btn(cta, { kind: "secondary small", go, action, data }) : ""}</div></section>`;

/** On the first day there is nothing yet: what the money should yield until the last delivery date. */
function projectedYield(s, c) {
  const end = c.stages.at(-1)?.due;
  const days = end ? Math.max(0, daysBetween(now(s), parseDdMm(end))) : 0;
  const cents = yieldCents(c.paidInCents, days, c.yield.rate);
  return cents > 0 ? `Começa a render hoje, a 100% do CDI: cerca de ${money(cents)} até ${end}. Volta para você no fim.` : "Rende 100% do CDI enquanto está guardado. Volta para você no fim.";
}

/** The yield of the guarded money, shown to whoever pays. */
export function yieldCard(s, c) {
  if (!c.yield) return "";
  const days = Math.max(0, daysBetween(parseDdMm(c.yield.since), now(s)));
  const cents = c.yield.paidCents ?? yieldCents(c.paidInCents, days, c.yield.rate);
  const text = c.yield.paidCents != null ? `${money(cents)} creditados na sua conta em ${c.yield.paidAt}.` : cents > 0 ? `Rende 100% do CDI enquanto está guardado: ${money(cents)} até hoje. Volta para você no fim.` : projectedYield(s, c);
  return offerCard({ ic: "chart-line-up", title: "Seu dinheiro guardado rende", text, tone: "pos" });
}

/** What the person has to do now: pay, approve, deliver, or just follow. */
function nextStep(c, role) {
  if (c.completionReason === "cancelled") return ["Cancelado", ""];
  if (c.cancellation?.status === "pending") return ["Cancelamento solicitado", "warn"];
  const paying = role !== "payee";
  const idx = c.stages.findIndex((st) => !["released", "split"].includes(st.status));
  const st = c.stages[idx];
  if (c.status === "completed") return ["Concluído", "pos"];
  if (c.status === "awaitingPayment") return paying ? ["Pagar", "warn"] : ["Aguardando o pagamento", ""];
  if (c.status === "funding") return ["Pagamento em grupo", "warn"];
  if (st?.status === "awaitingApproval") return paying ? ["Aprovar entrega", "warn"] : ["Aguardando aprovação", ""];
  if (st?.status === "disputed") return ["Em disputa", "neg"];
  if (!paying && ["inProgress", "adjustRequested"].includes(st?.status)) return [`Entregar ${c.stages.length > 1 ? `marco ${idx + 1}` : "o serviço"}`, "warn"];
  return ["Guardado", "pos"];
}

function contractItem(s, c) {
  const role = roleOf(c, myNames(s));
  const [label, tone] = nextStep(c, role);
  const other = role === "payee" ? c.client : c.provider;
  const go = c.status === "awaitingPayment" && role === "payer" ? `#/pagar/${c.id}` : c.kind === "collective" && role !== "payee" ? `#/coletivo/${c.id}` : `#/servico/${c.id}`;
  const text = `${c.title} ${other} ${label} ${c.id} ${money(c.totalCents)}`;
  return { done: c.status === "completed", paying: role !== "payee", text, html: bkItem({ icon: role === "payee" ? "hand-coins" : "wallet", label, tone, title: c.title, value: money(c.totalCents), extra: `<small>${esc(other)}</small>`, go }) };
}

function inviteItem(s, inv) {
  const mine = inv.createdBy === s.session.person;
  const paying = inv.from === "provider" ? !mine : mine;
  const closed = ["cancelled", "declined"].includes(inv.status);
  const label = closed ? (inv.from === "provider" ? (inv.status === "cancelled" ? "Cobrança cancelada" : "Cobrança recusada") : (inv.status === "cancelled" ? "Combinado cancelado" : "Combinado recusado")) : mine ? "Aguardando aceite" : inv.from === "provider" ? "Cobrança para conferir" : "Combinado para conferir";
  const other = mine ? (inv.from === "provider" ? inv.client : inv.provider) ?? (inv.channel === "qr" ? "QR code" : inv.contact) : creatorName(inv);
  return { done: closed, paying, text: `${inv.title} ${other} ${label} ${money(inv.totalCents)}`, html: bkItem({ icon: "seal-check", label, tone: mine ? "" : "warn", title: inv.title, value: money(inv.totalCents), extra: `<small>${esc(other)}</small>`, go: closed ? `#/p/${inv.token}` : mine ? `#/combinado/enviado/${inv.id}` : `#/p/${inv.token}` }) };
}

/** Every payment the person takes part in, marked as to pay, to receive or done. */
/** Every payment of the person (charges and payments to check, invitations to split, services); also searched. */
export function paymentItems(s) {
  const names = myNames(s);
  const invites = s.invites.filter((i) => i.protected && ["sent", "cancelled", "declined"].includes(i.status) && (i.createdBy === s.session.person || names.has(i.client) || names.has(i.provider)));
  const splits = mySplitInvites(s).map(({ holder, participant }) => ({ done: false, paying: true, text: `${holder.title} ${holder.client} dividir ${money(participant.shareCents)}`, html: bkItem({ icon: "users-three", label: "Convite para dividir", tone: "warn", title: holder.title, value: money(participant.shareCents), extra: `<small>${esc(holder.client)}</small>`, go: `#/dividir/${participant.token}` }) }));
  return [...invites.map((i) => inviteItem(s, i)), ...splits, ...s.contracts.filter((c) => canSee(c, s)).map((c) => contractItem(s, c))];
}

/** "A pagar", "A receber" and "Concluídos", with the list of the chosen one. */
export function paymentsSection(s) {
  const all = paymentItems(s);
  const open = all.filter((x) => !x.done);
  const tab = draft(`home.tab.${s.session.person}`) ?? (open.some((x) => x.paying) || !open.length ? "pay" : "receive");
  const list = all.filter((x) => (tab === "done" ? x.done : !x.done && (tab === "pay" ? x.paying : !x.paying)));
  const count = (pred) => all.filter(pred).length;
  const tabs = [["pay", "A pagar", count((x) => !x.done && x.paying)], ["receive", "A receber", count((x) => !x.done && !x.paying)], ["done", "Histórico", count((x) => x.done)]];
  const seg = `<div class="seg wide pay-tabs">${tabs.map(([k, l, n]) => `<button type="button" class="${tab === k ? "on" : ""}" data-action="setPaymentsTab" data-tab="${k}">${l}${n ? ` <span class="bk-count">${n}</span>` : ""}</button>`).join("")}</div>`;
  return `${seg}${bkSection("Pagamentos", list.map((x) => x.html), { empty: tab === "done" ? "Nada concluído ainda." : "Nada por aqui. Use Cobrar ou Pagar para começar." })}`;
}

export const protectedRoutes = {
  "cobrar/destinatario": chargeRecipientScreen,
  "combinado/1": combinado1, "combinado/2": combinado2, "combinado/3": combinado3, "combinado/enviado/:id": combinadoEnviado,
  "p/:token": linkPage, "ler-qr": lerQr, "dividir-pagamento/:id": dividirPagamento, cobrar,
};
