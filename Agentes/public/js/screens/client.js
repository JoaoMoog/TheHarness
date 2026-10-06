import { TEMPLATES, actions, arbitrationFee, go, insurancePremium, novoParticipants, novoTotals, payableCents, splitPercentError } from "../actions/index.js";
import { equalBps, formatBps, pendingCount, rebalance } from "../domain/split.js";
import {
  STAGE_STATUS, canSee, contractById, getState, parseReais, personOfContact, personOfName, providerList, splitInviteOf, custodyCents, draft, isProviderOf, myContracts, myName, myParticipant, person, releasedCents, role, setDraft,
} from "../store.js";
import {
  appbar, btn, busyNote, card, checkbox, chip, circle, empty, esc, field, icon, kv, listCard, money, note, option, percent, progress,
  row, screen, sheet, signal,
} from "../ui.js";
import { authCode, bkPageHeader, bkReceipt } from "./nexo-kit.js";

const ATTACH_ICON = { photo: "camera", video: "video-camera", document: "file-text", location: "map-pin" };

export function stageRow(c, st, i) {
  const [label, tone, ic] = STAGE_STATUS[st.status];
  const detail =
    st.status === "released" ? `${money(st.valueCents)} · liberada em ${st.releasedAt}`
      : st.status === "split" ? `${money(st.split.providerCents)} ao prestador · acordo`
        : st.status === "awaitingApproval" ? `${money(st.valueCents)} · entrega enviada ${st.delivery.sentAt}`
          : `${money(st.valueCents)} · até ${st.due}`;
  return `<div class="stage-row">${circle(ic, tone === "neutral" ? "neutral" : tone, 32)}<div class="row-text"><strong>Etapa ${i + 1} · ${esc(st.name)}</strong><small>${esc(detail)}</small></div>${chip(st.anticipation && st.status === "awaitingApproval" ? "Antecipada" : label, tone)}</div>`;
}

const stepBar = (n) => `<div class="steps">${[1, 2, 3].map((i) => `<span class="${i <= n ? "on" : ""}"></span>`).join("")}</div>`;

/** Where a contract opens, its status line and its icon, shared by the list rows and the home activity. */
export function contractSummary(c, isProvider = false) {
  const go = c.kind === "collective" && !isProvider ? `#/coletivo/${c.id}` : `#/servico/${c.id}`;
  const done = c.stages.filter((st) => st.status === "released" || st.status === "split").length;
  const other = isProvider ? c.client : c.provider;
  const detail = c.kind === "collective" ? `Coletivo · ${c.participants.filter((p) => p.paid).length} de ${c.participants.length} pagas` : c.status === "completed" ? `Concluído · ${other}` : c.status === "awaitingPayment" ? `Aguardando pagamento · ${other}` : `Etapa ${Math.min(done + 1, c.stages.length)} de ${c.stages.length} · ${other}`;
  return { go, detail, icon: c.kind === "collective" ? "users-three" : c.parent ? "tree-structure" : "briefcase" };
}

export function contractRow(c, isProvider = false) {
  const { go, detail, icon: ic } = contractSummary(c, isProvider);
  return row({ icon: ic, title: c.title, detail, value: money(c.totalCents), go });
}

function servicos(s) {
  const tab = draft("servicos.tab", "andamento");
  const isProvider = role(s) === "prestador";
  const list = myContracts(s).filter((c) => (tab === "andamento" ? c.status !== "completed" : c.status === "completed"));
  const me = myName(s);
  const invites = s.invites.filter((i) => i.status === "sent" && (isProvider ? i.provider === me : i.client === me));
  const inviteRow = (i) => {
    const quote = i.from === "provider";
    const incoming = quote ? !isProvider : isProvider;
    const detail = quote ? (isProvider ? `Orçamento enviado a ${i.client}` : `Orçamento de ${i.provider} · ${money(i.totalCents)}`) : isProvider ? `Convite de ${i.client} · ${money(i.totalCents)}` : `Convite enviado a ${i.provider}`;
    const go = quote ? `#/orcamento/${i.id}` : incoming ? `#/convite/${i.id}` : undefined;
    return row({ icon: quote ? "file-text" : "paper-plane-tilt", title: i.title, detail, go, tone: incoming ? "warn" : "neutral" });
  };
  const inviteRows = invites.map(inviteRow).join("");
  return screen({
    header: bkPageHeader(s, { title: "Serviços", sub: isProvider ? "Etapas, entregas e recebimentos do que você presta." : "Etapas, entregas e pagamentos do que você contratou." }), tab: "servicos",
    body: `<div class="row-between"><div class="seg">${[["andamento", "Em andamento"], ["concluidos", "Concluídos"]].map(([k, l]) => `<button type="button" class="${tab === k ? "on" : ""}" data-action="setTab" data-tab="${k}">${l}</button>`).join("")}</div>${isProvider ? btn("Orçamento", { kind: "secondary small", go: "#/orcamento/novo", iconName: "plus" }) : btn("Novo", { kind: "secondary small", go: "#/novo/1", iconName: "plus" })}</div>
      ${invites.length ? listCard("Convites", inviteRows) : ""}
      ${list.length ? listCard("", list.map((c) => contractRow(c, isProvider)).join("")) : empty("Nada por aqui.")}`,
  });
}

function stageActions(s, c, st, i, isProvider) {
  const out = [];
  const dispute = s.disputes.find((d) => d.contractId === c.id && d.stage === i);
  if (!isProvider && st.status === "awaitingApproval") out.push(btn("Revisar entrega", { kind: "secondary small", action: "openApprove", data: { id: c.id, stage: i } }));
  if (isProvider && (st.status === "inProgress" || st.status === "adjustRequested")) out.push(btn(st.status === "adjustRequested" ? "Reenviar entrega" : "Enviar entrega", { kind: "secondary small", action: "startDelivery", data: { id: c.id, stage: i } }));
  if (isProvider && st.status === "awaitingApproval" && !st.anticipation) out.push(btn("Antecipar", { kind: "secondary small", go: `#/antecipar/${c.id}/${i}` }));
  const hasSub = s.contracts.some((x) => x.stages.some((y) => y.linkedTo?.contractId === c.id && y.linkedTo.stage === i));
  if (isProvider && !c.parent && c.kind === "individual" && ["inProgress", "pending"].includes(st.status) && !hasSub) out.push(btn("Subcontratar", { kind: "text small", go: `#/subcontratar/${c.id}/${i}`, iconName: "tree-structure" }));
  if (!isProvider && c.parent && st.status === "inProgress") out.push(btn("Simular entrega do subcontratado", { kind: "text small", action: "simulateSubDelivery", data: { id: c.id } }));
  if (isProvider && st.fraudCheck?.risky && st.status === "awaitingApproval") out.push(chip("Evidência em análise de segurança", "warn"));
  if (dispute) out.push(btn("Ver disputa", { kind: "text small", go: `#/disputa/${dispute.id}` }));
  if (st.status === "released") out.push(btn("Comprovante", { kind: "text small", go: `#/comprovante/${c.id}/${i}` }));
  const r = st.reschedule;
  if (r?.status === "proposed" && isProvider) out.push(btn(`Aceitar nova data ${r.proposedDue}`, { kind: "secondary small", action: "answerNewDate", data: { id: c.id, stage: i, accept: "yes" } }), btn("Recusar", { kind: "text small", action: "answerNewDate", data: { id: c.id, stage: i, accept: "no" } }));
  if (r?.status === "proposed" && !isProvider) out.push(chip(`Nova data proposta: ${r.proposedDue}`, "info"));
  if (r?.status === "accepted") out.push(chip(`Prazo remarcado de ${r.previousDue} para ${r.proposedDue}`, "pos"));
  const reply = st.status === "adjustRequested" && st.reply ? `<p class="quote">“${esc(st.reply.text)}”</p>` : "";
  const link = st.linkedTo ? `<p class="small muted">${icon("tree-structure")} Liberada junto com a etapa ${st.linkedTo.stage + 1} de ${esc(st.linkedTo.contractId)}</p>` : "";
  return reply || link || out.length ? `<div class="stage-actions">${reply}${link}${out.join("")}</div>` : "";
}

function serviceFooter(c, isProvider) {
  const id = c.id;
  const awaitingIdx = c.stages.findIndex((st) => st.status === "awaitingApproval");
  const contestIdx = c.stages.findIndex((st) => ["awaitingApproval", "inProgress", "adjustRequested"].includes(st.status));
  const workIdx = c.stages.findIndex((st) => st.status === "inProgress" || st.status === "adjustRequested");
  if (!isProvider && c.status === "awaitingPayment" && c.entrada?.status !== "requested" && c.entrada?.status !== "countered") return btn(`Pagar ${money(payableCents(c))}`, { go: `#/pagar/${id}` });
  if (!isProvider && c.status === "active") {
    const buttons = `${contestIdx >= 0 ? btn("Abrir disputa", { kind: "secondary", action: "startDispute", data: { id, stage: contestIdx } }) : ""}${awaitingIdx >= 0 ? btn(`Aprovar etapa ${awaitingIdx + 1}`, { action: "openApprove", data: { id, stage: awaitingIdx } }) : ""}`;
    return buttons ? `<div class="btn-row">${buttons}</div>` : "";
  }
  if (isProvider && workIdx >= 0) return btn(`Enviar entrega da etapa ${workIdx + 1}`, { action: "startDelivery", data: { id, stage: workIdx } });
  if (isProvider && c.kind === "collective" && c.status === "funding") return btn("Cobrar na maquininha", { go: `#/maquininha/${id}` });
  return "";
}

function servico(s, { id }) {
  const c = contractById(s, id);
  if (!canSee(c, s)) return screen({ header: appbar({ title: "Serviço" }), body: empty("Serviço não encontrado.") });
  const isProvider = isProviderOf(c, s);
  const released = releasedCents(c);
  const other = isProvider ? c.client : c.provider;
  const statusChip = { awaitingPayment: chip("Aguardando pagamento", "warn"), funding: chip("Coletando pagamentos", "warn"), active: chip("Em andamento", "info"), completed: chip("Concluído", "pos") }[c.status];
  const entrada = c.entrada && c.entrada.status !== "paid" && c.entrada.status !== "refused"
    ? card(`<div class="row-between"><strong>Entrada</strong>${chip(c.entrada.status === "countered" ? `Contraproposta ${money(c.entrada.counterCents)}` : `Pedida ${money(c.entrada.requestedCents)}`, "warn")}</div>${!isProvider && c.entrada.status === "requested" ? btn("Decidir a entrada", { go: `#/entrada-decidir/${id}` }) : ""}${isProvider && c.entrada.status === "countered" ? btn("Aceitar contraproposta", { action: "acceptCounter", data: { id } }) : ""}`, "warn-soft")
    : "";
  const parent = c.parent ? contractById(s, c.parent.contractId) : null;
  const subs = s.contracts.filter((x) => x.parent?.contractId === c.id && isProviderOf(c, s));
  const links = [
    c.kind === "collective" ? row({ icon: "users-three", title: "Rateio e participantes", detail: `${c.participants.filter((p) => p.paid).length} de ${c.participants.length} pagaram`, go: `#/coletivo/${id}` }) : "",
    !isProvider && c.payment?.method === "credit" ? row({ icon: "credit-card", title: "Pagamento", detail: `${c.payment.count}x de ${money(c.payment.valueCents)} · CET ${c.payment.cet}`, go: c.payment.creditId ? `#/ccb/${c.payment.creditId}` : "#/financeiro" }) : "",
    c.insurance ? row({ icon: "shield-check", title: "Seguro Aval da obra", detail: `${c.insurance.policy} · cobre ${money(c.insurance.coverageCents)}${c.insurance.paid ? "" : " · prêmio pendente"}`, go: `#/seguro/${id}` }) : "",
    parent ? row({ icon: "tree-structure", title: "Subcontrato da obra principal", detail: `${parent.title} · etapa ${c.parent.stage + 1}`, go: `#/servico/${parent.id}` }) : "",
    ...subs.map((sub) => row({ icon: "tree-structure", title: `Subcontrato com ${sub.provider}`, detail: `${money(sub.totalCents)} · liberado em cascata`, go: `#/servico/${sub.id}` })),
    c.kind !== "collective" ? row({ icon: "chat-circle-text", title: "Conversa", detail: `${(s.messages[id] ?? []).length} mensagens · registrada no contrato`, go: `#/conversa/${id}` }) : "",
    c.kind === "recurring" ? row({ icon: "calendar-blank", title: "Serviço recorrente", detail: `Pix Automático de ${money(c.monthlyCents)} por mês · aprovação tácita em 3 dias`, tone: "pos" }) : "",
    isProvider && c.kind === "individual" && c.status === "active" ? `<div class="toggle-row pad">${circle("lightning", c.autoAnticipate ? "pos" : "neutral", 32)}<div><strong>Antecipação automática</strong><small>Receba 95% assim que enviar cada entrega</small></div><button type="button" class="toggle ${c.autoAnticipate ? "on" : ""}" role="switch" aria-checked="${Boolean(c.autoAnticipate)}" aria-label="Antecipação automática" data-action="toggleAutoAnticipation" data-id="${esc(c.id)}"><span></span></button></div>` : "",
    c.origin ? row({ icon: "link", title: `Origem: ${c.origin}`, detail: "Cliente pagou sem o app, pelo link" }) : "",
    row({ icon: "file-text", title: "Contrato e arbitragem", detail: `Assinado em ${c.signedAt} · arbitragem incluída`, go: `#/contrato/${id}` }),
  ].join("");
  return screen({
    header: appbar({ title: c.title }), fab: !isProvider,
    body: `${card(`<div class="row-between"><small class="muted">${esc(c.id)} · ${esc(other)}</small>${statusChip}</div><div class="amount dark">${money(c.totalCents)}</div>${progress(released / c.totalCents)}<div class="row-between small"><span class="pos-text">Liberado ${money(released)}</span><span>Em custódia ${money(custodyCents(c))}</span></div>`)}
      ${entrada}
      ${c.status === "awaitingPayment" ? note(isProvider ? "Aguardando o pagamento da contratante. Você é avisado quando o dinheiro entrar em custódia." : "O dinheiro fica em custódia no Nexo e só é liberado por etapa aprovada.") : ""}
      ${card(c.stages.map((st, i) => `${stageRow(c, st, i)}${stageActions(s, c, st, i, isProvider)}`).join(""), "flush stages")}
      ${listCard("", links)}`,
    footer: serviceFooter(c, isProvider),
  });
}

function approveSheet(s) {
  const { id, stage } = s.ui.sheet;
  const c = contractById(s, id);
  const st = c.stages[stage];
  const reply = draft("reply", "");
  const subs = s.contracts.filter((x) => x.stages.some((y) => y.linkedTo?.contractId === id && y.linkedTo.stage === stage && y.status === "awaitingApproval"));
  const thumbs = st.delivery.attachments.map((a) => `<div class="thumb" title="${esc(a.caption)}">${icon(ATTACH_ICON[a.kind])}<small>${esc(a.caption)}</small></div>`).join("");
  const risk = st.fraudCheck?.risky ? card(`<div class="row-gap warn-text">${icon("warning-circle")}<strong>Sinais de atenção na evidência</strong></div>${st.fraudCheck.flags.map((f) => `<div class="check-line warn">${icon("warning-circle")}<span>${esc(f)}</span></div>`).join("")}`) : "";
  const items = st.items.map((it) => `<div class="check-line muted">${icon("list-checks")}<span>${esc(it)}</span></div>`).join("");
  return sheet(`Aprovar etapa ${stage + 1}`, `<p class="muted">${esc(c.provider)} enviou a entrega em ${esc(st.delivery.sentAt)}. Confira antes de liberar.</p>
    <p class="quote">“${esc(st.delivery.description)}”</p><div class="thumbs">${thumbs}</div>${risk}
    ${card(`<strong>O que foi combinado nesta etapa</strong>${items}`)}
    ${subs.length ? note(`Ao aprovar, ${subs.map((x) => x.provider).join(", ")} recebe na mesma hora pelo subcontrato com ${c.provider}.`, "info", "tree-structure") : ""}
    <div class="note warn">${icon("clock")}<span>Sem resposta até ${esc(st.delivery.deadline)}, a etapa é aprovada automaticamente. <button type="button" class="link" data-action="simulateDeadline" data-id="${esc(id)}" data-stage="${stage}">Simular fim do prazo</button></span></div>
    ${btn(`Aprovar e liberar ${money(st.valueCents)}`, { action: "approveStage", data: { id, stage } })}
    ${field("Precisa de ajuste? Conte ao prestador", { bind: "reply", value: reply, multiline: true, rows: 2, placeholder: "Ex.: falta rejuntar o box" })}
    ${btn("Pedir ajuste ao prestador", { kind: "secondary", action: "requestAdjust", data: { id, stage } })}`);
}

function comprovante(s, { id, stage }) {
  const c = contractById(s, id);
  const st = canSee(c, s) ? c.stages[Number(stage)] : null;
  if (!st || st.status !== "released") return screen({ header: appbar({ title: "Comprovante" }), body: empty("Esta etapa ainda não foi liberada.") });
  const cascaded = s.contracts.flatMap((x) => x.stages.filter((y) => y.linkedTo?.contractId === id && y.linkedTo.stage === Number(stage) && y.status === "released").map(() => x));
  const facts = [
    ["Etapa", `${Number(stage) + 1} · ${st.name}`], ["Forma", st.releaseMode], ["Ainda em custódia", money(custodyCents(c))],
    ...(st.invoiceId ? [["Nota fiscal", `${st.invoiceId} emitida`]] : []), ...(st.anticipation ? [["Observação", "Quita a antecipação do prestador"]] : []),
  ];
  return screen({
    cls: "bk-receipt-screen", header: appbar({ close: `#/servico/${id}` }),
    body: `${bkReceipt({
      title: "Comprovante de liberação", when: `Feito em ${st.releasedAt}${st.releasedAt.length <= 5 ? "/2026" : ""}`, valueCents: st.valueCents,
      parties: [
        { label: "Para", name: c.provider, lines: ["Banco Nexo S.A.", "Conta de recebimentos Aval"] },
        { label: "De", name: `Custódia ${c.id}`, lines: [`Aprovado por ${c.client}`, "Banco Nexo S.A."] },
      ],
      facts, auth: authCode(`${id}:${stage}:${st.releasedAt}`),
    })}${cascaded.length ? `<div class="bk-pad">${cascaded.map((x) => note(`Liberação em cascata: ${x.provider} recebeu ${money(x.stages[0].valueCents)} pelo subcontrato ${x.id}.`, "pos", "tree-structure")).join("")}</div>` : ""}`,
    footer: btn("Compartilhar", { action: "shareReceipt", iconName: "export" }),
  });
}

/** Shares of the new service when it is split, or null when one person pays or the percentages do not add up. */
function splitPreview(s) {
  const people = novoParticipants(s);
  const total = parseReais(draft("novo.total")) ?? 0;
  return people && people.length >= 2 && total > 0 && !splitPercentError(s) ? rebalance(total, people) : null;
}

/** Live parts of the split: the amount of each person and the sum of the percentages. */
export function updateSplitAmounts(s) {
  const shares = splitPreview(s);
  const error = splitPercentError(s);
  (novoParticipants(s) ?? []).forEach((_, i) => {
    const el = document.getElementById(`split-amt-${i}`);
    if (el) el.textContent = shares ? money(shares[i].shareCents) : "—";
  });
  const sum = document.getElementById("novo-split-sum");
  if (sum) {
    sum.className = `pct-sum ${error ? "err" : "ok"}`;
    sum.textContent = error ?? "Soma: 100%";
  }
}

const CHANNEL_ICON = { whatsapp: "chat-circle-text", email: "paper-plane-tilt" };
const channelLabel = (p) => (p.channel === "email" ? "Link por e-mail" : p.channel === "whatsapp" ? "Convite no WhatsApp" : "Quem organizou");

/** Each person's percentage (equal parts until someone edits) and the amount it means, updated as you type. */
function splitPercents(s) {
  const people = novoParticipants(s) ?? [];
  if (people.length < 2) return card(`<p class="small muted">Convide pelo menos uma pessoa.</p>`);
  const typed = draft("novo.splitPct", []) ?? [];
  const equal = equalBps(people.length);
  const shares = splitPreview(s);
  const error = splitPercentError(s);
  const rows = people.map((p, i) => {
    const label = p.me ? `${p.name} (você)` : p.name;
    const value = typed[i] ?? String(equal[i] / 100).replace(".", ",");
    return `<div class="pct-row"><span class="pct-name">${esc(label)}</span><label class="pct-input"><input data-bind="novo.splitPct.${i}" inputmode="decimal" value="${esc(value)}" aria-label="Porcentagem de ${esc(label)}"><span>%</span></label><strong id="split-amt-${i}">${shares ? money(shares[i].shareCents) : "—"}</strong></div>`;
  }).join("");
  return card(`<div class="row-between"><strong>Quanto cada um paga</strong>${btn("Dividir igualmente", { kind: "text small", action: "equalSplit" })}</div>${rows}<div id="novo-split-sum" class="pct-sum ${error ? "err" : "ok"}">${esc(error ?? "Soma: 100%")}</div><small class="muted">Se alguém recusar, a parte dele é dividida entre os demais, na mesma proporção.</small>`);
}

/** Paying together: invite each person by mobile (WhatsApp) or e-mail, set each one's percentage; everyone accepts before paying. */
function splitSection(s) {
  const on = Boolean(draft("novo.splitOn", false));
  const toggle = `<button type="button" class="toggle ${on ? "on" : ""}" role="switch" aria-checked="${on}" aria-label="Dividir com outras pessoas" data-action="toggleSplit"><span></span></button>`;
  const head = card(`<div class="toggle-row">${circle("users-three", on ? "info" : "neutral")}<div><strong>Dividir com outras pessoas</strong><small>Cada pessoa recebe um convite, aceita e paga a sua parte.</small></div>${toggle}</div>`);
  if (!on) return head;
  const invited = draft("novo.splitContacts", []);
  const rows = invited.map((x, i) => {
    const who = personOfContact(x.contact, s);
    return `<div class="row-between line"><div class="row-gap">${icon(CHANNEL_ICON[x.channel])}<div><strong>${esc(who?.clientName ?? x.contact)}</strong><small class="muted">${esc(x.channel === "email" ? `Link por e-mail · ${x.contact}` : `Convite no WhatsApp · ${x.contact}`)}</small></div></div><button type="button" class="icon-btn" data-action="removeSplitContact" data-index="${i}" aria-label="Remover ${esc(x.contact)}">${icon("x")}</button></div>`;
  }).join("");
  return `${head}<h3>Quem divide com você</h3>
    ${card(`${field("Celular (WhatsApp) ou e-mail", { bind: "novo.splitContact", value: draft("novo.splitContact", ""), placeholder: "(11) 99999-9999 ou nome@email.com" })}${btn("Adicionar convite", { kind: "secondary", action: "addSplitContact", iconName: "plus" })}${rows}`)}
    ${note("Na demonstração, convide a Marina: (11) 98888-1001. Outros contatos recebem o link e respondem por ele.", "info", "info")}
    ${splitPercents(s)}`;
}

const templatePills = (current) =>
  `<div class="choice-list wrap">${Object.entries(TEMPLATES).map(([k, [label]]) => `<button type="button" class="pill-option ${current === k ? "on" : ""}" data-action="chooseNovoTemplate" data-key="${k}">${esc(label)}</button>`).join("")}</div>`;

function novo1(s) {
  const me = person(s)?.providerName;
  const chosen = draft("novo.provider");
  const providers = providerList(s).filter((p) => p.name !== me);
  return screen({
    header: appbar({ title: "Novo serviço" }),
    body: `${stepBar(1)}<h2 class="title">O que você vai contratar?</h2>
      ${card(`${field("Título", { bind: "novo.title", value: draft("novo.title") })}${field("Descrição do serviço", { bind: "novo.description", value: draft("novo.description"), multiline: true, rows: 4 })}${field("Valor total (R$)", { bind: "novo.total", value: draft("novo.total"), inputmode: "decimal" })}`)}
      <h3>Prestador</h3>
      ${providers.map((p) => option({ title: p.name, sub: `${p.activity} · ${p.doc} · nota ${p.rating}`, selected: chosen === p.name, action: "chooseProvider", data: { name: p.name } })).join("")}
      ${splitSection(s)}
      <h3>Modelo de etapas</h3>${templatePills(draft("novo.template", "unica"))}
      ${note("As etapas saem do modelo, com valores divididos. Você ajusta nomes, valores e prazos no próximo passo.", "info", "list-checks")}`,
    footer: btn("Continuar", { action: "buildStages" }),
  });
}

export function sumHtml() {
  const { sum, total } = novoTotals();
  const okSum = sum === total;
  return `${kv("Total do serviço", money(total))}${kv("Soma das etapas", money(sum), okSum ? "pos-text" : "neg-text")}${okSum ? "" : `<p class="small neg-text">Ajuste os valores: faltam ${money(total - sum)}.</p>`}`;
}

function novo2(s) {
  const stages = draft("novo.stages", []);
  const editor = stages.map((st, i) => `<div class="stage-edit"><div class="row-between"><strong>Etapa ${i + 1}</strong><span class="muted small">até ${esc(st.due)}</span>${stages.length > 1 ? `<button type="button" class="icon-btn" data-action="removeStage" data-index="${i}" aria-label="Remover etapa ${i + 1}">${icon("x")}</button>` : ""}</div>${field("Nome", { bind: `novo.stages.${i}.name`, value: st.name })}${field("Valor (R$)", { bind: `novo.stages.${i}.value`, value: st.value, inputmode: "decimal" })}</div>`).join("");
  return screen({
    header: appbar({ title: "Novo serviço" }),
    body: `${stepBar(2)}<div class="row-between"><h2 class="title">Etapas e valores</h2></div>
      ${card(editor, "flush-y")}${btn("Adicionar etapa", { kind: "text", action: "addStage", iconName: "plus" })}
      ${card(`<div id="novo-sum">${sumHtml()}</div>`)}`,
    footer: btn("Continuar", { action: "goNovo3" }),
  });
}

function novo3(s) {
  const { stages, total } = novoTotals();
  const shares = splitPreview(s);
  const insured = !shares && Boolean(draft("novo.insurance"));
  const premium = insurancePremium(total);
  return screen({
    header: appbar({ title: "Novo serviço" }),
    body: `${stepBar(3)}<h2 class="title">Revise e envie o convite</h2>
      ${card(`<small class="muted">${esc(draft("novo.provider"))}</small><h3>${esc(draft("novo.title"))}</h3><div class="amount dark">${money(total)}</div>${stages.map((st, i) => kv(`${i + 1}. ${st.name} · até ${st.due}`, `R$ ${st.value}`)).join("")}`)}
      ${shares ? card(`<strong>Pagamento dividido</strong>${shares.map((p) => kv(`${p.name} · ${formatBps(p.bps)}`, money(p.shareCents))).join("")}<p class="small muted">Cada pessoa recebe o convite e precisa aceitar antes de pagar. O Seguro Aval da obra não entra no serviço dividido.</p>`) : card(`<div class="toggle-row">${circle("shield-check", "pos")}<div><strong>Seguro Aval da obra</strong><small>Se a disputa terminar a seu favor, cobre o valor já liberado ou outro prestador para concluir.</small></div><button type="button" class="toggle ${insured ? "on" : ""}" role="switch" aria-checked="${insured}" aria-label="Seguro Aval da obra" data-action="toggleInsurance"><span></span></button></div>${kv("Prêmio único (2,5%)", insured ? money(premium) : "Não contratado")}<p class="small muted">Nexo Seguros · franquia de 10% · pago junto com o serviço.</p>`)}
      ${card(`<div class="row-gap">${icon("gavel")}<strong>Arbitragem incluída</strong></div>${kv("Seguro de arbitragem (já no custo)", money(arbitrationFee(total)))}<p class="small muted">Se a mediação não resolver, um árbitro independente decide. Ninguém paga nada a mais na hora da disputa.</p><button type="button" class="link" data-go="#/arbitragem">Como funciona</button>`)}
      ${card(`<strong>Como funciona</strong><ul class="bullets"><li>Você paga e o valor fica em custódia no Nexo.</li><li>Cada etapa é liberada quando você aprova a entrega.</li><li>Sem resposta em 7 dias, a etapa é aprovada automaticamente.</li><li>Sem acordo numa disputa, vale a arbitragem.</li></ul>`)}
      ${checkbox("Li e aceito as condições e a cláusula compromissória de arbitragem.", { bind: "novo.terms", checked: draft("novo.terms") })}`,
    footer: btn(`Enviar convite${insured ? ` · total ${money(total + premium)}` : ""}`, { action: "sendInvite", iconName: "paper-plane-tilt" }),
  });
}

function novoEnviado(s, { id }) {
  const inv = s.invites.find((i) => i.id === id);
  const invited = (inv?.participants ?? []).filter((p) => !p.me);
  const declined = inv?.declined ?? [];
  const status = (p) => `<div class="right">${p.status === "pending" ? `${chip("Aguardando", "warn")}${btn("Abrir o link", { kind: "secondary small", go: `#/dividir/${p.token}` })}` : chip("Aceitou", "pos")}</div>`;
  const splitCard = invited.length || declined.length
    ? card(`<strong>Convites para dividir</strong>${invited.map((p) => `<div class="row-between line"><div><strong>${esc(p.name)}</strong><small class="muted">${esc(p.name === p.contact ? channelLabel(p) : `${channelLabel(p)} · ${p.contact}`)}</small></div>${status(p)}</div>`).join("")}${declined.map((d) => `<div class="row-between line"><div><strong>${esc(d.name)}</strong><small class="muted">Recusou · partes recalculadas</small></div>${chip("Recusou", "neg")}</div>`).join("")}
      <p class="small muted">Na demonstração, abra o link de cada convite para aceitar ou recusar.</p>`)
    : "";
  return screen({
    header: appbar({ title: "Convite enviado" }),
    body: `<div class="center-block">${circle("paper-plane-tilt", "info", 64)}<h2>Convite enviado para ${esc(inv?.provider ?? "")}</h2><p class="muted">Quando o prestador aceitar${invited.length ? " e todos os convidados responderem" : ""}, cada pessoa paga e o dinheiro fica em custódia.</p></div>${splitCard}${note("Na demonstração, troque para Carlos (Horizonte) no topo para aceitar o convite do serviço.", "info")}`,
    footer: btn("Ir para o início", { go: "#/inicio" }),
  });
}

function entradaDecidir(s, { id }) {
  const c = contractById(s, id);
  if (!c?.entrada) return screen({ header: appbar({ title: "Pedido de entrada" }), body: empty("Não há entrada pendente.") });
  const choice = draft("entrada.choice", "pay");
  const first = c.stages[0];
  return screen({
    header: appbar({ title: "Pedido de entrada" }),
    body: `${card(`<div class="row-gap">${circle("briefcase")}<div><strong>${esc(c.provider)}</strong><small class="muted">${esc(providerList(s).find((p) => p.name === c.provider)?.doc ?? "")}</small></div></div><p>Pediu ${money(c.entrada.requestedCents)} de entrada para comprar material antes da etapa 1.</p>${kv("Valor pedido", money(c.entrada.requestedCents))}${kv("Desconta da etapa 1", `${money(first.valueCents)} → ${money(first.valueCents - c.entrada.requestedCents)}`)}${kv("Fica sem proteção", money(c.entrada.requestedCents), "neg-text")}`)}
      <h3>O que você decide?</h3>
      ${option({ title: "Pagar a entrada", sub: "Vai direto ao prestador, sem custódia", selected: choice === "pay", action: "chooseEntrada", data: { choice: "pay" } })}
      ${option({ title: "Propor outro valor", sub: "O prestador recebe sua contraproposta", selected: choice === "counter", action: "chooseEntrada", data: { choice: "counter" } })}
      ${choice === "counter" ? field("Contraproposta (R$)", { bind: "entrada.counter", value: draft("entrada.counter"), inputmode: "decimal" }) : ""}
      ${option({ title: "Recusar e manter tudo protegido", sub: "O serviço segue só com etapas", selected: choice === "refuse", action: "chooseEntrada", data: { choice: "refuse" } })}`,
    footer: btn("Confirmar decisão", { action: "confirmEntrada", data: { id } }),
  });
}

const splitStatus = (p) => (p.paid ? chip("Pago", "pos") : p.status === "pending" ? chip("Aguardando resposta", "warn") : chip("Aceitou", "info"));

function coletivo(s, { id }) {
  const c = contractById(s, id);
  if (!canSee(c, s) || !c.participants) return screen({ header: appbar({ title: "Serviço dividido" }), body: empty("Serviço dividido não encontrado.") });
  const isProvider = isProviderOf(c, s);
  const waiting = pendingCount(c.participants);
  const paidCount = c.participants.filter((p) => p.paid).length;
  const me = myParticipant(c, s);
  const organizer = c.client === myName(s) && !isProvider;
  const firstPending = c.participants.find((p) => p.status === "pending");
  let footer = "";
  if (isProvider) footer = waiting ? "" : btn("Gerar link da maquininha", { go: `#/maquininha/${id}`, iconName: "device-mobile" });
  else if (waiting && organizer) footer = btn("Reenviar convite", { kind: "secondary", action: "resendSplit", data: { token: firstPending.token } });
  else if (!waiting && me && !me.paid) footer = btn(`Pagar minha parte ${money(me.shareCents)}`, { go: `#/pagar/${id}` });
  const row = (p) => {
    const outside = !personOfName(p.name, s);
    const link = organizer && !p.paid && !p.me && (p.status === "pending" || outside) ? btn("Abrir o link", { kind: "secondary small", go: `#/dividir/${p.token}` }) : "";
    return `<div class="participant">${circle("user", p.paid ? "info" : "warn", 36)}<div class="row-text"><strong>${esc(p.name)}</strong><small>${p.paid ? `Pago com ${esc(p.origin ?? "")}` : esc(p.me ? "Quem organizou" : p.name === p.contact ? channelLabel(p) : `${channelLabel(p)} · ${p.contact}`)}</small></div><div class="right"><strong>${money(p.shareCents)}</strong><small class="muted">${formatBps(p.bps)}</small>${splitStatus(p)}${link}</div></div>`;
  };
  const declined = (c.declined ?? []).length ? `<p class="small muted">Recusaram: ${esc(c.declined.map((d) => d.name).join(", "))}. As partes foram recalculadas.</p>` : "";
  const head = c.status === "active" ? chip("Em andamento", "info") : waiting ? chip(`${waiting} sem responder`, "warn") : chip(`Faltam ${c.participants.length - paidCount} pagamento(s)`, "warn");
  return screen({
    header: appbar({ title: c.title }),
    body: `${card(`<div class="row-between"><small class="muted">${esc(c.id)} · Dividido</small>${head}</div><div class="amount dark">${money(c.totalCents)}</div>${progress(c.paidInCents / c.totalCents)}<small>${money(c.paidInCents)} de ${money(c.totalCents)} já em custódia</small>`)}
      ${card(`<div class="row-between"><strong>Quem divide</strong><small class="muted">${c.participants.length} pessoas</small></div>${c.participants.map(row).join("")}${declined}`)}
      ${note(waiting ? "O pagamento abre quando todos os convidados responderem. Se alguém recusar, as partes são recalculadas." : "Cada etapa só começa com 100% das partes pagas.")}
      ${btn("Ver etapas do serviço", { kind: "text", go: `#/servico/${id}` })}`,
    footer,
  });
}

/** Public page behind the WhatsApp or e-mail link: see the split, accept or decline, then pay your share. */
function dividir(s, { token }) {
  const found = splitInviteOf(s, token);
  if (!found) return screen({ header: appbar({ title: "Convite" }), body: empty("Convite não encontrado.") });
  const { holder, participant: p, isContract } = found;
  if (found.declined) return screen({ header: appbar({ title: "Convite" }), body: `<div class="center-block">${circle("x", "neutral", 56)}<h2>Você recusou este convite</h2><p class="muted">${esc(holder.title)} com ${esc(holder.provider)}</p></div>` });
  const waiting = pendingCount(holder.participants);
  const outside = !personOfName(p.name, s);
  let action = "";
  let footer = "";
  if (p.status === "pending") {
    action = outside ? card(field("Seu nome", { bind: "dividir.name", value: draft("dividir.name", ""), placeholder: "Como você quer aparecer para o grupo" })) : "";
    footer = `${btn("Aceitar e participar", { action: "acceptSplit", data: { token } })}${btn("Recusar convite", { kind: "text", action: "declineSplit", data: { token } })}`;
  } else if (p.paid) action = note(`Sua parte foi paga com ${p.origin}.`, "pos", "check-circle");
  else if (waiting) action = note(`Você aceitou. Falta(m) ${waiting} pessoa(s) responder; depois disso o pagamento abre.`, "info", "clock");
  else if (!isContract) action = note("Todos responderam. Falta o prestador aceitar o serviço; você será avisado para pagar.", "info", "clock");
  else footer = outside ? btn(`Pagar ${money(p.shareCents)} com Pix`, { action: "payShareByLink", data: { token }, iconName: "qr-code" }) : btn(`Pagar minha parte ${money(p.shareCents)}`, { go: `#/pagar/${holder.id}` });
  const list = holder.participants.map((x) => kv(`${x.name}${x === p ? " (você)" : ""}`, `${formatBps(x.bps)} · ${money(x.shareCents)} · ${x.paid ? "pago" : x.status === "pending" ? "aguardando" : "aceitou"}`)).join("");
  return screen({
    header: appbar({ title: "Convite para dividir" }),
    body: `<div class="center-block">${circle("users-three", "info", 56)}<h2>${esc(holder.client)} convidou você para dividir um serviço</h2><p class="muted">${esc(holder.title)} com ${esc(holder.provider)}</p></div>
      ${card(`<small class="muted">Sua parte</small><div class="amount dark">${money(p.shareCents)}</div><small class="muted">${formatBps(p.bps)} do total de ${money(holder.totalCents)}</small>`)}
      ${card(`<strong>Quem divide</strong>${list}`)}
      ${action}
      ${note("O dinheiro fica em custódia no Nexo e só chega ao prestador por etapa aprovada. Se alguém recusar, as partes são recalculadas.", "info", "shield-check")}`,
    footer,
  });
}

export const clientRoutes = {
  servicos, "servico/:id": servico, "comprovante/:id/:stage": comprovante, "novo/1": novo1, "novo/2": novo2, "novo/3": novo3,
  "novo/enviado/:id": novoEnviado, "entrada-decidir/:id": entradaDecidir, "coletivo/:id": coletivo, "dividir/:token": dividir,
};
export const clientSheets = { aprovar: approveSheet };

export const clientActions = {
  reviewStage: ({ id, stage }) => {
    go(`#/servico/${id}`);
    actions.openApprove({ id, stage });
  },
  setTab: ({ tab }) => setDraft("servicos.tab", tab, false),
  toggleInsurance: () => setDraft("novo.insurance", !draft("novo.insurance"), false),
  shareReceipt: () => actions.copied(),
};

/** Keeps the stage sum in step with typing, without re-rendering the form. */
export function liveUpdate(path) {
  if (path === "novo.total" || path.startsWith("novo.splitPct")) updateSplitAmounts(getState());
  if (!path.startsWith("novo.stages")) return;
  const el = document.getElementById("novo-sum");
  if (el) el.innerHTML = sumHtml();
}
