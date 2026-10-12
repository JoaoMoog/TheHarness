// Checkout of a protected payment: the bank's offers in context (pre-approved credit, card limit, insurance),
// then how to pay (balance, credit without card, BTG card up to 12x, Pix) and, for whoever pays alone, paying together.
import { CHECKOUT_INSTALLMENTS, checkoutOffers, chosenCardPlan, defaultPayMethod, payableCents } from "../actions/index.js";
import { CARD_RULES, cardBlockedReason, cardPlans } from "../domain/card.js";
import { limitIncreaseCents } from "../domain/offers.js";
import { recommendPayment } from "../domain/pay-advice.js";
import { insurancePremium } from "../domain/protected.js";
import { pendingCount } from "../domain/split.js";
import {
  account, availableLimitCents, cardAvailableCents, contractById, creditBlockedReason, draft, installmentCents, isClientOf, isBtgConnected, myParticipant,
} from "../store.js";
import { appbar, btn, card, circle, empty, esc, icon, kv, money, note, option, screen } from "../ui.js";
import { redeemFor } from "../domain/points.js";
import { reserveYield } from "../actions/index.js";
import { offerCard } from "./protected.js";
import { switchRow } from "./confirm.js";

const planText = (p) => `${p.count}x de ${money(p.installmentCents)}${p.interestFree ? " sem juros" : ""}`;

function creditSub(s, blocked, inst) {
  if (blocked === "noAccount") return "Conecte a conta BTG para parcelar";
  if (blocked === "late") return "Pausado: há uma parcela atrasada";
  if (blocked === "limit") return `Empréstimo na hora disponível ${money(availableLimitCents(s))}`;
  return `${CHECKOUT_INSTALLMENTS}x de ${money(inst)}`;
}

/** The tag and the reason on the way to pay that costs the payer least; it never changes what is selected. */
const recommended = (advice, method) => (advice.method === method ? `<span class="rec-tag">Recomendado</span><small class="rec-why">${esc(advice.reason)}</small>` : "");

/** Card option plus, when picked, the installment pills, what the plan costs and the limit increase offer. */
function cardChoice(s, id, amount, selected, advice) {
  const available = cardAvailableCents(s);
  const plan = chosenCardPlan(s, id, amount);
  const blocked = cardBlockedReason({ totalCents: plan.totalCents, availableCents: available, connected: isBtgConnected(s) });
  const sub = blocked === "noAccount" ? "Conecte a conta BTG para usar o cartão" : `Até ${CARD_RULES.maxCount}x · ${CARD_RULES.interestFreeUpTo}x sem juros · limite livre ${money(available)}`;
  const head = option({ title: "Cartão de crédito BTG", sub, value: selected && !blocked ? money(plan.totalCents) : "", selected, disabled: blocked === "noAccount", action: "choosePayMethod", data: { id, method: "card" }, extra: recommended(advice, "card") });
  if (!selected || blocked === "noAccount") return head;
  const pills = cardPlans(amount).map((p) => `<button type="button" class="pill-option ${p.count === plan.count ? "on" : ""}" data-action="chooseCardCount" data-id="${esc(id)}" data-count="${p.count}">${esc(planText(p))}</button>`).join("");
  const cost = plan.interestFree ? "Sem juros" : `${money(plan.totalCents - amount)} de juros (${(CARD_RULES.monthlyRate * 100).toFixed(2).replace(".", ",")}% ao mês)`;
  const increase = blocked === "limit" ? limitIncreaseCents(plan.totalCents, available) : 0;
  const limitOffer = increase
    ? offerCard({ ic: "credit-card", title: `Aumente o limite em ${money(increase)} agora`, text: "Só o que este pagamento precisa, aprovado na hora pelo banco. O resto do cartão continua igual.", cta: "Aumentar limite", action: "acceptLimitIncrease", data: { id } })
    : note("Fica guardado até você aprovar.", "info", "credit-card");
  return `${head}<div class="choice-list wrap">${pills}</div>
    ${card(`${kv("Parcelas", planText(plan))}${kv("Total no cartão", money(plan.totalCents))}${kv("Custo", cost)}`)}
    ${limitOffer}`;
}

/** The pre-approved credit, at the top when the balance does not cover the payment. */
function creditOffer(s, c, amount, method) {
  const offer = checkoutOffers(s, c, amount).find((o) => o.product === "credit");
  if (!offer || offer.priority !== 1 || method === "credit") return "";
  const inst = installmentCents(amount, CHECKOUT_INSTALLMENTS);
  return offerCard({
    ic: "hand-coins", title: "Seu saldo não cobre",
    text: `Parcele em ${CHECKOUT_INSTALLMENTS}x de ${money(inst)} com empréstimo na hora.`,
    cta: "Ver opções de empréstimo", action: "openOffers", data: { id: c.id },
  });
}

/** Optional insurance for whoever pays alone; the premium is added to the total. */
function insuranceChoice(c) {
  if (c.kind === "collective" || c.paidInCents > 0) return "";
  const on = Boolean(c.insurance);
  const premium = insurancePremium(c.totalCents);
  return card(switchRow({ ic: "shield-check", title: "Seguro do serviço", value: `+${money(premium)}`, on, kind: "insurance", id: c.id, off: "toggleCheckoutInsurance" }));
}

function waitingGroup(id) {
  return screen({ header: appbar({ title: "Pagar" }), body: note("Abre quando todos responderem ao convite.", "info", "clock"), footer: btn("Ver quem divide", { go: `#/coletivo/${id}` }) });
}

function paidAlready(c) {
  const target = c.kind === "collective" ? `#/coletivo/${c.id}` : `#/servico/${c.id}`;
  return screen({ header: appbar({ title: "Pagar" }), body: note("Este pagamento já está feito e guardado.", "pos", "check-circle"), footer: btn("Ver pagamento", { go: target }) });
}

/** The pay button names the action and the amount. */
function footerLabel(method, amount, plan, reserved, reservedRest) {
  if (method === "reserved" && reserved) return `Pagar ${money(amount)} com o crédito aprovado${reservedRest ? ` + ${money(reservedRest)} no Pix` : ""}`;
  if (plan) return `Pagar ${money(plan.totalCents)} no cartão em ${plan.count}x`;
  if (method === "credit") return `Pagar ${money(amount)} com empréstimo na hora em ${CHECKOUT_INSTALLMENTS}x`;
  if (method === "balance") return `Pagar ${money(amount)} com o saldo`;
  if (method === "reserve") return `Pagar ${money(amount)} com o cofrinho`;
  return `Pagar ${money(amount)} com Pix`;
}

/** Points as a discount on this payment, up to 10%; the discount comes back to the balance. */
function pointsChoice(s, c, amount) {
  const { points, cents } = redeemFor(s.points?.[s.session.person] ?? 0, amount);
  if (!points) return "";
  const on = Boolean(draft(`usePoints.${c.id}`, false));
  return card(switchRow({ ic: "star", title: `Usar ${points.toLocaleString("pt-BR")} pontos`, value: `−${money(cents)}`, on, kind: "points", id: c.id, off: "togglePointsUse" }));
}

/** The piggy bank of this payment: pay from it when it covers, or guard more. */
function reserveChoice(s, c, amount, method) {
  if (!isBtgConnected(s) || c.kind === "collective") return "";
  const r = s.reserves?.[c.id];
  if (!r) return btn("Guardar no cofrinho e pagar depois", { kind: "text", go: `#/cofrinho/${c.id}`, iconName: "piggy-bank" });
  const covers = r.cents >= amount;
  return option({ title: "Cofrinho deste pagamento", sub: covers ? `${money(r.cents)} guardados · rendeu ${money(reserveYield(r, s))}` : `${money(r.cents)} de ${money(amount)} · faltam ${money(amount - r.cents)}`, value: covers ? money(amount) : "", selected: method === "reserve", disabled: !covers, action: "choosePayMethod", data: { id: c.id, method: "reserve" } });
}

function pagar(s, { id }) {
  const c = contractById(s, id);
  if (!c || !isClientOf(c, s)) return screen({ header: appbar({ title: "Pagar" }), body: empty("Nada a pagar aqui.") });
  if (c.kind === "collective" && (pendingCount(c.participants) || myParticipant(c, s)?.status === "pending")) return waitingGroup(id);
  const amount = payableCents(c, s);
  if (amount <= 0) return paidAlready(c);
  const blocked = creditBlockedReason(s, amount);
  const reserved = isBtgConnected(s) ? account(s)?.reservedCredit : null;
  const method = draft(`pay.${id}`, defaultPayMethod(s, amount));
  const inst = installmentCents(amount, CHECKOUT_INSTALLMENTS);
  const premium = c.insurance && !c.insurance.paid ? c.insurance.premiumCents : 0;
  const reservedRest = reserved ? Math.max(0, amount - reserved.remainingCents) : 0;
  const plan = method === "card" ? chosenCardPlan(s, id, amount) : null;
  const balance = isBtgConnected(s) ? account(s)?.balanceCents ?? 0 : 0;
  const alone = c.kind !== "collective" && c.paidInCents === 0;
  const advice = recommendPayment({ amountCents: amount, balanceCents: balance, cardAvailableCents: cardAvailableCents(s), preApprovedCents: blocked ? 0 : availableLimitCents(s), connected: isBtgConnected(s) });
  return screen({
    header: appbar({ title: "Pagar" }),
    body: `${card(`<small class="muted">${esc(c.provider)} · ${esc(c.title)}</small><div class="amount dark">${money(amount)}</div>${c.kind === "collective" ? `<small class="muted">Sua parte</small>` : ""}${premium ? kv("Inclui o seguro do serviço", money(premium)) : ""}${c.arbitrationFeeCents ? kv("Já incluso: seguro de arbitragem", money(c.arbitrationFeeCents)) : ""}`)}
      ${creditOffer(s, c, amount, method)}
      ${insuranceChoice(c)}
      ${pointsChoice(s, c, amount)}
      <h3>Como você quer pagar?</h3>
      ${reserved ? option({ title: `Crédito aprovado ${reserved.creditId}`, sub: `${money(reserved.remainingCents)} disponíveis · ${reserved.count}x de ${money(reserved.installmentCents)}`, selected: method === "reserved", action: "choosePayMethod", data: { id, method: "reserved" } }) : ""}
      ${isBtgConnected(s) ? option({ title: "Saldo da conta BTG", sub: `Saldo ${money(balance)}`, value: balance >= amount ? money(amount) : "", selected: method === "balance", disabled: balance < amount, action: "choosePayMethod", data: { id, method: "balance" }, extra: recommended(advice, "balance") }) : ""}
      ${reserveChoice(s, c, amount, method)}
      ${option({ title: "Empréstimo na hora", sub: creditSub(s, blocked, inst), value: blocked ? "" : money(inst * CHECKOUT_INSTALLMENTS), selected: method === "credit" && !blocked, disabled: Boolean(blocked), action: "openOffers", data: { id }, extra: recommended(advice, "credit") })}
      ${cardChoice(s, id, amount, method === "card", advice)}
      ${option({ title: "Pix", sub: "De qualquer banco", value: money(amount), selected: method === "pix" || (Boolean(blocked) && method === "credit"), action: "choosePayMethod", data: { id, method: "pix" }, extra: recommended(advice, "pix") })}
      ${alone ? btn("Pagar em conjunto com outras pessoas", { kind: "text", action: "startSplitPayment", data: { id }, iconName: "users-three" }) : ""}
      <p class="pay-summary">${icon("lock-simple")}Fica guardado até você aprovar.</p>`,
    footer: btn(footerLabel(method, amount, plan, reserved, reservedRest), { action: "confirmPay", data: { id } }),
  });
}

export const checkoutRoutes = { "pagar/:id": pagar };
