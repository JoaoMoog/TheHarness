/**
 * Shared plumbing for the Azure DevOps scripts.
 *
 * The agent never calls `az` directly. It calls these scripts, and they build
 * the command. That is what makes every write auditable: --dry-run prints the
 * exact argv without executing, so the action can be read before it happens.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export const EXIT_OK = 0;
export const EXIT_FAIL = 2;

/** Quadrants come from the harness oversight model, not from a flag. */
export const QUADRANT = {
  Q1: 'automate',
  Q2: 'review after',
  Q3: 'confirm before',
  Q4: 'human at the keyboard',
};

export class AdoError extends Error {
  constructor(message, remedy) {
    super(message);
    this.remedy = remedy;
  }
}

/* ------------------------------------------------------------------ output */

const SECRET_PATTERNS = [
  /\bghp_[A-Za-z0-9]{30,}\b/g,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+/g,
  /(Bearer|Basic)\s+[A-Za-z0-9+/=._-]{16,}/gi,
  /\b[A-Za-z0-9]{52}\b/g,
];

function mask(value) {
  const s = String(value);
  if (s.length <= 8) return '*'.repeat(s.length);
  return `${s.slice(0, 4)}${'*'.repeat(Math.min(s.length - 8, 24))}${s.slice(-4)}`;
}

/** Nothing this tooling prints may carry a credential, including on failure. */
export function redact(text) {
  let out = String(text ?? '');
  for (const re of SECRET_PATTERNS) out = out.replace(re, (m) => mask(m));
  return out;
}

export function ok(payload) {
  process.stdout.write(`${JSON.stringify({ status: 'ok', ...payload }, null, 2)}\n`);
  return EXIT_OK;
}

/**
 * Fails closed, like every other guardrail here: a script that cannot verify
 * what it is about to do says so and stops, rather than exiting zero.
 */
export function fail(message, remedy) {
  console.error(`harness ado: ${redact(message)}`);
  if (remedy) console.error(`\n${remedy}`);
  return EXIT_FAIL;
}

/* ------------------------------------------------------------------ argv */

export function parseArgs(argv) {
  const args = { _: [] };
  for (const token of argv) {
    if (token.startsWith('--')) {
      const eq = token.indexOf('=');
      if (eq === -1) args[token.slice(2)] = true;
      else args[token.slice(2, eq)] = token.slice(eq + 1);
    } else args._.push(token);
  }
  return args;
}

/* ------------------------------------------------------------------ az */

const firstLine = (text) => String(text).split(/\r?\n/).find(Boolean) ?? '';

const NOT_FOUND_REMEDY =
  'Install the Azure CLI, then add the extension:\n  az extension add --name azure-devops';
const AUTH_REMEDY =
  'Sign in again:\n  az login\n  az devops login   # only if you authenticate with a PAT';

/**
 * On Windows the Azure CLI is a .cmd shim, and spawning it by bare name without
 * a shell fails. Resolving the real file off PATH lets us keep shell:false on
 * every platform. HARNESS_AZ_BIN overrides it, which is how the self-test
 * injects a stub without touching PATH.
 */
let cachedAz;
export function azBinary() {
  if (cachedAz !== undefined) return cachedAz;
  if (process.env.HARNESS_AZ_BIN) return (cachedAz = process.env.HARNESS_AZ_BIN);

  const names = process.platform === 'win32' ? ['az.cmd', 'az.bat', 'az.exe', 'az'] : ['az'];
  for (const dir of (process.env.PATH ?? '').split(path.delimiter).filter(Boolean)) {
    for (const name of names) {
      const candidate = path.join(dir, name);
      try {
        if (fs.statSync(candidate).isFile()) return (cachedAz = candidate);
      } catch {
        // Not in this directory; keep looking.
      }
    }
  }
  return (cachedAz = null);
}

/**
 * A .cmd cannot be spawned without a shell. Rather than turn on shell:true and
 * hand it a string built from free text, the command goes through the comspec
 * with each argument individually quoted, and an argument that cannot be quoted
 * safely is refused rather than escaped hopefully. Percent starts variable
 * expansion inside quotes, which is the one character that still breaks out.
 */
const UNQUOTABLE = /[%\r\n\u0000]/;

function windowsCommand(bin, args) {
  const parts = [bin, ...args];
  const bad = parts.find((p) => UNQUOTABLE.test(p));
  if (bad !== undefined) {
    throw new AdoError(
      `an argument contains a character that cannot be passed safely on Windows: ${redact(bad).slice(0, 60)}`,
      'Percent signs and newlines break comspec quoting. Put the text in a file and pass\nit as @<path>, which is what --description-file and --content-file already do.'
    );
  }
  const quoted = parts.map((p) => `"${p.split('"').join('""')}"`).join(' ');
  // cmd /s strips the first and last quote of the whole string, so a command
  // that both starts and ends with one loses them and stops being a path.
  // Wrapping the lot in one more pair is the documented way through.
  return `"${quoted}"`;
}

export function az(args, { allowFailure = false } = {}) {
  const options = {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
    env: { ...process.env, AZURE_CORE_ONLY_SHOW_ERRORS: 'true' },
  };
  const bin = azBinary();
  if (bin === null) {
    // allowFailure exists so a caller can probe for az and report it as a failed
    // check rather than aborting. Writes never pass it, so they still fail closed.
    if (allowFailure) return null;
    throw new AdoError('the az CLI was not found on PATH', NOT_FOUND_REMEDY);
  }

  try {
    const isBatch = /\.(cmd|bat)$/i.test(bin);
    const output = isBatch
      ? execFileSync(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', windowsCommand(bin, args)], {
          ...options,
          // Node quotes argv itself on Windows, which would undo the quoting
          // the comspec needs. Verbatim hands the string over untouched, so
          // windowsCommand is the single authority on how it is escaped.
          windowsVerbatimArguments: true,
        })
      : execFileSync(bin, args, options);
    return output.trim();
  } catch (err) {
    if (err instanceof AdoError) throw err;
    if (allowFailure) return null;
    if (err.code === 'ENOENT') throw new AdoError('the az CLI was not found on PATH', NOT_FOUND_REMEDY);

    const detail = redact(err.stderr || err.stdout || err.message).trim();
    if (/TF400813|401|not authorized|Unauthorized|expired/i.test(detail)) {
      throw new AdoError(`az rejected the request as unauthenticated: ${firstLine(detail)}`, AUTH_REMEDY);
    }
    throw new AdoError(`az failed: ${firstLine(detail)}`);
  }
}

export function azJson(args, options) {
  const raw = az([...args, '--output', 'json'], options);
  if (raw === null || raw === '') return null;
  try {
    return JSON.parse(raw);
  } catch {
    throw new AdoError(`az returned output that is not JSON: ${firstLine(redact(raw))}`);
  }
}

const quote = (part) => (/[\s"']/.test(part) ? JSON.stringify(part) : part);

/**
 * The single place a write is either printed or performed. Every write script
 * routes through this, so --dry-run cannot be forgotten in one of them.
 */
export function azWrite(args, { dryRun, quadrant, intent }) {
  const command = ['az', ...args].map(quote).join(' ');
  if (dryRun) return { dryRun: true, quadrant, intent, command, executed: false };
  return { dryRun: false, quadrant, intent, command, executed: true, result: azJson(args) };
}
