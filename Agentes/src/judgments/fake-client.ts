import type { SystemOneRequest } from "@typesafe-ai/sdk";
import type { JevClient } from "./types.js";

/** Test double for the Jev client: records requests and returns canned answers. */
export function fakeClient(answers: Record<string, unknown>): { client: JevClient; calls: SystemOneRequest[] } {
  const calls: SystemOneRequest[] = [];
  const client = {
    systemOne: async (request: SystemOneRequest) => {
      calls.push(request);
      return { model: "fake", answers, usage: { input_tokens: 0, output_tokens: 0 } };
    },
  } as unknown as JevClient;
  return { client, calls };
}

export const noulAnswer = (p: number) => ({ type: "noul", noul: p });

export const choiceAnswer = (choice: string, confidence: number) => ({
  type: "choice",
  choice,
  confidence,
  probabilities: { [choice]: confidence },
});

export const scoreAnswer = (score: number, confidence: number) => ({
  type: "score",
  score,
  confidence,
  legend: {},
  probabilities: {},
});
