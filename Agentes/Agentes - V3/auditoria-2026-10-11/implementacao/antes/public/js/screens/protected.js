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

const LINK_HOST = "pague.btgpactual.com.br/p/";
const stepBar = (n, total = 3) => `<div class="steps">${Array.from({ length: total }, (_, i) => `<span class="${i < n ? "on" : ""}"></span>`).join("")}</div>`;
/** A charge has two steps (the payer defines the release); a payment has three. */
const isCharge = () => draft("ag.from") === "provider";
const titleFor = () => (draft("ag.from") === "provider" ? "Cobrar" : "Pagar");
const RELEASE_LABEL = { single: "Valor único", stages: "Por marcos" };
const PROTECTION = [
  ["lock-simple", "Fica guardado no banco"],
  ["check-circle", "Sai quando quem paga aprova"],
  ["clock", "Sem resposta em 7 dias, libera sozinho"],
];
const protectionCard = () => card(`<strong>Como o Aval funciona</strong>${PROTECTION.map(([ic, t]) => `<div class="protect-line">${circle(ic, "info", 32)}<strong>${esc(t)}</strong></div>`).join("")}`);

/** The description, typed by the person, with an AI button that improves it. */
const descriptionField = () => `<label class="field ai-field"><span>Descrição do serviço</span><div class="ai-wrap">
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
  return screen({
    header: appbar({ title: titleFor() }),
    body: `${stepBar(1, provider ? 2 : 3)}${provider ? "" : card(row({ icon: "qr-code", title: "Ler QR do prestador", detail: "Recebeu a cobrança por QR? O combinado já vem preenchido.", go: "#/ler-qr" }))}<h2 class="title">O que vocês combinaram?</h2>
      ${draft("ag.improved") ? `<div class="ai-done">${icon("sparkle")}<span>Melhorado pela IA.</span><button type="button" data-action="undoImprove">Desfazer</button></div>` : ""}
      ${card(`${descriptionField()}${field("Valor combinado (R$)", { bind: "ag.total", value: draft("ag.total", ""), inputmode: "decimal" })}${field("Prazo de entrega", { bind: "ag.dueIso", type: "date", value: draft("ag.dueIso", brToIso(draft("ag.dueDate", ""))), min: toIso(now()) })}`)}
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
  const channel = draft("ag.channel", "app");
  const chosen = draft("ag.person");
  const people = otherPeople(s).map((p) => option({ title: ag.from === "provider" ? p.clientName : p.providerName, sub: p.phone, selected: chosen === p.id, action: "chooseAgPerson", data: { id: p.id } })).join("");
  const channels = [
    ["app", "No app", "Aviso no app"],
    ["whatsapp", "Link no WhatsApp", "Mensagem com o link"],
    ["qr", "QR code", "Leitura na hora"],
  ];
  const detail = channel === "app" ? `<h3>${ag.from === "provider" ? "Quem paga" : "Quem recebe"}</h3>${people}`
    : channel === "whatsapp" ? card(field("Celular com DDD", { bind: "ag.contact", value: draft("ag.contact", ""), inputmode: "tel", placeholder: "(11) 99999-9999" }))
      : note("Depois de enviar, mostre o QR.", "info", "qr-code");
  return screen({
    header: appbar({ title: titleFor() }),
    body: `${stepBar(isCharge() ? 2 : 3, isCharge() ? 2 : 3)}<h2 class="title">Como enviar?</h2>
      ${channels.map(([k, t, d]) => option({ title: t, sub: d, selected: channel === k, action: "chooseChannel", data: { channel: k } })).join("")}
      ${detail}
      ${ag.from === "provider" ? proposalCard(ag) : ""}
      ${card(`<small class="muted">${esc(ag.release ? RELEASE_LABEL[ag.release] : ag.proposal ? "Marcos sugeridos · quem paga decide" : "Marcos: quem paga define")} · até ${esc(ag.dueDate)}</small><h3>${esc(ag.description)}</h3><div class="amount dark">${money(ag.totalCents ?? 0)}</div><small class="muted">${esc(ag.address)}</small>`)}`,
    footer: btn(`${ag.from === "provider" ? "Enviar cobrança" : "Enviar pagamento"} de ${money(ag.totalCents ?? 0)}`, { action: "sendAgreement", iconName: "paper-plane-tilt" }),
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
  const other = inv.from === "provider" ? inv.client : inv.provider;
  const message = `${creatorName(inv)} ${verb(inv)} ${money(inv.totalCents)} com Aval: ${inv.title}. Confira e aceite: ${LINK_HOST}${inv.token} · Código de segurança ${securityCode(inv.token)}, o mesmo que aparece no app do BTG.`;
  const body = inv.channel === "qr"
    ? `<div class="center-block"><div class="qr big">${icon("qr-code")}</div><h2>Mostre este QR</h2><p class="muted">${esc(inv.title)} · ${money(inv.totalCents)}</p></div>`
    : inv.channel === "whatsapp"
      ? `<div class="center-block">${circle("chat-circle-text", "pos", 64)}<h2>Mensagem pronta no WhatsApp</h2></div><div class="wa-bubble"><p>${esc(message)}</p><small>${esc(inv.contact)}</small></div>`
      : `<div class="center-block">${circle("bell", "info", 64)}<h2>Enviado para ${esc(other ?? "")}</h2><p class="muted">A pessoa recebeu um aviso no app.</p></div>`;
  const opener = inv.channel === "qr" ? "Ler o QR como quem paga" : inv.channel === "whatsapp" ? "Abrir o link como quem recebeu" : "Abrir como quem recebeu";
  const open = inv.status === "sent" ? btn(opener, { action: "openAgreementLink", data: { token: inv.token }, iconName: "link" }) : "";
  const undo = inv.status === "sent" && Date.now() - (inv.sentAtMs ?? 0) < UNDO_MS
    ? `<div class="undo-bar" role="status"><span>Enviado.</span><button type="button" data-action="undoAgreement" data-token="${esc(inv.token)}">Desfazer</button></div>`
    : inv.status === "sent" ? btn("Cancelar este pagamento", { kind: "text", action: "cancelAgreement", data: { token: inv.token } }) : "";
  return screen({
    header: appbar({ title: "Enviado", close: "#/inicio" }),
    body: `${body}`,
    footer: `${undo}${open}${btn("Ir para o início", { kind: "text", go: "#/inicio" })}`,
  });
}

const agreementFacts = (inv) => card(`<small class="muted">${esc(creatorName(inv))} ${verb(inv)}</small><h3>${esc(inv.title)}</h3><div class="amount dark">${money(inv.totalCents)}</div>
  <p class="small">${esc(inv.description)}</p>${kv("Prazo de entrega", inv.dueDate)}${kv("Endereço", inv.address)}${kv("Liberação", inv.release ? RELEASE_LABEL[inv.release] : "Quem paga define")}
  ${inv.release === "stages" ? milestoneRows(inv.stages, { due: true }) : ""}`);

/** Whoever pays a charge defines how the money is released, with the assistant's suggestion. */
function stagesChoice(s, token) {
  const chosen = s.ui.drafts.stg?.[token]?.chosen;
  const inv = s.invites.find((i) => i.token === token);
  const suggested = !chosen && inv?.proposal ? `<small class="muted">Sugestão de ${esc(inv.provider)}</small>${milestoneRows(inv.proposal.stages)}` : "";
  const list = chosen ? milestoneRows(chosen.stages, { single: chosen.release === "single" }) : "";
  return card(`<div class="row-gap">${circle("sparkle", "info", 32)}<strong>Como o dinheiro é liberado</strong></div>${list}${suggested}
    ${btn(chosen ? "Alterar com o assistente" : "Definir com o assistente", { kind: chosen ? "text" : "secondary", action: "openStages", data: { key: token }, iconName: "sparkle" })}`, "ai-card");
}

/** Cobrar: a new charge to anyone, or the release of a stage of a service in progress. */
function cobrar(s) {
  const stages = chargeableStages(s).map(({ c, st, i }) => option({ title: `${c.title} · ${c.stages.length > 1 ? `marco ${i + 1}` : "entrega"}`, sub: `${st.name} · ${c.client} · pede a liberação`, value: money(st.valueCents), action: "chargeStage", data: { id: c.id, stage: i } })).join("");
  return screen({
    header: appbar({ title: "Cobrar" }),
    body: `<h2 class="title">O que você quer cobrar?</h2>
      ${option({ title: "Nova cobrança", sub: "Um serviço combinado com qualquer pessoa", action: "newCharge" })}
      <h3>Marco de um serviço em andamento</h3>${stages}
      ${note("Cobrar um marco envia a entrega para quem paga aprovar. O dinheiro dela já está guardado.", "info", "lock-simple")}`,
  });
}

/** The page behind the WhatsApp link, the QR or the app notice: check what was agreed and accept. */
function linkPage(s, { token }) {
  const inv = s.invites.find((i) => i.token === token);
  if (!inv) return screen({ header: appbar({ title: "Pagamento Aval" }), body: empty("Este link não existe mais.") });
  const signedIn = s.session.loggedIn && (s.session.person !== SELF || Boolean(s.people?.[SELF]));
  if (!signedIn) {
    return screen({
      header: appbar({ title: "Pagamento Aval" }),
      body: `${agreementFacts(inv)}${inv.channel === "app" ? "" : codeCard(inv)}${protectionCard()}${note("Entre com a conta BTG para pagar.", "info", "bank")}`,
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
    status = `${inv.from === "provider" ? stagesChoice(s, token) : ""}${checkbox("Confiro o combinado: valor, prazo, marcos e as regras do Aval.", { bind: "ag.accept", checked: draft("ag.accept") })}${arbitrationConsent()}`;
    footer = `${btn(inv.from === "provider" ? "Aceitar e pagar" : "Aceitar o pagamento", { action: "acceptAgreement", data: { token } })}${btn("Recusar", { kind: "text", action: "declineAgreement", data: { token } })}`;
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
  const label = mine ? "Aguardando aceite" : inv.from === "provider" ? "Cobrança para conferir" : "Pagamento para conferir";
  const other = mine ? (inv.from === "provider" ? inv.client : inv.provider) ?? (inv.channel === "qr" ? "QR code" : inv.contact) : creatorName(inv);
  return { done: false, paying, text: `${inv.title} ${other} ${label} ${money(inv.totalCents)}`, html: bkItem({ icon: "seal-check", label, tone: mine ? "" : "warn", title: inv.title, value: money(inv.totalCents), extra: `<small>${esc(other)}</small>`, go: mine ? `#/combinado/enviado/${inv.id}` : `#/p/${inv.token}` }) };
}

/** Every payment the person takes part in, marked as to pay, to receive or done. */
/** Every payment of the person (charges and payments to check, invitations to split, services); also searched. */
export function paymentItems(s) {
  const names = myNames(s);
  const invites = s.invites.filter((i) => i.protected && i.status === "sent" && (i.createdBy === s.session.person || names.has(i.client) || names.has(i.provider)));
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
  const tabs = [["pay", "A pagar", count((x) => !x.done && x.paying)], ["receive", "A receber", count((x) => !x.done && !x.paying)], ["done", "Concluídos", count((x) => x.done)]];
  const seg = `<div class="seg wide pay-tabs">${tabs.map(([k, l, n]) => `<button type="button" class="${tab === k ? "on" : ""}" data-action="setPaymentsTab" data-tab="${k}">${l}${n ? ` <span class="bk-count">${n}</span>` : ""}</button>`).join("")}</div>`;
  return `${seg}${bkSection("Pagamentos", list.map((x) => x.html), { empty: tab === "done" ? "Nada concluído ainda." : "Nada por aqui. Use Cobrar ou Pagar para começar." })}`;
}

export const protectedRoutes = {
  "combinado/1": combinado1, "combinado/2": combinado2, "combinado/3": combinado3, "combinado/enviado/:id": combinadoEnviado,
  "p/:token": linkPage, "ler-qr": lerQr, "dividir-pagamento/:id": dividirPagamento, cobrar,
};
