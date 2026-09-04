#!/usr/bin/env node
/**
 * Creates the pull request for the current branch, or updates the one that
 * already exists for it. Draft by default.
 *
 * Quadrant: creating or updating a draft is Q2 - reversible, so it runs and you
 * review the result. Publishing it (--publish) is Q3, because that notifies
 * reviewers and starts branch policies; the hook asks first.
 *
 *   node pr-create.mjs --title="feat: export the report as CSV" \
 *     --description-file=specs/007-export-csv/pr-body.md --dry-run
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { azJson, azWrite, ok, fail, parseArgs, redact, AdoError, QUADRANT } from './lib/ado.mjs';
import { resolveContext, currentBranch, defaultBranch } from './lib/context.mjs';

const args = parseArgs(process.argv.slice(2));
const dryRun = Boolean(args['dry-run']);
const publish = Boolean(args.publish);

const ref = (branch) => (branch.startsWith('refs/') ? branch : `refs/heads/${branch}`);
const list = (value) => String(value ?? '').split(',').map((s) => s.trim()).filter(Boolean);

function descriptionText() {
  if (args['description-file']) {
    try {
      return fs.readFileSync(args['description-file'], 'utf8');
    } catch (err) {
      throw new AdoError(`cannot read the description file: ${err.message}`);
    }
  }
  if (args.description) return String(args.description);
  throw new AdoError(
    'a pull request needs a description',
    'Pass --description-file=<path> or --description="...". The ado-pull-request skill\n' +
      'defines what the body carries: the spec link, the review verdict, what was\n' +
      'actually verified, and what was left out.'
  );
}

/**
 * The Azure CLI reads a value from a file when it starts with @. Routing the
 * description through a file keeps arbitrary markdown off the command line,
 * which is what makes this safe to run through the Windows comspec.
 */
function descriptionArg(text, temps) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-ado-'));
  const file = path.join(dir, 'description.md');
  fs.writeFileSync(file, text, 'utf8');
  temps.push(dir);
  return `@${file}`;
}

const temps = [];
try {
  const context = resolveContext(args);
  const source = args.source ?? currentBranch();
  const target = args.target ?? defaultBranch();

  if (!source) throw new AdoError('cannot determine the source branch', 'Pass --source=<branch>.');
  if (source === target) {
    throw new AdoError(
      `the source and the target branch are both ${source}`,
      'A pull request needs a branch that differs from the target. Commit the work to a\nfeature branch first.'
    );
  }

  const scope = ['--organization', context.orgUrl, '--project', context.project];
  const text = descriptionText();

  const existing =
    azJson(
      ['repos', 'pr', 'list', ...scope, '--repository', context.repo,
       '--source-branch', ref(source), '--target-branch', ref(target), '--status', 'active'],
      { allowFailure: dryRun }
    ) ?? [];
  const open = Array.isArray(existing) ? existing[0] : null;

  const description = dryRun ? '@<description file>' : descriptionArg(text, temps);

  const outcome = open
    ? azWrite(
        ['repos', 'pr', 'update', '--organization', context.orgUrl, '--id', String(open.pullRequestId),
         ...(args.title ? ['--title', String(args.title)] : []),
         '--description', description,
         ...(publish ? ['--draft', 'false'] : [])],
        {
          dryRun,
          quadrant: publish ? QUADRANT.Q3 : QUADRANT.Q2,
          intent: publish ? `publish pull request ${open.pullRequestId}` : `update pull request ${open.pullRequestId}`,
        }
      )
    : azWrite(
        ['repos', 'pr', 'create', ...scope, '--repository', context.repo,
         '--source-branch', source, '--target-branch', target,
         '--title', String(args.title ?? `Merge ${source} into ${target}`),
         '--description', description,
         '--draft', publish ? 'false' : 'true',
         ...(args['work-items'] ? ['--work-items', ...list(args['work-items'])] : []),
         ...(args.reviewers ? ['--reviewers', ...list(args.reviewers)] : [])],
        {
          dryRun,
          quadrant: publish ? QUADRANT.Q3 : QUADRANT.Q2,
          intent: publish ? 'create and publish a pull request' : 'create a draft pull request',
        }
      );

  const pr = outcome.result ?? open ?? null;
  process.exit(
    ok({
      action: open ? 'updated' : 'created',
      draft: !publish,
      quadrant: outcome.quadrant,
      executed: outcome.executed,
      command: redact(outcome.command),
      descriptionBytes: Buffer.byteLength(text, 'utf8'),
      source,
      target,
      pullRequest: pr
        ? {
            id: pr.pullRequestId,
            url: `${context.orgUrl}/${encodeURIComponent(context.project)}/_git/${encodeURIComponent(context.repo)}/pullrequest/${pr.pullRequestId}`,
          }
        : null,
    })
  );
} catch (err) {
  if (err instanceof AdoError) process.exit(fail(err.message, err.remedy));
  throw err;
} finally {
  for (const dir of temps) fs.rmSync(dir, { recursive: true, force: true });
}
