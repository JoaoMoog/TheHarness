import { choice, noul } from "@typesafe-ai/sdk";
import { noulConfidence, route } from "../policy.js";
import { type JevClient, type Judgment, requireText, strictest } from "./types.js";

const REASONS = {
  deliveryQuality: "The work was done but has defects or differs from what was agreed",
  delay: "The work is late compared with the agreed date",
  scopeChange: "The parties disagree about what was included in the job",
  payment: "The complaint is about charges, amounts or payment, not the work itself",
  abandonment: "The provider stopped the work and left it unfinished",
  other: "None of the above",
} as const;

export type DisputeReason = keyof typeof REASONS;

export const DISPUTE_REASONS = Object.keys(REASONS) as [DisputeReason, ...DisputeReason[]];

export interface DisputeReasonInput {
  readonly stageName: string;
  readonly report: string;
}

/** Suggests the dispute category shown to the client, who can still change it. */
export async function judgeDisputeReason(
  client: JevClient,
  input: DisputeReasonInput,
): Promise<Judgment<{ reason: DisputeReason; providerUnresponsive: boolean }>> {
  const report = requireText("report", input.report);
  const { answers } = await client.systemOne({
    state: { stage: input.stageName, report },
    questions: {
      reason: choice("What is the main problem the client describes in `report`?", REASONS),
      providerUnresponsive: noul("Does `report` say the provider stopped answering the client?"),
    },
  });
  const unresponsiveConfidence = noulConfidence(answers.providerUnresponsive.noul);
  return {
    value: { reason: answers.reason.choice, providerUnresponsive: answers.providerUnresponsive.noul >= 0.5 },
    confidence: Math.min(answers.reason.confidence, unresponsiveConfidence),
    routing: strictest([
      route("disputeReason", answers.reason.confidence),
      route("disputeReason", unresponsiveConfidence),
    ]),
  };
}
