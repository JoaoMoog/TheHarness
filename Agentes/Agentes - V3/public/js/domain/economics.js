// What the bank earns on one protected payment and who pays each part. Pure functions over the demo state; the same
// rates feed the revenue page, so a contract and the month always add up the same way.
import { soldOffers } from "./offers.js";

/** Monthly return of the guarded money for the bank (funding it does not pay elsewhere). */
export const FLOAT_MONTHLY = 0.008;
export const TRANSACTION_FEE_CENTS = 1_990;
/** The Aval keeps the brokerage commission of the insurance, not the premium. */
export const INSURANCE_COMMISSION = 0.2;
export const MDR_RATE = 0.025;

const OFFER_SOURCE = { credit: "creditInterest", limit: "cardInterest", anticipation: "anticipation" };
const PAYER = { creditInterest: "quem paga", cardInterest: "quem paga", insurance: "quem paga", anticipation: "prestador", arbitration: "dentro do valor", transaction: "prestador", float: "captação" };

/** The parts of the bank's revenue on one contract, the total and its share of the contract value. */
export function contractEconomics(s, contractId) {
  const c = (s.contracts ?? []).find((x) => x.id === contractId);
  if (!c) return null;
  const offers = soldOffers(s.offerEvents ?? []).filter((e) => e.contractId === contractId && e.accepted && OFFER_SOURCE[e.product]);
  const fromOffers = offers.map((e) => ({ source: OFFER_SOURCE[e.product], cents: e.revenueCents }));
  const insurance = c.insurance?.paid ? [{ source: "insurance", cents: Math.round(c.insurance.premiumCents * INSURANCE_COMMISSION) }] : [];
  const fixed = [
    { source: "arbitration", cents: c.arbitrationFeeCents ?? 0 },
    { source: "transaction", cents: TRANSACTION_FEE_CENTS },
    { source: "float", cents: Math.round(Math.max(0, c.paidInCents - c.refundedCents) * FLOAT_MONTHLY) },
  ];
  const rows = [...fromOffers, ...insurance, ...fixed].filter((r) => r.cents > 0).map((r) => ({ ...r, payer: PAYER[r.source] }));
  const totalCents = rows.reduce((a, r) => a + r.cents, 0);
  return { contract: c, rows, totalCents, share: c.totalCents ? totalCents / c.totalCents : 0 };
}
