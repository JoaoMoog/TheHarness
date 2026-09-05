#!/usr/bin/env node
/**
 * Proves the matrix finds what it claims to find, against a spec built to
 * contain one of each defect: a requirement with no test, a test claiming an id
 * the spec never defined, a changed file the plan never named, and an open
 * clarification.
 */
import { spawnSync, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const NL = String.fromCharCode(10);
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-trace-'));
const specDir = path.join(root, 'specs', '007-export-csv');

fs.mkdirSync(specDir, { recursive: true });
fs.mkdirSync(path.join(root, 'tests'), { recursive: true });
fs.mkdirSync(path.join(root, 'src'), { recursive: true });

fs.writeFileSync(
  path.join(specDir, 'spec.md'),
  [
    '# Specification: export CSV',
    '',
    '| id | criterion |',
    '|---|---|',
    '| FR-001 | WHEN the user clicks Export, the system SHALL produce a CSV of the active filter |',
    '| FR-002 | IF the filter matches nothing, THEN the system SHALL produce a header-only file |',
    '| FR-003 | WHILE an export is running, the system SHALL disable the button |',
    '| NFR-001 | The export SHALL complete within 3 seconds for 10000 rows |',
    '',
    'Open: [NEEDS CLARIFICATION: does the filename need the tenant name?]',
    '',
  ].join(NL),
  'utf8'
);

fs.writeFileSync(
  path.join(specDir, 'plan.md'),
  ['# Plan', '', '| file | change |', '|---|---|', '| `src/export.ts` | new |', ''].join(NL),
  'utf8'
);

fs.writeFileSync(
  path.join(root, 'tests', 'export.spec.ts'),
  [
    'describe("export", () => {',
    '  it("FR-001 writes the filtered rows", () => {});',
    '  it("FR-002 writes a header when empty", () => {});',
    '  it("NFR-001 completes inside the budget", () => {});',
    '  it("FR-404 covers something the spec never asked for", () => {});',
    '});',
    '',
  ].join(NL),
  'utf8'
);

fs.writeFileSync(path.join(root, 'src', 'export.ts'), 'export const toCsv = () => "";' + NL, 'utf8');
fs.writeFileSync(path.join(root, 'src', 'rogue.ts'), 'export const surprise = () => 1;' + NL, 'utf8');

const git = (args) =>
  execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
git(['init', '-q', '--initial-branch=main']);
git(['config', 'user.email', 'selftest@example.com']);
git(['config', 'user.name', 'selftest']);
git(['add', 'specs', 'tests']);
git(['commit', '-qm', 'spec and tests']);
git(['checkout', '-qb', 'feat/csv']);
git(['add', '-A']);
git(['commit', '-qm', 'implementation']);

const run = (extra = []) =>
  spawnSync(
    process.execPath,
    [path.join(HERE, 'traceability.mjs'), `--spec=specs/007-export-csv`, `--root=${root}`, ...extra],
    { cwd: root, encoding: 'utf8' }
  );

const results = [];
const check = (label, condition, detail = '') => {
  const passed = Boolean(condition);
  results.push(passed);
  console.log('  ' + (passed ? 'pass' : 'FAIL') + '  ' + label + (passed || !detail ? '' : '  (' + String(detail).slice(0, 110) + ')'));
};

console.log('Traceability self-test' + NL);

const plain = run();
check('exits non-zero when intent is unverified', plain.status === 2, 'exit ' + plain.status);
check('names the requirement with no test', /FR-003.*GAP|FR-003 +unverified/.test(plain.stdout), plain.stdout.slice(0, 120));
check('does not flag a requirement that has one', !/FR-001 +unverified/.test(plain.stdout));
check('counts NFR ids too', /NFR-001/.test(plain.stdout));
check('flags a test claiming an id the spec never defined', /FR-404/.test(plain.stdout));
check('surfaces the open clarification', /tenant name/.test(plain.stdout));

const json = run(['--json', '--base=main']);
let parsed = null;
try {
  parsed = JSON.parse(json.stdout);
} catch {
  // asserted below
}
check('emits machine-readable output', parsed !== null, json.stderr.slice(0, 120));
check('json lists exactly the one gap', parsed?.gaps?.length === 1 && parsed.gaps[0] === 'FR-003', JSON.stringify(parsed?.gaps));
check('json lists the orphan test id', parsed?.orphanTests?.includes('FR-404'), JSON.stringify(parsed?.orphanTests));
check(
  'flags the changed file the plan never named',
  (parsed?.unrequested ?? []).some((f) => f.endsWith('rogue.ts')),
  JSON.stringify(parsed?.unrequested)
);
check(
  'does not flag the file the plan did name',
  !(parsed?.unrequested ?? []).some((f) => f.endsWith('export.ts')),
  JSON.stringify(parsed?.unrequested)
);

// A clean spec must pass.
fs.writeFileSync(
  path.join(specDir, 'spec.md'),
  ['# Specification', '', '| FR-001 | the system SHALL export |', '| FR-002 | the system SHALL handle empty |', ''].join(NL),
  'utf8'
);
fs.writeFileSync(
  path.join(root, 'tests', 'export.spec.ts'),
  ['it("FR-001 exports", () => {});', 'it("FR-002 handles empty", () => {});', ''].join(NL),
  'utf8'
);
const clean = run();
check('a fully traced spec exits zero', clean.status === 0, 'exit ' + clean.status + ' ' + clean.stdout.slice(0, 100));


// The template ships a three-column table, and a json named latest.json is
// neither a test nor exempt from the unrequested-change check.
fs.writeFileSync(
  path.join(specDir, 'spec.md'),
  ['# Specification', '', '| id | pattern | requirement |', '|---|---|---|',
   '| FR-001 | Event | WHEN the user clicks Export, the system SHALL produce a CSV |',
   '| FR-002 | Unwanted | IF the filter is empty, THEN the system SHALL produce a header-only file |', ''].join(NL),
  'utf8'
);
fs.writeFileSync(
  path.join(root, 'tests', 'export.spec.ts'),
  ['it("FR-001 exports", () => {});', 'it("FR-002 handles empty", () => {});', ''].join(NL),
  'utf8'
);
fs.mkdirSync(path.join(root, 'config'), { recursive: true });
fs.writeFileSync(path.join(root, 'config', 'latest.json'), '{"FR-999": true}' + NL, 'utf8');
git(['add', '-A']);
git(['commit', '-qm', 'three columns and a config file']);
const three = run(['--json', '--base=main']);
let parsed3 = null;
try { parsed3 = JSON.parse(three.stdout); } catch { /* asserted below */ }
check('a three-column table yields the requirement, not the pattern column',
  parsed3?.requirements?.[0]?.statement?.startsWith('WHEN the user clicks'), JSON.stringify(parsed3?.requirements?.[0]));
check('latest.json is not mistaken for a test file', !(parsed3?.orphanTests ?? []).includes('FR-999'), JSON.stringify(parsed3?.orphanTests));
check('latest.json is reported as an unrequested change', (parsed3?.unrequested ?? []).some((f) => f.endsWith('latest.json')), JSON.stringify(parsed3?.unrequested));

// The Kiro layout is the same spec under different file names, so the tool
// has to find it without being told which layout it is looking at.
const kiroDir = path.join(root, '.kiro', 'specs', '012-import-csv');
fs.mkdirSync(kiroDir, { recursive: true });
fs.writeFileSync(
  path.join(kiroDir, 'requirements.md'),
  ['# Requirements: import CSV', '', '| id | criterion |', '|---|---|',
   '| FR-010 | WHEN a CSV is uploaded, the system SHALL validate its header row |', ''].join(NL),
  'utf8'
);
fs.writeFileSync(
  path.join(kiroDir, 'design.md'),
  ['# Design', '', '## Files', '', '- src/import.ts', ''].join(NL),
  'utf8'
);
fs.writeFileSync(
  path.join(root, 'tests', 'import.spec.ts'),
  ['it("FR-010 validates the header", () => {});', ''].join(NL),
  'utf8'
);
const kiro = spawnSync(
  process.execPath,
  [path.join(HERE, 'traceability.mjs'), '--spec=.kiro/specs/012-import-csv', '--root=' + root, '--json'],
  { cwd: root, encoding: 'utf8' }
);
let parsedKiro = null;
try { parsedKiro = JSON.parse(kiro.stdout); } catch { /* asserted below */ }
check('reads requirements.md when there is no spec.md', kiro.status === 0, 'exit ' + kiro.status + ' ' + kiro.stderr.slice(0, 120));
check('traces the Kiro-layout requirement to its test', (parsedKiro?.gaps ?? ['unset']).length === 0, JSON.stringify(parsedKiro?.gaps));
check('reads design.md as the plan', (parsedKiro?.unrequested ?? []).length === 0, JSON.stringify(parsedKiro?.unrequested));

const missing = spawnSync(
  process.execPath,
  [path.join(HERE, 'traceability.mjs'), '--spec=specs', '--root=' + root],
  { cwd: root, encoding: 'utf8' }
);
check('names both layouts when neither file is there', /spec.md or requirements.md/.test(missing.stdout + missing.stderr), (missing.stdout + missing.stderr).slice(0, 120));

const failed = results.filter((r) => !r).length;
console.log(NL + '  ' + (results.length - failed) + ' passed, ' + failed + ' failed');
console.log('  sandbox: ' + root);
process.exit(failed === 0 ? 0 : 1);
