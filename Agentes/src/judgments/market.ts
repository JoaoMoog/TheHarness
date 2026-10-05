import { choice, noul, score, type ScoreQuestion } from "@typesafe-ai/sdk";
import { noulConfidence, route } from "../policy.js";
import { type JevClient, type Judgment, requireNonEmpty, requireText, strictest } from "./types.js";

/** Nexo Serviços marketplace judgments. Jev reads text; ranking, prices and publishing rules stay in code. */

const CATEGORIES = {
  reformas: "Renovation of rooms: demolition, flooring, tiles, bathrooms, kitchens",
  eletrica: "Electrical work: wiring, outlets, breaker panels, showers",
  hidraulica: "Plumbing: leaks, clogs, pipes, faucets",
  pintura: "Painting walls, facades, doors or windows",
  marcenaria: "Carpentry: custom cabinets and wooden furniture",
  interiores: "Interior design projects for rooms",
  limpeza: "Cleaning: housekeeping or post-construction cleaning",
  piscina: "Swimming pool maintenance or repair",
  jardinagem: "Gardening and landscaping",
  montagem: "Assembling ready-made furniture",
  arCondicionado: "Air conditioning installation, cleaning or repair",
  assistencia: "Repair of home appliances such as washing machines or fridges",
} as const;

type CategoryKey = keyof typeof CATEGORIES;

/** The app uses "ar-condicionado"; Jev keys stay identifier-like. */
const toAppCategory = (key: CategoryKey): string => (key === "arCondicionado" ? "ar-condicionado" : key);

export async function judgeRequestCategory(client: JevClient, input: { readonly text: string }): Promise<Judgment<string>> {
  const text = requireText("text", input.text);
  const { answers } = await client.systemOne({
    state: { request: text },
    questions: { category: choice("Which kind of home service does `request` ask for?", CATEGORIES) },
  });
  return {
    value: toAppCategory(answers.category.choice as CategoryKey),
    confidence: answers.category.confidence,
    routing: route("requestCategory", answers.category.confidence),
  };
}

export async function judgeRequestCompleteness(
  client: JevClient,
  input: { readonly text: string; readonly category: string },
): Promise<Judgment<boolean>> {
  const text = requireText("text", input.text);
  const { answers } = await client.systemOne({
    state: { request: text, category: requireText("category", input.category) },
    questions: {
      complete: noul("Could a provider send a first price estimate from `request` alone?", {
        true: "The request says what to do and gives at least one concrete detail: number of rooms, area, quantity, the symptom or the item involved",
        false: "The request only names a trade or a vague need, with no concrete detail about the job",
      }),
    },
  });
  const confidence = noulConfidence(answers.complete.noul);
  return { value: answers.complete.noul >= 0.5, confidence, routing: route("requestCompleteness", confidence) };
}

const MATCH_LEVELS = [
  "Does not do this kind of service",
  "Related trade, but not this job",
  "Does this kind of service",
  "Does exactly this job",
] as const;
const MAX_MATCH = MATCH_LEVELS.length - 1;
const MAX_CANDIDATES = 12;
const matchKey = (i: number) => `match${i}`;

export interface MatchCandidate {
  readonly id: string;
  readonly text: string;
}

/** One Score per candidate; the code mixes it with distance, rating and verification to rank. */
export async function judgeServiceMatch(
  client: JevClient,
  input: { readonly request: string; readonly candidates: readonly MatchCandidate[] },
): Promise<Judgment<Record<string, number>>> {
  const request = requireText("request", input.request);
  const candidates = requireNonEmpty("candidates", input.candidates).slice(0, MAX_CANDIDATES)
    .map((c) => ({ id: requireText("id", c.id), text: requireText("text", c.text) }));
  const questions: Record<string, ScoreQuestion> = Object.fromEntries(
    candidates.map((_, i) => [matchKey(i), score(`How well does the provider in \`${matchKey(i)}\` fit \`request\`?`, MATCH_LEVELS)]),
  );
  const { answers } = await client.systemOne({
    state: { request, ...Object.fromEntries(candidates.map((c, i) => [matchKey(i), c.text])) },
    questions,
  });
  const readings = candidates.map((c, i) => ({ id: c.id, answer: answers[matchKey(i)] as { score: number; confidence: number } }));
  return {
    value: Object.fromEntries(readings.map((r) => [r.id, r.answer.score / MAX_MATCH])),
    confidence: Math.min(...readings.map((r) => r.answer.confidence)),
    routing: "automatic",
  };
}

const VERDICTS = {
  ok: "A normal service listing that can be published",
  contactLeak: "Asks to be contacted or paid outside the platform: phone, WhatsApp, email, social handle or off-platform payment",
  prohibited: "Offers an illegal or dangerous service, such as clandestine electrical connections",
  misleading: "Promises something unrealistic or impersonates a brand or a public body",
} as const;

export type ListingVerdict = keyof typeof VERDICTS;
const ALWAYS_HUMAN: readonly ListingVerdict[] = ["prohibited", "misleading"];

export async function judgeListingModeration(
  client: JevClient,
  input: { readonly title: string; readonly text: string },
): Promise<Judgment<ListingVerdict>> {
  const { answers } = await client.systemOne({
    state: { title: requireText("title", input.title), listing: requireText("text", input.text) },
    questions: { verdict: choice("Can the service listing in `title` and `listing` be published on a home services marketplace?", VERDICTS) },
  });
  const verdict = answers.verdict.choice as ListingVerdict;
  return {
    value: verdict,
    confidence: answers.verdict.confidence,
    routing: ALWAYS_HUMAN.includes(verdict) ? "humanReview" : strictest([route("listingModeration", answers.verdict.confidence)]),
  };
}
