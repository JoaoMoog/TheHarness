export interface DemoMetrics {
  payments: number;
  guardedCents: number;
  releasedCents: number;
  anticipatedCents: number;
  accounts: number;
  offersShown: number;
  offersAccepted: number;
  revenueCents: number;
  disputesClosed: number;
}

export function releasedCents(c: { stages: object[] }): number;
export function custodyCents(c: { paidInCents: number; refundedCents: number; stages: object[] }): number;
export function demoMetrics(s: { contracts: object[]; offerEvents?: object[]; disputes?: object[]; people?: object }): DemoMetrics;
export function metricsDelta(before: DemoMetrics | null, after: DemoMetrics): DemoMetrics;
export function addMetrics(total: DemoMetrics | null, more: DemoMetrics): DemoMetrics;
