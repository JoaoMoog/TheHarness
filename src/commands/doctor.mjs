import fs from 'node:fs';
import path from 'node:path';
import { loadConfig, selectedRepos } from '../lib/config.mjs';
import { loadLock, hashFile, sha256 } from '../lib/lock.mjs';
import { linksTo, inspect } from '../fs/link.mjs';
import { hasManagedBlock, isGitRepo } from '../fs/gitexclude.mjs';
import { auditSelf, diagnose } from '../lib/audit.mjs';
import { generatedFiles } from '../lib/kiro-gen.mjs';
import { unmappedEvents } from '../lib/targets.mjs';
import { readDreams, openOnes, isTemplate } from '../lib/dreams.mjs';
import { loadAllowlist, entryProblems, ALLOW_FILE } from '../../core/hooks/scripts/lib/allowlist.mjs';
import { createReport, log, c } from '../lib/log.mjs';

const VENDOR_SAMPLE = 400;

/** One occurrence is an event; two make a pattern. The skill says the same thing. */
const MIN_EVIDENCE = 2;

/**
 * Above this, candidates are accumulating because nobody is deciding on them,
 * and a memory nobody prunes stops being read at all.
 */
const MAX_OPEN_CANDIDATES = 12;

function auditRepos(report) {
  const cfg = loadConfig();
  if (!cfg) {
    report.warn('no harness.config.json - run "harness scan <folder>" to adopt repositories');
    return 0;
  }
  const lock = loadLock();
  const repos = selectedRepos(cfg);
  let installed = 0;

  for (const repo of repos) {
    const entry = lock.repos[repo.name];
    if (!entry) {
      report.warn(`${repo.name}: known but not installed`);
      continue;
    }
    installed += 1;

    for (const [target, source] of Object.entries(entry.links ?? {})) {
      const full = path.join(repo.dir, target);
      if (linksTo(full, source)) report.pass(`${repo.name}/${target} linked`);
      else report.fail(`${repo.name}/${target} is ${inspect(full).state}, expected a link to ${source}`);
    }

    for (const [target, hash] of Object.entries(entry.files ?? {})) {
      const current = hashFile(path.join(repo.dir, target));
      if (current === null) report.fail(`${repo.name}/${target} missing, re-run harness link`);
      else if (current !== hash) report.fail(`${repo.name}/${target} drifted from the harness source`);
      else report.pass(`${repo.name}/${target} in sync`);
    }

    // Vendored files are copies, so drift is the expected failure mode and the
    // one the documentation promises to catch. Sampled to keep doctor fast on a
    // repository carrying several hundred vendored files.
    const vendored = Object.entries(entry.vendored ?? {});
    const sample = vendored.slice(0, VENDOR_SAMPLE);
    const drifted = sample.filter(([target, hash]) => hashFile(path.join(repo.dir, target)) !== hash);
    if (vendored.length > 0) {
      if (drifted.length === 0) {
        report.pass(`${repo.name}: ${sample.length} vendored files in sync`);
      } else {
        for (const [target] of drifted.slice(0, 5)) {
          report.fail(`${repo.name}/${target} drifted from the harness source`);
        }
        if (drifted.length > 5) report.fail(`${repo.name}: ${drifted.length - 5} more vendored files drifted`);
      }
      if (vendored.length > VENDOR_SAMPLE) {
        report.warn(`${repo.name}: checked ${VENDOR_SAMPLE} of ${vendored.length} vendored files`);
      }
    }

    checkGenerated(report, repo, entry);
    checkTargetGaps(report, repo);
    checkDreams(report, repo);
    checkAllowlist(report, repo);

    if (!isGitRepo(repo.dir)) {
      report.warn(`${repo.name}: not a git repository, so the local exclude was skipped`);
    } else if (entry.mode === 'link' && !hasManagedBlock(repo.dir)) {
      report.fail(`${repo.name}: local exclude block missing, harness files will show up in git status`);
    } else if (entry.mode === 'vendor' && hasManagedBlock(repo.dir)) {
      report.fail(`${repo.name}: vendored files are excluded from git, so they can never be committed`);
    }
  }
  return installed;
}

/**
 * Generated files are the one surface the harness writes rather than links, so
 * they can drift two ways: someone edits the copy, or the source moves on and
 * the copy stays behind. Both are compared here against what would be
 * generated right now, which catches the second case as well as the first.
 */
function checkGenerated(report, repo, entry) {
  const recorded = Object.entries(entry.generated ?? {});
  if (recorded.length === 0) return;

  const expected = new Map(generatedFiles().map((file) => [file.path, sha256(file.content)]));
  const stale = recorded.filter(([target, hash]) => {
    const onDisk = hashFile(path.join(repo.dir, target));
    return onDisk === null || onDisk !== hash || expected.get(target) !== hash;
  });

  if (stale.length === 0) {
    report.pass(`${repo.name}: ${recorded.length} generated files match their source`);
    return;
  }
  for (const [target] of stale.slice(0, 5)) {
    report.fail(`${repo.name}/${target} was hand-edited or is stale, re-run harness link`);
  }
  if (stale.length > 5) {
    report.fail(`${repo.name}: ${stale.length - 5} more generated files are stale`);
  }
}

/**
 * Consolidation writes suggestions, and a suggestion with no evidence behind
 * it is the failure mode worth catching: it reads exactly like one that has
 * evidence, and it is one keystroke away from becoming a rule.
 */
function checkDreams(report, repo) {
  const { file, candidates } = readDreams(repo.dir);
  const real = candidates.filter((candidate) => !isTemplate(candidate));
  if (real.length === 0) return;

  const open = openOnes(real);
  const thin = open.filter((candidate) => candidate.sessions.length < MIN_EVIDENCE);
  const where = path.relative(repo.dir, file).split(path.sep).join('/');

  for (const candidate of thin.slice(0, 5)) {
    report.fail(
      `${repo.name}/${where}: ${candidate.id} cites ${candidate.sessions.length} session(s); ` +
        'a pattern needs two'
    );
  }
  if (thin.length > 5) report.fail(`${repo.name}/${where}: ${thin.length - 5} more candidates lack evidence`);
  if (thin.length === 0) report.pass(`${repo.name}: ${open.length} dream candidates all cite their sessions`);

  if (open.length > MAX_OPEN_CANDIDATES) {
    report.warn(
      `${repo.name}/${where}: ${open.length} open candidates, above the ${MAX_OPEN_CANDIDATES} ceiling. ` +
        'Promote or discard some, or the file stops being read'
    );
  }
}

/**
 * The false-positive list of the credential scan is committed and hand-editable,
 * so it is checked like any authored artifact: a file that does not parse
 * silences nothing, and an entry without a reason is a hole nobody can review.
 */
function checkAllowlist(report, repo) {
  const list = loadAllowlist(repo.dir);
  if (list.error) {
    report.fail(`${repo.name}/${ALLOW_FILE} is not valid JSON, so no false positive in it is honoured: ${list.error}`);
    return;
  }
  if (list.entries.length === 0) return;
  const bad = list.entries.map((entry, i) => ({ i, problems: entryProblems(entry) })).filter((x) => x.problems.length > 0);
  for (const { i, problems } of bad.slice(0, 5)) {
    report.fail(`${repo.name}/${ALLOW_FILE}: entry ${i + 1} ${problems.join(' and ')}`);
  }
  if (bad.length > 5) report.fail(`${repo.name}/${ALLOW_FILE}: ${bad.length - 5} more entries are malformed`);
  if (bad.length === 0) report.pass(`${repo.name}: ${list.entries.length} credential false positive(s) marked, each with a reason`);
}

/**
 * A target with no equivalent for an event silently drops the guardrails bound
 * to it. Said out loud once per repository, because the alternative - moving
 * them to a nearby event - fires a guardrail at the wrong moment.
 */
function checkTargetGaps(report, repo) {
  const missing = unmappedEvents(repo.settings.targets ?? ['copilot']);
  if (missing.length === 0) return;
  report.warn(
    `${repo.name}: no target here fires ${missing.join(', ')}, so sub-agent telemetry, ` +
      'handoff validation and compaction rescue do not run'
  );
}

export default function doctor(args) {
  const report = createReport('Harness audit');
  const counts = auditSelf(report);
  const installed = args.self ? null : auditRepos(report);
  const healthy = report.print({ verbose: Boolean(args.verbose) });

  log.title('Diagnostics');
  const questions = diagnose({ ...counts, installed, lockExists: fs.existsSync('harness.lock.json') });
  for (const q of questions) {
    log.plain(`  ${q.answer ? c.green('yes') : c.red('no ')}  ${q.question}`);
    if (!q.answer && q.why) log.plain(`        ${c.dim(q.why)}`);
  }

  // A diagnostic that cannot fail the command is decoration. These can.
  const unanswered = questions.filter((q) => !q.answer && q.blocking);
  if (unanswered.length > 0) {
    log.plain(`\n  ${c.red(`${unanswered.length} blocking diagnostic(s) unanswered`)}`);
  }

  if (!args.verbose) log.plain(`\n${c.dim('Run with --verbose to list every passing check.')}`);
  return healthy && unanswered.length === 0 ? 0 : 1;
}
