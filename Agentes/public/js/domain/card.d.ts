export declare const CARD_RULES: Readonly<{
  maxCount: number;
  interestFreeUpTo: number;
  monthlyRate: number;
  minInstallmentCents: number;
}>;

export interface CardPlan {
  count: number;
  installmentCents: number;
  totalCents: number;
  interestFree: boolean;
}

export function cardPlan(amountCents: number, count: number): CardPlan;
export function cardPlans(amountCents: number): CardPlan[];
export function cardBlockedReason(input: { totalCents: number; availableCents: number; connected: boolean }): "noAccount" | "limit" | null;
