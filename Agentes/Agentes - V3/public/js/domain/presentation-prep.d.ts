export interface Ready { index: number; resets: number }
export interface PrepPlan { reset: boolean; run: number[] }

export function prepPlan(args: { track: number[]; index: number; ready: Ready | null; resets: number }): PrepPlan;
export function trackOf(tracks: Record<string, number[]>, index: number, list: number[] | null): number[];
