// Which way to pay costs the payer least right now. Pure function: the bank's fixed order, never a sales pitch.
import { CARD_RULES } from "./card.js";

/** Above this, raising the card limit for one payment is not a light suggestion: the credit fits better. */
export const MAX_LIMIT_INCREASE_CENTS = 500_000;

/** Recommends only methods covered by the currently available balance or limit. */
export function recommendPayment({ amountCents, balanceCents = 0, cardAvailableCents = 0, preApprovedCents = 0, connected }) {
  if (!connected) return { method: "pix", reason: "Pix de qualquer banco, sem precisar de conta BTG." };
  if (balanceCents >= amountCents) return { method: "balance", reason: "Seu saldo cobre, sem custo nenhum." };
  if (cardAvailableCents >= amountCents) {
    return { method: "card", reason: `${CARD_RULES.interestFreeUpTo}x sem juros no cartão, dentro do limite disponível.` };
  }
  if (preApprovedCents >= amountCents) return { method: "credit", reason: "O empréstimo na hora cobre tudo, com parcelas fixas." };
  return { method: "pix", reason: "Pix de qualquer banco." };
}
