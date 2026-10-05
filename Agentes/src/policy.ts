/**
 * Confidence thresholds per Jev judgment. Below the threshold a case goes to
 * the bank's work queue. Values mirror screen W6 and start as hypotheses to be
 * calibrated against reviewed cases.
 */
export type Routing = "automatic" | "humanReview";

type JudgmentRule =
  | { kind: "gated"; threshold: number }
  | { kind: "alwaysHuman" }
  | { kind: "ungated" };

export const JUDGMENT_POLICY = {
  deliveryCoverage: { kind: "gated", threshold: 0.8 },
  tacitConfirmation: { kind: "gated", threshold: 0.85 },
  disputeReason: { kind: "gated", threshold: 0.75 },
  evidenceSufficiency: { kind: "gated", threshold: 0.7 },
  expertInspection: { kind: "gated", threshold: 0.65 },
  suggestedStages: { kind: "gated", threshold: 0.8 },
  assistantIntent: { kind: "gated", threshold: 0.9 },
  reviewModeration: { kind: "gated", threshold: 0.8 },
  conversationEscalation: { kind: "gated", threshold: 0.7 },
  scheduleOnly: { kind: "gated", threshold: 0.8 },
  evidenceConsistency: { kind: "gated", threshold: 0.75 },
  requestCategory: { kind: "gated", threshold: 0.8 },
  requestCompleteness: { kind: "gated", threshold: 0.6 },
  listingModeration: { kind: "gated", threshold: 0.8 },
  queuePriority: { kind: "ungated" },
  fraudSignals: { kind: "alwaysHuman" },
  blockAppeal: { kind: "alwaysHuman" },
} as const satisfies Record<string, JudgmentRule>;

export type JudgmentName = keyof typeof JUDGMENT_POLICY;

/** Noul answers carry only P(yes); |2p - 1| puts them on the Choice/Score confidence scale. */
export function noulConfidence(probability: number): number {
  return Math.abs(2 * probability - 1);
}

/** Decides whether a judgment can be used automatically or needs a person. */
export function route(judgment: JudgmentName, confidence: number): Routing {
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    throw new RangeError(`Confidence must be between 0 and 1, got ${confidence}`);
  }
  const rule: JudgmentRule = JUDGMENT_POLICY[judgment];
  if (rule.kind === "alwaysHuman") return "humanReview";
  if (rule.kind === "ungated") return "automatic";
  return confidence >= rule.threshold ? "automatic" : "humanReview";
}
