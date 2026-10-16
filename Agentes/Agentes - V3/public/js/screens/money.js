// Money screens in the BTG Banking style: Pix, receipt, finance (both sides) and statement by day.
import { parseDdMm } from "../domain/dates.js";
import {
  account, anticipationInUseCents, availableLimitCents, canSee, contractById, custodyCents, installmentCents, isBtgConnected, lateInstallments, limitOf, myContracts, myInstallments, myName, myParticipant, outstandingCents, role,
} from "../store.js";
import { appbar, btn, byEnv, card, chip, circle, empty, esc, icon, money, note, screen, timeline } from "../ui.js";
import { authCode, bkBanner, bkFacts, bkItem, bkLimit, bkLink, bkMonthBars, bkPageHeader, bkReceipt, bkSection, dayLabel, fullDate, monthName } from "./btg-kit.js";
import { shown } from "./chrome.js";
import { switchRow } from "./confirm.js";

function pix(s) {
  const p = s.ui.payment;
  if (!p) return screen({ header: appbar({ title: "Pix" }), body: empty("Nenhum pagamento em andamento.") });
  const balance = account(s)?.balanceCents ?? 0;
  return screen({
    header: appbar({ title: "Simular pagamento com Pix" }),
    body: `${card(`<div class="center-block"><small class="muted">${esc(p.label)}</small><div class="amount dark">${money(p.amountCents)}</div><div class="qr">${icon("qr-code")}</div><p class="small muted">Pix copia e cola</p><code class="pix-code">00020126580014br.gov.bcb.pix0136aval-${esc(p.kind)}-demo</code></div>`)}
      ${isBtgConnected(s) ? card(`<div class="row-between"><div><strong>Pagar com saldo da conta BTG</strong><small class="muted">Saldo ${money(balance)}</small></div>${btn("Pagar", { kind: "secondary small", action: "simulatePix", data: { source: "saldo" }, disabled: balance < p.amountCents })}</div>`) : ""}
      ${note("De outro banco, a confirmação chega em segundos. Aqui, simule a confirmação.")}`,
    footer: `${btn("Simular Pix de outro banco", { action: "simulatePix", iconName: "check-circle" })}${btn("Copiar código", { kind: "text", action: "copied" })}`,
  });
}

function pago(s, { id }) {
  const c = contractById(s, id);
  if (!c || !canSee(c, s)) return screen({ header: appbar({ title: "Pagamento" }), body: empty("Pagamento não encontrado.") });
  if (!c.paidInCents) return screen({ header: appbar({ title: "Pagamento" }), body: empty("Nenhum pagamento foi confirmado neste combinado.") });
  const share = myParticipant(c, s);
  const pending = c.kind === "collective" ? c.participants.filter((p) => !p.paid).length : 0;
  const valueCents = c.kind === "collective" ? share?.shareCents ?? 0 : c.paidInCents ?? 0;
  const situation = c.kind === "collective"
    ? `Sua parte ${share?.paid ? "está paga" : "ainda está pendente"}. ${pending ? `Faltam ${pending} participante(s).` : "Todos pagaram: o marco 1 já pode começar."}`
    : `Guardado no BTG.${c.status === "active" ? " O prestador já pode começar o marco 1." : ""}`;
  const target = c.kind === "collective" ? `#/coletivo/${id}` : `#/servico/${id}`;
  return screen({
    cls: "bk-receipt-screen", header: appbar({ close: target }),
    body: `${bkReceipt({
      // The presentation keeps its own calendar: the receipt carries the demo date, not the computer's.
      title: byEnv("Pagamento com Aval", "Pagamento simulado"),
      when: byEnv(c.paidOn ? `Pago em ${c.paidOn}` : fullDate(), c.paymentRecordedAt ? `Registrado em ${new Date(c.paymentRecordedAt).toLocaleString("pt-BR")}` : `Cenário de ${fullDate()}`), valueCents,
      parties: [
        { label: "Para", name: "Guardado no Aval", lines: [`Contrato ${c.id}`, "Banco BTG Pactual S.A."] },
        { label: "De", name: myName(s), lines: [c.payment?.method === "card" ? `${c.payment.label} · ${c.payment.count}x de ${money(c.payment.valueCents)}` : c.payment?.origin ?? "Origem não informada"] },
      ],
      facts: [["Recebedor final", c.provider], ["Serviço", c.title], ["Situação", situation]], auth: authCode(`pago:${id}:${valueCents}`),
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
    header: bkPageHeader(s, { title: "Empréstimos", sub: "O que você usou para pagar serviços." }),
    body: `${lateCards(late)}
      <section class="bk-panel">${bkLimit(s, { title: "Empréstimo na hora", totalCents: limitOf(s, s.session.person), usedCents: outstandingCents(s), freeCents: availableLimitCents(s), freeText: late.length ? "Pausado" : "" })}
        ${bkFacts([["Próximo vencimento", next ? `${next.due} · ${money(next.valueCents)}` : "Nenhum"], ["Open Finance", shared ? acc.openFinance.banks.join(", ") : "Não compartilhado"]])}</section>
      ${bkSection("Seus empréstimos", credits.map((c) => bkItem({ icon: "hand-coins", label: `${c.count}x de ${money(c.installmentCents)} · custo total ${c.cet}`, title: `${c.id} · ${c.purpose}`, value: c.status === "paid" ? "Quitado" : money(c.principalCents), go: `#/ccb/${c.id}` })), { empty: "Nenhum empréstimo ainda. Ele aparece na hora de pagar um serviço." })}
      ${months.length ? `<section class="bk-section"><div class="bk-section-head"><h3>Parcelas</h3>${bkLink("Movimentos", "#/extrato")}</div>${bkMonthBars(s, months)}</section>` : ""}
      <div class="bk-pad">${collectionSteps(s, late)}${card(switchRow({ ic: "calendar-blank", title: "Pix Automático nas parcelas", on: Boolean(acc.pixAuto), kind: "pixAuto", off: "togglePixAuto" }))}
        ${acc.reservedCredit ? card(`<div class="row-between"><strong>Crédito aprovado para serviços</strong>${chip(money(acc.reservedCredit.remainingCents), "pos")}</div>`, "soft") : ""}</div>
      ${shared ? "" : bkBanner({ text: "Quer mais limite? Traga seus dados de outros bancos pelo Open Finance.", cta: "Ver no app do BTG", art: "arrows-left-right", go: "#/no-app-btg/open-finance" })}`,
  });
}

function providerFinance(s) {
  const mine = myContracts(s);
  const custody = mine.reduce((a, c) => a + custodyCents(c), 0);
  const anticipations = mine.flatMap((c) => c.stages.map((st, i) => ({ c, st, i })).filter((x) => x.st.anticipation));
  const acc = account(s);
  const used = anticipationInUseCents(s);
  return screen({
    cls: "bk-flat", tab: "financeiro",
    header: bkPageHeader(s, { title: "A receber dos pagamentos", sub: "Guardado, antecipações e recebimentos." }),
    body: `<section class="bk-panel"><div class="bk-big"><small>A receber guardado</small><strong>${shown(s, custody)}</strong></div>
        ${bkLimit(s, { title: "Limite de antecipação", totalCents: acc.anticipationLimitCents, usedCents: used, freeCents: Math.max(0, acc.anticipationLimitCents - used), usedLabel: "Em uso" })}
        ${bkFacts([["Recebe em", acc.pj?.label ?? "Conta BTG"], ["Limite", "Próprio de quem presta"]])}</section>
      ${bkSection("Antecipações", anticipations.map(({ c, st, i }) => bkItem({ icon: "lightning", label: `Em ${st.anticipation.at} · taxa ${money(st.anticipation.feeCents)}`, title: `${c.title} · marco ${i + 1}`, value: money(st.anticipation.netCents) })), { empty: "Nenhuma antecipação ativa." })}
      ${bkSection("Movimentos", [
        bkItem({ icon: "receipt", label: "Entradas, liberações e antecipações", title: "Extrato", go: "#/extrato" }),
        bkItem({ icon: "calendar-blank", label: "Recebimentos previstos por marco", title: "Agenda", go: "#/agenda" }),
        bkItem({ icon: "file-text", label: "NFS-e emitida a cada liberação", title: "Notas fiscais", go: "#/notas" }),
      ])}`,
  });
}

const financeiro = (s) => (role(s) === "prestador" ? providerFinance(s) : clientFinance(s));

const statementRows = (s) => {
  const ids = new Set(myContracts(s).map((c) => c.id));
  return s.ledger.filter((l) => ids.has(l.contractId));
};
const statementItem = (l) => bkItem({
  icon: l.amountCents < 0 ? "arrow-right" : "lock-simple", label: `${l.amountCents < 0 ? "Saída do valor guardado" : "Entrada no valor guardado"} · ${l.contractId}`,
  title: l.label, value: `${l.amountCents < 0 ? "−" : "+"} ${money(Math.abs(l.amountCents))}`, go: `#/servico/${l.contractId}`,
});
/** The movements of the statement, newest first, with the text the search looks into. */
export const statementItems = (s) => statementRows(s).map((l) => ({ text: `${l.label} ${l.contractId} ${l.date} ${money(Math.abs(l.amountCents))}`, html: statementItem(l) }));

function extrato(s) {
  const rows = statementRows(s);
  const days = [...new Set(rows.map((l) => l.date))];
  const item = statementItem;
  return screen({
    cls: "bk-flat", header: appbar({ title: "Extrato" }),
    body: rows.length
      ? days.map((d) => `<section class="bk-section"><div class="bk-section-head"><span class="bk-day">${dayLabel(d)}</span></div>${rows.filter((l) => l.date === d).map(item).join("")}</section>`).join("")
      : empty("Sem movimentos."),
  });
}

export const moneyRoutes = { pix, "pago/:id": pago, financeiro, extrato };
