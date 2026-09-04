#!/usr/bin/env node
/**
 * Exercises the Azure DevOps scripts against a stub `az` and a throwaway git
 * repository. No organisation, no network, no credentials.
 *
 * This is the only way to prove the interesting parts: that --dry-run really
 * does not call az, that a release pipeline is refused before any call, that a
 * secret in a description never reaches the output, and that the Windows
 * comspec path actually works rather than merely existing.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-ado-selftest-'));
const binDir = path.join(root, 'bin');
const repoDir = path.join(root, 'billing-api');
const callLog = path.join(root, 'az-calls.log');
fs.mkdirSync(binDir);
fs.mkdirSync(repoDir);

const NL = String.fromCharCode(10);
const BS = String.fromCharCode(92);
const SECRET = 'a'.repeat(40);

const stub = [
  'import fs from "node:fs";',
  'const args = process.argv.slice(2);',
  'fs.appendFileSync(process.env.AZ_CALL_LOG, JSON.stringify(args) + "' + BS + 'n");',
  'const sub = args.join(" ");',
  'const say = (o) => { process.stdout.write(JSON.stringify(o)); process.exit(0); };',
  'if (args.includes("version")) { process.stdout.write("azure-cli 2.60.0"); process.exit(0); }',
  'if (sub.startsWith("extension list")) say([{ name: "azure-devops", version: "1.0.0" }]);',
  'if (sub.startsWith("account show")) say({ user: { name: "dev@example.com" } });',
  'if (sub.startsWith("devops configure")) { process.stdout.write("organization = https://dev.azure.com/stale' + BS + 'nproject = Stale"); process.exit(0); }',
  'if (sub.startsWith("repos pr list")) say(process.env.AZ_EXISTING_PR ? [{ pullRequestId: 482 }] : []);',
  'if (sub.startsWith("repos pr create")) say({ pullRequestId: 501 });',
  'if (sub.startsWith("repos pr update")) say({ pullRequestId: 482 });',
  'if (sub.startsWith("pipelines runs show")) say({ id: 48213, status: "completed", result: "succeeded" });',
  'if (sub.startsWith("pipelines run")) say({ id: 48213, status: "notStarted" });',
  'if (sub.startsWith("rest")) say({ id: 9001 });',
  'process.stderr.write("fake-az: unhandled " + sub); process.exit(1);',
].join(NL);

fs.writeFileSync(path.join(binDir, 'fake-az.mjs'), stub, 'utf8');

const isWindows = process.platform === 'win32';
const azPath = path.join(binDir, isWindows ? 'az.cmd' : 'az');
const stubPath = path.join(binDir, 'fake-az.mjs');

fs.writeFileSync(
  azPath,
  isWindows
    ? '@echo off' + String.fromCharCode(13, 10) + 'node "' + stubPath + '" %*' + String.fromCharCode(13, 10)
    : '#!/bin/sh' + NL + 'exec node "' + stubPath + '" "$@"' + NL,
  'utf8'
);
if (!isWindows) fs.chmodSync(azPath, 0o755);

const git = (args, cwd = repoDir) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });

git(['init', '-q', '--initial-branch=main']);
git(['config', 'user.email', 'selftest@example.com']);
git(['config', 'user.name', 'selftest']);
git(['remote', 'add', 'origin', 'https://dev.azure.com/contoso/Payments/_git/billing-api']);
fs.writeFileSync(path.join(repoDir, 'README.md'), '# billing-api' + NL);
git(['add', '-A']);
git(['commit', '-qm', 'init']);
git(['checkout', '-qb', 'feat/csv-export']);

const bodyFile = path.join(repoDir, 'pr-body.md');
fs.writeFileSync(bodyFile, '## What' + NL + 'Export the report as CSV.' + NL, 'utf8');

const results = [];

function run(script, args, env = {}, cwd = repoDir) {
  const before = fs.existsSync(callLog) ? fs.readFileSync(callLog, 'utf8') : '';
  const proc = spawnSync(process.execPath, [path.join(HERE, script), ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, HARNESS_AZ_BIN: azPath, AZ_CALL_LOG: callLog, ...env },
  });
  const after = fs.existsSync(callLog) ? fs.readFileSync(callLog, 'utf8') : '';
  let json = null;
  try {
    json = JSON.parse(proc.stdout);
  } catch {
    // Not every case returns JSON; the assertion says which.
  }
  const newCalls = after
    .slice(before.length)
    .split(NL)
    .filter(Boolean)
    .map((l) => JSON.parse(l));
  return { code: proc.status, stdout: proc.stdout ?? '', stderr: proc.stderr ?? '', json, newCalls };
}

function check(label, condition, detail = '') {
  const passed = Boolean(condition);
  results.push({ label, passed });
  const suffix = passed || !detail ? '' : '  (' + String(detail).slice(0, 120) + ')';
  console.log('  ' + (passed ? 'pass' : 'FAIL') + '  ' + label + suffix);
}

export { root, repoDir, bodyFile, azPath, binDir, SECRET, isWindows, run, check, results, git, NL };

console.log('Azure DevOps script self-test' + NL);

const pre = run('preflight.mjs', []);
check('preflight reports ready', pre.json?.ready === true, pre.stderr.trim());
check(
  'context comes from the git remote',
  pre.json?.context?.org === 'contoso' && pre.json?.context?.project === 'Payments' && pre.json?.context?.repo === 'billing-api',
  JSON.stringify(pre.json?.context)
);
check('the stale az default did not beat the remote', pre.json?.context?.project !== 'Stale');
check('branch detected', pre.json?.branch === 'feat/csv-export', pre.json?.branch);

const dry = run('pr-create.mjs', ['--title=feat: export CSV', '--description-file=' + bodyFile, '--dry-run']);
check('pr-create --dry-run reports not executed', dry.json?.executed === false, dry.stderr.trim());
check('pr-create --dry-run prints the command', String(dry.json?.command ?? '').includes('repos pr create'));
check(
  'pr-create --dry-run never calls az to write',
  !dry.newCalls.some((c) => c.join(' ').startsWith('repos pr create')),
  JSON.stringify(dry.newCalls)
);

const created = run('pr-create.mjs', ['--title=feat: export CSV', '--description-file=' + bodyFile]);
check('pr-create creates when none is open', created.json?.action === 'created', created.stderr.trim());
check('pr-create defaults to draft', created.json?.draft === true);
check('a draft is quadrant Q2', created.json?.quadrant === 'review after');
check(
  'the description goes as a file, not on the command line',
  created.newCalls.some((c) => c.some((a) => a.startsWith('@'))),
  JSON.stringify(created.newCalls.at(-1))
);
check('a browsable url comes back', String(created.json?.pullRequest?.url ?? '').includes('/pullrequest/501'));

const updated = run('pr-create.mjs', ['--title=x', '--description-file=' + bodyFile], { AZ_EXISTING_PR: '1' });
check('pr-create updates when one is already open', updated.json?.action === 'updated', updated.stderr.trim());

const published = run('pr-create.mjs', ['--title=x', '--description-file=' + bodyFile, '--publish'], { AZ_EXISTING_PR: '1' });
check('publishing is quadrant Q3', published.json?.quadrant === 'confirm before', published.stderr.trim());

const comment = run('pr-comment.mjs', ['--pr=482', '--file=src/api/list.ts', '--line=42', '--content=off by one', '--dry-run']);
check('a comment anchors to file and line', comment.json?.anchor === '/src/api/list.ts:42', comment.json?.anchor);
check('a comment builds a threads request', String(comment.json?.command ?? '').includes('/threads'), comment.stderr.trim());
check('a comment is quadrant Q2', comment.json?.quadrant === 'review after');

const pipeline = run('pipeline-run.mjs', ['--name=billing-api CI', '--dry-run']);
check('a pipeline run is quadrant Q3', pipeline.json?.quadrant === 'confirm before', pipeline.stderr.trim());
check('a dry run does not queue', pipeline.json?.executed === false);

const release = run('pipeline-run.mjs', ['--name=billing-api Release prod']);
check('a release pipeline is refused', release.code === 2, 'exit ' + release.code);
check('the refusal names the quadrant', /Q4/.test(release.stderr));
check('the refusal hands over the command', /az pipelines run/.test(release.stderr));
check('the refusal happens before any az call', release.newCalls.length === 0, JSON.stringify(release.newCalls));

const status = run('pipeline-status.mjs', ['--id=48213']);
check('pipeline-status reports a pass', status.json?.passed === true, status.stderr.trim());

const missing = run('preflight.mjs', [], { HARNESS_AZ_BIN: path.join(binDir, 'does-not-exist') });
check('a missing az fails closed', missing.code === 2, 'exit ' + missing.code);
check('a missing az explains the fix', /az extension add|Install the Azure CLI/.test(missing.stderr));

const leakyFile = path.join(repoDir, 'leaky.md');
fs.writeFileSync(leakyFile, 'token: Bearer ' + SECRET + NL, 'utf8');
const leaky = run('pr-create.mjs', ['--title=x', '--description-file=' + leakyFile, '--dry-run']);
check(
  'a credential in the description never reaches the output',
  !leaky.stdout.includes(SECRET) && !leaky.stderr.includes(SECRET)
);

const plain = path.join(root, 'plain');
fs.mkdirSync(plain);
git(['init', '-q'], plain);
const orphan = run('preflight.mjs', [], {}, plain);
check('a non Azure DevOps repository is refused clearly', orphan.code === 2 && /--org=/.test(orphan.stderr), orphan.stderr.trim());

if (isWindows) {
  check('the windows comspec path really ran az', pre.json?.ready === true);
  const percent = run('pr-create.mjs', ['--title=100% done', '--description-file=' + bodyFile]);
  check(
    'an unquotable title is refused, not escaped hopefully',
    percent.code === 2 && /cannot be passed safely/.test(percent.stderr),
    percent.stderr.trim()
  );
}

const failed = results.filter((r) => !r.passed);
console.log(NL + '  ' + (results.length - failed.length) + ' passed, ' + failed.length + ' failed');
console.log('  sandbox: ' + root);
process.exit(failed.length === 0 ? 0 : 1);
