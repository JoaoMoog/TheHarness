export interface Benefit {
  key: "cashback" | "warranty" | "assist";
  ready: boolean;
  title: string;
  text: string;
  valueCents?: number;
}

export declare const REAIS_PER_POINT: number;
export declare const POINT_VALUE_CENTS: number;
export declare const REFERRAL_POINTS: number;
export declare const PARTNER: string;
export function pointsFor(releasedCents: number): number;
export function redeemFor(points: number, payCents: number): { points: number; cents: number };
export function benefitsFor(input: { description: string; totalCents: number; status: string }): Benefit[];
