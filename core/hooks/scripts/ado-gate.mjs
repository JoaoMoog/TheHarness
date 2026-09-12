#!/usr/bin/env node
/**
 * Guardrail: applies the oversight quadrant to anything that reaches Azure
 * DevOps, before the command runs.
 *
 * The agent contract already says which actions need a human. This is the part
 * that does not depend on the agent remembering it. It also catches a raw `az`
 * call that bypasses the scripts, so the gate is on the action rather than on
 * the wrapper.
 *
 * Runs inside tool-hooks.mjs on every tool call, and on its own for Kiro and
 * the self-test.
 */
import { readHookInput, isHookMode, collectStrings, verdict, emitVerdict, isMain, EXIT_OK } from './lib/io.mjs';

/** Names that mean the change reaches users. Matched conservatively. */
const RELEASE = /\b(release|deploy|prod|production|cd|hotfix|publish)\b/i;

/** A deny or an ask for an Azure DevOps action that needs a human; null otherwise. */
export function decide(input) {
  const command = collectStrings(input.tool_input).join(' ');

  /** A dry run prints a command and touches nothing, so it needs no gate. */
  if (/--dry-run\b/.test(command)) return null;

  const pipelineName = (/--name[= ]"([^"]*)"/.exec(command) ?? /--name[= ](\S+)/.exec(command))?.[1] ?? '';

  const rules = [
    {
      when: () => /\baz\s+repos\s+pr\s+update\b/.test(command) && /--status[= ]+completed/.test(command),
      decision: 'deny',
      reason:
        'Completing a merge is Q4: a human does it. The change is already reviewed, so ' +
        'complete it in the Azure DevOps UI or run the command yourself.',
    },
    {
      when: () =>
        (/pipeline-run\.mjs/.test(command) || /\baz\s+pipelines\s+run\b/.test(command)) &&
        RELEASE.test(pipelineName),
      decision: 'deny',
      reason:
        `"${pipelineName}" looks like a release pipeline, which is Q4. An agent does not ship ` +
        'to users. Run it yourself if that is the intent.',
    },
    {
      when: () => /pipeline-run\.mjs/.test(command) || /\baz\s+pipelines\s+run\b/.test(command),
      decision: 'ask',
      reason: `Queue the pipeline${pipelineName ? ` "${pipelineName}"` : ''}? Triggering CI is Q3: it consumes agents and notifies people.`,
    },
    {
      when: () => /pr-create\.mjs/.test(command) && /--publish\b/.test(command),
      decision: 'ask',
      reason:
        'Publish the pull request? Taking it out of draft is Q3: it notifies reviewers and ' +
        'starts branch policies. Creating or updating a draft does not need this.',
    },
    {
      when: () => /\baz\s+repos\s+pr\s+(create|update)\b/.test(command) && !/pr-create\.mjs/.test(command),
      decision: 'ask',
      reason:
        'This calls az directly instead of core/tools/ado/pr-create.mjs, so it skips the ' +
        'dry run, the description file handling and the redaction. Prefer the script.',
    },
  ];

  const hit = rules.find((r) => r.when());
  if (!hit) return null;
  return hit.decision === 'deny' ? verdict.deny(hit.reason) : verdict.ask(hit.reason);
}

if (isMain(import.meta.url)) {
  const input = await readHookInput();
  if (!isHookMode(input)) process.exit(EXIT_OK);
  process.exit(emitVerdict('PreToolUse', decide(input)));
}
