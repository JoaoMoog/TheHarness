/**
 * Hook I/O protocol shared by every guardrail.
 *
 * Two callers, one script:
 *  - git pre-commit: no JSON on stdin, verdict is the exit code (1 = refuse)
 *  - VS Code agent hook: JSON on stdin, verdict is JSON on stdout; exit 2 is a
 *    hard block the model sees, any other non-zero exit is a warning.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const EXIT_OK = 0;
export const EXIT_REFUSE = 1;
export const EXIT_BLOCK = 2;

/**
 * Whether the module at `url` is the script Node was started with. Every
 * guardrail is both a CLI (git pre-commit, Kiro, the self-test) and a function
 * the tool-hooks dispatcher imports; the guard keeps the CLI path from running
 * on import. Both sides are resolved through symlinks, because the scripts are
 * reached through the .github/hooks junction and Node resolves the main module
 * to its real path while argv keeps the junction.
 */
export function isMain(url) {
  try {
    if (!process.argv[1]) return false;
    const real = (p) => {
      try {
        return fs.realpathSync(p);
      } catch {
        return p;
      }
    };
    return real(path.resolve(process.argv[1])) === real(fileURLToPath(url));
  } catch {
    return false;
  }
}

/**
 * A guardrail's answer as a value rather than an emitted line, so several can
 * run in one process. `null` means "not my concern"; a message on an allow is
 * the advisory the model sees.
 */
export const verdict = {
  allow: (systemMessage = undefined) => ({ decision: 'allow', ...(systemMessage ? { systemMessage } : {}) }),
  ask: (reason) => ({ decision: 'ask', reason }),
  deny: (reason) => ({ decision: 'deny', reason }),
};

/**
 * How the runtime combines several hooks on one call, done once here instead:
 * the most restrictive decision wins, and every message survives.
 */
export function combine(results) {
  const real = results.filter(Boolean);
  const messages = real.map((r) => r.systemMessage).filter(Boolean);
  const systemMessage = messages.length > 0 ? messages.join('\n\n') : undefined;
  const top = real.find((r) => r.decision === 'deny') ?? real.find((r) => r.decision === 'ask');
  const out = top ? { decision: top.decision, reason: top.reason } : { decision: 'allow' };
  return systemMessage ? { ...out, systemMessage } : out;
}

const STDIN_LIMIT = 4 * 1024 * 1024;
const STDIN_TIMEOUT_MS = 2000;

/** Every runtime that hands this script an event on stdin. */
const STDIN_MODES = new Set(['vscode', 'kiro']);

/**
 * Mode is explicit, never guessed. Guessing from isTTY blocks forever when
 * stdin is an open pipe that nobody writes to, which would hang the IDE or
 * the commit. An unset mode means "run as a git hook".
 *
 * Two ways to set it, because the runtimes differ: VS Code hooks carry an env
 * block, and Kiro's hook schema has none, so the generated Kiro command passes
 * --hook-mode=kiro in argv instead.
 */
export function hookMode() {
  const flag = process.argv.find((arg) => arg.startsWith('--hook-mode='));
  const mode = flag ? flag.slice('--hook-mode='.length) : process.env.HARNESS_HOOK_MODE;
  return STDIN_MODES.has(mode) ? mode : null;
}

export async function readHookInput() {
  if (hookMode() === null) return null;

  const raw = await new Promise((resolve) => {
    let buf = "";
    const done = (value) => {
      clearTimeout(timer);
      process.stdin.removeAllListeners();
      resolve(value);
    };
    const timer = setTimeout(() => done(null), STDIN_TIMEOUT_MS);
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      buf += chunk;
      if (buf.length > STDIN_LIMIT) done(null);
    });
    process.stdin.on("end", () => done(buf));
    process.stdin.on("error", () => done(null));
  });

  if (!raw || !raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && parsed.hook_event_name ? parsed : null;
  } catch {
    return null;
  }
}
export const isHookMode = (input) => input !== null;

/** Every string reachable inside tool_input, so unknown tool shapes still get scanned. */
export function collectStrings(value, acc = [], depth = 0) {
  if (depth > 6 || value === null || value === undefined) return acc;
  if (typeof value === 'string') acc.push(value);
  else if (Array.isArray(value)) value.forEach((v) => collectStrings(v, acc, depth + 1));
  else if (typeof value === 'object') Object.values(value).forEach((v) => collectStrings(v, acc, depth + 1));
  return acc;
}

/** Best-effort file path from a tool input whose exact schema is not guaranteed. */
export function toolFilePath(input) {
  const ti = input?.tool_input ?? {};
  return ti.filePath ?? ti.file_path ?? ti.path ?? ti.uri ?? ti.file ?? null;
}

export function emit(json) {
  process.stdout.write(`${JSON.stringify(json)}\n`);
}

export function deny(eventName, reason, systemMessage = undefined) {
  const out = {
    hookSpecificOutput: {
      hookEventName: eventName,
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  };
  if (systemMessage) out.systemMessage = systemMessage;
  emit(out);
  return EXIT_OK;
}

export function ask(eventName, reason, systemMessage = undefined) {
  const out = {
    hookSpecificOutput: {
      hookEventName: eventName,
      permissionDecision: 'ask',
      permissionDecisionReason: reason,
    },
  };
  if (systemMessage) out.systemMessage = systemMessage;
  emit(out);
  return EXIT_OK;
}

/**
 * Emits a verdict value in the runtime's format. A PostToolUse carries no
 * permission decision, only what the model should hear.
 */
export function emitVerdict(eventName, v) {
  if (eventName === 'PostToolUse') {
    const out = { hookSpecificOutput: { hookEventName: eventName } };
    if (v?.systemMessage) out.systemMessage = v.systemMessage;
    emit(out);
    return EXIT_OK;
  }
  const decision = v?.decision ?? 'allow';
  if (decision === 'deny') return deny(eventName, v.reason, v.systemMessage);
  if (decision === 'ask') return ask(eventName, v.reason, v.systemMessage);
  return allow(eventName, v?.systemMessage);
}

/** An allow may carry a warning the model sees; an advisory guardrail is one that uses it. */
export function allow(eventName, systemMessage = undefined) {
  const out = { hookSpecificOutput: { hookEventName: eventName, permissionDecision: 'allow' } };
  if (systemMessage) out.systemMessage = systemMessage;
  emit(out);
  return EXIT_OK;
}

export function context(eventName, text, systemMessage = undefined) {
  const out = { hookSpecificOutput: { hookEventName: eventName, additionalContext: text } };
  if (systemMessage) out.systemMessage = systemMessage;
  emit(out);
  return EXIT_OK;
}

/** A guardrail that cannot do its job says so loudly and blocks; it never waves work through. */
export function failSecure(name, err, hookMode) {
  console.error(`harness ${name}: cannot verify - ${err?.message ?? err}`);
  console.error('Refusing to proceed. A guardrail that cannot run must not approve.');
  return hookMode ? EXIT_BLOCK : EXIT_REFUSE;
}
