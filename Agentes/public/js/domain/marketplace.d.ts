export interface Point { lat: number; lng: number }
export interface MarketProvider extends Point {
  id: string;
  name: string;
  categories: string[];
  rating: number;
  verified: boolean;
  acceptsCredit: boolean;
  priceFromCents: number;
  [key: string]: unknown;
}
export interface ProviderFilters {
  categoryId?: string;
  origin?: Point;
  radiusKm?: number;
  minRating?: number;
  verifiedOnly?: boolean;
  creditOnly?: boolean;
  maxPriceCents?: number;
}
export interface Boost { providerId: string; until: number }
export type RankedProvider<T> = T & { distanceKm: number; relevance: number; boosted: boolean };
export interface Quoted { status: string; quotes: { provider: string }[] }

export const MARKETPLACE_TAKE_RATE: number;
export const MAX_QUOTES: number;
export const BOOST_DAYS: number;
export const BOOST_PRICE_CENTS: number;
export function distanceKm(a: Point, b: Point): number;
export function filterProviders<T extends MarketProvider>(list: T[], filters?: ProviderFilters): T[];
export function boostActive(boost: Boost | undefined, now: Date): boolean;
export function rankProviders<T extends MarketProvider>(
  list: T[],
  options?: { matchScores?: Record<string, number>; origin?: Point; sort?: "relevance" | "rating" | "price" | "distance"; boosts?: Boost[]; now?: Date },
): RankedProvider<T>[];
export function estimateRange(listings: { categoryId: string; priceCents: number }[], categoryId: string): { minCents: number; maxCents: number } | null;
export function quoteSlotsLeft(request: Quoted): number;
export function canQuote(request: Quoted, providerName: string): boolean;
export function takeRateCents(totalCents: number): number;
export function netForProvider(totalCents: number): number;
export function maskContacts(text: string): { text: string; masked: boolean };
