export interface CreditTerms {
  amountCents: number;
  count: number;
  graceDays: number;
  monthlyRate: number;
}

export interface CreditSimulation {
  installmentCents: number;
  iofCents: number;
  totalCents: number;
  cetYear: number;
  monthlyRate: number;
  firstDueDays: number;
}

export interface CreditRequest {
  amountCents: number;
  count: number;
  graceDays: number;
  incomeCents: number;
  monthlyDebtCents: number;
  availableLimitCents: number;
  hasLate: boolean;
  reputation: number;
  openFinanceShared: boolean;
}

export interface CreditDecision {
  status: "approved" | "approvedLower" | "denied";
  reason: "late" | "limit" | "income" | null;
  approvedCents: number;
  monthlyRate: number;
  simulation: CreditSimulation;
}

export const CREDIT_RULES: Readonly<Record<string, number>>;
export function rateFor(reputation: number): number;
export function priceInstallment(principalCents: number, monthlyRate: number, count: number, graceDays?: number): number;
export function iofCents(principalCents: number, count: number): number;
export function simulateCredit(terms: CreditTerms): CreditSimulation;
export function creditDecision(request: CreditRequest): CreditDecision;
