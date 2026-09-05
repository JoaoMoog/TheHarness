/**
 * Hook I/O protocol shared by every guardrail.
 *
 * Two callers, one script:
 *  - git pre-commit: no JSON on stdin, verdict is the exit code (1 = refuse)
 *  - VS Code agent hook: JSON on stdin, verdict is JSON on stdout; exit 2 is a
 *    hard block the model sees, any other non-zero exit is a warning.
 */

export const EXIT_OK = 0;
export const EXIT_REFUSE = 1;
export const EXIT_BLOCK = 2;

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

export function deny(eventName, reason) {
  emit({
    hookSpecificOutput: {
      hookEventName: eventName,
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  });
  return EXIT_OK;
}

export function ask(eventName, reason) {
  emit({
    hookSpecificOutput: {
      hookEventName: eventName,
      permissionDecision: 'ask',
      permissionDecisionReason: reason,
    },
  });
  return EXIT_OK;
}

export function allow(eventName) {
  emit({ hookSpecificOutput: { hookEventName: eventName, permissionDecision: 'allow' } });
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
