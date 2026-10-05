import assert from "node:assert/strict";
import { test } from "node:test";
import { choiceAnswer, fakeClient, noulAnswer, scoreAnswer } from "./fake-client.js";
import { judgeListingModeration, judgeRequestCategory, judgeRequestCompleteness, judgeServiceMatch } from "./market.js";

const FIACAO = "Trocar a fiação do apartamento de 2 quartos, os disjuntores desarmam com o chuveiro ligado.";

test("request category maps a confident answer to the app category id", async () => {
  // Arrange
  const { client, calls } = fakeClient({ category: choiceAnswer("eletrica", 0.93) });

  // Act
  const result = await judgeRequestCategory(client, { text: FIACAO });

  // Assert
  assert.equal(result.value, "eletrica");
  assert.equal(result.routing, "automatic");
  assert.equal(calls[0]!.questions.category?.type, "choice");
});

test("request category translates the air conditioning key and leaves unsure readings to the user", async () => {
  const { client } = fakeClient({ category: choiceAnswer("arCondicionado", 0.55) });
  const result = await judgeRequestCategory(client, { text: "O ar do quarto pinga água." });
  assert.equal(result.value, "ar-condicionado");
  assert.equal(result.routing, "humanReview");
});

test("request category rejects an empty request before calling Jev", async () => {
  const { client, calls } = fakeClient({});
  await assert.rejects(() => judgeRequestCategory(client, { text: "   " }), TypeError);
  assert.equal(calls.length, 0);
});

test("request completeness says a vague request is missing details", async () => {
  const { client } = fakeClient({ complete: noulAnswer(0.1) });
  const result = await judgeRequestCompleteness(client, { text: "Preciso de um eletricista.", category: "Elétrica" });
  assert.equal(result.value, false);
  assert.equal(result.routing, "automatic");
});

test("request completeness accepts a detailed request", async () => {
  const { client } = fakeClient({ complete: noulAnswer(0.9) });
  const result = await judgeRequestCompleteness(client, { text: FIACAO, category: "Elétrica" });
  assert.equal(result.value, true);
});

test("service match scores each candidate from 0 to 1 and keeps their ids", async () => {
  const { client, calls } = fakeClient({ match0: scoreAnswer(3, 0.8), match1: scoreAnswer(0, 0.9) });
  const result = await judgeServiceMatch(client, {
    request: FIACAO,
    candidates: [{ id: "paulo-reis", text: "Eletricista, troca de fiação e quadros" }, { id: "brilho-casa", text: "Faxina e limpeza pós-obra" }],
  });
  assert.deepEqual(result.value, { "paulo-reis": 1, "brilho-casa": 0 });
  assert.equal(result.routing, "automatic");
  assert.equal(Object.keys(calls[0]!.questions).length, 2);
});

test("service match rejects an empty candidate list", async () => {
  const { client } = fakeClient({});
  await assert.rejects(() => judgeServiceMatch(client, { request: FIACAO, candidates: [] }), TypeError);
});

test("listing moderation publishes a clean listing automatically", async () => {
  const { client } = fakeClient({ verdict: choiceAnswer("ok", 0.95) });
  const result = await judgeListingModeration(client, { title: "Pintura de apartamento", text: "Pintura interna com duas demãos." });
  assert.equal(result.value, "ok");
  assert.equal(result.routing, "automatic");
});

test("listing moderation flags a phone number as contact outside the platform", async () => {
  const { client } = fakeClient({ verdict: choiceAnswer("contactLeak", 0.9) });
  const result = await judgeListingModeration(client, { title: "Elétrica", text: "Chama no zap 11 98888-7777 que faço mais barato." });
  assert.equal(result.value, "contactLeak");
  assert.equal(result.routing, "automatic");
});

test("listing moderation always sends prohibited or misleading listings to a person", async () => {
  const { client } = fakeClient({ verdict: choiceAnswer("prohibited", 0.99) });
  const result = await judgeListingModeration(client, { title: "Ligação clandestina", text: "Faço gato de luz." });
  assert.equal(result.value, "prohibited");
  assert.equal(result.routing, "humanReview");
});
