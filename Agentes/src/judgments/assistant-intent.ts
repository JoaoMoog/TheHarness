import { choice } from "@typesafe-ai/sdk";
import { route } from "../policy.js";
import { type JevClient, type Judgment, requireNonEmpty, requireText } from "./types.js";

const INTENTS = {
  approveStage: "Approve a delivered stage and release its payment",
  pay: "Pay a service, a share of a group contract, or an installment",
  openDispute: "Complain about a service or open a dispute",
  viewStatement: "See balance, statement, installments or credit limit",
  newService: "Hire or set up a new service",
  requestCredit: "Ask for credit, a loan or financing to pay for a service",
  other: "Anything else",
} as const;

export type AssistantIntent = keyof typeof INTENTS;

const NEEDS_SERVICE: ReadonlySet<AssistantIntent> = new Set(["approveStage", "pay", "openDispute"]);
const NO_SERVICE = "none";

export interface ServiceOption {
  readonly id: string;
  readonly label: string;
}

export interface AssistantIntentInput {
  readonly message: string;
  readonly services: readonly ServiceOption[];
}

/**
 * Maps a free-text request to a screen. Both questions run in one call; code
 * only weighs the service answer when the intent needs a service.
 */
export async function judgeAssistantIntent(
  client: JevClient,
  input: AssistantIntentInput,
): Promise<Judgment<{ intent: AssistantIntent; serviceId: string | null }>> {
  const message = requireText("message", input.message);
  const services = requireNonEmpty("services", input.services);
  const serviceCriteria: Record<string, string> = {
    ...Object.fromEntries(services.map((s) => [s.id, s.label])),
    [NO_SERVICE]: "The message does not point to any of these services",
  };
  const { answers } = await client.systemOne({
    state: { message, services: services.map((s) => ({ id: s.id, label: s.label })) },
    questions: {
      intent: choice("What does the user want to do in `message`?", INTENTS),
      service: choice("Which of `services` is `message` about?", serviceCriteria),
    },
  });
  const intent = answers.intent.choice;
  const needsService = NEEDS_SERVICE.has(intent);
  const serviceId = needsService && answers.service.choice !== NO_SERVICE ? answers.service.choice : null;
  const confidence = needsService
    ? Math.min(answers.intent.confidence, answers.service.confidence)
    : answers.intent.confidence;
  const routing = needsService && serviceId === null ? "humanReview" : route("assistantIntent", confidence);
  return { value: { intent, serviceId }, confidence, routing };
}
