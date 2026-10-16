export const FLOAT_MONTHLY: number;
export const TRANSACTION_FEE_CENTS: number;
export const INSURANCE_COMMISSION: number;
export const MDR_RATE: number;
export interface EconomicsRow { source: string; cents: number; payer: string }
export function contractEconomics(s: { contracts?: object[]; offerEvents?: object[] }, contractId: string): { contract: object; rows: EconomicsRow[]; totalCents: number; share: number } | null;
