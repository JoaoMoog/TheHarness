// Credit journey: simulate, propose, analysis by policy (code), sign the CCB, money goes to custody only.
import { creditDecision, rateFor, simulateCredit } from "../domain/credit.js";
import {
  peopleOf, addDays, audit, availableLimitOf, contractById, draft, getState, installmentsOf, monthlyDebtOf, nextId, notify, notifyBank, outstandingOf,
  parseReais, setDraft, today, update,
} from "../store.js";
import { money } from "../ui.js";
import { actions as A, go, ok, warn } from "./core.js";
import { openCredit, payableCents } from "./payment.js";

const ANALYSIS_DAYS = 1;
export const RESERVE = "reserve";
export const cetLabel = (cetYear) => `${(cetYear * 100).toFixed(2).replace(".", ",")}% ao ano`;

/** Reads the simulator fields; null when a value is out of the product range. */
export function creditInputs() {
  const amountCents = parseReais(draft("credito.amount"));
  const count = Number(draft("credito.count"));
  const graceDays = Number(draft("credito.grace"));
  return amountCents ? { amountCents, count, graceDays } : null;
}
export function creditSimulation(s) {
  const inputs = creditInputs();
  if (!inputs) return null;
  try {
    return simulateCredit({ ...inputs, monthlyRate: rateFor(s.accounts[s.session.person].reputation) });
  } catch {
    return null;
  }
}

A.setCreditCount = ({ n }) => setDraft("credito.count", Number(n), false);
A.setCreditGrace = ({ days }) => setDraft("credito.grace", Number(days), false);
A.setDueDay = ({ day }) => setDraft("credito.dueDay", Number(day), false);
A.setCreditPurpose = ({ purpose }) => {
  const c = contractById(getState(), purpose);
  setDraft("credito.purpose", purpose, false);
  if (c) setDraft("credito.amount", (payableCents(c) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 }), false);
};
/** One step: the request goes in and the credit policy (code, not AI) answers on the spot. */
A.submitCredit = () => {
  if (!creditSimulation(getState())) return warn("Informe um valor válido, de 3 a 24 parcelas e carência de até 60 dias.");
  if (getState().accounts[getState().session.person].reservedCredit) return warn("Use o crédito já aprovado antes de pedir outro.");
  const inputs = creditInputs();
  const incomeCents = parseReais(draft("credito.income"));
  if (!inputs || !incomeCents) return warn("Informe o valor e a renda mensal.");
  if (!draft("credito.consent")) return warn("Autorize a consulta ao SCR e aos bureaus de crédito para seguir.");
  const s0 = getState();
  const purpose = draft("credito.purpose", RESERVE);
  const c = contractById(s0, purpose);
  if (c && inputs.amountCents > payableCents(c, s0)) return warn(`Para este serviço, peça até ${money(payableCents(c, s0))}.`);
  let id = "";
  update((s) => {
    const owner = s.session.person;
    id = nextId("CR-", s.creditRequests.map((r) => r.id));
    s.creditRequests.unshift({
      id, owner, ...inputs, incomeCents, dueDay: Number(draft("credito.dueDay")), purpose, contractId: c?.id ?? null,
      purposeLabel: c ? c.title : "Reservado para um novo serviço", openFinanceShared: s.accounts[owner].openFinance.status === "shared",
      status: "analysis", createdAt: today(), readyAt: addDays(ANALYSIS_DAYS), decision: null,
    });
    notifyBank(s, "Pedido de crédito", `${id} · ${peopleOf(s)[owner].name} · ${money(inputs.amountCents)}`, "hand-coins", "#/banco/credito");
    decideCredit(s, s.creditRequests[0]);
  });
  go(`#/credito/analise/${id}`);
};

/** Policy decision in code; the AI never decides credit. */
export function decideCredit(s, req) {
  const owner = req.owner;
  const decision = creditDecision({
    amountCents: req.amountCents, count: req.count, graceDays: req.graceDays, incomeCents: req.incomeCents,
    monthlyDebtCents: monthlyDebtOf(s, owner), availableLimitCents: availableLimitOf(s, owner),
    hasLate: installmentsOf(s, owner).some((i) => i.status === "late"), reputation: s.accounts[owner].reputation,
    openFinanceShared: s.accounts[owner].openFinance.status === "shared",
  });
  Object.assign(req, { status: decision.status, decision, decidedAt: today() });
  audit(s, "Política de crédito", "Decisão de crédito", `${req.id} · ${decision.status}${decision.reason ? ` (${decision.reason})` : ""} · ${money(decision.approvedCents)}`, req.id);
  const label = { approved: "Crédito aprovado", approvedLower: "Crédito aprovado com valor menor", denied: "Crédito não aprovado" }[decision.status];
  notify(s, peopleOf(s)[owner].clientName, label, `${req.id} · ${money(decision.approvedCents || req.amountCents)}`, "hand-coins", `#/credito/analise/${req.id}`, "contratante");
}
A.finishCreditAnalysis = ({ id }) => update((s) => decideCredit(s, s.creditRequests.find((r) => r.id === id)));
A.retryCredit = ({ id }) => {
  update((s) => {
    const req = s.creditRequests.find((r) => r.id === id);
    Object.assign(req, { openFinanceShared: s.accounts[req.owner].openFinance.status === "shared" });
    decideCredit(s, req);
  });
};
A.declineCredit = ({ id }) => {
  update((s) => { s.creditRequests.find((r) => r.id === id).status = "declined"; });
  go("#/creditos");
};

/** Signing the CCB: the money stays earmarked for custody and never reaches the client's hands. */
A.signCredit = ({ id }) => {
  const req = getState().creditRequests.find((r) => r.id === id);
  if (!req || !["approved", "approvedLower"].includes(req.status)) return warn("Este crédito não está aprovado.");
  if (!draft("credito.ccbOk")) return warn("Leia e aceite a Cédula de Crédito Bancário.");
  update((s) => {
    const r = s.creditRequests.find((x) => x.id === id);
    const { approvedCents, monthlyRate, simulation } = r.decision;
    const creditId = openCredit(s, {
      principalCents: approvedCents, count: r.count, installment: simulation.installmentCents, monthlyRate,
      cet: cetLabel(simulation.cetYear), purpose: r.purposeLabel, contractId: r.contractId, graceDays: r.graceDays,
    });
    const acc = s.accounts[r.owner];
    acc.creditLimitCents = Math.max(acc.creditLimitCents, outstandingOf(s, r.owner));
    acc.reservedCredit = { creditId, remainingCents: approvedCents, count: r.count, installmentCents: simulation.installmentCents, cet: cetLabel(simulation.cetYear) };
    Object.assign(r, { status: "signed", creditId, signedAt: today() });
    if (r.contractId) s.ui.drafts.pay = { ...s.ui.drafts.pay, [r.contractId]: "reserved" };
  });
  setDraft("credito.ccbOk", false);
  go(`#/credito/ok/${id}`);
};

/** Paying installments early removes the interest not yet incurred (present value at the contract rate). */
export function prepayValue(credit, installments) {
  return installments.reduce((acc, inst, k) => acc + Math.round(inst.valueCents / Math.pow(1 + credit.monthlyRate, k + 1)), 0);
}
function startPrepay(id, count) {
  const s = getState();
  const credit = s.credits.find((c) => c.id === id);
  const open = s.installments.filter((i) => i.creditId === id && i.status === "open");
  const chosen = count ? open.slice(-count) : open;
  if (chosen.length === 0) return warn("Não há parcelas em aberto neste crédito.");
  const amountCents = prepayValue(credit, [...chosen].reverse());
  update((x) => {
    x.ui.payment = {
      kind: "prepay", creditId: id, installmentIds: chosen.map((i) => i.id), amountCents,
      label: count ? `Antecipação de ${chosen.length} parcela(s) ${id}` : `Quitação ${id}`, after: `#/ccb/${id}`,
    };
  });
  go("#/pix");
}
A.prepayCredit = ({ id }) => startPrepay(id, 2);
A.payoffCredit = ({ id }) => startPrepay(id, 0);
A.portability = () => ok("Portabilidade registrada como interesse. O BTG entra em contato.");

// Bank side: the policy result is shown; an analyst may approve an exception, always logged
A.bankCreditException = ({ id }) => {
  update((s) => {
    const r = s.creditRequests.find((x) => x.id === id);
    const monthlyRate = rateFor(s.accounts[r.owner].reputation);
    const simulation = simulateCredit({ amountCents: r.amountCents, count: r.count, graceDays: r.graceDays, monthlyRate });
    audit(s, "Luiza Prado · analista", "Exceção de crédito", `${r.id} · aprovado ${money(r.amountCents)} acima da política`, r.id);
    Object.assign(r, { status: "approved", exception: true, decidedAt: today(), decision: { status: "approved", reason: null, approvedCents: r.amountCents, monthlyRate, simulation } });
    notify(s, peopleOf(s)[r.owner].clientName, "Crédito aprovado pelo analista", `${r.id} · ${money(r.amountCents)}`, "hand-coins", `#/credito/analise/${r.id}`, "contratante");
  });
  ok(`${id}: exceção aprovada e registrada na trilha de auditoria.`);
};
A.bankCreditDecide = ({ id }) => {
  update((s) => decideCredit(s, s.creditRequests.find((r) => r.id === id)));
  ok(`${id}: decisão da política aplicada.`);
};
