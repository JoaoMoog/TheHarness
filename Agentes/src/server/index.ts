import { fileURLToPath } from "node:url";
import { createJevClient } from "../jev.js";
import { createAvalServer } from "./app.js";
import { WorkQueue } from "./queue.js";

const DEFAULT_PORT = 8787;
const REQUESTS_PER_MINUTE = 60;
const MINUTE_MS = 60_000;

const port = Number(process.env.PORT ?? DEFAULT_PORT);
if (!Number.isInteger(port) || port <= 0) throw new Error(`PORT must be a positive integer, got ${process.env.PORT}`);
const host = process.env.HOST ?? "127.0.0.1";

const server = createAvalServer({
  client: createJevClient(),
  publicDir: fileURLToPath(new URL("../../public/", import.meta.url)),
  queue: new WorkQueue(),
  rateLimit: { limit: REQUESTS_PER_MINUTE, windowMs: MINUTE_MS },
  ...(process.env.ALLOWED_ORIGIN ? { allowedOrigin: process.env.ALLOWED_ORIGIN } : {}),
});

server.listen(port, host, () => {
  console.log(`Aval API em http://${host}:${port} (health, queue, judge/:nome)`);
});
