import { noul, type NoulQuestion } from "@typesafe-ai/sdk";
import { noulConfidence, route } from "../policy.js";
import { type JevClient, type Judgment, requireText, strictest } from "./types.js";

const MAX_CANDIDATES = 12;
const MIN_CLAUSE_LENGTH = 3;
const CENTS_PER_REAL = 100;

export interface SuggestedStage {
  readonly name: string;
  readonly valueCents: number;
}

export interface SuggestedStagesInput {
  readonly description: string;
  readonly totalCents: number;
}

/** Candidate clauses come from code, so Jev selects stages instead of writing them. */
export function splitCandidates(description: string): string[] {
  return description
    .split(/[:;,.\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= MIN_CLAUSE_LENGTH)
    .slice(0, MAX_CANDIDATES);
}

const capitalize = (s: string) => s.charAt(0).toLocaleUpperCase("pt-BR") + s.slice(1);

/** Splits the total in whole reais; the remainder goes to the last stage. */
function splitTotal(totalCents: number, parts: number): number[] {
  const base = Math.floor(totalCents / parts / CENTS_PER_REAL) * CENTS_PER_REAL;
  return Array.from({ length: parts }, (_, i) => (i === parts - 1 ? totalCents - base * (parts - 1) : base));
}

export async function judgeSuggestedStages(
  client: JevClient,
  input: SuggestedStagesInput,
): Promise<Judgment<{ stages: readonly SuggestedStage[] }>> {
  const candidates = splitCandidates(requireText("description", input.description));
  if (candidates.length === 0) return { value: { stages: [] }, confidence: 0, routing: "humanReview" };
  const questions: Record<string, NoulQuestion> = Object.fromEntries(
    candidates.map((_, i) => [
      `candidate${i}`,
      noul(`Is \`candidates[${i}]\` one distinct part of the job that can be delivered and checked on its own?`, {
        true: "A concrete piece of work, such as demolition, wiring or painting a room",
        false: "A summary of the whole job, a place, a material list or a condition",
      }),
    ]),
  );
  const { answers } = await client.systemOne({ state: { job: input.description, candidates }, questions });
  const judged = candidates.map((text, i) => {
    const answer = answers[`candidate${i}`];
    if (answer?.type !== "noul") throw new Error(`Jev returned no answer for candidate${i}`);
    const confidence = noulConfidence(answer.noul);
    return { text, isStage: answer.noul >= 0.5, confidence, routing: route("suggestedStages", confidence) };
  });
  const accepted = judged.filter((c) => c.isStage);
  if (accepted.length === 0) return { value: { stages: [] }, confidence: 0, routing: "humanReview" };
  const values = splitTotal(input.totalCents, accepted.length);
  return {
    value: { stages: accepted.map((c, i) => ({ name: capitalize(c.text), valueCents: values[i]! })) },
    confidence: Math.min(...judged.map((c) => c.confidence)),
    routing: strictest(judged.map((c) => c.routing)),
  };
}
