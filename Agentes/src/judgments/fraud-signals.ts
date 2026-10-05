import { noul } from "@typesafe-ai/sdk";
import { noulConfidence, route } from "../policy.js";
import { type JevClient, type Judgment, requireText } from "./types.js";

const SIGNALS = {
  nameMismatch: "Is the person in `account.documentName` different from `account.name`, beyond abbreviations or accents?",
  offPlatformPayment: "Does `serviceText` ask to pay outside Aval, for example into a personal account?",
  notRealService: "Does `serviceText` describe a loan, investment or money transfer instead of real work?",
  urgencyPressure: "Does `serviceText` pressure the other party to pay right away?",
} as const;

export type FraudSignal = keyof typeof SIGNALS;

export interface FraudSignalsInput {
  readonly accountName: string;
  readonly documentName: string;
  readonly serviceText: string;
}

/** Reads onboarding and service text for fraud signals. A person always decides. */
export async function judgeFraudSignals(
  client: JevClient,
  input: FraudSignalsInput,
): Promise<Judgment<{ present: readonly FraudSignal[]; probabilities: Readonly<Record<FraudSignal, number>> }>> {
  const state = {
    account: { name: requireText("accountName", input.accountName), documentName: requireText("documentName", input.documentName) },
    serviceText: requireText("serviceText", input.serviceText),
  };
  const names = Object.keys(SIGNALS) as FraudSignal[];
  const { answers } = await client.systemOne({
    state,
    questions: Object.fromEntries(names.map((n) => [n, noul(SIGNALS[n])])),
  });
  const probabilities = Object.fromEntries(
    names.map((n) => {
      const answer = answers[n];
      if (answer?.type !== "noul") throw new Error(`Jev returned no answer for ${n}`);
      return [n, answer.noul];
    }),
  ) as Record<FraudSignal, number>;
  const confidence = Math.min(...names.map((n) => noulConfidence(probabilities[n])));
  return {
    value: { present: names.filter((n) => probabilities[n] >= 0.5), probabilities },
    confidence,
    routing: route("fraudSignals", confidence),
  };
}
