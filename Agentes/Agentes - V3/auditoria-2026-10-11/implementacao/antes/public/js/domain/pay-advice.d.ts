export const MAX_LIMIT_INCREASE_CENTS: number;
export type PayMethod = "balance" | "card" | "credit" | "pix";
export function recommendPayment(ctx: { amountCents: number; balanceCents?: number; cardAvailableCents?: number; preApprovedCents?: number; connected: boolean }): { method: PayMethod; reason: string };
