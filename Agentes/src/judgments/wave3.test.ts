import assert from "node:assert/strict";
import { test } from "node:test";
import { judgeBlockAppeal } from "./block-appeal.js";
import { judgeConversationEscalation } from "./conversation-escalation.js";
import { judgeEvidenceConsistency } from "./evidence-consistency.js";
import { choiceAnswer, fakeClient, noulAnswer } from "./fake-client.js";
import { judgeScheduleOnly } from "./schedule-only.js";

const chat = [
  { from: "client" as const, text: "O chuveiro continua sem ligar e você não responde." },
  { from: "provider" as const, text: "Já fiz o que estava no contrato, não vou voltar aí." },
];

test("conversation escalation flags a heated thread automatically when Jev is sure", async () => {
  // Arrange
  const { client, calls } = fakeClient({ escalating: noulAnswer(0.93) });

  // Act
  const result = await judgeConversationEscalation(client, { messages: chat });

  // Assert
  assert.equal(result.value.escalating, true);
  assert.equal(result.routing, "automatic");
  assert.equal(calls[0]!.questions.escalating?.type, "noul");
  assert.deepEqual((calls[0]!.state as { messages: unknown[] }).messages.length, 2);
});

test("conversation escalation leaves borderline threads to the user", async () => {
  const { client } = fakeClient({ escalating: noulAnswer(0.6) });
  const result = await judgeConversationEscalation(client, { messages: chat });
  assert.equal(result.routing, "humanReview");
});

test("conversation escalation rejects an empty thread before calling Jev", async () => {
  const { client, calls } = fakeClient({});
  await assert.rejects(() => judgeConversationEscalation(client, { messages: [] }), TypeError);
  assert.equal(calls.length, 0);
});

test("schedule only recognises a pure delay complaint", async () => {
  const { client } = fakeClient({ scheduleOnly: noulAnswer(0.95) });
  const result = await judgeScheduleOnly(client, { report: "A etapa atrasou uma semana, mas o serviço está bem feito." });
  assert.equal(result.value, true);
  assert.equal(result.routing, "automatic");
});

test("schedule only sends unsure readings to the user", async () => {
  const { client } = fakeClient({ scheduleOnly: noulAnswer(0.3) });
  const result = await judgeScheduleOnly(client, { report: "Atrasou e o rejunte ficou torto." });
  assert.equal(result.value, false);
  assert.ok(Math.abs(result.confidence - 0.4) < 1e-9);
  assert.equal(result.routing, "humanReview");
});

test("evidence consistency reads each attachment and counts the odd ones", async () => {
  const { client, calls } = fakeClient({ attachment0: noulAnswer(0.96), attachment1: noulAnswer(0.04) });
  const result = await judgeEvidenceConsistency(client, {
    stageName: "Acabamento",
    attachments: [{ kind: "photo", caption: "Piso rejuntado no box" }, { kind: "photo", caption: "Carro na oficina mecânica" }],
  });
  assert.deepEqual(result.value.items.map((i) => i.consistent), [true, false]);
  assert.equal(result.value.inconsistentCount, 1);
  assert.equal(result.routing, "automatic");
  assert.ok("attachment1" in calls[0]!.questions);
});

test("evidence consistency is strict when any attachment is unclear", async () => {
  const { client } = fakeClient({ attachment0: noulAnswer(0.96), attachment1: noulAnswer(0.55) });
  const result = await judgeEvidenceConsistency(client, {
    stageName: "Acabamento",
    attachments: [{ kind: "photo", caption: "Piso rejuntado" }, { kind: "document", caption: "Recibo" }],
  });
  assert.equal(result.routing, "humanReview");
});

test("block appeal is always reviewed by a person", async () => {
  const { client } = fakeClient({ appeal: choiceAnswer("newDocument", 0.98) });
  const result = await judgeBlockAppeal(client, {
    blockReason: "Nome diferente do documento",
    appeal: "Mudei de nome no casamento, envio a certidão.",
  });
  assert.equal(result.value, "newDocument");
  assert.equal(result.routing, "humanReview");
});
