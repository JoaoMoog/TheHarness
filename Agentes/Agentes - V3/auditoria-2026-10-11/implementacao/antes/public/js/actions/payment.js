// Payments into custody: checkout credit, approved credit, Pix, installments and the down payment.
import { cardBlockedReason, cardPlans } from "../domain/card.js";
import { CDI_RATE, limitIncreaseCents, offersFor } from "../domain/offers.js";
import { insurancePremium } from "../domain/protected.js";
import { INSURANCE_COMMISSION } from "../domain/economics.js";
import { waOnFunded } from "./wa-notify.js";
import { pendingCount } from "../domain/split.js";
import {
  account, addDays, addLedger, availableLimitCents, cardAvailableCents, contractById, creditBlockedReason, draft, getState, installmentCents, isBtgConnected, myParticipant, nextId,
  notify, person, notifyProvider, setDraft, today, update,
} from "../store.js";
import { acceptOffer, recordOffer } from "./offers.js";
import { redeemPoints, reserveYield } from "./perks.js";
import { money } from "../ui.js";
import { actions as A, go, ok, warn } from "./core.js";

export const CHECKOUT_INSTALLMENTS = 6;
const CHECKOUT_CET = "29,05% a.a.";

const premiumDue = (c) => (c.insurance && !c.insurance.paid ? c.insurance.premiumCents : 0);

/**
 * What the person still has to pay to start: their share, or what is missing in custody plus an unpaid premium.
 * A paid down payment already lowered the contract total, so it is not subtracted again.
 */
export function payableCents(c, s = getState()) {
  if (c.kind === "collective") return (myParticipant(c, s) ?? c.participants.find((p) => p.me)).shareCents;
  return Math.max(0, c.totalCents - c.paidInCents) + premiumDue(c);
}

/** Money enters custody; the insurance premium goes to the insurer, never to custody. */
export function fund(s, c, amountCents, origin) {
  redeemPoints(s, c, amountCents);
  const payer = c.kind === "collective" ? (myParticipant(c, s) ?? c.participants.find((p) => p.me)) : null;
  if (payer) Object.assign(payer, { paid: true, origin });
  else if (c.payment == null) c.payment = { method: "pix" };
  const premium = premiumDue(c);
  if (premium) {
    c.insurance.paid = true;
    addLedger(s, c.id, `Prêmio Seguro Aval ${c.insurance.policy} · repasse à seguradora`, premium, "Repasse");
  }
  c.paidInCents += amountCents - premium;
  addLedger(s, c.id, `${origin} · ${payer?.name ?? c.client}`, amountCents - premium);
  activateIfFunded(s, c);
}
export function activateIfFunded(s, c) {
  const funded = c.kind === "collective" ? c.participants.every((p) => p.paid) : c.paidInCents >= c.totalCents;
  if (!funded || c.status === "active") return;
  c.status = "active";
  if (c.protected) {
    c.yield = { since: today(), rate: CDI_RATE };
    recordOffer(s, { product: "yield", contractId: c.id, valueCents: c.totalCents, accepted: true });
  }
  if (c.stages[0].status === "pending") Object.assign(c.stages[0], { status: "inProgress", startedAt: today() });
  notifyProvider(s, c, "Dinheiro guardado", `${c.title} · pode começar o marco 1`, "lock-simple", `#/servico/${c.id}`);
  waOnFunded(s, c);
}

/** Opens a credit contract (CCB) and its installments for the current person. */
export function openCredit(s, { principalCents, count, installment, monthlyRate, cet, purpose, contractId, graceDays = 0 }) {
  const owner = s.session.person;
  const id = nextId("CCB-2026-", s.credits.map((c) => c.id));
  s.credits.unshift({ id, owner, contractId, principalCents, count, installmentCents: installment, monthlyRate, cet, signedAt: addDays(0), purpose, status: "active", graceDays });
  for (let n = 1; n <= count; n += 1) {
    s.installments.push({ id: `P-${id}-${n}`, owner, creditId: id, contractId, n, of: count, valueCents: installment, due: addDays(30 * n + graceDays), status: "open" });
  }
  return id;
}

/** The card plan count the person picked for this contract, or the longest interest-free plan available. */
export function chosenCardPlan(s, id, amountCents) {
  const plans = cardPlans(amountCents);
  const fallback = plans.filter((p) => p.interestFree).at(-1).count;
  const wanted = Number(draft(`card.${id}`, fallback));
  return plans.find((p) => p.count === wanted) ?? plans.find((p) => p.count === fallback);
}

function payWithCard(s0, id, amount) {
  const plan = chosenCardPlan(s0, id, amount);
  const blocked = cardBlockedReason({ totalCents: plan.totalCents, availableCents: cardAvailableCents(s0), connected: isBtgConnected(s0) });
  if (blocked === "noAccount") return warn("Conecte a conta BTG para pagar com o cartão.");
  if (blocked === "limit") {
    update((s) => recordOffer(s, { product: "limit", contractId: id, valueCents: limitIncreaseCents(plan.totalCents, cardAvailableCents(s0)) }), { silent: true });
    return warn("O limite do cartão não cobre este valor. Aceite o aumento de limite ou escolha outra forma.");
  }
  update((s) => {
    const card = s.accounts[s.session.person].card;
    card.usedCents += plan.totalCents;
    const ct = contractById(s, id);
    if (ct.kind !== "collective") ct.payment = { method: "card", label: card.label, count: plan.count, valueCents: plan.installmentCents, interestFree: plan.interestFree };
    fund(s, ct, amount, `Cartão BTG ${plan.count}x`);
  });
  return go(`#/pago/${id}`);
}

/** The offers the checkout shows for this payment, with what is needed to price them. */
export function checkoutOffers(s, c, amount) {
  return offersFor({
    moment: "checkout", role: "payer", totalCents: amount, balanceCents: account(s)?.balanceCents ?? 0,
    cardAvailableCents: cardAvailableCents(s), preApprovedCents: isBtgConnected(s) ? availableLimitCents(s) : 0,
  }).filter((o) => o.product !== "insurance" || (c.kind !== "collective" && c.paidInCents === 0));
}
/** When the person pays, each offer shown at checkout is recorded, accepted or not. */
function recordCheckout(s, c, amount, method) {
  for (const o of checkoutOffers(s, c, amount)) {
    if (o.product === "credit") {
      const interest = installmentCents(amount, CHECKOUT_INSTALLMENTS) * CHECKOUT_INSTALLMENTS - amount;
      recordOffer(s, { product: "credit", contractId: c.id, valueCents: amount, accepted: method === "credit", revenueCents: method === "credit" ? interest : 0 });
    }
    if (o.product === "insurance") recordOffer(s, { product: "insurance", contractId: c.id, valueCents: o.valueCents, accepted: Boolean(c.insurance), revenueCents: Math.round((c.insurance?.premiumCents ?? 0) * INSURANCE_COMMISSION) });
  }
}

/** Pays from the piggy bank of this payment; what is left and the yield go back to the balance. */
function payWithReserve(s0, id, amount) {
  const r = s0.reserves?.[id];
  if (!r || r.cents < amount) return warn("O cofrinho ainda não cobre este pagamento. Guarde mais ou escolha outra forma.");
  const gain = reserveYield(r, s0);
  update((s) => {
    const ct = contractById(s, id);
    s.accounts[s.session.person].balanceCents += r.cents - amount + gain;
    s.reserves = Object.fromEntries(Object.entries(s.reserves).filter(([k]) => k !== id));
    if (ct.kind !== "collective") ct.payment = { method: "reserve" };
    fund(s, ct, amount, "Cofrinho do pagamento");
  });
  if (gain) ok(`O cofrinho rendeu ${money(gain)}. Voltou para o seu saldo.`);
  return go(`#/pago/${id}`);
}

function payWithBalance(s0, id, amount) {
  if (!isBtgConnected(s0)) return warn("Conecte a conta BTG para usar o saldo.");
  if ((account(s0)?.balanceCents ?? 0) < amount) return warn("O saldo não cobre este pagamento. Use o crédito empréstimo na hora ou outra forma.");
  update((s) => {
    s.accounts[s.session.person].balanceCents -= amount;
    const ct = contractById(s, id);
    if (ct.kind !== "collective") ct.payment = { method: "balance" };
    fund(s, ct, amount, "Saldo conta BTG");
  });
  return go(`#/pago/${id}`);
}

/**
 * The method picked when the checkout opens: an approved credit first, the balance when it covers, Pix otherwise.
 * The pre-approved credit is never picked for the person: it is offered at the top, and they choose it.
 */
export function defaultPayMethod(s, amount) {
  const reserved = isBtgConnected(s) ? account(s)?.reservedCredit : null;
  if (reserved && reserved.remainingCents >= amount) return "reserved";
  const balance = isBtgConnected(s) ? account(s)?.balanceCents ?? 0 : 0;
  return balance >= amount ? "balance" : "pix";
}

A.choosePayMethod = ({ id, method }) => setDraft(`pay.${id}`, method, false);
/** Optional insurance, chosen by whoever pays; the premium is added to what is paid now. */
A.toggleCheckoutInsurance = ({ id }) => update((s) => {
  const c = contractById(s, id);
  if (c.kind === "collective" || c.paidInCents > 0) return;
  c.insurance = c.insurance ? null : { policy: nextId("SG-2026-", s.contracts.map((x) => x.insurance?.policy).filter(Boolean)), premiumCents: insurancePremium(c.totalCents), coverageCents: c.totalCents, paid: false };
});
/** Card limit increase offered in the checkout: only what this payment needs, applied on the spot. */
A.acceptLimitIncrease = ({ id }) => {
  const s0 = getState();
  const amount = payableCents(contractById(s0, id), s0);
  const plan = chosenCardPlan(s0, id, amount);
  const increase = limitIncreaseCents(plan.totalCents, cardAvailableCents(s0));
  if (!increase) return;
  update((s) => {
    const card = s.accounts[s.session.person].card;
    card.limitCents += increase;
    card.extraCents = (card.extraCents ?? 0) + increase;
    acceptOffer(s, "limit", id, { valueCents: increase, revenueCents: plan.totalCents - amount });
  });
  ok(`Limite do cartão aumentado em ${money(increase)} para este pagamento.`);
};
A.chooseCardCount = ({ id, count }) => setDraft(`card.${id}`, Number(count), false);
A.confirmPay = ({ id }) => {
  const s0 = getState();
  const c = contractById(s0, id);
  const amount = payableCents(c, s0);
  if (c.kind === "collective") {
    if (myParticipant(c, s0)?.status === "pending") return warn("Aceite o convite antes de pagar.");
    if (pendingCount(c.participants)) return warn("O pagamento abre quando todos os convidados responderem.");
  }
  const method = draft(`pay.${id}`, defaultPayMethod(s0, amount));
  update((s) => recordCheckout(s, contractById(s, id), amount, method), { silent: true });
  if (method === "card") return payWithCard(s0, id, amount);
  if (method === "balance") return payWithBalance(s0, id, amount);
  if (method === "reserve") return payWithReserve(s0, id, amount);
  const reserved = isBtgConnected(s0) ? account(s0)?.reservedCredit : null;
  if (method === "reserved") {
    if (!reserved) return warn("Você não tem crédito aprovado disponível.");
    const fromCredit = Math.min(reserved.remainingCents, amount);
    const rest = amount - fromCredit;
    update((s) => {
      const r = s.accounts[s.session.person].reservedCredit;
      r.remainingCents -= fromCredit;
      const ct = contractById(s, id);
      if (ct.kind !== "collective") ct.payment = { method: "credit", creditId: r.creditId, count: r.count, valueCents: r.installmentCents, cet: r.cet };
      s.credits.find((cr) => cr.id === r.creditId).contractId = id;
      fund(s, ct, fromCredit, `Crédito aprovado ${r.creditId}`);
      if (r.remainingCents === 0) s.accounts[s.session.person].reservedCredit = null;
      if (rest > 0) s.ui.payment = { kind: "contract", contractId: id, amountCents: rest, label: `${ct.title} · restante após o crédito`, after: `#/pago/${id}` };
    });
    return go(rest > 0 ? "#/pix" : `#/pago/${id}`);
  }
  if (method === "credit") {
    if (creditBlockedReason(s0, amount)) return warn("O crédito não está disponível para este valor agora.");
    update((s) => {
      const value = installmentCents(amount, CHECKOUT_INSTALLMENTS);
      const ct = contractById(s, id);
      const creditId = openCredit(s, { principalCents: amount, count: CHECKOUT_INSTALLMENTS, installment: value, monthlyRate: 0.0215, cet: CHECKOUT_CET, purpose: ct.title, contractId: id });
      if (ct.kind !== "collective") ct.payment = { method: "credit", creditId, count: CHECKOUT_INSTALLMENTS, valueCents: value, cet: CHECKOUT_CET };
      fund(s, ct, amount, `Crédito Aval ${CHECKOUT_INSTALLMENTS}x`);
    });
    return go(`#/pago/${id}`);
  }
  update((s) => { s.ui.payment = { kind: "contract", contractId: id, amountCents: amount, label: c.title, after: `#/pago/${id}` }; });
  go("#/pix");
};
A.payInstallment = ({ id }) => {
  const inst = getState().installments.find((i) => i.id === id);
  update((s) => {
    s.ui.payment = { kind: "installment", installmentId: id, amountCents: inst.valueCents + (inst.lateFeeCents ?? 0), label: `Parcela ${inst.n} de ${inst.of}`, after: "#/financeiro" };
  });
  go("#/pix");
};

function settle(s, p, source) {
  if (p.kind === "contract") fund(s, contractById(s, p.contractId), p.amountCents, source);
  if (p.kind === "installment") {
    const inst = s.installments.find((i) => i.id === p.installmentId);
    inst.status = "paid";
    addLedger(s, inst.contractId, `Parcela ${inst.n} de ${inst.of} · ${source}`, p.amountCents);
    notify(s, person(s).clientName, "Parcela paga", "Seu limite foi liberado", "check-circle", "#/financeiro", "contratante");
  }
  if (p.kind === "prepay") {
    p.installmentIds.forEach((iid) => { s.installments.find((i) => i.id === iid).status = "paid"; });
    const credit = s.credits.find((c) => c.id === p.creditId);
    if (s.installments.filter((i) => i.creditId === credit.id).every((i) => i.status === "paid")) credit.status = "paid";
    addLedger(s, credit.contractId ?? "", `${p.label} · ${source}`, p.amountCents);
  }
  if (p.kind === "entrada") {
    const c = contractById(s, p.contractId);
    c.entrada.status = "paid";
    c.stages[0].valueCents -= p.amountCents;
    c.totalCents -= p.amountCents;
    addLedger(s, c.id, "Entrada direta ao prestador (fora do valor guardado)", -p.amountCents);
    notifyProvider(s, c, "Entrada recebida", money(p.amountCents), "hand-coins", `#/servico/${c.id}`);
  }
}

/** Pix from any bank, or a debit from the connected BTG account balance. */
A.simulatePix = ({ source = "Pix" } = {}) => {
  const p = getState().ui.payment;
  if (!p) return go("#/inicio");
  const fromBalance = source === "saldo";
  if (fromBalance && (account()?.balanceCents ?? 0) < p.amountCents) return warn("Saldo insuficiente na conta BTG. Pague com Pix de outro banco.");
  update((s) => {
    if (fromBalance) s.accounts[s.session.person].balanceCents -= p.amountCents;
    settle(s, p, fromBalance ? "Saldo conta BTG" : "Pix");
    s.ui.payment = null;
  });
  ok("Pagamento confirmado.");
  go(p.after);
};
