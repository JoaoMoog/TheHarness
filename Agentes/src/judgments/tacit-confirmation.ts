import { choice } from "@typesafe-ai/sdk";
import { route } from "../policy.js";
import { type JevClient, type Judgment, requireText } from "./types.js";

const OUTCOMES = {
  approve: "The client accepts the delivery and agrees to release the payment",
  approveWithReservation: "The client accepts the delivery but points out a minor issue to fix later",
  reject: "The client refuses the delivery or asks for rework before paying",
  ambiguous: "The message does not say whether the client accepts the delivery",
} as const;

export type TacitOutcome = keyof typeof OUTCOMES;

export interface TacitConfirmationInput {
  readonly stageName: string;
  readonly items: readonly string[];
  readonly clientMessage: string;
}

/** Reads the client's reply to a delivered stage. Silence until the deadline is handled in code. */
export async function judgeTacitConfirmation(
  client: JevClient,
  input: TacitConfirmationInput,
): Promise<Judgment<TacitOutcome>> {
  const clientMessage = requireText("clientMessage", input.clientMessage);
  const { answers } = await client.systemOne({
    state: { stage: { name: input.stageName, items: [...input.items] }, clientMessage },
    questions: {
      outcome: choice(
        "How does `clientMessage` respond to the delivery of `stage` by the service provider?",
        OUTCOMES,
      ),
    },
  });
  const { choice: value, confidence } = answers.outcome;
  const routing = value === "ambiguous" ? "humanReview" : route("tacitConfirmation", confidence);
  return { value, confidence, routing };
}
