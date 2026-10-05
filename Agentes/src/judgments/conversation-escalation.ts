import { noul } from "@typesafe-ai/sdk";
import { noulConfidence, route } from "../policy.js";
import { type JevClient, type Judgment, requireNonEmpty, requireText } from "./types.js";

export interface ChatMessage {
  readonly from: "client" | "provider";
  readonly text: string;
}

export interface ConversationEscalationInput {
  readonly messages: readonly ChatMessage[];
}

/**
 * Reads the contract chat and tells whether it is heading to a dispute.
 * Code only suggests mediation early; nothing is blocked or released.
 */
export async function judgeConversationEscalation(
  client: JevClient,
  input: ConversationEscalationInput,
): Promise<Judgment<{ escalating: boolean; probability: number }>> {
  const messages = requireNonEmpty("messages", input.messages).map((m) => ({ from: m.from, text: requireText("text", m.text) }));
  const { answers } = await client.systemOne({
    state: { messages },
    questions: {
      escalating: noul("Is the exchange in `messages` between the client and the provider of a service heading toward a dispute?", {
        true: "Accusations, refusal to fix or to pay, threats to cancel or to complain, or one side ignoring the other",
        false: "Ordinary coordination about dates, access, materials or small fixes, even if someone is annoyed",
      }),
    },
  });
  const probability = answers.escalating.noul;
  const confidence = noulConfidence(probability);
  return { value: { escalating: probability >= 0.5, probability }, confidence, routing: route("conversationEscalation", confidence) };
}
