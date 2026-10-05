import { readFile, stat } from "node:fs/promises";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { extname, resolve, sep } from "node:path";
import { z } from "zod";
import type { JevClient, Judgment } from "../judgments/types.js";
import { JUDGMENT_POLICY } from "../policy.js";
import type { WorkQueue } from "./queue.js";
import { isEndpointName, REGISTRY } from "./registry.js";

const MAX_BODY_BYTES = 32 * 1024;
const MAX_TRACKED_CLIENTS = 10_000;
/** Pages, styles and icons are cheap, so they get a looser limit than Jev calls. */
const STATIC_LIMIT_FACTOR = 20;

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
};

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com",
  "img-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
].join("; ");

const resolveBody = z.object({ decision: z.string().trim().min(1).max(300) }).strict();

export type Log = (event: Record<string, unknown>) => void;

export interface ServerDeps {
  readonly client: JevClient;
  readonly queue: WorkQueue;
  readonly rateLimit: { readonly limit: number; readonly windowMs: number };
  readonly log?: Log;
  readonly allowedOrigin?: string;
  /** Folder with the prototype's static files. */
  readonly publicDir?: string;
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly extra: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

/** Fixed-window limiter per client address. */
function createRateLimiter({ limit, windowMs }: ServerDeps["rateLimit"]) {
  const windows = new Map<string, { count: number; resetAt: number }>();
  return (key: string): boolean => {
    const now = Date.now();
    if (windows.size > MAX_TRACKED_CLIENTS) {
      for (const [k, w] of windows) if (w.resetAt <= now) windows.delete(k);
    }
    const current = windows.get(key);
    const window = current && current.resetAt > now ? current : { count: 0, resetAt: now + windowMs };
    const next = { ...window, count: window.count + 1 };
    windows.set(key, next);
    return next.count <= limit;
  };
}

const clientKey = (req: IncomingMessage) => req.socket.remoteAddress ?? "unknown";

function send(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function requireMethod(req: IncomingMessage, method: string): void {
  if (req.method !== method) throw new HttpError(405, "Método não permitido");
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size <= MAX_BODY_BYTES) chunks.push(chunk);
    });
    req.on("end", () =>
      size > MAX_BODY_BYTES
        ? reject(new HttpError(413, "Conteúdo grande demais"))
        : resolve(Buffer.concat(chunks).toString("utf8")),
    );
    req.on("error", reject);
  });
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    throw new HttpError(400, "JSON inválido");
  }
}

type AnyRun = (client: JevClient, input: unknown) => Promise<Judgment<unknown>>;

/** Serves a file from publicDir, refusing any path that resolves outside it. */
async function serveStatic(publicDir: string, pathname: string, res: ServerResponse): Promise<void> {
  const root = resolve(publicDir);
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname === "/" ? "/index.html" : pathname);
  } catch {
    throw new HttpError(400, "Caminho inválido");
  }
  const file = resolve(root, `.${decoded}`);
  if (!file.startsWith(root + sep)) throw new HttpError(404, "Rota não encontrada");
  const info = await stat(file).catch(() => null);
  if (!info?.isFile()) throw new HttpError(404, "Rota não encontrada");
  const body = await readFile(file);
  res.writeHead(200, {
    "content-type": CONTENT_TYPES[extname(file)] ?? "application/octet-stream",
    "content-security-policy": CONTENT_SECURITY_POLICY,
    "x-content-type-options": "nosniff",
    "cache-control": "no-store",
  });
  res.end(body);
}

/**
 * HTTP API for the prototype. The Jev key stays here, server side; the
 * browser only ever sees judgments and routing.
 */
export function createAvalServer(deps: ServerDeps): Server {
  const allowJudge = createRateLimiter(deps.rateLimit);
  const allowAny = createRateLimiter({ ...deps.rateLimit, limit: deps.rateLimit.limit * STATIC_LIMIT_FACTOR });
  const log: Log = deps.log ?? ((event) => console.log(JSON.stringify(event)));

  async function judge(name: string, req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (!isEndpointName(name)) throw new HttpError(404, "Julgamento desconhecido");
    requireMethod(req, "POST");
    if (!allowJudge(clientKey(req))) throw new HttpError(429, "Muitas requisições. Tente em instantes.");
    const input = parseJson(await readBody(req));
    const { schema, run, escalateTo } = REGISTRY[name];
    const parsed = schema.safeParse(input);
    if (!parsed.success) {
      const fields = parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
      throw new HttpError(400, "Dados inválidos", { fields });
    }
    const started = Date.now();
    let result: Judgment<unknown>;
    try {
      result = await (run as AnyRun)(deps.client, parsed.data);
    } catch (error) {
      log({ event: "jev_error", judgment: name, error: String(error) });
      throw new HttpError(502, "Serviço de julgamento indisponível. Tente novamente.");
    }
    const needsPerson = result.routing === "humanReview";
    const queueId =
      needsPerson && escalateTo === "bankQueue"
        ? deps.queue.enqueue({ judgment: name, input: parsed.data, value: result.value, confidence: result.confidence }).id
        : null;
    log({ event: "judgment", judgment: name, routing: result.routing, confidence: result.confidence, ms: Date.now() - started });
    send(res, 200, {
      judgment: name,
      value: result.value,
      confidence: result.confidence,
      routing: result.routing,
      escalateTo: needsPerson ? escalateTo : null,
      queueId,
    });
  }

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (deps.allowedOrigin) {
      res.setHeader("access-control-allow-origin", deps.allowedOrigin);
      res.setHeader("access-control-allow-headers", "content-type");
      res.setHeader("access-control-allow-methods", "GET, POST");
      if (req.method === "OPTIONS") {
        res.writeHead(204).end();
        return;
      }
    }
    if (!allowAny(clientKey(req))) throw new HttpError(429, "Muitas requisições. Tente em instantes.");
    const { pathname } = new URL(req.url ?? "/", "http://localhost");
    if (pathname === "/health") {
      requireMethod(req, "GET");
      return send(res, 200, { status: "ok" });
    }
    if (pathname === "/policy") {
      requireMethod(req, "GET");
      return send(res, 200, JUDGMENT_POLICY);
    }
    if (pathname === "/queue") {
      requireMethod(req, "GET");
      return send(res, 200, { items: deps.queue.list() });
    }
    const resolveMatch = /^\/queue\/(Q-\d{4,})\/resolve$/.exec(pathname);
    if (resolveMatch?.[1]) return resolveItem(resolveMatch[1], req, res);
    const judgeMatch = /^\/judge\/([A-Za-z]+)$/.exec(pathname);
    if (judgeMatch?.[1]) return judge(judgeMatch[1], req, res);
    if (deps.publicDir && req.method === "GET") return serveStatic(deps.publicDir, pathname, res);
    throw new HttpError(404, "Rota não encontrada");
  }

  async function resolveItem(id: string, req: IncomingMessage, res: ServerResponse): Promise<void> {
    requireMethod(req, "POST");
    const parsed = resolveBody.safeParse(parseJson(await readBody(req)));
    if (!parsed.success) throw new HttpError(400, "Dados inválidos");
    const outcome = deps.queue.resolve(id, parsed.data.decision);
    if (outcome.kind === "notFound") throw new HttpError(404, "Item não encontrado");
    if (outcome.kind === "alreadyResolved") throw new HttpError(409, "Item já resolvido");
    log({ event: "queue_resolved", id, decision: parsed.data.decision });
    send(res, 200, outcome.item);
  }

  return createServer((req, res) => {
    handle(req, res).catch((error: unknown) => {
      if (error instanceof HttpError) return send(res, error.status, { error: error.message, ...error.extra });
      log({ event: "server_error", error: String(error) });
      send(res, 500, { error: "Erro interno" });
    });
  });
}
