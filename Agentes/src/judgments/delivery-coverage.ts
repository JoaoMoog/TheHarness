import { noul, type NoulQuestion } from "@typesafe-ai/sdk";
import { noulConfidence, route, type Routing } from "../policy.js";
import { type JevClient, type Judgment, requireNonEmpty, strictest } from "./types.js";

export interface Attachment {
  readonly kind: "photo" | "video" | "document" | "location";
  readonly caption: string;
}

export interface DeliveryCoverageInput {
  readonly stageName: string;
  readonly items: readonly string[];
  readonly description: string;
  readonly attachments: readonly Attachment[];
}

export interface ItemCoverage {
  readonly item: string;
  readonly covered: boolean;
  readonly probability: number;
  readonly confidence: number;
  readonly routing: Routing;
}

export interface DeliveryCoverage {
  readonly items: readonly ItemCoverage[];
  readonly coveredCount: number;
}

const COVERED_AT = 0.5;

/**
 * Checks each stage item against the provider's description and attachment captions.
 * Jev reads text only, so media reach it as captions and metadata.
 */
export async function judgeDeliveryCoverage(
  client: JevClient,
  input: DeliveryCoverageInput,
): Promise<Judgment<DeliveryCoverage>> {
  const items = requireNonEmpty("items", input.items);
  const questions: Record<string, NoulQuestion> = Object.fromEntries(
    items.map((item, i) => [
      `item${i}`,
      noul(`Does \`delivery\` show that this item of the stage was completed: "${item}"?`, {
        true: "The description or an attachment caption directly shows this item done",
        false: "Nothing in the delivery shows this item, or it is only promised for later",
      }),
    ]),
  );
  const { answers } = await client.systemOne({
    state: {
      stage: { name: input.stageName },
      delivery: {
        description: input.description,
        attachments: input.attachments.map((a) => ({ kind: a.kind, caption: a.caption })),
      },
    },
    questions,
  });
  const coverage = items.map((item, i): ItemCoverage => {
    const answer = answers[`item${i}`];
    if (answer?.type !== "noul") throw new Error(`Jev returned no answer for item${i}`);
    const probability = answer.noul;
    const confidence = noulConfidence(probability);
    return {
      item,
      covered: probability >= COVERED_AT,
      probability,
      confidence,
      routing: route("deliveryCoverage", confidence),
    };
  });
  return {
    value: { items: coverage, coveredCount: coverage.filter((c) => c.covered).length },
    confidence: Math.min(...coverage.map((c) => c.confidence)),
    routing: strictest(coverage.map((c) => c.routing)),
  };
}
