export interface Share {
  name: string;
  shareCents: number;
}

export interface Contact {
  channel: "whatsapp" | "email";
  contact: string;
}

export interface Participant {
  name: string;
  status?: string;
  paid?: boolean;
  bps?: number;
  shareCents?: number;
  [key: string]: unknown;
}

export declare const FULL_BPS: number;
export function splitShares(totalCents: number, names: string[]): Share[];
export function parsePercent(text: string): number | null;
export function equalBps(n: number): number[];
export function sharesFromBps(totalCents: number, bps: number[]): number[];
export function rebalance<T extends Participant>(totalCents: number, participants: T[]): (T & { bps: number; shareCents: number })[];
export function formatBps(bps: number): string;
export function parseContact(text: string): Contact | null;
export function pendingCount(participants: { status?: string }[]): number;
