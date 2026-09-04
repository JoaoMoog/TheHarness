#!/usr/bin/env node
/**
 * Checks everything the other scripts assume, and says exactly what to do when
 * one of them is missing. Run this first: a clear failure here is much cheaper
 * than an opaque `az` error in the middle of a delivery.
 *
 * Read-only. Never writes to Azure DevOps.
 */
import { az, azJson, ok, fail, parseArgs, AdoError, EXIT_OK } from './lib/ado.mjs';
import { resolveContext, currentBranch, defaultBranch } from './lib/context.mjs';

const args = parseArgs(process.argv.slice(2));
const checks = [];
const record = (name, passed, detail, remedy) => {
  checks.push({ name, passed, detail, ...(remedy && !passed ? { remedy } : {}) });
  return passed;
};

try {
  const version = az(['version'], { allowFailure: true });
  if (
    !record('az CLI', version !== null, version ? 'found on PATH' : 'not found', 'Install the Azure CLI.')
  ) {
    throw new AdoError('the az CLI is not available', 'Install the Azure CLI and run this again.');
  }

  const extensions = azJson(['extension', 'list'], { allowFailure: true }) ?? [];
  const hasExtension = Array.isArray(extensions) && extensions.some((e) => e?.name === 'azure-devops');
  record(
    'azure-devops extension',
    hasExtension,
    hasExtension ? 'installed' : 'missing',
    'az extension add --name azure-devops'
  );

  const account = azJson(['account', 'show'], { allowFailure: true });
  record(
    'signed in',
    account !== null,
    account ? `as ${account.user?.name ?? 'unknown'}` : 'no active account',
    'az login'
  );

  const context = resolveContext(args);
  record('context', true, `${context.org} / ${context.project} / ${context.repo}`);
  record('context source', true, context.source);

  const branch = currentBranch();
  record('branch', branch !== null, branch ?? 'not a git repository', 'Run this inside the repository.');
  record('target branch', true, defaultBranch());

  const failed = checks.filter((c) => !c.passed);
  if (failed.length > 0) {
    console.error('harness ado preflight: not ready\n');
    for (const c of failed) console.error(`  ${c.name}: ${c.detail}\n    fix: ${c.remedy ?? 'see above'}`);
    process.exit(2);
  }

  process.exit(ok({ ready: true, context, branch, targetBranch: defaultBranch(), checks }));
} catch (err) {
  if (err instanceof AdoError) process.exit(fail(err.message, err.remedy));
  throw err;
}
