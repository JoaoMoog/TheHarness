export const BASE_DATE: Date;
export function fmtDate(d: Date): string;
export function shiftDate(date: Date, days: number): Date;
export function parseDdMm(text: string): Date;
export function daysBetween(from: Date, to: Date): number;
export function isoToBr(iso: string): string;
export function brToIso(text: string): string;
export function toIso(date: Date): string;
