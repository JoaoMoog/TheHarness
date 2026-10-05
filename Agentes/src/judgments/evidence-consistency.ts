import { noul, type NoulQuestion } from "@typesafe-ai/sdk";
import { noulConfidence, route } from "../policy.js";
import { type JevClient, type Judgment, requireNonEmpty, requireText, strictest } from "./types.js";

export interface EvidenceAttachment {
  readonly kind: "photo" | "video" | "document" | "location";
  readonly caption: string;
}

export interface EvidenceConsistencyInput {
  readonly stageName: string;
  readonly attachments: readonly EvidenceAttachment[];
}

interface ItemReading {
  readonly caption: string;
  readonly consistent: boolean;
  readonly probability: number;
}

const key = (i: number) => `attachment${i}`;

/**
 * Anti-fraud reading of delivery evidence: does each attachment describe the work
 * of this stage? Code adds its own checks (reused photo, location, timing).
 */
export async function judgeEvidenceConsistency(
  client: JevClient,
  input: EvidenceConsistencyInput,
): Promise<Judgment<{ items: ItemReading[]; inconsistentCount: number }>> {
  const stageName = requireText("stageName", input.stageName);
  const attachments = requireNonEmpty("attachments", input.attachments).map((a) => ({ kind: a.kind, caption: requireText("caption", a.caption) }));
  const questions: Record<string, NoulQuestion> = Object.fromEntries(
    attachments.map((_, i) => [
      key(i),
      noul(`Does \`${key(i)}\` plausibly document the work of \`stageName\` in a home or building service?`, {
        true: "The caption describes this kind of work, its materials, the site or a receipt for it",
        false: "The caption describes something unrelated, another kind of service or a different place",
      }),
    ]),
  );
  const { answers } = await client.systemOne({
    state: { stageName, ...Object.fromEntries(attachments.map((a, i) => [key(i), { kind: a.kind, caption: a.caption }])) },
    questions,
  });
  const items = attachments.map((a, i) => {
    const probability = (answers[key(i)] as { noul: number }).noul;
    return { caption: a.caption, consistent: probability >= 0.5, probability };
  });
  const confidences = items.map((i) => noulConfidence(i.probability));
  return {
    value: { items, inconsistentCount: items.filter((i) => !i.consistent).length },
    confidence: Math.min(...confidences),
    routing: strictest(confidences.map((c) => route("evidenceConsistency", c))),
  };
}
