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
 * kept. Each check keeps its own CLI entry for the git pre-commit path, Kiro
 * and the self-test, so nothing about a single guardrail changed but where it
 * runs.
 *
 * A check that crashes is said, not hidden: advisory ones allow the call with
 * a message, and one that fails secure (policy-gate) denies it.
 */
import { readHookInput, isHookMode, combine, emitVerdict, verdict, EXIT_OK } from './lib/io.mjs';
import { hookContext } from './lib/git.mjs';
import * as crosstkFirst from './crosstk-first.mjs';
import * as readGuard from './read-guard.mjs';
import * as secretBlock from './secret-block.mjs';
import * as policyGate from './policy-gate.mjs';
import * as destructiveGit from './destructive-git.mjs';
import * as adoGate from './ado-gate.mjs';
import * as format from './format.mjs';
import * as burnDetect from './burn-detect.mjs';

const CHECKS = {
  PreToolUse: [
    ['crosstk-first', crosstkFirst],
    ['read-guard', readGuard],
    ['secret-block', secretBlock],
    ['policy-gate', policyGate],
    ['destructive-git', destructiveGit],
    ['ado-gate', adoGate],
  ],
  PostToolUse: [
    ['format', format],
    ['burn-detect', burnDetect],
  ],
};

const input = await readHookInput();
if (!isHookMode(input)) process.exit(EXIT_OK);

const event = input.hook_event_name;
if (!CHECKS[event]) process.exit(EXIT_OK);

const ctx = hookContext();
const results = [];
for (const [name, check] of CHECKS[event]) {
  try {
    results.push((check.decide ?? check.observe)(input, ctx));
  } catch (err) {
    const why = err?.message ?? String(err);
    results.push(
      check.failsSecure
        ? verdict.deny(`harness ${name}: cannot verify - ${why}. A guardrail that cannot run must not approve.`)
        : verdict.allow(`harness ${name}: the check failed (${why}); the call was allowed unchecked.`)
    );
  }
}

process.exit(emitVerdict(event, combine(results)));
