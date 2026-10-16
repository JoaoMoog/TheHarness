import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const origin = 'http://127.0.0.1:3112';
mkdirSync(resolve(root, '.local'), { recursive: true });
const dataDir = mkdtempSync(resolve(root, '.local/daily-e2e-'));
const env = { ...process.env, AUTH_MODE: 'demo', AI_PROVIDER: 'demo', PUBLIC_APP_URL: origin,
  PROMETEU_DATA_DIR: dataDir, PLAYWRIGHT_BASE_URL: origin };
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3112'], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
server.stderr.pipe(process.stderr);
server.stdout.pipe(process.stdout);
let serverFailure;
let listening = false;
server.stdout.on('data', chunk => { if (chunk.toString().includes('Ready in')) listening = true; });
server.on('error', error => { serverFailure = error; });
try {
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (serverFailure) throw serverFailure;
    if (server.exitCode !== null) throw new Error('Review server exited: ' + server.exitCode);
    // Never run tests against an unrelated server already occupying this port.
    if (listening) {
      try { ready = (await fetch(origin + '/api/health', { signal: AbortSignal.timeout(1000) })).ok; } catch {}
    }
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  if (!ready) throw new Error('Review server did not become reachable');
  const tests = spawn(process.execPath, ['tests/run-e2e.mjs', ...process.argv.slice(2)], { cwd: root, env, stdio: 'inherit', windowsHide: true });
  const [code] = await once(tests, 'exit');
  process.exitCode = code ?? 1;
} finally {
  server.kill();
  if (server.exitCode === null) await once(server, 'exit');
  console.log('Review server stopped. Isolated test data: ' + dataDir);
}
