import fs from 'node:fs';
import path from 'node:path';
import { harnessPath } from '../lib/paths.mjs';
import { auditSelf } from '../lib/audit.mjs';
import { parseFrontmatter } from '../lib/frontmatter.mjs';
import { createReport, log, c } from '../lib/log.mjs';

const MIN_DESCRIPTION = 30;
const MAX_DESCRIPTION = 220;

const listDirs = (dir) =>
  fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()) : [];

/** A skill is selected by its description, so a vague one is a real defect. */
function evalDescriptions(report) {
  const root = harnessPath('core/skills');
  const seen = new Map();
  for (const dir of listDirs(root)) {
    const file = path.join(root, dir.name, 'SKILL.md');
    if (!fs.existsSync(file)) continue;
    const { data } = parseFrontmatter(fs.readFileSync(file, 'utf8'));
    const desc = String(data.description ?? '');

    if (desc.length < MIN_DESCRIPTION) {
      report.fail(`skill ${dir.name}: description too vague to route on (${desc.length} chars)`);
    } else if (desc.length > MAX_DESCRIPTION) {
      report.warn(`skill ${dir.name}: description ${desc.length} chars, trim it, it is scanned every turn`);
    } else {
      report.pass(`skill ${dir.name}: description routable`);
    }

    if (data.name && seen.has(data.name)) {
      report.fail(`skill name ${data.name} is declared by both ${seen.get(data.name)} and ${dir.name}`);
    }
    if (data.name) seen.set(data.name, dir.name);
  }
}

/** Relative markdown links that point at nothing waste a whole agent turn. */
function evalLinks(report) {
  const roots = ['core', 'loops', 'templates', 'finops'];
  const linkRe = /\]\((?!https?:|#|mailto:)([^)]+)\)/g;

  const walk = (dir) =>
    fs.existsSync(dir)
      ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
          e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]
        )
      : [];

  let broken = 0;
  for (const file of roots.flatMap((r) => walk(harnessPath(r))).filter((f) => f.endsWith('.md'))) {
    const text = fs.readFileSync(file, 'utf8');
    for (const match of text.matchAll(linkRe)) {
      const target = match[1].split('#')[0];
      if (!target) continue;
      const resolved = path.resolve(path.dirname(file), target);
      const fromRoot = harnessPath(target);
      if (!fs.existsSync(resolved) && !fs.existsSync(fromRoot)) {
        report.fail(`${path.relative(harnessPath('.'), file)}: broken link ${target}`);
        broken += 1;
      }
    }
  }
  if (broken === 0) report.pass('no broken relative links');
}

/**
 * Behavioural evals, split so no API key is needed: --emit prints the cases
 * for a Copilot agent, --check runs the assertions over what it answered.
 */
async function evalBehavioural(report, args) {
  const goldenRoot = harnessPath('evals/golden');
  const runnerPath = harnessPath('evals/runner.mjs').split(path.sep).join('/');
  const { loadCases, emitPrompt, checkAll } = await import(`file://${runnerPath}`);
  const cases = loadCases(goldenRoot);

  if (cases.length === 0) {
    report.warn('no golden sets in evals/golden - behavioural regression is not covered yet');
    return;
  }

  if (args.emit) {
    log.plain(emitPrompt(cases, harnessPath('core/skills')));
    return;
  }

  if (args.check) {
    let answers;
    try {
      answers = fs.readFileSync(args.check, 'utf8');
    } catch (err) {
      report.fail(`cannot read the answers file: ${err.message}`);
      return;
    }
    for (const outcome of checkAll(cases, answers)) {
      if (outcome.error) {
        report.fail(`${outcome.id}: ${outcome.error}`);
        continue;
      }
      const failed = (outcome.results ?? []).filter((r) => !r.ok);
      if ((outcome.results ?? []).length === 0) {
        report.fail(`${outcome.id}: no assertions, so nothing could have failed`);
        continue;
      }
      if (failed.length === 0) report.pass(`${outcome.id}: ${outcome.name}`);
      else report.fail(`${outcome.id}: failed ${failed.map((f) => `${f.type} ${f.value}`).join(", ")}`);
    }
    return;
  }

  log.info(`${cases.length} golden case(s) found. They need a model, so they are not part of the gate.`);
  log.info('Run them through Copilot: harness eval --emit > cases.txt, paste the answers back,');
  log.info('then harness eval --check answers.txt');
}

export default async function evaluate(args) {
  const report = createReport('Harness evals (tier A: structural)');
  auditSelf(report);
  evalDescriptions(report);
  evalLinks(report);
  await evalBehavioural(report, args);

  const passed = report.print({ verbose: Boolean(args.verbose) });
  log.plain(`\n${c.dim('Tier A runs with no API key and gates CI. Tier B needs a model.')}`);
  return passed ? 0 : 1;
}
