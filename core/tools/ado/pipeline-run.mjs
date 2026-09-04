#!/usr/bin/env node
/**
 * Triggers a named pipeline on a branch.
 *
 * Quadrant: Q3 for a validation pipeline - the hook asks before it runs.
 * A pipeline whose name looks like a release or a production deploy is Q4 and
 * this script refuses it outright, printing the command for a human to run.
 * That refusal is deliberate belt and braces: the hook already gates it, and a
 * guardrail that exists in one place only is one edit away from being gone.
 *
 *   node pipeline-run.mjs --name="billing-api CI" --dry-run
 */
import { azWrite, ok, fail, parseArgs, redact, AdoError, QUADRANT } from './lib/ado.mjs';
import { resolveContext, currentBranch } from './lib/context.mjs';

/** Names that mean "this reaches users", matched conservatively. */
const RELEASE = /\b(release|deploy|prod|production|cd|hotfix|publish)\b/i;

const args = parseArgs(process.argv.slice(2));
const dryRun = Boolean(args['dry-run']);

try {
  const context = resolveContext(args);
  const name = args.name ?? args.pipeline;
  if (!name) {
    throw new AdoError(
      'which pipeline?',
      'Pass --name="<pipeline name>". List them with:\n  az pipelines list --output table'
    );
  }

  const branch = args.branch ?? currentBranch();
  if (!branch) throw new AdoError('cannot determine the branch', 'Pass --branch=<branch>.');

  const argv = [
    'pipelines', 'run',
    '--organization', context.orgUrl,
    '--project', context.project,
    '--name', String(name),
    '--branch', branch,
  ];

  if (RELEASE.test(String(name))) {
    const command = ['az', ...argv].map((p) => (/\s/.test(p) ? JSON.stringify(p) : p)).join(' ');
    console.error(`harness ado: "${name}" looks like a release pipeline, which is Q4.`);
    console.error('\nAn agent does not ship to users. Run it yourself if that is what you want:\n');
    console.error(`  ${command}\n`);
    process.exit(2);
  }

  const outcome = azWrite(argv, {
    dryRun,
    quadrant: QUADRANT.Q3,
    intent: `run pipeline "${name}" on ${branch}`,
  });

  const run = outcome.result ?? null;
  process.exit(
    ok({
      action: 'queued',
      pipeline: String(name),
      branch,
      quadrant: outcome.quadrant,
      executed: outcome.executed,
      command: redact(outcome.command),
      pipelineRun: run
        ? {
            id: run.id,
            status: run.status ?? 'notStarted',
            url: `${context.orgUrl}/${encodeURIComponent(context.project)}/_build/results?buildId=${run.id}`,
          }
        : null,
    })
  );
} catch (err) {
  if (err instanceof AdoError) process.exit(fail(err.message, err.remedy));
  throw err;
}
