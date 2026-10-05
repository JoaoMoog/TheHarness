import { choice } from "@typesafe-ai/sdk";
import { route } from "../policy.js";
import { type JevClient, type Judgment, requireText } from "./types.js";

const APPEAL_KINDS = {
  newDocument: "Brings a new document or fact that directly answers the block reason",
  misunderstanding: "Explains a misunderstanding about the same facts, without new evidence",
  noNewInfo: "Repeats, complains or asks for release without new information",
} as const;

export type AppealKind = keyof typeof APPEAL_KINDS;

export interface BlockAppealInput {
  readonly blockReason: string;
  readonly appeal: string;
}

/** Reads a user's appeal against an automatic block. A person always decides. */
export async function judgeBlockAppeal(client: JevClient, input: BlockAppealInput): Promise<Judgment<AppealKind>> {
  const blockReason = requireText("blockReason", input.blockReason);
  const appeal = requireText("appeal", input.appeal);
  const { answers } = await client.systemOne({
    state: { blockReason, appeal },
    questions: { appeal: choice("What does `appeal` bring against `blockReason`?", APPEAL_KINDS) },
  });
  return { value: answers.appeal.choice, confidence: answers.appeal.confidence, routing: route("blockAppeal", answers.appeal.confidence) };
}
