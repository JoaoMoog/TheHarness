#!/usr/bin/env node
/**
 * Guardrail: warns when a credential is about to reach history or a tool call,
 * and records every warning in .harness/secrets.log.
 *
 * Advisory by decision, not by accident. Blocking on a credential pattern
 * trains people to reach for --no-verify, which switches off every guardrail
 * at once; a warning that cannot be missed plus a record that outlives the
 * terminal keeps the signal without the bypass. The obligation it leaves is
 * rotation: a value that reached history is compromised whether or not the
 * line is removed later.
 *
 * Two entry points, one implementation:
 *   git pre-commit         scans the staged INDEX, warns on stderr, exits 0
 *   VS Code PreToolUse     scans the tool payload, allows it with a warning
 *
 * A false positive is marked once and stays quiet everywhere after: by id in
 * .harness-allow.json through `harness secrets --allow=<id> --why`, by path
 * glob through --allow-path, or with the comment marker harness:allow-secret
 * on that one line. Every warning prints the id it would take.
 *
 * The log carries the redacted value and the id only. A record of the secret
 * would be a second copy of the secret.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { scanLine, scanStructured, redact } from './lib/patterns.mjs';
import { loadAllowlist, isAllowed, valueId, ALLOW_FILE } from './lib/allowlist.mjs';
import * as git from './lib/git.mjs';
import { readHookInput, isHookMode, collectStrings, toolFilePath, allow, EXIT_OK } from './lib/io.mjs';

const ALLOW_MARKER = 'harness:allow-secret';
const LARGE_FILE_BYTES = 512 * 1024;
const LOG_MAX_BYTES = 2 * 1024 * 1024;

/** Only files that genuinely cannot hold a live credential. */
const SKIP_FILE = /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|Cargo\.lock|go\.sum|poetry\.lock)$/i;

function repoRootOrNull() {
  try {
    return git.isInsideRepo() ? git.repoRoot() : null;
  } catch {
    return null;
  }
}

const ROOT = repoRootOrNull();
const ALLOWLIST = loadAllowlist(ROOT ?? process.cwd());

/** `file` is what the warning shows; `where` is the repository-relative path the allowlist matches on. */
function scanText(text, file, where = file) {
  const lines = text.split(/\r?\n/);
  const findings = [];

  lines.forEach((line, i) => {
    if (line.includes(ALLOW_MARKER)) return;
    const hit = scanLine(line);
    if (hit) findings.push({ file, line: i + 1, name: hit.name, value: hit.value });
  });

  for (const hit of scanStructured(lines)) {
    if (lines[hit.line - 1]?.includes(ALLOW_MARKER)) continue;
    findings.push({ file, ...hit });
  }
  return findings.filter((f) => !isAllowed(ALLOWLIST, { value: f.value, file: where }));
}

function scanIndex() {
  if (!git.isInsideRepo()) {
    throw new git.GitUnavailable('not inside a git work tree, so the staged index cannot be read');
  }
  const files = git.stagedFiles().filter((f) => !SKIP_FILE.test(f));
  const findings = [];
  const warnings = [];

  for (const file of files) {
    const size = git.stagedSize(file);
    if (size > LARGE_FILE_BYTES) {
      warnings.push(`${file} is ${(size / 1024).toFixed(0)} KB, larger than the scan limit and NOT checked`);
      continue;
    }
    const { text, encoding } = git.decode(git.stagedContent(file));
    if (text === null) continue;
    if (encoding !== 'utf-8') warnings.push(`${file} is ${encoding}; scanned after decoding`);
    findings.push(...scanText(text, file));
  }
  return { findings, warnings };
}

/** The record lives next to the telemetry: inside the repository, never committed. */
function logFile() {
  const dir = path.join(ROOT ?? os.tmpdir(), '.harness');
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, 'secrets.log');
}

/** Single rotation, like the audit log: one .1 file is enough. */
function rotate(file) {
  try {
    if (fs.statSync(file).size > LOG_MAX_BYTES) fs.renameSync(file, `${file}.1`);
  } catch {
    // Missing file, or a rename another process already did.
  }
}

const shown = (file) => path.relative(process.cwd(), file) || file;

/**
 * One JSON line per finding, value redacted. Best effort: a record that cannot
 * be written is said on stderr, and still never turns a warning into a block.
 */
function record(event, findings, extra = {}) {
  const at = new Date().toISOString();
  try {
    const file = logFile();
    rotate(file);
    const lines = findings.map((f) =>
      JSON.stringify({
        at,
        event,
        file: f.file,
        line: f.line,
        name: f.name,
        value: redact(f.value),
        id: valueId(f.value),
        ...extra,
      })
    );
    fs.appendFileSync(file, `${lines.join('\n')}\n`, 'utf8');
    return file;
  } catch (err) {
    console.error(`harness secret-block: could not record the warning - ${err.message}`);
    return null;
  }
}

/** How a person marks a false positive, printed with every warning so nobody has to look it up. */
function markingHint(ids) {
  const repo = path.basename(ROOT ?? process.cwd());
  const example = ids[0] ?? '<id>';
  return [
    'False positive? Mark it once and it stays quiet everywhere:',
    `  harness secrets ${repo} --allow=${example} --why="<reason>"    (or --allow-path=<glob>)`,
    `  It writes ${ALLOW_FILE}, which the team commits. Or put the comment ${ALLOW_MARKER} on that one line.`,
  ];
}

function runGit() {
  let scanned;
  try {
    scanned = scanIndex();
  } catch (err) {
    // Advisory throughout: a scanner that cannot run says so loudly, records
    // that it did not run, and the commit goes ahead.
    console.error(`\nharness secret-block: WARNING, could not scan the staged index - ${err.message}`);
    console.error('The commit goes ahead unscanned. Check it for credentials yourself before pushing.\n');
    record('pre-commit', [{ file: '-', line: 0, name: 'not scanned', value: '' }], {
      reason: String(err.message).slice(0, 160),
    });
    return EXIT_OK;
  }

  const { findings, warnings } = scanned;
  for (const w of warnings) console.error(`harness secret-block: ${w}`);
  if (findings.length === 0) return EXIT_OK;

  const where = record('pre-commit', findings, { branch: git.currentBranch() });
  console.error(`\nharness secret-block: WARNING, ${findings.length} credential-shaped value(s) in this commit\n`);
  for (const f of findings) {
    console.error(`  ${f.file}:${f.line}  ${f.name}`);
    console.error(`    value: ${redact(f.value)}   id: ${valueId(f.value)}`);
  }
  console.error(`\nThe commit goes ahead.${where ? ` Recorded in ${shown(where)}.` : ''}`);
  console.error('A value that reaches history is compromised: rotate it. Removing the line later is not enough.');
  console.error('Move it to an environment variable or a secret manager.');
  for (const line of markingHint([...new Set(findings.map((f) => valueId(f.value)))])) console.error(line);
  console.error('');
  return EXIT_OK;
}

/** The tool's file, repository-relative, so a path rule can match it; null outside the repository. */
function hookTarget(input) {
  const raw = toolFilePath(input);
  if (typeof raw !== 'string' || raw === '' || !ROOT) return null;
  const rel = path.relative(ROOT, path.resolve(raw)).split(path.sep).join('/');
  return rel.startsWith('..') ? null : rel;
}

function runHook(input) {
  const tool = input.tool_name ?? 'tool input';
  const where = hookTarget(input);
  const findings = collectStrings(input.tool_input).flatMap((s) => scanText(s, tool, where));
  if (findings.length === 0) return allow('PreToolUse');

  const logged = record('PreToolUse', findings, { tool, target: where, session: input.session_id ?? null });
  const first = findings[0];
  const id = valueId(first.value);
  const more = findings.length > 1 ? ` and ${findings.length - 1} more` : '';
  return allow(
    'PreToolUse',
    `harness: this ${tool} payload contains what looks like a ${first.name} (${redact(first.value)}, id ${id})${more}. ` +
      `It was allowed and recorded${logged ? ` in ${shown(logged)}` : ''}. Read the value from an environment ` +
      'variable or a secret manager instead; if it is real, tell the user it must be rotated, and if it is a ' +
      `false positive, tell them to mark it with: harness secrets --allow=${id} --why="<reason>".`
  );
}

const input = await readHookInput();
try {
  process.exit(isHookMode(input) ? runHook(input) : runGit());
} catch (err) {
  // Never a block: a scanner that failed is said, not enforced.
  const reason = err?.message ?? String(err);
  console.error(`harness secret-block: WARNING, the scanner failed - ${reason}. Nothing was blocked.`);
  process.exit(
    isHookMode(input)
      ? allow('PreToolUse', `harness: the credential scanner failed (${reason}); the call was allowed unscanned.`)
      : EXIT_OK
  );
}
