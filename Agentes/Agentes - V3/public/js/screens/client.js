import { actions, anticipationCheck, anticipationValues, go, payableCents } from "../actions/index.js";
import { formatBps, pendingCount } from "../domain/split.js";
import {
  STAGE_STATUS, canSee, contractById, getState, personOfName, providerList, splitInviteOf, custodyCents, draft, isProviderOf, myName, myNames, myParticipant, now, releasedCents, role, setDraft,
} from "../store.js";
import { appbar, btn, card, chip, circle, empty, esc, field, icon, kv, listCard, money, note, option, progress, row, screen, sheet } from "../ui.js";
import { authCode, bkPageHeader, bkReceipt } from "./btg-kit.js";
import { reviewDelivery } from "../domain/assistant.js";
import { nextStepLine, roleOf, stageShares } from "../domain/protected.js";
import { benefitsFor } from "../domain/points.js";
import { offerCard, paymentsSection, timelineCard, yieldCard } from "./protected.js";
import { channelLabel, updateSplitAmounts } from "./split.js";
import { switchRow } from "./confirm.js";
import { cancellationAmount, cancellationReason } from "../domain/cancellation.js";

const ATTACH_ICON = { photo: "camera", video: "video-camera", document: "file-text", location: "map-pin" };

export function stageRow(c, st, i) {
  const [label, tone, ic] = STAGE_STATUS[st.status];
  const detail =
    st.status === "released" ? `${money(st.valueCents)} · liberado em ${st.releasedAt}`
      : st.status === "split" ? `${money(st.split.providerCents)} ao prestador · acordo`
        : st.status === "awaitingApproval" ? `${money(st.valueCents)} · entrega enviada ${st.delivery.sentAt}`
          : `${money(st.valueCents)} · até ${st.due}`;
  return `<div class="stage-row">${circle(ic, tone === "neutral" ? "neutral" : tone, 32)}<div class="row-text"><strong>Marco ${i + 1} · ${esc(st.name)}${c.stages.length > 1 ? ` · ${stageShares(c.stages)[i]}%` : ""}</strong><small>${esc(detail)}</small></div>${chip(st.anticipation && st.status === "awaitingApproval" ? "Antecipado" : label, tone)}</div>`;
}

function servicos(s) {
  return screen({
    header: bkPageHeader(s, { title: "Pagamentos", sub: "O que você paga e recebe." }), tab: "servicos",
    body: `<div class="btn-row">${btn("Cobrar", { kind: "secondary small", action: "startCharge", iconName: "hand-coins" })}${btn("Pagar", { kind: "secondary small", action: "startPayment", iconName: "wallet" })}</div>
      ${paymentsSection(s)}`,
  });
}

function stageActions(s, c, st, i, isProvider) {
  if (c.cancellation?.status === "pending") return "";
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
  const link = st.linkedTo ? `<p class="small muted">${icon("tree-structure")} Liberado junto com o marco ${st.linkedTo.stage + 1} de ${esc(st.linkedTo.contractId)}</p>` : "";
  return reply || link || out.length ? `<div class="stage-actions">${reply}${link}${out.join("")}</div>` : "";
}

function serviceFooter(c, isProvider) {
  if (c.cancellation?.status === "pending" || c.completionReason === "cancelled") return "";
  const id = c.id;
  const awaitingIdx = c.stages.findIndex((st) => st.status === "awaitingApproval");
  const contestIdx = c.stages.findIndex((st) => ["awaitingApproval", "inProgress", "adjustRequested"].includes(st.status));
  const workIdx = c.stages.findIndex((st) => st.status === "inProgress" || st.status === "adjustRequested");
  if (!isProvider && c.status === "awaitingPayment" && c.entrada?.status !== "requested" && c.entrada?.status !== "countered") return btn(`Pagar ${money(payableCents(c))}`, { go: `#/pagar/${id}` });
  if (!isProvider && c.status === "active") {
    const buttons = `${contestIdx >= 0 ? btn("Abrir disputa", { kind: "secondary", action: "startDispute", data: { id, stage: contestIdx } }) : ""}${awaitingIdx >= 0 ? btn(`Aprovar marco ${awaitingIdx + 1}`, { action: "openApprove", data: { id, stage: awaitingIdx } }) : ""}`;
    return buttons ? `<div class="btn-row">${buttons}</div>` : "";
  }
  if (isProvider && workIdx >= 0) return btn(`Enviar entrega do marco ${workIdx + 1}`, { action: "startDelivery", data: { id, stage: workIdx } });
  return "";
}

/** The anticipation offer for whoever receives: today, with the fee already discounted. */
function anticipationOffer(s, c) {
  const i = c.stages.findIndex((st, idx) => st.status === "awaitingApproval" && anticipationCheck(s, c, idx).every(([, okItem]) => okItem));
  if (i < 0) return "";
  const { netCents } = anticipationValues(c.stages[i]);
  return offerCard({ ic: "lightning", title: `Receba hoje ${money(netCents)}`, text: `${c.stages.length > 1 ? `Do marco ${i + 1}` : "Da entrega"}, sem esperar a aprovação. Taxa já descontada.`, cta: "Receber agora", go: `#/antecipar/${c.id}/${i}` });
}

function servico(s, { id }) {
  const c = contractById(s, id);
  if (!canSee(c, s)) return screen({ header: appbar({ title: "Serviço" }), body: empty("Serviço não encontrado.") });
  const isProvider = isProviderOf(c, s);
  const released = releasedCents(c);
  const other = isProvider ? c.client : c.provider;
  const statusChip = c.completionReason === "cancelled" ? chip("Cancelado", "neutral") : c.cancellation?.status === "pending" ? chip("Cancelamento solicitado", "warn") : { awaitingPayment: chip("Aguardando pagamento", "warn"), funding: chip("Coletando pagamentos", "warn"), active: chip("Em andamento", "info"), completed: chip("Concluído", "pos") }[c.status];
  const entrada = c.entrada && c.entrada.status !== "paid" && c.entrada.status !== "refused"
    ? card(`<div class="row-between"><strong>Entrada</strong>${chip(c.entrada.status === "countered" ? `Contraproposta ${money(c.entrada.counterCents)}` : `Pedida ${money(c.entrada.requestedCents)}`, "warn")}</div>${!isProvider && c.entrada.status === "requested" ? btn("Decidir a entrada", { go: `#/entrada-decidir/${id}` }) : ""}${isProvider && c.entrada.status === "countered" ? btn("Aceitar contraproposta", { action: "acceptCounter", data: { id } }) : ""}`, "warn-soft")
    : "";
  const parent = c.parent ? contractById(s, c.parent.contractId) : null;
  const subs = s.contracts.filter((x) => x.parent?.contractId === c.id && isProviderOf(c, s));
  const links = [
    c.kind === "collective" ? row({ icon: "users-three", title: "Rateio e participantes", detail: `${c.participants.filter((p) => p.paid).length} de ${c.participants.length} pagaram`, go: `#/coletivo/${id}` }) : "",
    !isProvider && c.payment?.method === "credit" ? row({ icon: "credit-card", title: "Pagamento", detail: `${c.payment.count}x de ${money(c.payment.valueCents)} · custo total ${c.payment.cet}`, go: c.payment.creditId ? `#/ccb/${c.payment.creditId}` : "#/financeiro" }) : "",
    c.insurance ? row({ icon: "shield-check", title: "Seguro Aval da obra", detail: `${c.insurance.policy} · cobre ${money(c.insurance.coverageCents)}${c.insurance.paid ? "" : " · prêmio pendente"}`, go: `#/seguro/${id}` }) : "",
    parent ? row({ icon: "tree-structure", title: "Subcontrato da obra principal", detail: `${parent.title} · marco ${c.parent.stage + 1}`, go: `#/servico/${parent.id}` }) : "",
    ...subs.map((sub) => row({ icon: "tree-structure", title: `Subcontrato com ${sub.provider}`, detail: `${money(sub.totalCents)} · liberado em cascata`, go: `#/servico/${sub.id}` })),
    c.kind !== "collective" ? row({ icon: "chat-circle-text", title: "Conversa", detail: `${(s.messages[id] ?? []).length} mensagens · registrada no contrato`, go: `#/conversa/${id}` }) : "",
    c.kind === "recurring" ? row({ icon: "calendar-blank", title: "Serviço recorrente", detail: `Pix Automático de ${money(c.monthlyCents)} por mês · aprovação tácita em 3 dias`, tone: "pos" }) : "",
    isProvider && c.kind === "individual" && c.status === "active" ? `<div class="pad">${switchRow({ ic: "lightning", title: "Receber antes, sempre", on: Boolean(c.autoAnticipate), kind: "autoAnticipate", id: c.id, off: "toggleAutoAnticipation" })}</div>` : "",
    !isProvider && c.protected ? row({ icon: "star", title: "Benefícios deste pagamento", detail: benefitsFor(c).map((b) => b.title).join(" · "), go: "#/beneficios" }) : "",
    !isProvider && c.status === "awaitingPayment" && c.kind !== "collective" ? row({ icon: "piggy-bank", title: "Guardar no cofrinho para pagar", detail: "Separe o dinheiro e veja quanto rende", go: `#/cofrinho/${id}` }) : "",
    row({ icon: "sparkle", title: "Tirar dúvida com o assistente", detail: "Prazos, marcos, seguro e disputas", go: "#/assistente" }),
    row({ icon: "file-text", title: "Contrato e arbitragem", detail: `Assinado em ${c.signedAt} · arbitragem incluída`, go: `#/contrato/${id}` }),
  ].join("");
  return screen({
    header: appbar({ title: c.title }), fab: !isProvider,
    body: `${card(`<div class="row-between"><small class="muted">${esc(c.id)} · ${esc(other)}</small>${statusChip}</div><div class="amount dark">${money(c.totalCents)}</div>${progress(released / c.totalCents)}<div class="row-between small"><span class="pos-text">Liberado ${money(released)}</span><span>Guardado ${money(custodyCents(c))}</span></div>`)}
      <div class="now-bar" role="status">${icon("clock")}<span>${esc(c.completionReason === "cancelled" ? "Combinado cancelado. Consulte a devolução simulada." : c.cancellation?.status === "pending" ? "Aguardando aceite da outra parte. A liberação está pausada." : nextStepLine(c, roleOf(c, [...myNames(s)]) ?? "payer", now(s)))}</span></div>
      ${cancellationCard(s, c)}
      ${entrada}
      ${isProvider ? anticipationOffer(s, c) : yieldCard(s, c)}
      ${c.protected && !c.completionReason && c.cancellation?.status !== "pending" ? timelineCard(s, c) : ""}
      ${card(c.stages.map((st, i) => `${stageRow(c, st, i)}${stageActions(s, c, st, i, isProvider)}`).join(""), "flush stages")}
      ${c.protected ? card(`${kv("Prazo de entrega", c.dueDate)}${kv("Endereço", c.address)}<p class="small muted">${esc(c.description)}</p>`) : ""}
      ${listCard("", links)}
      ${card(`<strong>Continuar com a outra parte</strong><p class="small muted">Simule a participação de ${esc(other)} neste combinado. Nenhuma outra pessoa será contatada.</p>${btn("Simular outra parte", { kind: "secondary", action: "simulateCounterparty", data: { id } })}`)}`,
    footer: serviceFooter(c, isProvider),
  });
}

function cancellationCard(s, c) {
  if (c.completionReason === "cancelled") return card(`${kv("Devolução simulada", money(c.cancellation.amountCents))}${btn("Ver registro do cancelamento", { kind: "secondary", go: `#/devolucao/${c.id}` })}`);
  const request = c.cancellation;
  if (request?.status === "pending") return card(`<h3>Pedido de cancelamento</h3>${kv("A devolver na simulação", money(request.amountCents))}<p class="small">O valor já liberado não será alterado. A devolução só é registrada depois do aceite da outra parte.</p>${request.requestedBy === s.session.person ? note("Aguardando a resposta da outra parte.") : `${btn("Aceitar cancelamento e devolução", { action: "answerCancellation", data: { id: c.id, accept: "yes" } })}${btn("Manter o combinado", { kind: "text", action: "answerCancellation", data: { id: c.id, accept: "no" } })}`}`);
  if (cancellationReason(c)) return "";
  return card(`<details><summary>Cancelar este combinado</summary><p>Na simulação, as duas partes precisam aceitar. Será devolvido somente o valor ainda guardado: ${money(cancellationAmount(c))}. Valores já liberados permanecem como estão.</p>${btn("Pedir cancelamento", { kind: "secondary", action: "requestCancellation", data: { id: c.id } })}</details>`);
}

function devolucao(s, { id }) {
  const c = contractById(s, id);
  if (!canSee(c, s) || c.cancellation?.status !== "accepted") return screen({ header: appbar({ title: "Cancelamento" }), body: empty("Nenhuma devolução concluída neste combinado.") });
  return screen({ header: appbar({ close: `#/servico/${id}` }), body: bkReceipt({
    title: "Cancelamento e devolução simulados", when: new Date(c.cancellation.completedAt).toLocaleString("pt-BR"), valueCents: c.cancellation.amountCents,
    parties: [{ label: "Para quem pagou", name: c.client, lines: [c.payment?.origin ?? "Nenhum pagamento realizado"] }],
    facts: [["Combinado", c.id], ["Situação", "Cancelamento aceito pelas duas partes"], ["Ainda guardado", money(custodyCents(c))]],
  }), footer: btn("Ver combinado", { go: `#/servico/${id}` }) });
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
  const review = reviewDelivery({ stageName: st.name, delivery: st.delivery });
  const check = card(`<div class="row-gap">${icon("sparkle")}<strong>Conferência do assistente</strong></div>${review.notes.map((n) => `<div class="check-line ${n.tone === "pos" ? "pos" : "warn"}">${icon(n.tone === "pos" ? "check-circle" : "warning-circle")}<span>${esc(n.text)}</span></div>`).join("")}<small class="muted">${review.ok ? "Há anexos informados. O assistente não verifica a qualidade do serviço." : "Vale conferir antes de aprovar. A decisão é sua."}</small>`, "ai-card");
  return sheet(`Aprovar marco ${stage + 1}`, `<p class="muted">${esc(c.provider)} enviou a entrega em ${esc(st.delivery.sentAt)}. Confira antes de liberar.</p>
    <p class="quote">“${esc(st.delivery.description)}”</p><div class="thumbs">${thumbs}</div>${check}${risk}
    ${card(`<strong>O que foi combinado neste marco</strong>${items}`)}
    ${subs.length ? note(`Ao aprovar, ${subs.map((x) => x.provider).join(", ")} recebe na mesma hora pelo subcontrato com ${c.provider}.`, "info", "tree-structure") : ""}
    <div class="note warn">${icon("clock")}<span>Sem resposta até ${esc(st.delivery.deadline)}, o marco é aprovado automaticamente. <button type="button" class="link" data-action="simulateDeadline" data-id="${esc(id)}" data-stage="${stage}">Simular fim do prazo</button></span></div>
    ${btn(`Aprovar e liberar ${money(st.valueCents)}`, { action: "approveStage", data: { id, stage } })}
    ${card(`<strong>Liberar só uma parte</strong>${field("Liberar agora (R$)", { bind: "partial.amount", value: draft("partial.amount", (Math.round(st.valueCents * 0.75) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })), inputmode: "decimal" })}${btn("Liberar parte e segurar o resto", { kind: "secondary", action: "releasePartial", data: { id, stage } })}`)}
    ${field("Precisa de ajuste? Conte ao prestador", { bind: "reply", value: reply, multiline: true, rows: 2, placeholder: "Ex.: falta rejuntar o box" })}
    ${btn("Pedir ajuste ao prestador", { kind: "secondary", action: "requestAdjust", data: { id, stage } })}`);
}

function comprovante(s, { id, stage }) {
  const c = contractById(s, id);
  const st = canSee(c, s) ? c.stages[Number(stage)] : null;
  if (!st || st.status !== "released") return screen({ header: appbar({ title: "Comprovante" }), body: empty("Este marco ainda não foi liberado.") });
  const cascaded = s.contracts.flatMap((x) => x.stages.filter((y) => y.linkedTo?.contractId === id && y.linkedTo.stage === Number(stage) && y.status === "released").map(() => x));
  const facts = [
    ["Marco", `${Number(stage) + 1} · ${st.name}`], ["Forma", st.releaseMode], ["Ainda guardado", money(custodyCents(c))],
    ...(st.invoiceId ? [["Nota fiscal", `${st.invoiceId} emitida`]] : []), ...(st.anticipation ? [["Observação", "Quita a antecipação do prestador"]] : []),
  ];
  return screen({
    cls: "bk-receipt-screen", header: appbar({ close: `#/servico/${id}` }),
    body: `${bkReceipt({
      title: "Comprovante de liberação", when: `Feito em ${st.releasedAt}${st.releasedAt.length <= 5 ? "/2026" : ""}`, valueCents: st.valueCents,
      parties: [
        { label: "Para", name: c.provider, lines: ["Banco BTG Pactual S.A.", "Conta de recebimentos Aval"] },
        { label: "De", name: `Valor guardado ${c.id}`, lines: [`Aprovado por ${c.client}`, "Banco BTG Pactual S.A."] },
      ],
      facts, auth: authCode(`${id}:${stage}:${st.releasedAt}`),
    })}${cascaded.length ? `<div class="bk-pad">${cascaded.map((x) => note(`Liberação em cascata: ${x.provider} recebeu ${money(x.stages[0].valueCents)} pelo subcontrato ${x.id}.`, "pos", "tree-structure")).join("")}</div>` : ""}`,
    footer: btn("Compartilhar comprovante do Aval", { action: "openProof", data: { id, stage }, iconName: "share-network" }),
  });
}

function entradaDecidir(s, { id }) {
  const c = contractById(s, id);
  if (!c?.entrada) return screen({ header: appbar({ title: "Pedido de entrada" }), body: empty("Não há entrada pendente.") });
  const choice = draft("entrada.choice", "pay");
  const first = c.stages[0];
  return screen({
    header: appbar({ title: "Pedido de entrada" }),
    body: `${card(`<div class="row-gap">${circle("briefcase")}<div><strong>${esc(c.provider)}</strong><small class="muted">${esc(providerList(s).find((p) => p.name === c.provider)?.doc ?? "")}</small></div></div><p>Pediu ${money(c.entrada.requestedCents)} de entrada para comprar material antes do marco 1.</p>${kv("Valor pedido", money(c.entrada.requestedCents))}${kv("Desconta do marco 1", `${money(first.valueCents)} → ${money(first.valueCents - c.entrada.requestedCents)}`)}${kv("Fica fora do Aval", money(c.entrada.requestedCents), "neg-text")}`)}
      <h3>O que você decide?</h3>
      ${option({ title: "Pagar a entrada", sub: "Vai direto ao prestador e fica fora do valor protegido", selected: choice === "pay", action: "chooseEntrada", data: { choice: "pay" } })}
      ${option({ title: "Propor outro valor", sub: "O prestador recebe sua contraproposta", selected: choice === "counter", action: "chooseEntrada", data: { choice: "counter" } })}
      ${choice === "counter" ? field("Contraproposta (R$)", { bind: "entrada.counter", value: draft("entrada.counter"), inputmode: "decimal" }) : ""}
      ${option({ title: "Recusar e manter tudo guardado", sub: "O serviço segue só com marcos", selected: choice === "refuse", action: "chooseEntrada", data: { choice: "refuse" } })}`,
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
  if (isProvider) footer = "";
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
    body: `${card(`<div class="row-between"><small class="muted">${esc(c.id)} · Dividido</small>${head}</div><div class="amount dark">${money(c.totalCents)}</div>${progress(c.paidInCents / c.totalCents)}<small>${money(c.paidInCents)} de ${money(c.totalCents)} já guardado</small>`)}
      ${card(`<div class="row-between"><strong>Quem divide</strong><small class="muted">${c.participants.length} pessoas</small></div>${c.participants.map(row).join("")}${declined}`)}
      ${note(waiting ? "O pagamento abre quando todos os convidados responderem. Se alguém recusar, as partes são recalculadas." : "Cada marco só começa com 100% das partes pagas.")}
      ${btn("Ver marcos do serviço", { kind: "text", go: `#/servico/${id}` })}`,
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
    const needsBtg = outside && !p.btg;
    action = needsBtg ? note("Para participar, entre com a sua conta BTG. Se ainda não tiver, ela é aberta na hora.", "info", "bank") : outside ? note(`Conta BTG conectada: ${p.btg.name}.`, "pos", "check-circle") : "";
    footer = needsBtg
      ? btn("Entrar com a conta BTG", { action: "btgForShare", data: { token }, iconName: "bank" })
      : `${btn("Aceitar e participar", { action: "acceptSplit", data: { token } })}${btn("Recusar convite", { kind: "text", action: "declineSplit", data: { token } })}`;
  } else if (p.paid) action = note(`Sua parte foi paga com ${p.origin}.`, "pos", "check-circle");
  else if (waiting) action = note(`Você aceitou. Falta(m) ${waiting} pessoa(s) responder; depois disso o pagamento abre.`, "info", "clock");
  else if (!isContract) action = note("Todos responderam. Falta o prestador aceitar o serviço; você será avisado para pagar.", "info", "clock");
  else footer = outside ? btn(`Pagar ${money(p.shareCents)} com Pix da conta BTG`, { action: "payShareByLink", data: { token }, iconName: "qr-code" }) : btn(`Pagar minha parte ${money(p.shareCents)}`, { go: `#/pagar/${holder.id}` });
  const list = holder.participants.map((x) => kv(`${x.name}${x === p ? " (você)" : ""}`, `${formatBps(x.bps)} · ${money(x.shareCents)} · ${x.paid ? "pago" : x.status === "pending" ? "aguardando" : "aceitou"}`)).join("");
  return screen({
    header: appbar({ title: "Convite para dividir" }),
    body: `<div class="center-block">${circle("users-three", "info", 56)}<h2>${esc(holder.client)} convidou você para dividir um serviço</h2><p class="muted">${esc(holder.title)} com ${esc(holder.provider)}</p></div>
      ${card(`<small class="muted">Sua parte</small><div class="amount dark">${money(p.shareCents)}</div><small class="muted">${formatBps(p.bps)} do total de ${money(holder.totalCents)}</small>`)}
      ${card(`<strong>Quem divide</strong>${list}`)}
      ${action}
      ${note("O dinheiro fica guardado no banco e só chega a quem recebe quando a entrega é aprovada. Se alguém recusar, as partes são recalculadas.", "info", "shield-check")}`,
    footer,
  });
}

export const clientRoutes = {
  "devolucao/:id": devolucao,
  servicos, "servico/:id": servico, "comprovante/:id/:stage": comprovante, "entrada-decidir/:id": entradaDecidir, "coletivo/:id": coletivo, "dividir/:token": dividir,
};
export const clientSheets = { aprovar: approveSheet };

export const clientActions = {
  reviewStage: ({ id, stage }) => {
    go(`#/servico/${id}`);
    actions.openApprove({ id, stage });
  },
  setTab: ({ tab }) => setDraft("servicos.tab", tab, false),
  shareReceipt: () => actions.copied(),
};

/** Keeps the split amounts in step with typing, without re-rendering the form. */
export function liveUpdate(path) {
  if (path.startsWith("novo.splitPct")) updateSplitAmounts(getState());
}
