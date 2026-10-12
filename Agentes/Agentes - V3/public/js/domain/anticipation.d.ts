export const MIN_COMPLETED: number;
export const MIN_REPUTATION: number;
export const MAX_DISPUTE_RATE: number;
export function anticipationEligibility(ctx: { completedServices?: number; reputation?: number; disputeRate?: number; lateInstallments?: number }): Array<[string, boolean, string]>;
