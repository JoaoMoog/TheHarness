import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { request } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { createAvalServer } from "./app.js";

const servers: { close: () => void }[] = [];
after(() => servers.forEach((s) => s.close()));

async function publicFolder() {
  const dir = await mkdtemp(join(tmpdir(), "aval-public-"));
  await writeFile(join(dir, "index.html"), "<h1>Aval</h1>");
  await writeFile(join(dir, "app.css"), "body{}");
  return dir;
}

async function start(opts: { limit?: number; publicDir?: string; allowMockFrames?: boolean } = {}) {
  const server = createAvalServer({
    rateLimit: { limit: opts.limit ?? 100, windowMs: 60_000 },
    log: () => {},
    allowMockFrames: opts.allowMockFrames,
    ...(opts.publicDir ? { publicDir: opts.publicDir } : {}),
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  servers.push(server);
  const { port } = server.address() as AddressInfo;
  return { base: `http://127.0.0.1:${port}`, port };
}

test("health answers ok", async () => {
  // Arrange
  const { base } = await start();

  // Act
  const res = await fetch(`${base}/health`);

  // Assert
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { status: "ok" });
});

test("serves the prototype files with a content security policy", async () => {
  const { base } = await start({ publicDir: await publicFolder() });

  const home = await fetch(`${base}/`);
  assert.equal(home.status, 200);
  assert.match(home.headers.get("content-type") ?? "", /text\/html/);
  assert.match(home.headers.get("content-security-policy") ?? "", /default-src 'self'/);
  // The only outside call: the address of a CEP that is not a demo one.
  assert.match(home.headers.get("content-security-policy") ?? "", /connect-src 'self' https:\/\/viacep\.com\.br(;|$)/);
  assert.equal(home.headers.get("x-content-type-options"), "nosniff");
  assert.match((await fetch(`${base}/app.css`)).headers.get("content-type") ?? "", /text\/css/);
  assert.equal((await fetch(`${base}/missing.js`)).status, 404);
});

test("only validation mock pages may be embedded, and only by the same origin", async () => {
  const publicDir = await publicFolder();
  const normal = await start({ publicDir });
  const validation = await start({ publicDir, allowMockFrames: true });
  const policy = async (url: string) => (await fetch(url)).headers.get("content-security-policy") ?? "";
  assert.match(await policy(`${normal.base}/?mock=mock-001`), /frame-ancestors 'none'/);
  assert.match(await policy(`${validation.base}/?mock=mock-001`), /frame-ancestors 'self'/);
  assert.match(await policy(`${validation.base}/index.html?mock=mock-001`), /frame-ancestors 'self'/);
  assert.match(await policy(`${validation.base}/`), /frame-ancestors 'none'/);
  assert.match(await policy(`${validation.base}/app.css?mock=mock-001`), /frame-ancestors 'none'/);
  assert.match(await policy(`${validation.base}/?mock=invalid`), /frame-ancestors 'none'/);
});

test("refuses paths that escape the public folder", async () => {
  const { port } = await start({ publicDir: await publicFolder() });
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

test("only GET is allowed", async () => {
  const { base } = await start({ publicDir: await publicFolder() });
  assert.equal((await fetch(`${base}/health`, { method: "POST" })).status, 405);
  assert.equal((await fetch(`${base}/index.html`, { method: "POST" })).status, 405);
});

test("too many requests from one client return 429", async () => {
  const { base } = await start({ limit: 2, publicDir: await publicFolder() });
  const statuses = [];
  for (let i = 0; i < 3; i += 1) statuses.push((await fetch(`${base}/health`)).status);
  assert.deepEqual(statuses, [200, 200, 429]);
});

test("the old judgment and queue routes no longer exist", async () => {
  const { base } = await start({ publicDir: await publicFolder() });
  assert.equal((await fetch(`${base}/judge/tacitConfirmation`, { method: "GET" })).status, 404);
  assert.equal((await fetch(`${base}/queue`)).status, 404);
  assert.equal((await fetch(`${base}/policy`)).status, 404);
});
