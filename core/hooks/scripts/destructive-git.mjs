#!/usr/bin/env node
/**
 * Guardrail: asks a human before a git command that destroys work. These are
 * the operations CONSTITUTION.md requires an explicit instruction for, so the
 * decision is escalated rather than denied outright.
 *
 * Runs inside tool-hooks.mjs on every tool call, and on its own for Kiro and
 * the self-test.
 */
import { readHookInput, isHookMode, collectStrings, verdict, emitVerdict, isMain, EXIT_OK } from './lib/io.mjs';

const DESTRUCTIVE = [
  { re: /\bgit\s+push\b.*--force(?!-with-lease)/s, why: 'a force push overwrites remote history for everyone' },
  { re: /\bgit\s+push\b.*--force-with-lease/s, why: 'a force push, safer but still rewriting the remote branch' },
  { re: /\bgit\s+reset\s+--hard\b/, why: 'a hard reset discards uncommitted work irrecoverably' },
  { re: /\bgit\s+clean\s+-[a-z]*f/, why: 'git clean deletes untracked files with no undo' },
  { re: /\bgit\s+branch\s+-D\b/, why: 'a force branch delete drops unmerged commits' },
  { re: /\bgit\s+filter-branch\b|\bgit-filter-repo\b/, why: 'a history rewrite affects every clone' },
  { re: /\bgit\s+commit\b.*(--no-verify|\s-n\b)/s, why: 'it bypasses every guardrail at once' },
  { re: /\bgit\s+(checkout|restore)\b.*--\s/s, why: 'it discards local changes to the named paths' },
];

/** An ask when the command destroys work; null otherwise. */
export function decide(input) {
  const command = collectStrings(input.tool_input).join('\n');
  const hit = DESTRUCTIVE.find((d) => d.re.test(command));
  return hit
    ? verdict.ask(`Confirm before running this: ${hit.why}. State what will be lost and why that is acceptable.`)
    : null;
}

if (isMain(import.meta.url)) {
  const input = await readHookInput();
  if (!isHookMode(input)) process.exit(EXIT_OK);
  process.exit(emitVerdict('PreToolUse', decide(input)));
}
