#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { repositoryRoot, verificationIdentity } from './identity.mjs';

function executable(argv) {
  if (argv[0] === 'node') return [process.execPath, ...argv.slice(1)];
  // .cmd files cannot be execFile'd on Windows. Invoke npm's JS entry directly,
  // without constructing a shell command from arguments or filenames.
  if (process.platform === 'win32' && ['npm', 'npm.cmd'].includes(argv[0])) {
    const candidates = [process.env.npm_execpath, ...[path.dirname(process.execPath),path.dirname(path.dirname(process.execPath)),...(process.env.PATH ?? process.env.Path ?? '').split(path.delimiter)].map(dir=>path.join(dir,'node_modules/npm/bin/npm-cli.js'))].filter(Boolean);
    const cli = candidates.find(p => fs.existsSync(p) && p.endsWith('npm-cli.js'));
    if (!cli) throw new Error('npm JS entry unavailable; pass node and the package manager JS entry as argv');
    return [process.execPath, cli, ...argv.slice(1)];
  }
  return argv;
}

export function runVerification({ root = repositoryRoot(), argv, environment = '', inputs = [], reuse = false, timeoutMs = 120000 }) {
  if (!Array.isArray(argv) || !argv.length || argv.some(v => typeof v !== 'string' || v.includes('\0'))) throw new Error('argv must be a nonempty JSON array of strings');
  if (argv.some(v => /^--?(?:password|token|secret|api-key)(?:=|$)/i.test(v))) throw new Error('Use environment variables for credentials, not recorded command arguments');
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > 3600000) throw new Error('timeout must be 1..3600000 milliseconds');
  const identity = verificationIdentity(root, argv, environment, inputs);
  const directory = path.join(root, '.harness/verification');
  const file = path.join(directory, identity.key + '.json');
  if (reuse && fs.existsSync(file)) {
    const previous = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (previous.status === 'passed' && previous.cacheable && previous.identity.key === identity.key) return { ...previous, reused: true, record: file };
  }
  fs.mkdirSync(directory, { recursive: true });
  const start = Date.now();
  let result;
  try { const [command, ...args] = executable(argv); result = spawnSync(command, args, { cwd: root, encoding: 'utf8', windowsHide: true, timeout: timeoutMs, maxBuffer: 16 * 1024 * 1024 }); }
  catch (error) { result = { error }; }
  const status = result.error ? 'blocked' : result.status === 0 ? 'passed' : 'failed';
  let output = [result.stdout ?? '', result.stderr ?? '', result.error?.message ?? ''].join('\n');
  for (const [key, value] of Object.entries(process.env)) if (/token|secret|password|api.key/i.test(key) && value?.length > 4) output = output.replaceAll(value, '[redacted]');
  const log = path.join(directory, identity.key + '.log');
  fs.writeFileSync(log, output);
  const after = verificationIdentity(root, argv, environment, inputs);
  const record = { version: 1, at: new Date().toISOString(), argv, environmentLabel: environment, inputs, identity, status,
    cacheable: status === 'passed' && after.key === identity.key, durationMs: Date.now() - start,
    exitCode: result.status ?? null, error: result.error?.code ?? null, log, reused: false };
  fs.writeFileSync(file, JSON.stringify(record, null, 2) + '\n');
  return { ...record, record: file };
}

if (process.argv[1] && fs.realpathSync(path.resolve(process.argv[1])) === fileURLToPath(import.meta.url)) {
  try {
    const args = Object.fromEntries(process.argv.slice(2).map(v => { const i = v.indexOf('='); return [v.slice(2, i < 0 ? undefined : i), i < 0 ? true : v.slice(i + 1)]; }));
    const result = runVerification({ argv: JSON.parse(args.argv), environment: args.environment ?? '', inputs: args.inputs ? JSON.parse(args.inputs) : [], reuse: Boolean(args.reuse), timeoutMs: Number(args.timeout ?? 120000) });
    console.log(JSON.stringify(result));
    process.exitCode = result.status === 'passed' ? 0 : 1;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
