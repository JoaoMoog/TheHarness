import type { StageDraft } from "./protected.js";

export interface Category {
  key: string;
  words: string[];
  title: string;
  description: string;
  stages: [string, number][];
}

export interface Suggestion {
  release: "single" | "stages";
  title: string;
  description: string;
  stages: StageDraft[];
  reason: string;
}

export interface Note {
  tone: "pos" | "warn";
  text: string;
}

export declare const SINGLE_LIMIT_CENTS: number;
export declare const CATEGORIES: Category[];
export declare const SUGGESTED_QUESTIONS: string[];
export declare const FAQ: { topic: string; question: string; text: string }[];
export function classify(text: string): Category | null;
export function suggestStages(input: { description: string; totalCents: number; count?: number }): Suggestion;
export function parseConversation(text: string): { totalCents: number | null; dueDate: string | null; address: string | null; description: string; title: string };
export function answer(question: string): { topic: string; text: string };
export function reviewDelivery(input: { stageName: string; delivery: { description: string; attachments: { kind: string }[] } | null }): { ok: boolean; notes: Note[] };
export function disputeBrief(input: {
  report: string;
  reasonLabel: string;
  clientEvidence: string[];
  providerStatement: string | null;
  providerEvidence: string[];
  amountCents: number;
  share: number;
}): { lines: string[]; suggestion: string };
export function improveDescription(text: string): { text: string; title: string };
export const FIRST_SHARE: number;
export function frontLoad<T extends { name: string; valueCents: number }>(stages: T[], totalCents: number, firstShare?: number): { name: string; valueCents: number }[];
