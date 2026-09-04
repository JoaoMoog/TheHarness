#!/usr/bin/env node
/**
 * Builds the traceability matrix for a spec, and fails when intent is
 * unverified.
 *
 * The matrix exists to expose two things nothing else catches:
 *   - a requirement with no test: intent nobody proved
 *   - a changed file no requirement asked for: behaviour nobody requested
 *
 * Deterministic. Reads files, matches ids, prints a table. No model involved,
 * so it can gate a merge.
 *
 *   node traceability.mjs --spec=specs/007-export-csv
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const BS = String.fromCharCode(92);
const EXIT_OK = 0;
const EXIT_GAP = 2;

const REQUIREMENT_ID = /\b((?:FR|NFR)-\d{3,})\b/g;
const CLARIFICATION = /\[NEEDS CLARIFICATION:([^\]]*)\]/g;

const SEP = '[' + BS + BS + '/]';
// Directory names anchor at the start or a separator on either platform, and
// Test./Tests. are case-sensitive so latest.json and protest.md stay out.
const TEST_FILE = new RegExp(
  '(' + BS + '.test' + BS + '.|' + BS + '.spec' + BS + '.|_test' + BS + '.|Tests?' + BS + '.[A-Za-z0-9]+$|(^|' + SEP + ')test_)' +
    '|((^|' + SEP + ')(tests?|__tests__|spec)' + SEP + ')'
);

const IGNORED = new Set([
  'node_modules', '.git', 'dist', 'build', 'out', 'bin', 'obj', 'vendor',
  '.venv', 'venv', '__pycache__', 'target', 'coverage', '.next',
]);

/* ------------------------------------------------------------------ argv */

const args = {};
for (const token of process.argv.slice(2)) {
  const eq = token.indexOf('=');
  if (token.startsWith('--')) {
    if (eq === -1) args[token.slice(2)] = true;
    else args[token.slice(2, eq)] = token.slice(eq + 1);
  }
}

const die = (message, remedy) => {
  console.error(`harness traceability: ${message}`);
  if (remedy) console.error(`\n${remedy}`);
  process.exit(EXIT_GAP);
};

/* ------------------------------------------------------------------ read */

function walk(dir, acc = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const entry of entries) {
    if (IGNORED.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (entry.isFile()) acc.push(full);
  }
  return acc;
}

const uniq = (list) => [...new Set(list)];
const idsIn = (text) => uniq([...String(text).matchAll(REQUIREMENT_ID)].map((m) => m[1]));

/** Requirements come from the spec, in file order, with their statement. */
function readRequirements(specFile) {
  const text = fs.readFileSync(specFile, 'utf8');
  const found = new Map();
  for (const line of text.split(/\r?\n/)) {
    for (const id of idsIn(line)) {
      if (found.has(id)) continue;
      const statement = line
        .replace(/^[|\s\-*>]+/, '')
        .replace(REQUIREMENT_ID, '')
        .replace(/^[|\s:.\-]+/, '')
        .trim();
      // Table rows are | id | pattern | requirement |: the requirement is the last
      // non-empty cell. Bullet lines have no cells, so the remainder is used whole.
      const cells = line.split('|').map((c) => c.trim()).filter(Boolean);
      const fromCell = cells.length > 1 ? cells[cells.length - 1].replace(REQUIREMENT_ID, '').trim() : statement;
      found.set(id, fromCell.slice(0, 90));
    }
  }
  const clarifications = [...text.matchAll(CLARIFICATION)].map((m) => m[1].trim());
  return { requirements: found, clarifications };
}

/** A test claims a requirement by naming its id anywhere in the file. */
function readTests(root) {
  const coverage = new Map();
  for (const file of walk(root).filter((f) => TEST_FILE.test(f))) {
    let text;
    try {
      text = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    for (const id of idsIn(text)) {
      if (!coverage.has(id)) coverage.set(id, []);
      coverage.get(id).push(path.relative(root, file).split(path.sep).join('/'));
    }
  }
  return coverage;
}

/** Files the plan named. Anything changed outside this set is unrequested. */
function readPlannedFiles(planFile) {
  if (!fs.existsSync(planFile)) return null;
  const text = fs.readFileSync(planFile, 'utf8');
  const paths = [...text.matchAll(/`([\w./-]+\.[a-z0-9]{1,6})`/gi)].map((m) => m[1]);
  return uniq(paths.filter((p) => p.includes('/') || p.includes('.')));
}

function changedFiles(root, base) {
  try {
    return execFileSync('git', ['diff', '--name-only', `${base}...HEAD`], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .split(/\r?\n/)
      .filter(Boolean);
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ main */

const specDir = typeof args.spec === 'string' ? args.spec.split(BS).join('/').replace(/\/+$/, '') : null;
if (!specDir) {
  die('which spec?', 'Pass --spec=specs/<id>-<slug>. The directory holding spec.md and plan.md.');
}

const root = args.root ?? process.cwd();
const specFile = path.join(specDir, 'spec.md');
if (!fs.existsSync(specFile)) die(`no spec.md in ${specDir}`);

const { requirements, clarifications } = readRequirements(specFile);
if (requirements.size === 0) {
  die(
    `${specFile} has no requirement ids`,
    'Every criterion needs a stable id: FR-001 for functional, NFR-001 for the rest.\nWithout ids nothing can be traced, and the matrix is the point of the ids.'
  );
}

const coverage = readTests(root);
const planned = readPlannedFiles(path.join(specDir, 'plan.md'));
const changed = args.base ? changedFiles(root, args.base) : null;
if (args.base && changed === null) {
  die(
    `cannot list the files changed since ${args.base}`,
    'git failed or the base ref is not available locally. Fetch it, or drop --base to skip the unrequested-change check explicitly rather than silently.'
  );
}

const rows = [...requirements.entries()].map(([id, statement]) => ({
  id,
  statement,
  tests: coverage.get(id) ?? [],
}));

const gaps = rows.filter((r) => r.tests.length === 0);
// Ids are global across specs, so a test may legitimately cite another spec's id.
// An orphan is an id that no spec in the repository defines at all.
const allDefined = new Set(requirements.keys());
const specsRoot = path.dirname(path.resolve(root, specDir));
if (fs.existsSync(specsRoot)) {
  for (const dir of fs.readdirSync(specsRoot, { withFileTypes: true })) {
    const other = path.join(specsRoot, dir.name, 'spec.md');
    if (dir.isDirectory() && fs.existsSync(other)) {
      for (const id of idsIn(fs.readFileSync(other, 'utf8'))) allDefined.add(id);
    }
  }
}
const orphanTests = [...coverage.keys()].filter((id) => !allDefined.has(id));
const unrequested =
  changed && planned
    ? changed.filter(
        (f) => !TEST_FILE.test(f) && !f.startsWith(specDir) && !planned.some((p) => f.endsWith(p))
      )
    : [];

/* ---------------------------------------------------------------- output */

const width = Math.max(...rows.map((r) => r.id.length), 8);
const lines = [];
lines.push('| requirement | tests | status |');
lines.push('|---|---|---|');
for (const row of rows) {
  const status = row.tests.length === 0 ? 'GAP' : 'PASS';
  const tests = row.tests.length === 0 ? 'MISSING' : row.tests.join(', ');
  lines.push(`| ${row.id} | ${tests} | ${status} |`);
}

if (args.json) {
  console.log(JSON.stringify({ requirements: rows, gaps: gaps.map((g) => g.id), orphanTests, unrequested, clarifications }, null, 2));
} else {
  console.log(`\nTraceability: ${specDir}\n`);
  console.log(lines.join('\n'));
  console.log('');
  for (const row of gaps) {
    console.log(`  ${row.id.padEnd(width)}  unverified intent: ${row.statement}`);
  }
  for (const id of orphanTests) {
    console.log(`  ${id.padEnd(width)}  a test claims this id but the spec does not define it`);
  }
  for (const file of unrequested) {
    console.log(`  ${'  -'.padEnd(width)}  ${file} changed, and no requirement asked for it`);
  }
  for (const question of clarifications) {
    console.log(`  ${'  ?'.padEnd(width)}  still unanswered: ${question}`);
  }
  console.log(
    `\n  ${rows.length - gaps.length} of ${rows.length} requirements verified` +
      (clarifications.length ? `, ${clarifications.length} open question(s)` : '')
  );
}

const failing = gaps.length > 0 || clarifications.length > 0 || orphanTests.length > 0;
process.exit(failing ? EXIT_GAP : EXIT_OK);
