import { noul } from "@typesafe-ai/sdk";
import { noulConfidence, route } from "../policy.js";
import { type JevClient, type Judgment, requireText } from "./types.js";

export interface ScheduleOnlyInput {
  readonly report: string;
}

/**
 * Resolution matrix: a disagreement only about timing gets a new date without
 * touching the stage value. Jev tells whether the complaint is only about timing.
 */
export async function judgeScheduleOnly(client: JevClient, input: ScheduleOnlyInput): Promise<Judgment<boolean>> {
  const report = requireText("report", input.report);
  const { answers } = await client.systemOne({
    state: { report },
    questions: {
      scheduleOnly: noul("Is the complaint in `report` only about timing, such as a delay or a new date?", {
        true: "Only the date or the pace is criticised; the work itself is not said to be missing, wrong or badly done",
        false: "The report also says something is missing, broken, wrong, unsafe or poorly done",
      }),
    },
  });
  const probability = answers.scheduleOnly.noul;
  const confidence = noulConfidence(probability);
  return { value: probability >= 0.5, confidence, routing: route("scheduleOnly", confidence) };
}
