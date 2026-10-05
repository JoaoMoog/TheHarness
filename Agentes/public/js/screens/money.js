// Money screens in the Nexo Banking style: pay a service, Pix, receipt, finance (both sides) and statement by day.
import { CHECKOUT_INSTALLMENTS, payableCents } from "../actions/index.js";
import { parseDdMm } from "../domain/dates.js";
import {
  account, availableLimitCents, canSee, contractById, isClientOf, creditBlockedReason, custodyCents, draft, installmentCents, isNexoConnected, lateInstallments,
  limitOf, myContracts, myInstallments, myName, myParticipant, outstandingCents, role,
} from "../store.js";
import { appbar, btn, card, chip, circle, empty, esc, icon, kv, money, note, option, screen, timeline } from "../ui.js";
import {
  authCode, bkBanner, bkFacts, bkItem, bkLimit, bkLink, bkMonthBars, bkPageHeader, bkReceipt, bkSection, dayLabel, fullDate, monthName,
} from "./nexo-kit.js";
import { shown } from "./chrome.js";

const CHECKOUT_CET = "29,05% a.a.";

function creditSub(s, blocked, inst) {
  if (blocked === "noAccount") return "Conecte a conta Nexo para parcelar";
  if (blocked === "late") return "Pausado: há uma parcela atrasada";
  if (blocked === "limit") return `Limite disponível ${money(availableLimitCents(s))}`;
  return `${CHECKOUT_INSTALLMENTS}x de ${money(inst)} · CET ${CHECKOUT_CET}`;
}

function blockedHelp(blocked, id) {
  if (blocked === "late") return `${note("Seu crédito volta assim que a parcela atrasada for paga.", "warn", "warning-circle")}${btn("Ver parcela em aberto", { kind: "text", go: "#/financeiro" })}`;
  if (blocked === "limit") return `${note("O valor passa do seu limite. Peça mais limite: a análise considera sua renda e, se quiser, dados do Open Finance.", "info", "hand-coins")}${btn("Pedir mais limite", { kind: "secondary", action: "startCreditFor", data: { id } })}`;
  if (blocked === "noAccount") return `${note("Sem a conta Nexo, o Aval funciona só à vista, com custódia.", "info", "bank")}${btn("Conectar conta Nexo", { kind: "secondary", go: "#/conectar" })}`;
  return "";
}

function pagar(s, { id }) {
  const c = contractById(s, id);
  if (!c || !isClientOf(c, s)) return screen({ header: appbar({ title: "Pagar" }), body: empty("Nada a pagar neste serviço.") });
  const amount = payableCents(c, s);
  const blocked = creditBlockedReason(s, amount);
  const reserved = isNexoConnected(s) ? account(s)?.reservedCredit : null;
  const method = draft(`pay.${id}`, reserved ? "reserved" : blocked ? "pix" : "credit");
  const inst = installmentCents(amount, CHECKOUT_INSTALLMENTS);
  const premium = c.insurance && !c.insurance.paid ? c.insurance.premiumCents : 0;
  const reservedRest = reserved ? Math.max(0, amount - reserved.remainingCents) : 0;
  const footerLabel = method === "reserved" && reserved
    ? `Pagar com o crédito aprovado${reservedRest ? ` + ${money(reservedRest)} no Pix` : ""}`
    : method === "credit" && !blocked ? `Pagar ${money(amount)} em ${CHECKOUT_INSTALLMENTS}x` : `Pagar ${money(amount)} com Pix`;
  return screen({
    header: appbar({ title: "Pagar serviço" }),
    body: `${card(`<small class="muted">${esc(c.title)} · ${esc(c.id)}</small><div class="amount dark">${money(amount)}</div><small class="muted">${c.kind === "collective" ? "Sua parte no contrato coletivo" : "Vai para custódia e é liberado por etapa aprovada."}</small>${premium ? kv("Inclui o Seguro Aval da obra", money(premium)) : ""}`)}
      <h3>Como você quer pagar?</h3>
      ${reserved ? option({ title: `Crédito aprovado ${reserved.creditId}`, sub: `${money(reserved.remainingCents)} disponíveis · ${reserved.count}x de ${money(reserved.installmentCents)}${reservedRest ? ` · o restante vai no Pix` : ""}`, selected: method === "reserved", action: "choosePayMethod", data: { id, method: "reserved" } }) : ""}
      ${option({ title: "Parcelado no crédito Aval", sub: creditSub(s, blocked, inst), value: blocked ? "" : money(inst * CHECKOUT_INSTALLMENTS), selected: method === "credit" && !blocked, disabled: Boolean(blocked), action: "choosePayMethod", data: { id, method: "credit" }, extra: blocked ? "" : chip(`Limite disponível ${money(availableLimitCents(s))}`, "pos") })}
      ${option({ title: "À vista com Pix", sub: isNexoConnected(s) ? "Saldo da conta Nexo ou outro banco" : "Pix de qualquer banco", value: money(amount), selected: method === "pix" || (Boolean(blocked) && method === "credit"), action: "choosePayMethod", data: { id, method: "pix" } })}
      ${blockedHelp(blocked, id)}
      ${method === "credit" && !blocked ? note("A primeira parcela vence em 30 dias. O prestador recebe cada etapa no dia da aprovação.") : ""}
      ${!blocked && !reserved ? btn("Simular outro prazo ou carência", { kind: "text", action: "startCreditFor", data: { id } }) : ""}`,
    footer: btn(footerLabel, { action: "confirmPay", data: { id } }),
  });
}

function pix(s) {
  const p = s.ui.payment;
  if (!p) return screen({ header: appbar({ title: "Pix" }), body: empty("Nenhum pagamento em andamento.") });
  const balance = account(s)?.balanceCents ?? 0;
  return screen({
    header: appbar({ title: "Pagar com Pix" }),
    body: `${card(`<div class="center-block"><small class="muted">${esc(p.label)}</small><div class="amount dark">${money(p.amountCents)}</div><div class="qr">${icon("qr-code")}</div><p class="small muted">Pix copia e cola</p><code class="pix-code">00020126580014br.gov.bcb.pix0136aval-${esc(p.kind)}-demo</code></div>`)}
      ${isNexoConnected(s) ? card(`<div class="row-between"><div><strong>Pagar com saldo da conta Nexo</strong><small class="muted">Saldo ${money(balance)}</small></div>${btn("Pagar", { kind: "secondary small", action: "simulatePix", data: { source: "saldo" }, disabled: balance < p.amountCents })}</div>`) : ""}
      ${note("De outro banco, a confirmação chega em segundos. Aqui, simule a confirmação.")}`,
    footer: `${btn("Simular Pix de outro banco", { action: "simulatePix", iconName: "check-circle" })}${btn("Copiar código", { kind: "text", action: "copied" })}`,
  });
}

function pago(s, { id }) {
  const c = contractById(s, id);
  if (!c || !canSee(c, s)) return screen({ header: appbar({ title: "Pagamento" }), body: empty("Pagamento não encontrado.") });
  const share = myParticipant(c, s);
  const pending = c.kind === "collective" ? c.participants.filter((p) => !p.paid).length : 0;
  const valueCents = c.kind === "collective" ? share?.shareCents ?? 0 : c.paidInCents ?? 0;
  const situation = c.kind === "collective"
    ? `Sua parte ${share?.paid ? "está paga" : "ainda está pendente"}. ${pending ? `Faltam ${pending} participante(s).` : "Todos pagaram: a etapa 1 já pode começar."}`
    : `Protegido em custódia.${c.status === "active" ? " O prestador já pode começar a etapa 1." : ""}`;
  const target = c.kind === "collective" ? `#/coletivo/${id}` : `#/servico/${id}`;
  return screen({
    cls: "bk-receipt-screen", header: appbar({ close: target }),
    body: `${bkReceipt({
      title: "Pagamento confirmado", when: `Feito em ${fullDate()}`, valueCents,
      parties: [
        { label: "Para", name: "Custódia Aval", lines: [`Contrato ${c.id}`, "Banco Nexo S.A."] },
        { label: "De", name: myName(s), lines: [isNexoConnected(s) ? account(s).nexo.label : "Pix de outro banco"] },
      ],
      facts: [["Serviço", c.title], ["Situação", situation]], auth: authCode(`pago:${id}:${valueCents}`),
    })}${c.insurance?.paid ? `<div class="bk-pad">${note(`Seguro Aval ${c.insurance.policy} ativo.`, "pos", "shield-check")}</div>` : ""}`,
    footer: btn("Ver serviço", { go: target }),
  });
}

/** Installments grouped by month for the bill-style bars: paid, open (the next one), late or future. */
function monthBars(s) {
  const groups = new Map();
  for (const i of myInstallments(s)) {
    const d = parseDdMm(i.due);
    const key = d.getFullYear() * 12 + d.getMonth();
    const g = groups.get(key) ?? { date: d, cents: 0, states: [] };
    groups.set(key, { ...g, cents: g.cents + i.valueCents + (i.lateFeeCents ?? 0), states: [...g.states, i.status] });
  }
  const sorted = [...groups.entries()].sort(([a], [b]) => a - b).map(([, g]) => g);
  const firstOpen = sorted.findIndex((g) => g.states.includes("open"));
  return sorted.map((g, idx) => ({
    label: monthName(g.date), cents: g.cents,
    state: g.states.includes("late") ? "late" : g.states.every((x) => x === "paid") ? "paid" : idx === firstOpen ? "open" : "future",
  }));
}

const lateCards = (late) => (late.length
  ? `<div class="bk-pad">${late.map((i) => card(`<div class="row-gap neg-text">${icon("warning-circle")}<strong>Parcela ${i.n} de ${i.of} atrasada</strong></div><p class="small neg-text">${money(i.valueCents)} + ${money(i.lateFeeCents)} de juros. O crédito volta após o pagamento.</p>${btn(`Pagar ${money(i.valueCents + i.lateFeeCents)} com Pix`, { kind: "danger", action: "payInstallment", data: { id: i.id } })}`, "danger-soft")).join("")}</div>`
  : "");

/** Collection steps, shown under the bars while an installment is late. */
const collectionSteps = (s, late) => (late.length
  ? card(`<strong>Régua de cobrança</strong>${timeline([["Lembrete", "3 dias antes do vencimento", "ok"], ["Vencimento", account(s).pixAuto ? "Pix Automático no dia" : "Pix no app", "ok"], ["Juros e Pix pronto", "1 dia depois", "now"], ["Crédito pausado", "Até a parcela ser paga", "now"], ["Negativação", `${s.bankSettings.negativationDays} dias depois`, "next"]])}`)
  : "");

function clientFinance(s) {
  const late = lateInstallments(s);
  const next = myInstallments(s).find((i) => i.status === "open");
  const acc = account(s);
  const credits = s.credits.filter((c) => c.owner === s.session.person);
  const months = monthBars(s);
  const shared = acc.openFinance.status === "shared";
  return screen({
    cls: "bk-flat", tab: "financeiro",
    header: bkPageHeader(s, { title: "Financeiro", sub: "Limite, parcelas e créditos dos seus serviços." }),
    body: `${lateCards(late)}
      <section class="bk-panel">${bkLimit(s, { title: "Limite para contratar", totalCents: limitOf(s, s.session.person), usedCents: outstandingCents(s), freeCents: availableLimitCents(s), freeText: late.length ? "Pausado" : "", go: "#/credito" })}
        ${bkFacts([["Próximo vencimento", next ? `${next.due} · ${money(next.valueCents)}` : "Nenhum"], ["Open Finance", shared ? acc.openFinance.banks.join(", ") : "Não compartilhado"]])}</section>
      ${months.length ? `<section class="bk-section"><div class="bk-section-head"><h3>Parcelas</h3>${bkLink("Extrato", "#/extrato")}</div>${bkMonthBars(s, months)}</section>` : ""}
      <div class="bk-pad">${collectionSteps(s, late)}${card(`<div class="toggle-row">${circle("calendar-blank", acc.pixAuto ? "pos" : "neutral")}<div><strong>Pix Automático nas parcelas</strong><small>Paga no vencimento com o saldo Nexo e evita atraso</small></div><button type="button" class="toggle ${acc.pixAuto ? "on" : ""}" role="switch" aria-checked="${Boolean(acc.pixAuto)}" aria-label="Pix Automático" data-action="togglePixAuto"><span></span></button></div>`)}
        ${acc.reservedCredit ? card(`<div class="row-between"><strong>Crédito aprovado para serviços</strong>${chip(money(acc.reservedCredit.remainingCents), "pos")}</div><small class="muted">Use ao pagar um serviço. O dinheiro vai direto para a custódia.</small>`, "soft") : ""}</div>
      ${shared ? "" : bkBanner({ text: "Traga seus dados de outros bancos com o Open Finance e aumente o seu limite.", cta: "Compartilhar dados", art: "arrows-left-right", go: "#/open-finance" })}
      ${bkSection("Meus créditos", credits.map((c) => bkItem({ icon: "hand-coins", label: `${c.count}x de ${money(c.installmentCents)} · CET ${c.cet}`, title: `${c.id} · ${c.purpose}`, value: c.status === "paid" ? "Quitado" : money(c.principalCents), go: `#/ccb/${c.id}` })), { aside: bkLink("Pedir crédito", "#/credito"), empty: "Nenhum crédito ainda." })}`,
  });
}

function providerFinance(s) {
  const mine = myContracts(s);
  const custody = mine.reduce((a, c) => a + custodyCents(c), 0);
  const anticipations = mine.flatMap((c) => c.stages.map((st, i) => ({ c, st, i })).filter((x) => x.st.anticipation));
  const acc = account(s);
  const used = anticipations.filter((x) => x.st.status !== "released").reduce((a, x) => a + x.st.anticipation.grossCents, 0);
  return screen({
    cls: "bk-flat", tab: "financeiro",
    header: bkPageHeader(s, { title: "Financeiro", sub: "Custódia, antecipações e recebimentos." }),
    body: `<section class="bk-panel"><div class="bk-big"><small>A receber em custódia</small><strong>${shown(s, custody)}</strong></div>
        ${bkLimit(s, { title: "Limite de antecipação", totalCents: acc.anticipationLimitCents, usedCents: used, freeCents: Math.max(0, acc.anticipationLimitCents - used), usedLabel: "Em uso" })}
        ${bkFacts([["Recebe em", acc.pj?.label ?? "Conta Nexo"], ["Limite", "Próprio de quem presta"]])}</section>
      ${bkSection("Antecipações", anticipations.map(({ c, st, i }) => bkItem({ icon: "lightning", label: `Em ${st.anticipation.at} · taxa ${money(st.anticipation.feeCents)}`, title: `${c.title} · etapa ${i + 1}`, value: money(st.anticipation.netCents) })), { empty: "Nenhuma antecipação ativa." })}
      ${bkSection("Movimentos", [
        bkItem({ icon: "receipt", label: "Entradas, liberações e antecipações", title: "Extrato", go: "#/extrato" }),
        bkItem({ icon: "calendar-blank", label: "Recebimentos previstos por etapa", title: "Agenda", go: "#/agenda" }),
        bkItem({ icon: "file-text", label: "NFS-e emitida a cada liberação", title: "Notas fiscais", go: "#/notas" }),
      ])}`,
  });
}

const financeiro = (s) => (role(s) === "prestador" ? providerFinance(s) : clientFinance(s));

function extrato(s) {
  const ids = new Set(myContracts(s).map((c) => c.id));
  const rows = s.ledger.filter((l) => ids.has(l.contractId));
  const days = [...new Set(rows.map((l) => l.date))];
  const item = (l) => bkItem({
    icon: l.amountCents < 0 ? "arrow-right" : "lock-simple", label: `${l.amountCents < 0 ? "Saída da custódia" : "Entrada na custódia"} · ${l.contractId}`,
    title: l.label, value: `${l.amountCents < 0 ? "−" : "+"} ${money(Math.abs(l.amountCents))}`,
  });
  return screen({
    cls: "bk-flat", header: appbar({ title: "Extrato" }),
    body: rows.length
      ? days.map((d) => `<section class="bk-section"><div class="bk-section-head"><span class="bk-day">${dayLabel(d)}</span></div>${rows.filter((l) => l.date === d).map(item).join("")}</section>`).join("")
      : empty("Sem movimentos."),
  });
}

export const moneyRoutes = { "pagar/:id": pagar, pix, "pago/:id": pago, financeiro, extrato };
