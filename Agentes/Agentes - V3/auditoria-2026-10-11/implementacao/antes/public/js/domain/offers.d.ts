export type Product = "credit" | "limit" | "anticipation" | "yield" | "insurance";

export interface Offer {
  product: Product;
  priority: number;
  valueCents: number;
}

export interface OfferContext {
  moment: "checkout" | "card" | "guarded";
  role: string | null;
  totalCents: number;
  balanceCents?: number;
  cardAvailableCents?: number;
  preApprovedCents?: number;
  anticipableCents?: number;
}

export interface OfferEvent {
  product: Product;
  accepted: boolean;
  valueCents: number;
  revenueCents: number;
}

export interface FunnelRow {
  product: Product;
  shown: number;
  accepted: number;
  conversion: number;
  valueCents: number;
  revenueCents: number;
}

export declare const PRODUCTS: readonly Product[];
export declare const CDI_RATE: number;
export function limitIncreaseCents(totalCents: number, availableCents: number): number;
export function yieldCents(principalCents: number, days: number, annualRate?: number): number;
export function offersFor(context: OfferContext): Offer[];
export function funnelOf(events: OfferEvent[]): FunnelRow[];
export function soldOffers<T extends { product: Product }>(events: T[]): T[];
