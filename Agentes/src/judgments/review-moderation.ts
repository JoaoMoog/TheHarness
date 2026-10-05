import { noul } from "@typesafe-ai/sdk";
import { noulConfidence, route } from "../policy.js";
import { type JevClient, type Judgment, requireText, strictest } from "./types.js";

export interface ReviewModerationInput {
  readonly comment: string;
}

/** Checks a public review before it goes live. Code publishes only when both checks are clear. */
export async function judgeReviewModeration(
  client: JevClient,
  input: ReviewModerationInput,
): Promise<Judgment<{ publishable: boolean; offensive: boolean; personalData: boolean }>> {
  const comment = requireText("comment", input.comment);
  const { answers } = await client.systemOne({
    state: { comment },
    questions: {
      offensive: noul("Does `comment` insult, threaten or use slurs against a person or company?", {
        true: "Name-calling, threats or slurs",
        false: "Criticism of the work, even harsh, without insults",
      }),
      personalData: noul("Does `comment` expose personal data such as a phone number, address, ID number or email?"),
    },
  });
  const offensive = answers.offensive.noul >= 0.5;
  const personalData = answers.personalData.noul >= 0.5;
  const confidences = [noulConfidence(answers.offensive.noul), noulConfidence(answers.personalData.noul)];
  return {
    value: { publishable: !offensive && !personalData, offensive, personalData },
    confidence: Math.min(...confidences),
    routing: strictest(confidences.map((c) => route("reviewModeration", c))),
  };
}
