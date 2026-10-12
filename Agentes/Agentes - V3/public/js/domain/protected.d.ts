import type { CardPlan } from "./card.js";

export type Release = "single" | "stages";
export type Role = "payee" | "payer" | "splitPayer";
export type StepState = "done" | "current" | "next" | "alert";

export interface StageDraft {
  name: string;
  valueCents: number;
}

export interface Agreement {
  description?: string;
  totalCents?: number;
  dueDate?: string;
  address?: string;
  release?: string;
  stages?: StageDraft[];
}

export interface TimelineStage {
  name: string;
  valueCents: number;
  status: string;
  releasedAt?: string | null;
  releaseMode?: string | null;
  delivery?: { deadline: string } | null;
}

export interface TimelineContract {
  status: string;
  signedAt: string;
  stages: TimelineStage[];
}

export interface TimelineStep {
  key: string;
  label: string;
  state: StepState;
  detail: string;
}

export declare const AUTO_RELEASE_DAYS: number;
export declare const INSURANCE_RATE: number;
export declare const RELEASES: readonly Release[];
export declare const SINGLE_STAGE: string;
export declare const TEMPLATES: Record<string, [string, [string, number][]]>;
export function insurancePremium(totalCents: number): number;
export function splitByTemplate(totalCents: number, key: string): StageDraft[];
export function stagesFor(totalCents: number, release: Release, templateKey?: string): StageDraft[];
export function validateAgreement(agreement: Agreement, today?: Date): string[];
export function roleOf(contract: { client: string; provider: string; participants?: { name: string }[] }, names: Iterable<string>): Role | null;
export function autoReleaseDate(deliveredAt: Date): Date;
export function timelineOf(contract: TimelineContract, today: Date): TimelineStep[];
export function checkoutTotal(input: { totalCents: number; insured: boolean; method: string; cardCount?: number }): {
  premiumCents: number;
  payCents: number;
  plan: CardPlan | null;
};

export interface StepContract {
  status: string;
  client: string;
  provider: string;
  stages: { name: string; status: string; due?: string; delivery?: { deadline: string } | null }[];
}
export function partialRelease(stageCents: number, releaseCents: number): { releaseCents: number; holdCents: number };
export function reminderFor(deadline: string, today: Date): { daysLeft: number } | null;
export function nextStepLine(contract: StepContract, role: string, today: Date): string;

export function securityCode(token: string): string;
export function stageShares(stages: ReadonlyArray<{ valueCents: number }>): number[];
