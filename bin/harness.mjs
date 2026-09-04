#!/usr/bin/env node
import { log, c } from '../src/lib/log.mjs';

const COMMANDS = {
  scan: () => import('../src/commands/scan.mjs'),
  link: () => import('../src/commands/link.mjs'),
  vendor: () => import('../src/commands/link.mjs'),
  unlink: () => import('../src/commands/unlink.mjs'),
  doctor: () => import('../src/commands/doctor.mjs'),
  budget: () => import('../src/commands/budget.mjs'),
  cost: () => import('../src/commands/cost.mjs'),
  improve: () => import('../src/commands/improve.mjs'),
  eval: () => import('../src/commands/eval.mjs'),
  new: () => import('../src/commands/new.mjs'),
};

const USAGE = `
${c.bold('harness')} - portable agentic harness for GitHub Copilot

  ${c.cyan('scan')} [folder...]        Discover sibling repositories and detect their stacks
  ${c.cyan('link')} <repo>|--all      Install into repositories (junctions, no repo pollution)
  ${c.cyan('vendor')} <repo>|--all    Install as committable copies instead of links
  ${c.cyan('unlink')} <repo>|--all    Remove the harness, restoring the original state
  ${c.cyan('doctor')} [--self]        Audit harness contracts and installation health
  ${c.cyan('budget')} [--self]        Report context token cost per tier against budgets
  ${c.cyan('cost')}                   Report cost per delivered outcome, by track and agent
  ${c.cyan('improve')}                Read the telemetry and propose harness changes
  ${c.cyan('eval')}                   Run structural evals against the authored artifacts
  ${c.cyan('new')} <kind> <name>      Scaffold a skill, agent or instruction

Flags: --all  --force  --mode=link|vendor  --verbose  --json

Docs: README.md   Rules: CONSTITUTION.md
`;

/** Small hand-rolled parser: a flag library would be the only dependency. */
function parseArgs(argv) {
  const args = { _: [] };
  for (const token of argv) {
    if (token.startsWith('--')) {
      const raw = token.slice(2);
      const eq = raw.indexOf('=');
      if (eq === -1) args[raw] = true;
      else args[raw.slice(0, eq)] = raw.slice(eq + 1);
    } else if (token.startsWith('-') && token.length > 1) {
      args[token.slice(1)] = true;
    } else {
      args._.push(token);
    }
  }
  return args;
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  if (!command || command === 'help' || command === '--help') {
    console.log(USAGE);
    return 0;
  }
  const loader = COMMANDS[command];
  if (!loader) {
    log.fail(`Unknown command: ${command}`);
    console.log(USAGE);
    return 1;
  }
  const args = parseArgs(rest);
  if (command === 'vendor') args.mode = 'vendor';
  const mod = await loader();
  return (await mod.default(args)) ?? 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    log.fail(err.message);
    if (process.env.HARNESS_DEBUG) console.error(err);
    process.exit(1);
  });
