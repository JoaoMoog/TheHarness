import { fileURLToPath } from "node:url";
import { createAvalServer } from "./app.js";

const DEFAULT_PORT = 8787;
// One page load is about 100 requests (one per module); this allows ~60 reloads a minute before answering 429.
const REQUESTS_PER_MINUTE = 6000;
const MINUTE_MS = 60_000;

const port = Number(process.env.PORT ?? DEFAULT_PORT);
if (!Number.isInteger(port) || port <= 0) throw new Error(`PORT must be a positive integer, got ${process.env.PORT}`);
const host = process.env.HOST ?? "127.0.0.1";
// The web demo (slides, guide, Demo menu) is the default; `--release` previews the stripped build the APK ships.
const validation = !process.argv.includes("--release");

const server = createAvalServer({
  publicDir: fileURLToPath(new URL(validation ? "../../public/" : "../../dist/release/", import.meta.url)),
  allowMockFrames: validation,
  rateLimit: { limit: REQUESTS_PER_MINUTE, windowMs: MINUTE_MS },
  ...(process.env.ALLOWED_ORIGIN ? { allowedOrigin: process.env.ALLOWED_ORIGIN } : {}),
});

server.listen(port, host, () => {
  console.log(`Aval (${validation ? "validação" : "release"} — pagamentos simulados) em http://${host}:${port}`);
});
