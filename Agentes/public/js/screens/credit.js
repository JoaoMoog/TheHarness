// Credit screens: request with simulator, instant decision with CCB signature, my credits. The credit policy decides.
import { RESERVE, cetLabel, creditSimulation, payableCents, prepayValue } from "../actions/index.js";
import { priceInstallment } from "../domain/credit.js";
import { account, contractById, draft, isClientOf, myParticipant, parseReais, person } from "../store.js";
import { appbar, btn, card, checkbox, chip, circle, empty, esc, field, kv, listCard, money, note, option, row, screen, timeline } from "../ui.js";

const COUNTS = [3, 6, 12, 18, 24];
const GRACE = [0, 30, 60];
const DUE_DAYS = [5, 10, 15, 20];
const CARD_MONTHLY_RATE = 0.0299;
const CARD_COUNT = 12;
const pct = (r) => `${(r * 100).toFixed(2).replace(".", ",")}% a.m.`;
const pills = (values, current, action, key, label) =>
  `<div class="choice-list wrap">${values.map((v) => `<button type="button" class="pill-option ${Number(current) === v ? "on" : ""}" data-action="${action}" data-${key}="${v}">${label(v)}</button>`).join("")}</div>`;

/** Contracts the person can still pay, so the credit goes straight to their custody. */
function payable(s) {
  return s.contracts.filter((c) => {
    if (!isClientOf(c, s)) return false;
    if (c.kind === "collective") return !myParticipant(c, s)?.paid;
    return c.status === "awaitingPayment";
  });
}

function simCard(s) {
  const sim = creditSimulation(s);
  if (!sim) return note("Informe um valor válido para simular.", "warn", "warning-circle");
  const amount = parseReais(draft("credito.amount"));
  const count = Number(draft("credito.count"));
  const cardInst = priceInstallment(amount, CARD_MONTHLY_RATE, CARD_COUNT);
  return `${card(`<small class="muted">Parcela</small><div class="amount dark">${count}x de ${money(sim.installmentCents)}</div>
    ${kv("Taxa de juros", pct(sim.monthlyRate))}${kv("IOF", money(sim.iofCents))}${kv("CET", cetLabel(sim.cetYear), "dest")}${kv("Total a pagar", money(sim.totalCents))}${kv("Primeira parcela", `em ${sim.firstDueDays} dias`)}`)}
    ${listCard("Compare", `${row({ icon: "hand-coins", title: "Crédito Aval", detail: `${count}x · CET ${cetLabel(sim.cetYear)}`, value: money(sim.installmentCents), tone: "pos" })}${row({ icon: "credit-card", title: "Cartão Nexo", detail: `${CARD_COUNT}x · ${pct(CARD_MONTHLY_RATE)}`, value: money(cardInst), tone: "neutral" })}${row({ icon: "qr-code", title: "Pix à vista", detail: "Sem juros · sai do seu saldo hoje", value: money(amount), tone: "neutral" })}`)}`;
}

function credito(s) {
  const acc = account(s);
  const purpose = draft("credito.purpose", RESERVE);
  const options = payable(s).map((c) => option({ title: c.title, sub: `Paga ${money(payableCents(c, s))} direto na custódia`, selected: purpose === c.id, action: "setCreditPurpose", data: { purpose: c.id } })).join("");
  return screen({
    header: appbar({ title: "Pedir crédito", tone: "ink" }),
    body: `${card(`<small class="muted">Pré-aprovado para você</small><div class="amount dark">${money(acc.preApprovedCents)}</div><small class="muted">Taxa a partir de 1,79% a.m. · até 24x · carência de até 60 dias</small>`, "soft")}
      ${card(field("Quanto você precisa? (R$)", { bind: "credito.amount", value: draft("credito.amount"), inputmode: "decimal" }))}
      <h3>Para quê</h3>${options}${option({ title: "Reservar para um novo serviço", sub: "Fica aprovado e você usa ao pagar", selected: purpose === RESERVE, action: "setCreditPurpose", data: { purpose: RESERVE } })}
      <h3>Em quantas parcelas</h3>${pills(COUNTS, draft("credito.count"), "setCreditCount", "n", (v) => `${v}x`)}
      <h3>Carência</h3>${pills(GRACE, draft("credito.grace"), "setCreditGrace", "days", (v) => (v ? `${v} dias` : "Sem carência"))}
      <div id="credit-sim">${simCard(s)}</div>
      ${card(field("Renda mensal (R$)", { bind: "credito.income", value: draft("credito.income"), inputmode: "decimal" }))}
      <h3>Dia do vencimento</h3>${pills(DUE_DAYS, draft("credito.dueDay"), "setDueDay", "day", (v) => `Dia ${v}`)}
      ${checkbox("Autorizo a consulta ao SCR do Banco Central e a bureaus de crédito.", { bind: "credito.consent", checked: draft("credito.consent") })}
      ${note("O dinheiro nunca cai na sua conta: vai direto para a custódia do serviço. A decisão é da política de crédito do Nexo, na hora.", "info", "shield-check")}`,
    footer: btn("Pedir crédito", { action: "submitCredit" }),
  });
}

const REASON_TEXT = {
  late: "Há uma parcela atrasada. Assim que ela for paga, você pode pedir de novo.",
  limit: "O pedido passou do limite disponível para você hoje.",
  income: "A parcela passaria de 30% da sua renda somada às parcelas que você já paga.",
};
const head = (ic, tone, title, sub) => `<div class="center-block">${circle(ic, tone, 64)}<h2>${title}</h2><p class="muted">${sub}</p></div>`;

function approvedView(s, r, id) {
  const d = r.decision;
  const lower = r.status === "approvedLower";
  const p = person(s);
  return screen({
    header: appbar({ title: "Análise de crédito" }),
    body: `${head(lower ? "hand-coins" : "check-circle", lower ? "warn" : "pos", lower ? `Aprovamos ${money(d.approvedCents)}` : "Crédito aprovado", lower ? `Você pediu ${money(r.amountCents)}.` : `${money(d.approvedCents)} ${r.contractId ? `para ${esc(r.purposeLabel)}` : "reservados para o seu próximo serviço"}`)}
      ${lower ? note(REASON_TEXT[d.reason], "warn", "info") : ""}
      ${card(`<strong>Cédula de Crédito Bancário</strong>${kv("Emitente", `${p.name} · ${p.clientDoc}`)}${kv("Credor", "Banco Nexo S.A.")}${kv("Valor", money(d.approvedCents))}${kv("Parcelas", `${r.count}x de ${money(d.simulation.installmentCents)} · todo dia ${r.dueDay}`)}${kv("Taxa", pct(d.monthlyRate))}${kv("IOF", money(d.simulation.iofCents))}${kv("CET", cetLabel(d.simulation.cetYear), "dest")}${kv("Total", money(d.simulation.totalCents))}${kv("Finalidade", r.purposeLabel)}${r.exception ? kv("Decisão", "Exceção aprovada por analista") : ""}`)}
      ${note("O valor vai para a custódia do serviço e só chega ao prestador por etapa aprovada. Dá para antecipar ou quitar quando quiser; atraso gera multa de 2% e pausa novos créditos.", "info", "lock-simple")}
      ${checkbox("Li e aceito a Cédula de Crédito Bancário.", { bind: "credito.ccbOk", checked: draft("credito.ccbOk") })}
      ${lower && !r.openFinanceShared ? btn("Compartilhar Open Finance e pedir de novo", { kind: "text", go: "#/open-finance" }) : ""}
      ${lower ? btn("Pedir o valor inteiro de novo", { kind: "text", action: "retryCredit", data: { id } }) : ""}`,
    footer: `${btn(`Assinar e contratar ${money(d.approvedCents)}`, { action: "signCredit", data: { id }, iconName: "fingerprint" })}${btn("Não quero", { kind: "text", action: "declineCredit", data: { id } })}`,
  });
}

function analise(s, { id }) {
  const r = s.creditRequests.find((x) => x.id === id && x.owner === s.session.person);
  if (!r) return screen({ header: appbar({ title: "Análise" }), body: empty("Pedido não encontrado.") });
  if (r.status === "analysis") {
    return screen({
      header: appbar({ title: "Análise de crédito" }),
      body: `${head("hourglass-medium", "info", "Estamos analisando", `${r.id} · ${money(r.amountCents)} em ${r.count}x`)}
        ${card(timeline([["Proposta recebida", r.createdAt, "ok"], ["Consulta ao SCR e bureaus", "Concluída", "ok"], ["Política de crédito Nexo", "Em andamento", "now"], ["Resposta", `Até ${r.readyAt}`, "next"]]))}
        ${note("Costuma levar até 1 dia útil. Avance o relógio da demonstração ou simule abaixo.")}`,
      footer: btn("Simular análise concluída", { action: "finishCreditAnalysis", data: { id } }),
    });
  }
  if (r.status === "approved" || r.status === "approvedLower") return approvedView(s, r, id);
  if (r.status === "denied") {
    const late = r.decision.reason === "late";
    return screen({
      header: appbar({ title: "Análise de crédito" }),
      body: `${head("warning-circle", "neg", "Não aprovamos agora", REASON_TEXT[r.decision.reason])}${card(kv("Pedido", `${money(r.amountCents)} em ${r.count}x`))}`,
      footer: `${late ? btn("Pagar a parcela atrasada", { go: "#/financeiro" }) : ""}${btn("Pedir de novo", { kind: late ? "text" : "primary", action: "retryCredit", data: { id } })}`,
    });
  }
  return screen({ header: appbar({ title: "Análise de crédito" }), body: empty(r.status === "signed" ? "Crédito contratado." : "Pedido encerrado."), footer: btn("Meus créditos", { go: "#/creditos" }) });
}

function contratado(s, { id }) {
  const r = s.creditRequests.find((x) => x.id === id && x.owner === s.session.person);
  const c = r?.contractId ? contractById(s, r.contractId) : null;
  return screen({
    header: appbar({ title: "Crédito contratado" }),
    body: `<div class="center-block">${circle("seal-check", "pos", 64)}<h2>Crédito contratado</h2><div class="amount dark">${money(r?.decision?.approvedCents ?? 0)}</div><p class="muted">${c ? `Pronto para pagar ${esc(c.title)}.` : "Fica reservado para o próximo serviço que você contratar."}</p></div>
      ${note("O dinheiro só sai para a custódia de um serviço. Você acompanha as parcelas em Meus créditos.", "info", "shield-check")}`,
    footer: `${c ? btn(`Pagar ${c.title}`, { go: `#/pagar/${c.id}` }) : btn("Contratar um serviço", { go: "#/novo/1" })}${btn("Meus créditos", { kind: "text", go: "#/creditos" })}`,
  });
}

const REQUEST_LABEL = { analysis: ["Em análise", "info"], approved: ["Aprovado", "pos"], approvedLower: ["Aprovado com valor menor", "warn"], denied: ["Não aprovado", "neg"] };

function creditos(s) {
  const mine = s.credits.filter((c) => c.owner === s.session.person);
  const requests = s.creditRequests.filter((r) => r.owner === s.session.person && REQUEST_LABEL[r.status]);
  return screen({
    header: appbar({ title: "Meus créditos", tone: "ink" }),
    body: `${requests.length ? listCard("Pedidos", requests.map((r) => row({ icon: "hourglass-medium", title: `${r.id} · ${money(r.amountCents)}`, detail: r.purposeLabel, go: `#/credito/analise/${r.id}`, extra: chip(...REQUEST_LABEL[r.status]) })).join("")) : ""}
      ${listCard("Contratados", mine.length ? mine.map((c) => row({ icon: "hand-coins", title: `${c.id} · ${c.purpose}`, detail: `${c.count}x de ${money(c.installmentCents)} · CET ${c.cet}`, go: `#/ccb/${c.id}`, extra: c.status === "paid" ? chip("Quitado", "pos") : "" })).join("") : empty("Nenhum crédito contratado."))}`,
    footer: btn("Pedir crédito", { go: "#/credito", iconName: "plus" }),
  });
}

const INSTALLMENT_TONE = { paid: ["Paga", "pos"], late: ["Atrasada", "neg"], open: ["Em aberto", "neutral"] };

function ccb(s, { id }) {
  const c = s.credits.find((x) => x.id === id && x.owner === s.session.person);
  if (!c) return screen({ header: appbar({ title: "Crédito" }), body: empty("Crédito não encontrado.") });
  const inst = s.installments.filter((i) => i.creditId === id);
  const open = inst.filter((i) => i.status !== "paid");
  const balance = prepayValue(c, open);
  return screen({
    header: appbar({ title: c.id }),
    body: `${card(`<small class="muted">${esc(c.purpose)} · assinado em ${esc(c.signedAt)}</small><small>Saldo devedor hoje</small><div class="amount dark">${money(balance)}</div>${kv("Contratado", money(c.principalCents))}${kv("Parcelas", `${inst.length - open.length} de ${c.count} pagas`)}${kv("CET", c.cet)}`)}
      ${listCard("Parcelas", inst.map((i) => row({ icon: "credit-card", title: `Parcela ${i.n} de ${i.of}`, detail: `Vence ${i.due}`, value: money(i.valueCents), extra: chip(...INSTALLMENT_TONE[i.status]) })).join(""))}
      ${open.length ? note("Antecipar ou quitar desconta os juros que ainda não correram.", "info", "percent") : ""}`,
    footer: open.length ? `<div class="btn-row">${btn("Antecipar 2 parcelas", { kind: "secondary", action: "prepayCredit", data: { id } })}${btn("Quitar", { action: "payoffCredit", data: { id } })}</div>${btn("Portabilidade", { kind: "text", action: "portability" })}` : btn("Voltar", { kind: "secondary", go: "#/creditos" }),
  });
}

export const creditRoutes = {
  credito, "credito/analise/:id": analise, "credito/ok/:id": contratado,
  creditos, "ccb/:id": ccb,
};

/** Keeps the simulation in step with typing, without re-rendering the form. */
export function creditLiveUpdate(path, s) {
  if (path !== "credito.amount") return;
  const el = document.getElementById("credit-sim");
  if (el) el.innerHTML = simCard(s);
}
