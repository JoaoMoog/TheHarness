#!/usr/bin/env node
/**
 * UserPromptSubmit: when a prompt starts an autonomous loop, attaches the cap
 * that loop must run under.
 *
 * CONSTITUTION.md makes unbounded loops a hard constraint. Asking the model to
 * remember the cap is not enforcement; injecting it every time is closer.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readHookInput, isHookMode, context, EXIT_OK } from './lib/io.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BUDGETS = path.resolve(HERE, '..', '..', '..', 'loops', 'budgets.json');

const TRIGGERS = /\b(loop|iterate|keep going|until it passes|repeat until|autonomous|orchestrat|\/feature|\/resume)\b/i;

const input = await readHookInput();
if (!isHookMode(input)) process.exit(EXIT_OK);

const prompt = String(input.prompt ?? input.user_prompt ?? '');
if (!TRIGGERS.test(prompt)) process.exit(EXIT_OK);

let budgets;
try {
  budgets = JSON.parse(fs.readFileSync(BUDGETS, 'utf8'));
} catch {
  process.exit(
    context('UserPromptSubmit', 'No loop budget file was found. Do not start an unbounded loop: declare a cap first.')
  );
}

const lines = Object.entries(budgets.loops ?? {}).map(
  ([name, cfg]) => `- ${name}: at most ${cfg.maxIterations} iterations, ${cfg.tokenBudget} tokens. Stop when ${cfg.stopCriterion}`
);

process.exit(
  context(
    'UserPromptSubmit',
    ['This prompt looks like it starts a loop. Declared caps:', ...lines,
      '', 'State which cap you are running under before the first iteration, and stop when it is reached.'].join('\n')
  )
);
