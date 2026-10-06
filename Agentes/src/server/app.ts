import { readFile, stat } from "node:fs/promises";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { extname, resolve, sep } from "node:path";

const MAX_TRACKED_CLIENTS = 10_000;

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

export type Log = (event: Record<string, unknown>) => void;

export interface ServerDeps {
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

/** Serves the prototype: static files plus a health check. All the app's logic runs in the browser. */
export function createAvalServer(deps: ServerDeps): Server {
  const allow = createRateLimiter(deps.rateLimit);
  const log: Log = deps.log ?? ((event) => console.log(JSON.stringify(event)));

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (deps.allowedOrigin) {
      res.setHeader("access-control-allow-origin", deps.allowedOrigin);
      res.setHeader("access-control-allow-methods", "GET");
      if (req.method === "OPTIONS") {
        res.writeHead(204).end();
        return;
      }
    }
    if (!allow(clientKey(req))) throw new HttpError(429, "Muitas requisições. Tente em instantes.");
    if (req.method !== "GET") throw new HttpError(405, "Método não permitido");
    const { pathname } = new URL(req.url ?? "/", "http://localhost");
    if (pathname === "/health") return send(res, 200, { status: "ok" });
    if (deps.publicDir) return serveStatic(deps.publicDir, pathname, res);
    throw new HttpError(404, "Rota não encontrada");
  }

  return createServer((req, res) => {
    handle(req, res).catch((error: unknown) => {
      if (error instanceof HttpError) return send(res, error.status, { error: error.message });
      log({ event: "server_error", error: String(error) });
      send(res, 500, { error: "Erro interno" });
    });
  });
}
