import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { AddressInfo } from "node:net";
import { fileURLToPath } from "node:url";
import { createAppServer } from "../src/app.js";

const server = createAppServer({ webDir: fileURLToPath(new URL("../web/", import.meta.url)), log: () => {} });
let url = "";
before(async () => {
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  url = "http://127.0.0.1:" + (server.address() as AddressInfo).port;
});
after(() => server.close());

describe("static server", () => {
  it("serves the app shell with security headers", async () => {
    const res = await fetch(url + "/");
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-security-policy") ?? "", /script-src 'self'/);
    assert.equal(res.headers.get("x-content-type-options"), "nosniff");
  });
  it("answers the health check", async () => assert.deepEqual(await (await fetch(url + "/health")).json(), { status: "ok" }));
  it("refuses path traversal and unknown files", async () => {
    assert.equal((await fetch(url + "/..%2Fpackage.json")).status, 404);
    assert.equal((await fetch(url + "/nada.js")).status, 404);
  });
  it("refuses methods other than GET", async () => assert.equal((await fetch(url + "/", { method: "POST" })).status, 405));
});
