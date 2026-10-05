import { score } from "@typesafe-ai/sdk";
import { route } from "../policy.js";
import { type JevClient, type Judgment, requireText } from "./types.js";

const SEVERITY_LEVELS = [
  "Minor: cosmetic issue or question, no money or safety at risk",
  "Moderate: part of the work must be redone, the rest is usable",
  "Serious: the work cannot be used, or a large share of the money is at stake",
  "Critical: safety risk, abandoned work, or signs of fraud",
] as const;

const MAX_SEVERITY = SEVERITY_LEVELS.length - 1;
const SEVERITY_WEIGHT = 0.6;
const DEADLINE_WEIGHT = 0.4;
const DEADLINE_HORIZON_HOURS = 120;

export interface QueuePriorityInput {
  readonly summary: string;
  readonly hoursToDeadline: number;
}

/** Severity comes from Jev; the deadline is a known fact, so code mixes them. */
export async function judgeQueuePriority(
  client: JevClient,
  input: QueuePriorityInput,
): Promise<Judgment<{ severity: number; priority: number }>> {
  const summary = requireText("summary", input.summary);
  if (!Number.isFinite(input.hoursToDeadline)) throw new TypeError("hoursToDeadline must be a number");
  const { answers } = await client.systemOne({
    state: { case: summary },
    questions: { severity: score("How severe is the problem described in `case`?", SEVERITY_LEVELS) },
  });
  const severity = answers.severity.score;
  const clampedHours = Math.min(Math.max(input.hoursToDeadline, 0), DEADLINE_HORIZON_HOURS);
  const deadlineUrgency = 1 - clampedHours / DEADLINE_HORIZON_HOURS;
  const priority = SEVERITY_WEIGHT * (severity / MAX_SEVERITY) + DEADLINE_WEIGHT * deadlineUrgency;
  return {
    value: { severity, priority },
    confidence: answers.severity.confidence,
    routing: route("queuePriority", answers.severity.confidence),
  };
}
