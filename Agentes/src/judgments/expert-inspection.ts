import { noul } from "@typesafe-ai/sdk";
import { noulConfidence, route } from "../policy.js";
import { type JevClient, type Judgment, requireText } from "./types.js";

export interface ExpertInspectionInput {
  readonly summary: string;
}

/** Suggests an on-site technical inspection; the mediator opens it. */
export async function judgeExpertInspection(
  client: JevClient,
  input: ExpertInspectionInput,
): Promise<Judgment<boolean>> {
  const summary = requireText("summary", input.summary);
  const { answers } = await client.systemOne({
    state: { dispute: summary },
    questions: {
      needsInspection: noul(
        "Would a fair decision on `dispute` need a qualified technician to inspect or measure the work on site?",
        {
          true: "The parties disagree about whether the work meets a technical standard or norm, which needs expert measurement",
          false: "The disagreement is about dates, amounts, scope or something visible in photos and messages",
        },
      ),
    },
  });
  const confidence = noulConfidence(answers.needsInspection.noul);
  return {
    value: answers.needsInspection.noul >= 0.5,
    confidence,
    routing: route("expertInspection", confidence),
  };
}
