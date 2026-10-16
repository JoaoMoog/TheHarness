// Which way to pay costs the payer least right now. Pure function: the bank's fixed order, never a sales pitch.
import { CARD_RULES } from "./card.js";
import { limitIncreaseCents } from "./offers.js";

/** Above this, raising the card limit for one payment is not a light suggestion: the credit fits better. */
export const MAX_LIMIT_INCREASE_CENTS = 500_000;

/** Balance, then the card without interest (with a small limit increase), then the pre-approved credit, then Pix. */
export function recommendPayment({ amountCents, balanceCents = 0, cardAvailableCents = 0, preApprovedCents = 0, connected }) {
  if (!connected) return { method: "pix", reason: "Pix de qualquer banco, sem precisar de conta BTG." };
  if (balanceCents >= amountCents) return { method: "balance", reason: "Seu saldo cobre, sem custo nenhum." };
  const increase = limitIncreaseCents(amountCents, cardAvailableCents);
  if (increase <= MAX_LIMIT_INCREASE_CENTS) {
    const extra = increase ? ", com um aumento pequeno de limite" : "";
    return { method: "card", reason: `${CARD_RULES.interestFreeUpTo}x sem juros no cartão${extra}. Seu saldo fica livre.` };
  }
  if (preApprovedCents >= amountCents) return { method: "credit", reason: "O empréstimo na hora cobre tudo, com parcelas fixas." };
  return { method: "pix", reason: "Pix de qualquer banco." };
}
