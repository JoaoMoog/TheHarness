import { readFile, stat } from "node:fs/promises";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { extname, resolve, sep } from "node:path";

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

export interface ServerDeps {
  /** Folder with the prototype's static files. */
  readonly webDir: string;
  readonly log?: (event: Record<string, unknown>) => void;
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

/** Serves a file from webDir, refusing any path that resolves outside it. */
async function serveStatic(webDir: string, pathname: string, res: ServerResponse): Promise<void> {
  const root = resolve(webDir);
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

/** Static server for the prototype. All product logic runs in the browser with simulated data. */
export function createAppServer(deps: ServerDeps): Server {
  const log = deps.log ?? ((event) => console.log(JSON.stringify(event)));
  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (req.method !== "GET") throw new HttpError(405, "Método não permitido");
    const { pathname } = new URL(req.url ?? "/", "http://localhost");
    if (pathname === "/health") return sendJson(res, 200, { status: "ok" });
    return serveStatic(deps.webDir, pathname, res);
  }
  return createServer((req, res) => {
    handle(req, res).catch((error: unknown) => {
      if (error instanceof HttpError) return sendJson(res, error.status, { error: error.message });
      log({ event: "server_error", error: String(error) });
      sendJson(res, 500, { error: "Erro interno" });
    });
  });
}
