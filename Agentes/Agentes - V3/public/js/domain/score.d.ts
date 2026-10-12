export interface Tip {
  key: string;
  text: string;
  go?: string;
  action?: string;
}

export declare const NOTE_BANDS: readonly [number, string][];
export function creditNote(input: {
  lateInstallments?: number;
  paidInstallments?: number;
  utilization?: number;
  openFinance?: boolean;
  completedPayments?: number;
  autoPix?: boolean;
}): { score: number; band: string; tips: Tip[] };
