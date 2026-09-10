import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { HARNESS_ROOT } from '../lib/paths.mjs';
import { log } from '../lib/log.mjs';

const MARKER = '# the-harness managed pre-commit hook';

/** Forward slashes keep the generated hook portable across Git Bash and sh. */
const posix = (p) => p.split(path.sep).join('/');

/**
 * Resolves the real hooks directory. A worktree or submodule has .git as a
 * FILE, and a repository using husky or lefthook redirects hooks elsewhere via
 * core.hooksPath. Writing blindly to <repo>/.git/hooks fails in the first case
 * and is silently ignored by git in the second.
 */
export function resolveHooksDir(repoDir) {
  const git = (args) =>
    execFileSync('git', args, { cwd: repoDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

  let configured = '';
  try {
    configured = git(['config', '--get', 'core.hooksPath']);
  } catch {
    configured = '';
  }
  if (configured) {
    return { dir: path.resolve(repoDir, configured), managedByGit: false };
  }
  const common = git(['rev-parse', '--git-common-dir']);
  return { dir: path.resolve(repoDir, common, 'hooks'), managedByGit: true };
}

function hookBody() {
  const scripts = posix(path.join(HARNESS_ROOT, 'core', 'hooks', 'scripts'));
  return [
    '#!/bin/sh',
    MARKER,
    '# Remove this file, or run "harness unlink", to uninstall.',
    'HARNESS_SCRIPTS="' + scripts + '"',
    'export HARNESS_HOOK_MODE=git',
    '',
    'if ! command -v node >/dev/null 2>&1; then',
    '  echo "harness: node not found, guardrails did not run" >&2',
    '  exit 1',
    'fi',
    '',
    '# Record the attempt first: a log that only sees successful commits cannot',
    '# tell you about the ones a guardrail refused.',
    'node "$HARNESS_SCRIPTS/audit-log.mjs" || true',
    '',
    '# Normalise before scanning, so what is scanned is what gets committed.',
    'node "$HARNESS_SCRIPTS/format.mjs" || true',
    '',
    '# The credential scan is advisory: it warns and records in .harness/secrets.log,',
    '# and the commit goes ahead. Only a scanner that failed to start is worth a line.',
    'node "$HARNESS_SCRIPTS/secret-block.mjs" || echo "harness: secret-block did not run; check the commit for credentials yourself" >&2',
    '',
    '# Files that must never enter history are still refused.',
    'node "$HARNESS_SCRIPTS/policy-gate.mjs" || exit 1',
    '',
  ].join('\n');
}

export function installGitHook(repoDir) {
  let target;
  try {
    target = resolveHooksDir(repoDir);
  } catch (err) {
    log.warn(`${path.basename(repoDir)}: cannot resolve the hooks directory (${err.message.split('\n')[0]})`);
    return 'unresolved';
  }

  if (!target.managedByGit) {
    log.warn(
      `${path.basename(repoDir)}: core.hooksPath points at ${posix(target.dir)}; ` +
        'a hook manager owns this repository, so the guardrails were not installed. Add them to that manager.'
    );
    return 'delegated';
  }

  const file = path.join(target.dir, 'pre-commit');
  if (fs.existsSync(file) && !fs.readFileSync(file, 'utf8').includes(MARKER)) {
    log.warn(`${path.basename(repoDir)}: a pre-commit hook already exists and is not ours, left untouched`);
    return 'foreign';
  }

  fs.mkdirSync(target.dir, { recursive: true });
  fs.writeFileSync(file, hookBody(), 'utf8');
  try {
    fs.chmodSync(file, 0o755);
  } catch {
    // chmod is a no-op on some Windows filesystems; the hook still runs.
  }
  return 'installed';
}

export function removeGitHook(repoDir) {
  let target;
  try {
    target = resolveHooksDir(repoDir);
  } catch {
    return 'unresolved';
  }
  const file = path.join(target.dir, 'pre-commit');
  if (!fs.existsSync(file)) return 'absent';
  if (!fs.readFileSync(file, 'utf8').includes(MARKER)) return 'foreign';
  fs.rmSync(file);
  return 'removed';
}
