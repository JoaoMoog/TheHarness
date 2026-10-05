import assert from "node:assert/strict";
import { test } from "node:test";
import { AV_2026_001 } from "../fixtures/av-2026-001.js";
import { judgeAssistantIntent } from "./assistant-intent.js";
import { judgeDeliveryCoverage } from "./delivery-coverage.js";
import { judgeDisputeReason } from "./dispute-reason.js";
import { judgeEvidenceSufficiency } from "./evidence-sufficiency.js";
import { judgeExpertInspection } from "./expert-inspection.js";
import { choiceAnswer, fakeClient, noulAnswer, scoreAnswer } from "./fake-client.js";
import { judgeFraudSignals } from "./fraud-signals.js";
import { judgeQueuePriority } from "./queue-priority.js";
import { judgeReviewModeration } from "./review-moderation.js";
import { judgeSuggestedStages, splitCandidates } from "./suggested-stages.js";
import { judgeTacitConfirmation } from "./tacit-confirmation.js";

test("splitCandidates breaks a description into clause candidates", () => {
  assert.deepEqual(splitCandidates(AV_2026_001.description), [
    "Reforma completa do banheiro",
    "demolição",
    "troca de instalações hidráulicas e elétricas",
    "revestimento e louças",
  ]);
});

test("suggested stages keeps only clauses judged as stages and splits the total in code", async () => {
  // Arrange
  const { client, calls } = fakeClient({
    candidate0: noulAnswer(0.08),
    candidate1: noulAnswer(0.97),
    candidate2: noulAnswer(0.95),
    candidate3: noulAnswer(0.96),
  });

  // Act
  const result = await judgeSuggestedStages(client, { description: AV_2026_001.description, totalCents: 1_200_000 });

  // Assert
  assert.equal(calls.length, 1);
  assert.deepEqual(
    result.value.stages.map((s) => s.name),
    ["Demolição", "Troca de instalações hidráulicas e elétricas", "Revestimento e louças"],
  );
  assert.equal(
    result.value.stages.reduce((acc, s) => acc + s.valueCents, 0),
    1_200_000,
  );
  assert.equal(result.routing, "automatic");
});

test("suggested stages asks the user when no clause looks like a stage", async () => {
  const { client } = fakeClient({ candidate0: noulAnswer(0.1) });
  const result = await judgeSuggestedStages(client, { description: "Pintura", totalCents: 100_000 });
  assert.equal(result.value.stages.length, 0);
  assert.equal(result.routing, "humanReview");
});

test("fraud signals always go to a person and list the present signals", async () => {
  const { client } = fakeClient({
    nameMismatch: noulAnswer(0.02),
    offPlatformPayment: noulAnswer(0.91),
    notRealService: noulAnswer(0.1),
    urgencyPressure: noulAnswer(0.88),
  });
  const result = await judgeFraudSignals(client, {
    accountName: "Paulo Reis",
    documentName: "Paulo Reis",
    serviceText: "Pague por fora no meu Pix pessoal hoje.",
  });
  assert.deepEqual(result.value.present, ["offPlatformPayment", "urgencyPressure"]);
  assert.equal(result.routing, "humanReview");
});

test("review moderation blocks offensive comments", async () => {
  const { client } = fakeClient({ offensive: noulAnswer(0.93), personalData: noulAnswer(0.05) });
  const result = await judgeReviewModeration(client, { comment: "Bando de incompetentes." });
  assert.deepEqual(result.value, { publishable: false, offensive: true, personalData: false });
});

test("review moderation publishes a clean comment automatically", async () => {
  const { client } = fakeClient({ offensive: noulAnswer(0.03), personalData: noulAnswer(0.02) });
  const result = await judgeReviewModeration(client, { comment: "Obra limpa e no prazo." });
  assert.equal(result.value.publishable, true);
  assert.equal(result.routing, "automatic");
});

const stage2 = AV_2026_001.stages[1]!;

test("tacit confirmation approves automatically when confident", async () => {
  // Arrange
  const { client, calls } = fakeClient({ outcome: choiceAnswer("approve", 0.97) });

  // Act
  const result = await judgeTacitConfirmation(client, {
    stageName: stage2.name,
    items: stage2.items,
    clientMessage: "Ficou ótimo, pode liberar.",
  });

  // Assert
  assert.equal(result.value, "approve");
  assert.equal(result.routing, "automatic");
  assert.equal(calls[0]?.questions.outcome?.type, "choice");
});

test("tacit confirmation sends ambiguous replies to a person even when confident", async () => {
  const { client } = fakeClient({ outcome: choiceAnswer("ambiguous", 0.99) });
  const result = await judgeTacitConfirmation(client, {
    stageName: stage2.name,
    items: stage2.items,
    clientMessage: "Vou ver amanhã.",
  });
  assert.equal(result.routing, "humanReview");
});

test("tacit confirmation rejects an empty message before calling Jev", async () => {
  const { client, calls } = fakeClient({});
  await assert.rejects(
    judgeTacitConfirmation(client, { stageName: stage2.name, items: stage2.items, clientMessage: "  " }),
    TypeError,
  );
  assert.equal(calls.length, 0);
});

test("delivery coverage asks one noul per stage item in a single call", async () => {
  const { client, calls } = fakeClient({
    item0: noulAnswer(0.98),
    item1: noulAnswer(0.95),
    item2: noulAnswer(0.97),
    item3: noulAnswer(0.55),
  });

  const result = await judgeDeliveryCoverage(client, {
    stageName: stage2.name,
    items: stage2.items,
    description: "Tubulação e quadro trocados, pontos instalados.",
    attachments: [{ kind: "photo", caption: "Quadro elétrico novo" }],
  });

  assert.equal(calls.length, 1);
  assert.equal(Object.keys(calls[0]!.questions).length, 4);
  assert.equal(result.value.coveredCount, 4);
  assert.equal(result.value.items[3]!.routing, "humanReview");
  assert.equal(result.routing, "humanReview");
});

test("delivery coverage marks a low probability item as not covered", async () => {
  const { client } = fakeClient({ item0: noulAnswer(0.04), item1: noulAnswer(0.99) });
  const result = await judgeDeliveryCoverage(client, {
    stageName: "Etapa",
    items: ["Nota fiscal", "Piso assentado"],
    description: "Piso pronto.",
    attachments: [],
  });
  assert.equal(result.value.items[0]!.covered, false);
  assert.equal(result.value.coveredCount, 1);
  assert.equal(result.routing, "automatic");
});

test("dispute reason combines the category with the unresponsive provider flag", async () => {
  const { client } = fakeClient({
    reason: choiceAnswer("deliveryQuality", 0.91),
    providerUnresponsive: noulAnswer(0.96),
  });
  const result = await judgeDisputeReason(client, {
    stageName: stage2.name,
    report: "O chuveiro não liga e o prestador não responde há 4 dias.",
  });
  assert.deepEqual(result.value, { reason: "deliveryQuality", providerUnresponsive: true });
  assert.equal(result.routing, "automatic");
});

test("evidence sufficiency judges each party separately", async () => {
  const { client, calls } = fakeClient({ party0: noulAnswer(0.94), party1: noulAnswer(0.17) });
  const result = await judgeEvidenceSufficiency(client, {
    reason: "deliveryQuality",
    parties: [
      { party: "client", statement: "Quadro diferente do combinado.", evidence: ["2 fotos do quadro", "vídeo do chuveiro"] },
      { party: "provider", statement: "Instalei conforme o projeto.", evidence: ["1 foto"] },
    ],
  });
  assert.equal(calls.length, 1);
  assert.deepEqual(
    result.value.map((p) => p.sufficient),
    [true, false],
  );
});

test("queue priority mixes judged severity with the deadline in code", async () => {
  const { client } = fakeClient({ severity: scoreAnswer(3, 0.9) });
  const urgent = await judgeQueuePriority(client, { summary: "Obra abandonada.", hoursToDeadline: 6 });
  const { client: client2 } = fakeClient({ severity: scoreAnswer(3, 0.9) });
  const relaxed = await judgeQueuePriority(client2, { summary: "Obra abandonada.", hoursToDeadline: 240 });
  assert.ok(urgent.value.priority > relaxed.value.priority);
  assert.equal(urgent.routing, "automatic");
});

test("expert inspection routes uncertain answers to review", async () => {
  const { client } = fakeClient({ needsInspection: noulAnswer(0.6) });
  const result = await judgeExpertInspection(client, { summary: "Divergência sobre a instalação elétrica." });
  assert.equal(result.value, true);
  assert.equal(result.routing, "humanReview");
});

test("assistant intent ignores service uncertainty when the intent needs no service", async () => {
  const { client } = fakeClient({ intent: choiceAnswer("viewStatement", 0.97), service: choiceAnswer("none", 0.4) });
  const result = await judgeAssistantIntent(client, {
    message: "mostra meu extrato",
    services: [{ id: "AV-2026-001", label: "Reforma do banheiro" }],
  });
  assert.deepEqual(result.value, { intent: "viewStatement", serviceId: null });
  assert.equal(result.routing, "automatic");
});

test("assistant intent offers credit as an intent that needs no service", async () => {
  const { client, calls } = fakeClient({ intent: choiceAnswer("requestCredit", 0.96), service: choiceAnswer("AV-2026-001", 0.5) });
  const result = await judgeAssistantIntent(client, {
    message: "quero financiar a reforma",
    services: [{ id: "AV-2026-001", label: "Reforma do banheiro" }],
  });
  const intentQuestion = calls[0]!.questions.intent;
  assert.ok(intentQuestion?.type === "choice" && "requestCredit" in intentQuestion.criteria);
  assert.deepEqual(result.value, { intent: "requestCredit", serviceId: null });
  assert.equal(result.routing, "automatic");
});

test("assistant intent asks for confirmation when the service is unclear", async () => {
  const { client, calls } = fakeClient({ intent: choiceAnswer("pay", 0.95), service: choiceAnswer("AV-2026-014", 0.55) });
  const result = await judgeAssistantIntent(client, {
    message: "e pagar o pintor também",
    services: [
      { id: "AV-2026-001", label: "Reforma do banheiro" },
      { id: "AV-2026-014", label: "Pintura do condomínio" },
    ],
  });
  const serviceQuestion = calls[0]!.questions.service;
  assert.ok(serviceQuestion?.type === "choice" && "none" in serviceQuestion.criteria);
  assert.equal(result.value.serviceId, "AV-2026-014");
  assert.equal(result.routing, "humanReview");
});
