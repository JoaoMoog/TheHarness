import { noul, type NoulQuestion } from "@typesafe-ai/sdk";
import { noulConfidence, route, type Routing } from "../policy.js";
import type { DisputeReason } from "./dispute-reason.js";
import { type JevClient, type Judgment, requireNonEmpty, strictest } from "./types.js";

export interface PartyEvidence {
  readonly party: "client" | "provider";
  readonly statement: string;
  readonly evidence: readonly string[];
}

export interface EvidenceSufficiencyInput {
  readonly reason: DisputeReason;
  readonly parties: readonly PartyEvidence[];
}

export interface PartySufficiency {
  readonly party: PartyEvidence["party"];
  readonly sufficient: boolean;
  readonly probability: number;
  readonly routing: Routing;
}

/** Reads each side's evidence for the mediator. It never decides the dispute. */
export async function judgeEvidenceSufficiency(
  client: JevClient,
  input: EvidenceSufficiencyInput,
): Promise<Judgment<readonly PartySufficiency[]>> {
  const parties = requireNonEmpty("parties", input.parties);
  const questions: Record<string, NoulQuestion> = Object.fromEntries(
    parties.map((_, i) => [
      `party${i}`,
      noul(`Does \`parties[${i}].evidence\` support \`parties[${i}].statement\` about the dispute in \`reason\`?`, {
        true: "The listed evidence directly shows what the statement claims",
        false: "The evidence is missing, unrelated, or only repeats the claim",
      }),
    ]),
  );
  const { answers } = await client.systemOne({
    state: {
      reason: input.reason,
      parties: parties.map((p) => ({ party: p.party, statement: p.statement, evidence: [...p.evidence] })),
    },
    questions,
  });
  const results = parties.map((p, i) => {
    const answer = answers[`party${i}`];
    if (answer?.type !== "noul") throw new Error(`Jev returned no answer for party${i}`);
    const confidence = noulConfidence(answer.noul);
    const party: PartySufficiency = {
      party: p.party,
      sufficient: answer.noul >= 0.5,
      probability: answer.noul,
      routing: route("evidenceSufficiency", confidence),
    };
    return { party, confidence };
  });
  return {
    value: results.map((r) => r.party),
    confidence: Math.min(...results.map((r) => r.confidence)),
    routing: strictest(results.map((r) => r.party.routing)),
  };
}
