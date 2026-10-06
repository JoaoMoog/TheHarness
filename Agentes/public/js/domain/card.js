// Nexo credit card plans for paying a service. Pure functions: the bank's rules, never the AI.
import { priceInstallment } from "./credit.js";

export const CARD_RULES = Object.freeze({
  maxCount: 12,
  interestFreeUpTo: 3,
  monthlyRate: 0.0299,
  minInstallmentCents: 5_000,
});

function assertAmount(amountCents) {
  if (!Number.isInteger(amountCents) || amountCents <= 0) throw new RangeError("amountCents must be a positive whole number of cents");
}

function assertCount(count) {
  if (!Number.isInteger(count) || count < 1 || count > CARD_RULES.maxCount) {
    throw new RangeError(`count must be a whole number between 1 and ${CARD_RULES.maxCount}`);
  }
}

/** One plan: up to interestFreeUpTo the client pays exactly the amount; after that, Price-table interest. */
export function cardPlan(amountCents, count) {
  assertAmount(amountCents);
  assertCount(count);
  if (count <= CARD_RULES.interestFreeUpTo) {
    return { count, installmentCents: Math.ceil(amountCents / count), totalCents: amountCents, interestFree: true };
  }
  const installmentCents = priceInstallment(amountCents, CARD_RULES.monthlyRate, count);
  return { count, installmentCents, totalCents: installmentCents * count, interestFree: false };
}

/** Every plan the client can pick: one installment always, more only while the installment stays above the minimum. */
export function cardPlans(amountCents) {
  assertAmount(amountCents);
  return Array.from({ length: CARD_RULES.maxCount }, (_, i) => cardPlan(amountCents, i + 1))
    .filter((p) => p.count === 1 || p.installmentCents >= CARD_RULES.minInstallmentCents);
}

/** Why the card cannot pay this plan, or null when it can. */
export function cardBlockedReason({ totalCents, availableCents, connected }) {
  if (!connected) return "noAccount";
  if (totalCents > availableCents) return "limit";
  return null;
}
