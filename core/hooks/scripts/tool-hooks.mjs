#!/usr/bin/env node
/**
 * One process per tool event.
 *
 * VS Code runs every PreToolUse and PostToolUse hook on every tool call and
 * ignores the matcher field (documented), so eight registered scripts meant
 * eight Node starts and five git spawns per tool call - 402 ms of hooks on a
 * plain read, measured. This runs the same checks in one process, in the same
 * order, sharing one stdin read and one repository lookup, and combines their
 * answers the way the runtime would: deny over ask over allow, every message
 * kept, and a rewrite of the call only on a plain allow. Each check keeps its
 * own CLI entry for the git pre-commit path, Kiro and the self-test, so
 * nothing about a single guardrail changed but where it runs.
 *
 * A check that crashes is said, not hidden: advisory ones allow the call with
 * a message, and one that fails secure (policy-gate) denies it.
 *
 * The same process counts the call for `harness cost`: which tool, whether it
 * went through Cross TK, whether it was rewritten, and how many bytes came
 * back. Those are the drivers of a token bill that the runtime does not
 * report, and counting them here costs one small file write.
 */
import { readHookInput, isHookMode, combine, emitVerdict, verdict, EXIT_OK } from './lib/io.mjs';
import { hookContext } from './lib/git.mjs';
import { isCrossTkTool } from './lib/crosstk.mjs';
import { bumpUsage, responseBytes } from './lib/usage.mjs';
import * as readGuard from './read-guard.mjs';
import * as secretBlock from './secret-block.mjs';
import * as policyGate from './policy-gate.mjs';
import * as localOnly from './local-only.mjs';
import * as destructiveGit from './destructive-git.mjs';
import * as crosstkNudge from './crosstk-nudge.mjs';
import * as crosstkRun from './crosstk-run.mjs';
import * as burnDetect from './burn-detect.mjs';

const CHECKS = {
  PreToolUse: [
    ['local-only', localOnly],
    ['read-guard', readGuard],
    ['secret-block', secretBlock],
    ['policy-gate', policyGate],
    ['destructive-git', destructiveGit],
    ['crosstk-nudge', crosstkNudge],
    ['crosstk-run', crosstkRun],
  ],
  PostToolUse: [
    ['burn-detect', burnDetect],
  ],
};

const input = await readHookInput();
if (!isHookMode(input)) process.exit(EXIT_OK);

const event = input.hook_event_name;
if (!CHECKS[event]) process.exit(EXIT_OK);

const ctx = hookContext();
const results = [];
const checkDurations = {};
const startedAt = performance.now();
for (const [name, check] of CHECKS[event]) {
  const start = performance.now();
  try {
    results.push((check.decide ?? check.observe)(input, ctx));
  } catch (err) {
    const why = err?.message ?? String(err);
    results.push(
      check.failsSecure
        ? verdict.deny(`harness ${name}: cannot verify - ${why}. A guardrail that cannot run must not approve.`)
        : verdict.allow(`harness ${name}: the check failed (${why}); the call was allowed unchecked.`)
    );
  } finally { checkDurations[name] = performance.now() - start; }
}

const combined = combine(results);

try {
  if (event === 'PreToolUse') {
    bumpUsage(ctx.root, input.session_id, {
      toolCalls: 1,
      hookDurationMs: performance.now() - startedAt, checkDurations,
      tool: input.tool_name,
      crossTk: isCrossTkTool(input.tool_name) ? 1 : 0,
      rewrites: combined.updatedInput ? 1 : 0,
    });
  } else {
    bumpUsage(ctx.root, input.session_id, { toolOutputBytes: responseBytes(input), hookDurationMs: performance.now() - startedAt, checkDurations, toolDurationMs: input.duration_ms ?? input.tool_duration_ms });
  }
} catch {
  // A counter that cannot be written must not touch the verdict.
}

process.exit(emitVerdict(event, combined));
