import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { request } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { choiceAnswer, fakeClient, noulAnswer } from "../judgments/fake-client.js";
import type { JevClient } from "../judgments/types.js";
import { createAvalServer } from "./app.js";
import { WorkQueue } from "./queue.js";

const servers: { close: () => void }[] = [];
after(() => servers.forEach((s) => s.close()));

async function start(client: JevClient, opts: { limit?: number; publicDir?: string } = {}) {
  const queue = new WorkQueue(() => new Date("2026-10-04T12:00:00Z"));
  const server = createAvalServer({
    client,
    queue,
    rateLimit: { limit: opts.limit ?? 100, windowMs: 60_000 },
    log: () => {},
    ...(opts.publicDir ? { publicDir: opts.publicDir } : {}),
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  servers.push(server);
  const { port } = server.address() as AddressInfo;
  const base = `http://127.0.0.1:${port}`;
  const post = (path: string, body: unknown) =>
    fetch(base + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return { base, post, queue };
}

const tacitBody = { stageName: "Instalações", items: ["Quadro elétrico novo"], clientMessage: "Pode liberar." };

test("health answers ok", async () => {
  const { base } = await start(fakeClient({}).client);
  const res = await fetch(`${base}/health`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { status: "ok" });
});

test("a confident judgment returns automatic and is not queued", async () => {
  // Arrange
  const { post, queue } = await start(fakeClient({ outcome: choiceAnswer("approve", 0.97) }).client);

  // Act
  const res = await post("/judge/tacitConfirmation", tacitBody);

  // Assert
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.value, "approve");
  assert.equal(body.routing, "automatic");
  assert.equal(body.queueId, null);
  assert.equal(queue.list().length, 0);
});

test("a low confidence judgment goes to the work queue", async () => {
  const { base, post } = await start(fakeClient({ needsInspection: noulAnswer(0.6) }).client);
  const res = await post("/judge/expertInspection", { summary: "Divergência sobre a fiação." });
  const body = await res.json();
  assert.equal(body.routing, "humanReview");
  assert.equal(body.escalateTo, "bankQueue");
  assert.match(body.queueId, /^Q-\d{4}$/);

  const list = await (await fetch(`${base}/queue`)).json();
  assert.equal(list.items.length, 1);
  assert.equal(list.items[0].judgment, "expertInspection");
  assert.equal(list.items[0].createdAt, "2026-10-04T12:00:00.000Z");
});

test("user-facing judgments ask the user to confirm instead of queueing for the bank", async () => {
  const { post, queue } = await start(
    fakeClient({ intent: choiceAnswer("pay", 0.95), service: choiceAnswer("AV-2026-014", 0.55) }).client,
  );
  const res = await post("/judge/assistantIntent", {
    message: "e pagar o pintor também",
    services: [{ id: "AV-2026-014", label: "Pintura do condomínio" }],
  });
  const body = await res.json();
  assert.equal(body.routing, "humanReview");
  assert.equal(body.escalateTo, "user");
  assert.equal(body.queueId, null);
  assert.equal(queue.list().length, 0);
});

test("invalid input is rejected with 400 before calling Jev", async () => {
  const { client, calls } = fakeClient({});
  const { post } = await start(client);
  const res = await post("/judge/tacitConfirmation", { stageName: "x", items: [] });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error, "Dados inválidos");
  assert.ok(Array.isArray(body.fields));
  assert.equal(calls.length, 0);
});

test("malformed JSON returns 400", async () => {
  const { base } = await start(fakeClient({}).client);
  const res = await fetch(`${base}/judge/tacitConfirmation`, { method: "POST", body: "{not json" });
  assert.equal(res.status, 400);
});

test("unknown judgment returns 404", async () => {
  const { post } = await start(fakeClient({}).client);
  const res = await post("/judge/somethingElse", {});
  assert.equal(res.status, 404);
});

test("wrong method returns 405", async () => {
  const { base } = await start(fakeClient({}).client);
  const res = await fetch(`${base}/judge/tacitConfirmation`);
  assert.equal(res.status, 405);
});

test("oversized body returns 413", async () => {
  const { post } = await start(fakeClient({}).client);
  const res = await post("/judge/expertInspection", { summary: "x".repeat(40_000) });
  assert.equal(res.status, 413);
});

test("too many judgment requests from one client return 429", async () => {
  const { post } = await start(fakeClient({ needsInspection: noulAnswer(0.99) }).client, { limit: 2 });
  const codes = [];
  for (let i = 0; i < 3; i++) codes.push((await post("/judge/expertInspection", { summary: "Fiação." })).status);
  assert.deepEqual(codes, [200, 200, 429]);
});

test("policy exposes the confidence thresholds", async () => {
  const { base } = await start(fakeClient({}).client);
  const body = await (await fetch(`${base}/policy`)).json();
  assert.equal(body.tacitConfirmation.threshold, 0.85);
  assert.equal(body.fraudSignals.kind, "alwaysHuman");
});

test("a queue item can be resolved once", async () => {
  const { base, post } = await start(fakeClient({ needsInspection: noulAnswer(0.6) }).client);
  const { queueId } = await (await post("/judge/expertInspection", { summary: "Fiação." })).json();

  const first = await post(`/queue/${queueId}/resolve`, { decision: "Perícia aprovada" });
  assert.equal(first.status, 200);
  const item = await first.json();
  assert.equal(item.status, "resolved");
  assert.equal(item.decision, "Perícia aprovada");

  assert.equal((await post(`/queue/${queueId}/resolve`, { decision: "De novo" })).status, 409);
  assert.equal((await post("/queue/Q-9999/resolve", { decision: "x" })).status, 404);
});

test("serves the prototype files with a content security policy", async () => {
  const dir = await mkdtemp(join(tmpdir(), "aval-public-"));
  await writeFile(join(dir, "index.html"), "<h1>Aval</h1>");
  await writeFile(join(dir, "app.css"), "body{}");
  const { base } = await start(fakeClient({}).client, { publicDir: dir });

  const home = await fetch(`${base}/`);
  assert.equal(home.status, 200);
  assert.match(home.headers.get("content-type") ?? "", /text\/html/);
  assert.match(home.headers.get("content-security-policy") ?? "", /default-src 'self'/);
  assert.match((await fetch(`${base}/app.css`)).headers.get("content-type") ?? "", /text\/css/);
  assert.equal((await fetch(`${base}/missing.js`)).status, 404);
});

test("refuses paths that escape the public folder", async () => {
  const dir = await mkdtemp(join(tmpdir(), "aval-public-"));
  await writeFile(join(dir, "index.html"), "ok");
  const { base } = await start(fakeClient({}).client, { publicDir: dir });
  const { port } = new URL(base);
  const status = await new Promise<number>((resolve, reject) => {
    request({ host: "127.0.0.1", port, path: "/..%2f..%2fpackage.json" }, (res) => {
      res.resume();
      resolve(res.statusCode ?? 0);
    })
      .on("error", reject)
      .end();
  });
  assert.equal(status, 404);
});

test("a Jev failure returns 502 without leaking details", async () => {
  const failing = {
    systemOne: async () => {
      throw new Error("secret upstream detail");
    },
  } as unknown as JevClient;
  const { post } = await start(failing);
  const res = await post("/judge/tacitConfirmation", tacitBody);
  assert.equal(res.status, 502);
  const text = await res.text();
  assert.ok(!text.includes("secret"));
});

test("a block appeal always reaches the bank queue, even when Jev is sure", async () => {
  const { post, queue } = await start(fakeClient({ appeal: choiceAnswer("newDocument", 0.99) }).client);
  const res = await post("/judge/blockAppeal", { blockReason: "Nome diferente do documento", appeal: "Envio a certidão de casamento." });
  const body = await res.json();
  assert.equal(body.routing, "humanReview");
  assert.equal(body.escalateTo, "bankQueue");
  assert.equal(queue.list().length, 1);
});

test("conversation escalation is a user-facing hint and never queues for the bank", async () => {
  const { post, queue } = await start(fakeClient({ escalating: noulAnswer(0.6) }).client);
  const res = await post("/judge/conversationEscalation", { messages: [{ from: "client", text: "Você sumiu e não vou pagar." }] });
  const body = await res.json();
  assert.equal(body.escalateTo, "user");
  assert.equal(queue.list().length, 0);
});

test("evidence consistency rejects more attachments than allowed", async () => {
  const { client, calls } = fakeClient({});
  const { post } = await start(client);
  const attachments = Array.from({ length: 21 }, () => ({ kind: "photo", caption: "Foto" }));
  const res = await post("/judge/evidenceConsistency", { stageName: "Acabamento", attachments });
  assert.equal(res.status, 400);
  assert.equal(calls.length, 0);
});

test("a prohibited listing always reaches the bank queue, even when Jev is sure", async () => {
  const { post, queue } = await start(fakeClient({ verdict: choiceAnswer("prohibited", 0.98) }).client);
  const res = await post("/judge/listingModeration", { title: "Ligação de luz", text: "Faço gato de energia barato." });
  const body = await res.json();
  assert.equal(body.routing, "humanReview");
  assert.equal(body.escalateTo, "bankQueue");
  assert.equal(queue.list().length, 1);
});

test("service match rejects more candidates than allowed before calling Jev", async () => {
  const { client, calls } = fakeClient({});
  const { post } = await start(client);
  const candidates = Array.from({ length: 13 }, (_, i) => ({ id: `p${i}`, text: "Eletricista" }));
  const res = await post("/judge/serviceMatch", { request: "Trocar a fiação", candidates });
  assert.equal(res.status, 400);
  assert.equal(calls.length, 0);
});
