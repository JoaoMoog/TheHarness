import { fileURLToPath } from "node:url";
import { createAppServer } from "./app.js";

const DEFAULT_PORT = 8790;

const port = Number(process.env.PORT ?? DEFAULT_PORT);
if (!Number.isInteger(port) || port <= 0) throw new Error(`PORT must be a positive integer, got ${process.env.PORT}`);
const host = process.env.HOST ?? "127.0.0.1";

const server = createAppServer({ webDir: fileURLToPath(new URL("../web/", import.meta.url)) });
server.listen(port, host, () => console.log(`CrossMarketPlace em http://${host}:${port}`));
