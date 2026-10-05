import { z } from "zod";
import { judgeAssistantIntent } from "../judgments/assistant-intent.js";
import { judgeBlockAppeal } from "../judgments/block-appeal.js";
import { judgeConversationEscalation } from "../judgments/conversation-escalation.js";
import { judgeDeliveryCoverage } from "../judgments/delivery-coverage.js";
import { DISPUTE_REASONS, judgeDisputeReason } from "../judgments/dispute-reason.js";
import { judgeEvidenceConsistency } from "../judgments/evidence-consistency.js";
import { judgeEvidenceSufficiency } from "../judgments/evidence-sufficiency.js";
import { judgeExpertInspection } from "../judgments/expert-inspection.js";
import { judgeFraudSignals } from "../judgments/fraud-signals.js";
import { judgeListingModeration, judgeRequestCategory, judgeRequestCompleteness, judgeServiceMatch } from "../judgments/market.js";
import { judgeQueuePriority } from "../judgments/queue-priority.js";
import { judgeReviewModeration } from "../judgments/review-moderation.js";
import { judgeScheduleOnly } from "../judgments/schedule-only.js";
import { judgeSuggestedStages } from "../judgments/suggested-stages.js";
import { judgeTacitConfirmation } from "../judgments/tacit-confirmation.js";
import type { JevClient, Judgment } from "../judgments/types.js";

const SHORT = 300;
const LONG = 4000;
const MAX_ITEMS = 20;
const HOURS_PER_YEAR = 24 * 365;
const MAX_CONTRACT_CENTS = 1_000_000_000;
const MAX_MATCH_CANDIDATES = 12;

const text = (max: number) => z.string().trim().min(1).max(max);
const items = z.array(text(SHORT)).max(MAX_ITEMS);

/**
 * Who handles a judgment Jev is unsure about: the user confirms in the app
 * (support for their own decision), or a bank analyst picks it up in the queue.
 */
export type EscalateTo = "user" | "bankQueue";

interface Entry<S extends z.ZodTypeAny> {
  readonly schema: S;
  readonly run: (client: JevClient, input: z.infer<S>) => Promise<Judgment<unknown>>;
  readonly escalateTo: EscalateTo;
}

const entry = <S extends z.ZodTypeAny>(escalateTo: EscalateTo, schema: S, run: Entry<S>["run"]): Entry<S> => ({
  schema,
  run,
  escalateTo,
});

/** Each endpoint's input schema next to the judgment it runs. */
export const REGISTRY = {
  tacitConfirmation: entry(
    "user",
    z.object({ stageName: text(SHORT), items, clientMessage: text(LONG) }).strict(),
    judgeTacitConfirmation,
  ),
  deliveryCoverage: entry(
    "user",
    z
      .object({
        stageName: text(SHORT),
        items: items.min(1),
        description: text(LONG),
        attachments: z
          .array(z.object({ kind: z.enum(["photo", "video", "document", "location"]), caption: text(SHORT) }).strict())
          .max(MAX_ITEMS),
      })
      .strict(),
    judgeDeliveryCoverage,
  ),
  disputeReason: entry(
    "user",
    z.object({ stageName: text(SHORT), report: text(LONG) }).strict(),
    judgeDisputeReason,
  ),
  evidenceSufficiency: entry(
    "bankQueue",
    z
      .object({
        reason: z.enum(DISPUTE_REASONS),
        parties: z
          .array(
            z
              .object({ party: z.enum(["client", "provider"]), statement: text(LONG), evidence: items })
              .strict(),
          )
          .min(1)
          .max(4),
      })
      .strict(),
    judgeEvidenceSufficiency,
  ),
  queuePriority: entry(
    "bankQueue",
    z.object({ summary: text(LONG), hoursToDeadline: z.number().finite().min(0).max(HOURS_PER_YEAR) }).strict(),
    judgeQueuePriority,
  ),
  expertInspection: entry("bankQueue", z.object({ summary: text(LONG) }).strict(), judgeExpertInspection),
  assistantIntent: entry(
    "user",
    z
      .object({
        message: text(SHORT),
        services: z
          .array(z.object({ id: z.string().regex(/^[A-Z0-9-]{3,40}$/), label: text(SHORT) }).strict())
          .min(1)
          .max(MAX_ITEMS),
      })
      .strict(),
    judgeAssistantIntent,
  ),
  suggestedStages: entry(
    "user",
    z.object({ description: text(LONG), totalCents: z.number().int().positive().max(MAX_CONTRACT_CENTS) }).strict(),
    judgeSuggestedStages,
  ),
  fraudSignals: entry(
    "bankQueue",
    z.object({ accountName: text(SHORT), documentName: text(SHORT), serviceText: text(LONG) }).strict(),
    judgeFraudSignals,
  ),
  reviewModeration: entry("bankQueue", z.object({ comment: text(LONG) }).strict(), judgeReviewModeration),
  conversationEscalation: entry(
    "user",
    z
      .object({
        messages: z
          .array(z.object({ from: z.enum(["client", "provider"]), text: text(SHORT) }).strict())
          .min(1)
          .max(MAX_ITEMS),
      })
      .strict(),
    judgeConversationEscalation,
  ),
  scheduleOnly: entry("user", z.object({ report: text(LONG) }).strict(), judgeScheduleOnly),
  evidenceConsistency: entry(
    "bankQueue",
    z
      .object({
        stageName: text(SHORT),
        attachments: z
          .array(z.object({ kind: z.enum(["photo", "video", "document", "location"]), caption: text(SHORT) }).strict())
          .min(1)
          .max(MAX_ITEMS),
      })
      .strict(),
    judgeEvidenceConsistency,
  ),
  blockAppeal: entry("bankQueue", z.object({ blockReason: text(SHORT), appeal: text(LONG) }).strict(), judgeBlockAppeal),
  requestCategory: entry("user", z.object({ text: text(LONG) }).strict(), judgeRequestCategory),
  requestCompleteness: entry("user", z.object({ text: text(LONG), category: text(SHORT) }).strict(), judgeRequestCompleteness),
  serviceMatch: entry(
    "user",
    z
      .object({
        request: text(LONG),
        candidates: z.array(z.object({ id: text(SHORT), text: text(LONG) }).strict()).min(1).max(MAX_MATCH_CANDIDATES),
      })
      .strict(),
    judgeServiceMatch,
  ),
  listingModeration: entry("bankQueue", z.object({ title: text(SHORT), text: text(LONG) }).strict(), judgeListingModeration),
} as const;

export type EndpointName = keyof typeof REGISTRY;

export function isEndpointName(name: string): name is EndpointName {
  return Object.hasOwn(REGISTRY, name);
}
