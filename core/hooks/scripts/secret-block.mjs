#!/usr/bin/env node
/**
 * Guardrail: refuses to let a credential reach history, or reach a tool call.
 *
 * Two entry points, one implementation:
 *   git pre-commit         scans the staged INDEX, exits 1 to refuse
 *   VS Code PreToolUse     scans the tool payload, returns permissionDecision
 *
 * Bypass one line with the comment marker harness:allow-secret when a match is
 * a documented false positive.
 */
import { scanLine, scanStructured, redact } from './lib/patterns.mjs';
import * as git from './lib/git.mjs';
import {
  readHookInput, isHookMode, collectStrings, deny, allow, failSecure,
  EXIT_OK, EXIT_REFUSE,
} from './lib/io.mjs';

const ALLOW_MARKER = 'harness:allow-secret';
const LARGE_FILE_BYTES = 512 * 1024;

/** Only files that genuinely cannot hold a live credential. */
const SKIP_FILE = /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|Cargo\.lock|go\.sum|poetry\.lock)$/i;

function scanText(text, file) {
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
  return findings;
}

function scanIndex() {
  if (!git.isInsideRepo()) {
    throw new git.GitUnavailable(
      "not inside a git work tree, so the staged index cannot be read"
    );
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

function report(findings, warnings) {
  console.error('\nharness secret-block: refused\n');
  for (const f of findings) {
    console.error(`  ${f.file}:${f.line}  ${f.name}`);
    console.error(`    value: ${redact(f.value)}`);
  }
  for (const w of warnings) console.error(`  warning: ${w}`);
  console.error('\nMove the value to an environment variable or a secret manager.');
  console.error('A value that was ever committed must be rotated; deleting the line is not enough.');
  console.error(`If this is a false positive, append the comment ${ALLOW_MARKER} to that line.\n`);
}

function runHook(input) {
  const strings = collectStrings(input.tool_input);
  const findings = strings.flatMap((s) => scanText(s, input.tool_name ?? 'tool input'));
  if (findings.length === 0) return allow('PreToolUse');
  const first = findings[0];
  return deny(
    'PreToolUse',
    `Blocked: the payload contains what looks like a ${first.name} (${redact(first.value)}). ` +
      'Read it from an environment variable or a secret manager instead.'
  );
}

function runGit() {
  const { findings, warnings } = scanIndex();
  if (findings.length > 0) {
    report(findings, warnings);
    return EXIT_REFUSE;
  }
  for (const w of warnings) console.error(`harness secret-block: ${w}`);
  return EXIT_OK;
}

const input = await readHookInput();
try {
  process.exit(isHookMode(input) ? runHook(input) : runGit());
} catch (err) {
  process.exit(failSecure('secret-block', err, isHookMode(input)));
}
