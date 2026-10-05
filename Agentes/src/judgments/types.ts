import type { TypeSafeClient } from "@typesafe-ai/sdk";
import type { Routing } from "../policy.js";

/** Only the call the judgments need, so tests can pass a fake. */
export type JevClient = Pick<TypeSafeClient, "systemOne">;

/** A typed answer plus how sure Jev is and whether code may act on it. */
export interface Judgment<T> {
  readonly value: T;
  readonly confidence: number;
  readonly routing: Routing;
}

export function requireText(field: string, value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) throw new TypeError(`${field} must not be empty`);
  return trimmed;
}

export function requireNonEmpty<T>(field: string, values: readonly T[]): readonly T[] {
  if (values.length === 0) throw new TypeError(`${field} must have at least one entry`);
  return values;
}

/** The most cautious routing wins: one item in review sends the whole judgment to review. */
export function strictest(routings: readonly Routing[]): Routing {
  return routings.includes("humanReview") ? "humanReview" : "automatic";
}
