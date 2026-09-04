#!/usr/bin/env node
/**
 * Adds a structured comment thread to a pull request, optionally anchored to a
 * file and line, or resolves an existing thread.
 *
 * The azure-devops extension has no command for threads, so this goes through
 * `az rest` against the threads API. Authentication still belongs to az: this
 * tooling never handles a PAT itself.
 *
 * Quadrant: Q2. A comment is reversible and carries no side effect beyond a
 * notification, so it runs and you read the result.
 *
 *   node pr-comment.mjs --pr=482 --file=src/api/list.ts --line=42 \
 *     --content="offset uses page * size; page=1 skips the first 20 rows" --dry-run
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { azWrite, ok, fail, parseArgs, redact, AdoError, QUADRANT } from './lib/ado.mjs';
import { resolveContext } from './lib/context.mjs';

/** The Azure DevOps application id, so az can acquire a token for the API. */
const ADO_RESOURCE = '499b84ac-1321-427f-aa17-267ca6975798';
const API = 'api-version=7.1';

const args = parseArgs(process.argv.slice(2));
const dryRun = Boolean(args['dry-run']);

function content() {
  if (args['content-file']) {
    try {
      return fs.readFileSync(args['content-file'], 'utf8');
    } catch (err) {
      throw new AdoError(`cannot read the content file: ${err.message}`);
    }
  }
  if (args.content) return String(args.content);
  throw new AdoError(
    'a comment needs content',
    'Pass --content="..." or --content-file=<path>. One thread per finding: the\n' +
      'ado-comment skill explains why a single wall of text is worse than nothing.'
  );
}

function threadBody() {
  const body = {
    comments: [{ parentCommentId: 0, commentType: 'text', content: content() }],
    status: args.status ?? 'active',
  };
  if (args.file) {
    const line = Number(args.line ?? 1);
    if (!Number.isInteger(line) || line < 1) throw new AdoError(`--line must be a positive integer, got ${args.line}`);
    const filePath = String(args.file).startsWith('/') ? String(args.file) : `/${args.file}`;
    body.threadContext = {
      filePath,
      rightFileStart: { line, offset: 1 },
      rightFileEnd: { line, offset: 1 },
    };
  }
  return body;
}

/** az rest reads the body from a file so newlines and quotes survive Windows. */
function writeBodyFile(body) {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'harness-ado-')), 'body.json');
  fs.writeFileSync(file, JSON.stringify(body), 'utf8');
  return file;
}

try {
  const context = resolveContext(args);
  const pr = args.pr ?? args.id;
  if (!pr) throw new AdoError('which pull request?', 'Pass --pr=<id>.');

  const repoUri =
    `${context.orgUrl}/${encodeURIComponent(context.project)}/_apis/git/repositories/` +
    `${encodeURIComponent(context.repo)}/pullRequests/${pr}/threads`;

  const resolving = Boolean(args.resolve);
  if (resolving && !args.thread) {
    throw new AdoError('which thread?', 'Pass --thread=<id> together with --resolve.');
  }

  const body = resolving ? { status: 'closed' } : threadBody();
  const uri = resolving ? `${repoUri}/${args.thread}?${API}` : `${repoUri}?${API}`;
  const method = resolving ? 'patch' : 'post';

  const bodyFile = dryRun ? null : writeBodyFile(body);
  let outcome;
  try {
    outcome = azWrite(
      [
        'rest',
        '--method', method,
        '--resource', ADO_RESOURCE,
        '--uri', uri,
        '--headers', 'Content-Type=application/json',
        '--body', bodyFile ? `@${bodyFile}` : JSON.stringify(body),
      ],
      {
        dryRun,
        quadrant: QUADRANT.Q2,
        intent: resolving ? `resolve thread ${args.thread} on PR ${pr}` : `comment on PR ${pr}`,
      }
    );
  } finally {
    if (bodyFile) fs.rmSync(path.dirname(bodyFile), { recursive: true, force: true });
  }

  process.exit(
    ok({
      action: resolving ? 'resolved' : 'commented',
      pullRequest: pr,
      anchor: body.threadContext ? `${body.threadContext.filePath}:${body.threadContext.rightFileStart.line}` : null,
      quadrant: outcome.quadrant,
      executed: outcome.executed,
      command: redact(outcome.command),
      body: dryRun ? body : undefined,
      thread: outcome.result?.id ?? args.thread ?? null,
    })
  );
} catch (err) {
  if (err instanceof AdoError) process.exit(fail(err.message, err.remedy));
  throw err;
}
