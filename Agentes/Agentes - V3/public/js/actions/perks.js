// Comfort and benefits around a payment: bank offers in full screen when paying with credit, points (earned when money
// is released, used as a discount on the next payment), the piggy bank for one payment, partial release, undo,
// payment notices and sharing. The bank's own products stay in the BTG app; here they only serve a payment.
import { daysBetween } from "../domain/dates.js";
import { yieldCents } from "../domain/offers.js";
import { REFERRAL_POINTS, pointsFor, redeemFor } from "../domain/points.js";
import { partialRelease } from "../domain/protected.js";
import { addLedger, contractById, draft, getState, notify, notifyClient, notifyProvider, now, parseDdMm, parseReais, personOfName, setDraft, today, update } from "../store.js";
import { byEnv, money } from "../ui.js";
import { actions as A, go, ok, warn } from "./core.js";
import { recordOffer } from "./offers.js";

/** Seconds to undo a payment that was just sent. */
export const UNDO_MS = 10_000;

// Points: whoever pays earns them when money is released, and can use them as a discount on the next payment.
export function earnPoints(s, c, releasedCents) {
  const owner = personOfName(c.client, s);
  const points = pointsFor(releasedCents);
  if (!owner || !points) return;
  s.points = { ...s.points, [owner.id]: (s.points?.[owner.id] ?? 0) + points };
  s.pointsLog = [{ at: today(), owner: owner.id, points, label: c.title }, ...(s.pointsLog ?? [])];
  notifyClient(s, c, `+${points} pontos`, `Pelo valor liberado de ${c.title}`, "star", "#/beneficios");
}
/** Called when a payment enters the guarded money: the points chosen at checkout come back as a discount in the balance. */
export function redeemPoints(s, c, payCents) {
  const who = s.session.person;
  if (!s.ui.drafts.usePoints?.[c.id] || !s.accounts[who]) return;
  const { points, cents } = redeemFor(s.points?.[who] ?? 0, payCents);
  if (!points) return;
  s.points = { ...s.points, [who]: s.points[who] - points };
  s.accounts[who].balanceCents += cents;
  s.pointsLog = [{ at: today(), owner: who, points: -points, label: `Desconto em ${c.title}` }, ...(s.pointsLog ?? [])];
  s.ui.drafts.usePoints = { ...s.ui.drafts.usePoints, [c.id]: false };
  notify(s, c.client, `Desconto de ${money(cents)} com pontos`, "Voltou para o saldo", "star", "#/beneficios", "contratante");
}
A.togglePointsUse = ({ id }) => setDraft(`usePoints.${id}`, !draft(`usePoints.${id}`, false), false);
A.shareReferral = ({ who }) => (setDraft("referral.shared", who, false), ok(who === "prestador" ? `Convite copiado. Vocês dois ganham ${REFERRAL_POINTS} pontos no primeiro pagamento.` : `Link copiado. Quando seu cliente pagar, vocês dois ganham ${REFERRAL_POINTS} pontos.`));

// Offers in full screen when choosing to pay with credit: loan and card side by side, with the credit note.
A.openOffers = ({ id }) => {
  const c = contractById(getState(), id);
  update((s) => {
    s.ui.sheet = { name: "ofertas", id, route: location.hash };
    recordOffer(s, { product: "credit", contractId: id, valueCents: c.totalCents - c.paidInCents });
  });
};
A.pickOffer = ({ id, product }) => {
  update((s) => {
    s.ui.drafts.pay = { ...s.ui.drafts.pay, [id]: product };
    if (product === "card") s.ui.drafts.card = { ...s.ui.drafts.card, [id]: 6 };
    s.ui.sheet = null;
  });
  ok(product === "credit" ? "Empréstimo na hora escolhido." : "Cartão em 6x escolhido.");
};

// Piggy bank for one payment: money set aside from the balance, yielding, used to pay it.
export const reserveYield = (r, s = getState()) => yieldCents(r.cents, Math.max(0, daysBetween(parseDdMm(r.since), now(s))));
A.guardReserve = ({ id }) => {
  const s0 = getState();
  const c = contractById(s0, id);
  const want = parseReais(draft(`reserve.${id}`)) ?? 0;
  const balance = s0.accounts[s0.session.person]?.balanceCents ?? 0;
  if (!want) return warn("Informe quanto quer guardar.");
  if (want > balance) return warn(`Seu saldo é ${money(balance)}. Guarde até esse valor.`);
  update((s) => {
    const r = s.reserves?.[id] ?? { cents: 0, since: today(), owner: s.session.person };
    s.accounts[s.session.person].balanceCents -= want;
    s.reserves = { ...s.reserves, [id]: { ...r, cents: r.cents + want } };
  });
  ok(`${money(want)} guardados no cofrinho de ${c.title}.`);
  go(`#/pagar/${id}`);
};

// Partial release: approve part of a delivered stage and keep the rest guarded until the adjustment.
A.releasePartial = ({ id, stage }) => {
  const s0 = getState();
  const idx = Number(stage);
  const st = contractById(s0, id).stages[idx];
  let parts;
  try {
    parts = partialRelease(st.valueCents, parseReais(draft("partial.amount")) ?? 0);
  } catch {
    return warn(`Escolha um valor entre R$ 0,01 e ${money(st.valueCents - 1)}.`);
  }
  update((s) => {
    const c = contractById(s, id);
    const stg = c.stages[idx];
    const text = String(draft("reply", "")).trim() || `Liberei ${money(parts.releaseCents)}. O restante sai quando o ajuste ficar pronto.`;
    Object.assign(stg, { valueCents: parts.holdCents, partialReleasedCents: (stg.partialReleasedCents ?? 0) + parts.releaseCents, status: "adjustRequested", reply: { text, at: today() } });
    addLedger(s, c.id, `Liberação parcial do marco ${idx + 1} para ${c.provider}`, -parts.releaseCents);
    notifyProvider(s, c, `${money(parts.releaseCents)} liberados do marco ${idx + 1}`, `${money(parts.holdCents)} seguem guardados até o ajuste`, "check-circle", `#/servico/${id}`);
    earnPoints(s, c, parts.releaseCents);
    s.ui.sheet = null;
    s.ui.drafts.partial = undefined;
  });
  ok(`${money(parts.releaseCents)} liberados. ${money(parts.holdCents)} seguem guardados.`);
};

// Undo a payment just sent, or cancel it while nobody accepted.
function withdraw(token, status) {
  const current = getState();
  const invitation = current.invites.find((i) => i.token === token);
  if (!invitation || invitation.status !== "sent" || invitation.createdBy !== current.session.person) {
    warn("Este convite não pode mais ser cancelado por você.");
    return false;
  }
  update((s) => {
    const inv = s.invites.find((i) => i.token === token);
    if (!inv || inv.status !== "sent") return;
    if (status === "undone") s.invites = s.invites.filter((i) => i !== inv);
    else inv.status = "cancelled";
    s.notifications = s.notifications.filter((n) => n.go !== `#/p/${token}`);
  });
  go("#/inicio");
  return true;
}
A.undoAgreement = ({ token }) => {
  const inv = getState().invites.find((i) => i.token === token);
  if (!inv || Date.now() - (inv.sentAtMs ?? 0) > UNDO_MS) return warn("O tempo para desfazer acabou. Você ainda pode cancelar enquanto ninguém aceitar.");
  if (withdraw(token, "undone")) ok(byEnv("Convite desfeito. Nenhum pagamento foi feito.", "Convite de teste desfeito. Nenhum pagamento foi feito."));
};
A.cancelAgreement = ({ token }) => {
  const charge = getState().invites.find(inv => inv.token === token)?.from === "provider";
  if (withdraw(token, "cancelled")) ok(charge ? "Cobrança cancelada. Nenhum pagamento foi feito." : "Combinado cancelado. Nenhum pagamento foi feito.");
};

// Payment notices: asked once per person, on the first payment, with a real example.
A.allowNotify = () => {
  update((s) => { s.ui.prompts = { ...s.ui.prompts, [s.session.person]: "on" }; });
  ok("Avisos ligados. Você sabe na hora quando o dinheiro mexer.");
};
A.laterNotify = () => update((s) => { s.ui.prompts = { ...s.ui.prompts, [s.session.person]: "later" }; });
A.toggleNotify = () => update((s) => {
  const on = s.ui.prompts?.[s.session.person] === "on";
  s.ui.prompts = { ...s.ui.prompts, [s.session.person]: on ? "later" : "on" };
});

// Switches confirm in a window before turning on; the window says what the switch does.
const CONFIRM_ACTIONS = { repeat: "toggleRepeat", insurance: "toggleCheckoutInsurance", points: "togglePointsUse", autoAnticipate: "toggleAutoAnticipation", pixAuto: "togglePixAuto" };
A.askConfirm = ({ kind, id }) => update((s) => { s.ui.sheet = { name: "confirmar", kind, id, route: location.hash }; });
A.confirmToggle = () => {
  const { kind, id } = getState().ui.sheet ?? {};
  if (!CONFIRM_ACTIONS[kind]) return;
  update((s) => { s.ui.sheet = null; });
  A[CONFIRM_ACTIONS[kind]]({ id });
};

// Sharing: the provider's seal and a clean proof of a protected release.
A.shareSeal = () => {
  setDraft("seal.shared", true, false);
  warn("Compartilhamento ainda indisponível. Nenhum selo foi copiado.");
};
A.openProof = ({ id, stage }) => update((s) => { s.ui.sheet = { name: "comprovante", id, stage: Number(stage), route: location.hash }; });
A.shareProof = () => {
  update((s) => { s.ui.sheet = null; });
  warn("Compartilhamento ainda indisponível. Nenhuma imagem foi gerada.");
};
