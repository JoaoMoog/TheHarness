import fs from 'node:fs';
import path from 'node:path';
import { loadConfig, selectedRepos } from '../lib/config.mjs';
import { loadLock, hashFile } from '../lib/lock.mjs';
import { linksTo, inspect } from '../fs/link.mjs';
import { hasManagedBlock, isGitRepo } from '../fs/gitexclude.mjs';
import { auditSelf, diagnose } from '../lib/audit.mjs';
import { createReport, log, c } from '../lib/log.mjs';

const VENDOR_SAMPLE = 400;

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
