// Contextual bank offers inside the protected payment. Pure functions: fixed rules decide when each one shows.
import { insurancePremium } from "./protected.js";

export const PRODUCTS = Object.freeze(["credit", "limit", "anticipation", "yield", "insurance"]);
/** Fixed CDI for the presentation; the guarded money yields 100% of it to the payer. */
export const CDI_RATE = 0.1415;
const LIMIT_STEP_CENTS = 10_000;
const PAYERS = new Set(["payer", "splitPayer"]);

/** The card limit increase that covers the payment, in whole hundreds of reais. */
export function limitIncreaseCents(totalCents, availableCents) {
  const missing = totalCents - availableCents;
  return missing > 0 ? Math.ceil(missing / LIMIT_STEP_CENTS) * LIMIT_STEP_CENTS : 0;
}

/** Compound yield of the money while it stays guarded. */
export const yieldCents = (principalCents, days, annualRate = CDI_RATE) => Math.round(principalCents * ((1 + annualRate) ** (days / 365) - 1));

function payerOffers({ moment, totalCents, balanceCents = 0, cardAvailableCents = 0, preApprovedCents = 0 }) {
  if (moment === "card") {
    const increase = limitIncreaseCents(totalCents, cardAvailableCents);
    return increase ? [{ product: "limit", priority: 1, valueCents: increase }] : [];
  }
  if (moment === "guarded") return [{ product: "yield", priority: 1, valueCents: totalCents }];
  if (moment !== "checkout") return [];
  const offers = [{ product: "insurance", priority: 2, valueCents: insurancePremium(totalCents) }];
  if (preApprovedCents >= totalCents) offers.push({ product: "credit", priority: balanceCents < totalCents ? 1 : 3, valueCents: totalCents });
  return offers;
}

/** The offers that fit this moment of the payment, most relevant first. */
export function offersFor(context) {
  if (PAYERS.has(context.role)) return payerOffers(context).sort((a, b) => a.priority - b.priority);
  if (context.role === "payee" && context.moment === "guarded" && context.anticipableCents > 0) {
    return [{ product: "anticipation", priority: 1, valueCents: context.anticipableCents }];
  }
  return [];
}

/** Offers the person chose; the yield comes with every guarded payment, so it is not counted as a sale. */
const AUTOMATIC = new Set(["yield"]);
export const soldOffers = (events) => events.filter((e) => !AUTOMATIC.has(e.product));

/** Shown, accepted, conversion, value and revenue of each product, from the offer events. */
export function funnelOf(events) {
  return PRODUCTS.map((product) => {
    const shown = events.filter((e) => e.product === product);
    const accepted = shown.filter((e) => e.accepted);
    return {
      product,
      shown: shown.length,
      accepted: accepted.length,
      conversion: shown.length ? accepted.length / shown.length : 0,
      valueCents: accepted.reduce((sum, e) => sum + e.valueCents, 0),
      revenueCents: accepted.reduce((sum, e) => sum + e.revenueCents, 0),
    };
  });
}
