#!/usr/bin/env node
/**
 * Reads the state of a pipeline run, and on failure names the tasks that failed
 * rather than returning the whole log. A failed build log is tens of thousands
 * of tokens and almost all of it is noise.
 *
 * Read-only.
 *
 *   node pipeline-status.mjs --id=48213
 */
import { azJson, ok, fail, parseArgs, AdoError } from './lib/ado.mjs';
import { resolveContext } from './lib/context.mjs';

const args = parseArgs(process.argv.slice(2));

try {
  const context = resolveContext(args);
  const id = args.id ?? args.run;
  if (!id) throw new AdoError('which run?', 'Pass --id=<run id>, as returned by pipeline-run.mjs.');

  const base = ['--organization', context.orgUrl, '--project', context.project];
  const run = azJson(['pipelines', 'runs', 'show', ...base, '--id', String(id)]);
  if (!run) throw new AdoError(`run ${id} was not found`);

  const done = run.status === 'completed';
  const failed = done && run.result !== 'succeeded';

  let failures = [];
  if (failed) {
    const timeline = azJson(
      ['pipelines', 'runs', 'show', ...base, '--id', String(id), '--query', 'records'],
      { allowFailure: true }
    );
    failures = (Array.isArray(timeline) ? timeline : [])
      .filter((r) => r?.result === 'failed' && r?.type === 'Task')
      .map((r) => ({ task: r.name, issues: (r.issues ?? []).map((i) => i.message).slice(0, 3) }))
      .slice(0, 10);
  }

  process.exit(
    ok({
      pipelineRun: {
        id: run.id,
        status: run.status,
        result: run.result ?? null,
        branch: run.sourceBranch ?? null,
        url: `${context.orgUrl}/${encodeURIComponent(context.project)}/_build/results?buildId=${run.id}`,
      },
      finished: done,
      passed: done && run.result === 'succeeded',
      failures,
      nextStep: !done
        ? 'still running; check again rather than waiting in the session'
        : failed
          ? 'read the named failing tasks above before opening any log'
          : 'nothing to do',
    })
  );
} catch (err) {
  if (err instanceof AdoError) process.exit(fail(err.message, err.remedy));
  throw err;
}
