#!/usr/bin/env node
/**
 * Proves the guardrails refuse what they claim to refuse, and only that.
 *
 * Every case here exists because the previous version got it wrong: scanning
 * the working tree instead of the index, a policy gate failing open when git
 * was unavailable, and a credential regex that matched none of the formats an
 * AWS or Kubernetes repository is actually made of. The credential scanner is
 * advisory by decision, so its cases assert a warning and a record, never a
 * refusal.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { valueId, addAllow, globToRegExp } from './lib/allowlist.mjs';
import { userMcpFiles } from './lib/crosstk.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const script = (name) => path.join(HERE, name + '.mjs');
const DOLLAR = String.fromCharCode(36);

/** Assembled at runtime so no credential-shaped literal lives in the repository. */
const FAKE_AWS_ID = ['AKIA', 'Z7Q4M2N8', 'P1R5T3V6'].join('');
const FAKE_AWS_SECRET = ['wJalrXUtnFEMI', 'K7MDENGbPxRfi', 'CYzzLbGm1nQq'].join('');

const results = [];

function sandbox() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-selftest-'));
  const git = (...args) => execFileSync('git', args, { cwd: dir, stdio: 'ignore' });
  git('init', '-q');
  git('config', 'user.email', 'selftest@example.com');
  git('config', 'user.name', 'selftest');
  return { dir, git };
}

function runGuardrail(name, cwd) {
  return spawnSync(process.execPath, [script(name)], { cwd, encoding: 'utf8' });
}

function runHook(name, payload, cwd = undefined, extraEnv = {}) {
  const r = spawnSync(process.execPath, [script(name)], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
    cwd,
    env: { ...process.env, ...extraEnv, HARNESS_HOOK_MODE: 'vscode' },
  });
  try {
    return JSON.parse(r.stdout || '{}');
  } catch {
    return {};
  }
}

function runKiroHook(name, payload, cwd = undefined) {
  const r = spawnSync(process.execPath, [script(name), '--hook-mode=kiro'], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
    cwd,
    env: { ...process.env, HARNESS_HOOK_MODE: '' },
  });
  try {
    return JSON.parse(r.stdout || '{}');
  } catch {
    return {};
  }
}

function check(label, actual, expected) {
  const pass = actual === expected;
  results.push(pass);
  const detail = pass ? '' : '  (got ' + actual + ', wanted ' + expected + ')';
  console.log('  ' + (pass ? 'pass' : 'FAIL') + '  ' + label + detail);
}

const write = (dir, file, body) => {
  const full = path.join(dir, file);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, body);
  return full;
};

console.log('Guardrail self-test\n');
console.log('secret-block: index versus working tree');

/* secret-block is advisory: a finding is a warning on stderr plus a line in
   .harness/secrets.log with the value redacted, and the exit code is always
   zero. "Warned" and "clean" are the two outcomes worth telling apart. */
const secretsLog = (dir) => {
  try {
    return fs.readFileSync(path.join(dir, '.harness', 'secrets.log'), 'utf8');
  } catch {
    return '';
  }
};
const warned = (r, dir) => r.status === 0 && /secret-block: WARNING/.test(r.stderr) && secretsLog(dir).trim() !== '';
const clean = (r, dir) => r.status === 0 && !/WARNING/.test(r.stderr) && secretsLog(dir) === '';

{
  const { dir, git } = sandbox();
  write(dir, 'creds.js', 'const key = "' + FAKE_AWS_ID + '";\n');
  git('add', 'creds.js');
  // The bypass the previous version allowed: stage the secret, then clean the
  // file on disk. The commit still records the staged blob.
  write(dir, 'creds.js', 'const key = process.env.AWS_KEY;\n');
  const r = runGuardrail('secret-block', dir);
  check('warns about a secret staged but edited out of the working tree, and lets the commit through', warned(r, dir), true);
  check('the record names the pattern and never carries the value', /AWS access key id/.test(secretsLog(dir)) && !secretsLog(dir).includes(FAKE_AWS_ID), true);
  check('the warning says the value must be rotated', /rotate/.test(r.stderr), true);
}

{
  const { dir, git } = sandbox();
  write(dir, 'clean.js', 'export const a = 1;\n');
  git('add', 'clean.js');
  // The false positive the previous version produced: an unstaged secret
  // elsewhere in the tree must not warn about a clean staged hunk.
  write(dir, 'notes.txt', 'AWS_SECRET_ACCESS_KEY=' + FAKE_AWS_SECRET + '\n');
  check('stays quiet on a clean staged file while an unstaged secret sits nearby', clean(runGuardrail('secret-block', dir), dir), true);
}

console.log('\nsecret-block: formats the previous version missed');

const missedFormats = [
  ['a shell export without quotes', 'deploy.sh', 'export AWS_SECRET_ACCESS_KEY=' + FAKE_AWS_SECRET + '\n'],
  ['a tfvars assignment', 'prod.tfvars', 'db_password = "SuperSecretProd123"\n'],
  ['a Kubernetes Secret value', 'secret.yaml', 'kind: Secret\ndata:\n  password: c3VwZXJzZWNyZXRwYXNzd29yZA==\n'],
  ['a CloudFormation parameter default', 'template.yaml', 'Parameters:\n  DbPassword:\n    Type: String\n    Default: Pr0dPassw0rd2024\n'],
  ['a connection URL with credentials', 'app.ini', 'url=postgres://admin:Pr0dPassw0rd@db.internal:5432/app\n'],
];

for (const [label, file, body] of missedFormats) {
  const { dir, git } = sandbox();
  write(dir, file, body);
  git('add', file);
  check('warns about ' + label, warned(runGuardrail('secret-block', dir), dir), true);
}

{
  const { dir, git } = sandbox();
  write(dir, 'settings.yaml', 'password: ' + DOLLAR + '{DB_PASSWORD}\ntoken: !Ref ApiToken\napi_key: your-key-here\n');
  git('add', 'settings.yaml');
  check('stays quiet on references and placeholders in a file it does scan', clean(runGuardrail('secret-block', dir), dir), true);
}

{
  const { dir, git } = sandbox();
  const utf16 = Buffer.concat([
    Buffer.from([0xff, 0xfe]),
    Buffer.from('AWS_SECRET_ACCESS_KEY=' + FAKE_AWS_SECRET + '\n', 'utf16le'),
  ]);
  fs.writeFileSync(path.join(dir, 'env.config'), utf16);
  git('add', 'env.config');
  check('warns about a UTF-16 file, which PowerShell writes by default', warned(runGuardrail('secret-block', dir), dir), true);
}

{
  const { dir, git } = sandbox();
  write(dir, 'fixture.js', 'const key = "' + FAKE_AWS_ID + '"; // harness:allow-secret\n');
  git('add', 'fixture.js');
  check('honours the harness:allow-secret marker without recording it', clean(runGuardrail('secret-block', dir), dir), true);
}

/* A person marks a false positive once, in the committed .harness-allow.json,
   and the scanner is quiet about that value or that path everywhere after,
   under both entry points. The id is the handle: printed with the warning,
   written to the record, derived from the value alone. */
console.log('\nsecret-block: marking a false positive');

{
  const { dir, git } = sandbox();
  write(dir, 'fixture.js', 'const key = "' + FAKE_AWS_ID + '";\n');
  git('add', 'fixture.js');
  const first = runGuardrail('secret-block', dir);
  const id = /id: ([0-9a-f]{16})/.exec(first.stderr)?.[1] ?? null;
  check('the warning prints a 16 hex id for the value', id !== null, true);
  check('the warning tells how to mark it', /harness secrets .*--allow=/.test(first.stderr), true);
  check('the record carries the same id', new RegExp('"id":"' + id + '"').test(secretsLog(dir)), true);
  check('the id is derived from the value alone', id, valueId(FAKE_AWS_ID));

  fs.rmSync(path.join(dir, '.harness'), { recursive: true, force: true });
  addAllow(dir, { id, why: 'documented fixture key, not live' });
  write(dir, 'other.js', 'export const k = "' + FAKE_AWS_ID + '";\n');
  git('add', 'other.js');
  check('once marked, the same value in another file is quiet', clean(runGuardrail('secret-block', dir), dir), true);
  const hook = runHook(
    'secret-block',
    { hook_event_name: 'PreToolUse', tool_name: 'editFiles', tool_input: { filePath: path.join(dir, 'x.ts'), content: 'const k = "' + FAKE_AWS_ID + '";' } },
    dir
  );
  check('and quiet in a tool payload too', hook.hookSpecificOutput?.permissionDecision === 'allow' && hook.systemMessage === undefined && secretsLog(dir) === '', true);
  check('marking the same id twice changes nothing', addAllow(dir, { id, why: 'again' }), null);
  check('an entry without a reason is refused', (() => { try { addAllow(dir, { id: 'ffffffffffffffff' }); return false; } catch { return true; } })(), true);
  check('the list never holds the value', !fs.readFileSync(path.join(dir, '.harness-allow.json'), 'utf8').includes(FAKE_AWS_ID), true);
}

{
  const { dir, git } = sandbox();
  addAllow(dir, { path: 'tests/fixtures/**', why: 'synthetic data only' });
  write(dir, 'tests/fixtures/aws.yaml', 'secret_access_key: ' + FAKE_AWS_SECRET + '\n');
  write(dir, 'src/real.js', 'const secret_access_key = "' + FAKE_AWS_SECRET + '";\n');
  git('add', 'tests/fixtures/aws.yaml', 'src/real.js');
  const r = runGuardrail('secret-block', dir);
  check('a path rule silences findings under the glob', !/tests\/fixtures\/aws\.yaml/.test(r.stderr), true);
  check('and leaves the same value outside the glob warning', /src\/real\.js/.test(r.stderr) && warned(r, dir), true);
  const inside = runHook(
    'secret-block',
    { hook_event_name: 'PreToolUse', tool_name: 'editFiles', tool_input: { filePath: path.join(dir, 'tests', 'fixtures', 'b.yaml'), content: 'secret_access_key: ' + FAKE_AWS_SECRET } },
    dir
  );
  check('the path rule matches an absolute tool path inside the repository', inside.systemMessage === undefined, true);
  const outside = runHook(
    'secret-block',
    { hook_event_name: 'PreToolUse', tool_name: 'editFiles', tool_input: { filePath: path.join(dir, 'src', 'b.yaml'), content: 'secret_access_key: ' + FAKE_AWS_SECRET } },
    dir
  );
  check('and not a path outside the glob', typeof outside.systemMessage === 'string', true);
  write(dir, '.harness-allow.json', '{ not json');
  git('add', 'src/real.js');
  check('a list that does not parse silences nothing', warned(runGuardrail('secret-block', dir), dir), true);
}

{
  const cases = [
    ['tests/fixtures/**', 'tests/fixtures/a/b.json', true],
    ['tests/fixtures/**', 'tests/other.json', false],
    ['**/*.snap', 'a.snap', true],
    ['**/*.snap', 'x/y/a.snap', true],
    ['src/*.ts', 'src/a.ts', true],
    ['src/*.ts', 'src/deep/a.ts', false],
    ['config/app.json', 'config/app.json', true],
    ['config/app.json', 'config/appXjson', false],
  ];
  check('glob rules match what they say and nothing more', cases.every(([g, p, want]) => globToRegExp(g).test(p) === want), true);
}

/* Advisory means advisory when the scanner itself cannot run: it says so,
   records that it did not scan, and never turns its own failure into a block.
   policy-gate keeps failing closed; the two are tested apart on purpose. */
console.log('\nsecret-block: cannot scan');

{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-nogit-'));
  const r = runGuardrail('secret-block', dir);
  check('warns instead of blocking when it is not in a git work tree', r.status === 0 && /WARNING/.test(r.stderr), true);
  check('says why it could not scan', /could not scan/.test(r.stderr) && /git work tree/.test(r.stderr), true);
}

{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-nogit-'));
  const r = runGuardrail('policy-gate', dir);
  check('policy-gate still refuses when it cannot verify', r.status !== 0 && /cannot verify/.test(r.stderr), true);
}

console.log('\npolicy-gate');

const policyCases = [
  ['a .env file', '.env', 'TOKEN=abc\n', true],
  ['Terraform state', 'terraform.tfstate', '{"version":4}\n', true],
  ['a kubeconfig', 'kubeconfig', 'apiVersion: v1\n', true],
  ['a cloud service account key', 'sa-key.json', '{"type":"service_account"}\n', true],
  ['a private key file', 'server.key', '-----BEGIN PRIVATE KEY-----\nabc\n', true],
  ['the example env file', '.env.example', 'TOKEN=\n', false],
  ['a public certificate chain', 'chain.pem', '-----BEGIN CERTIFICATE-----\nabc\n', false],
  ['a registry-only npmrc', '.npmrc', 'registry=https://registry.npmjs.org/\n', false],
];

for (const [label, file, body, shouldBlock] of policyCases) {
  const { dir, git } = sandbox();
  write(dir, file, body);
  git('add', '-f', file);
  const verb = shouldBlock ? 'refuses ' : 'allows ';
  check(verb + label, runGuardrail('policy-gate', dir).status !== 0, shouldBlock);
}

{
  const { dir, git } = sandbox();
  write(dir, 'ops/keystore.jks', 'placeholder content harness:allow-file\n');
  git('add', '-f', 'ops/keystore.jks');
  check('honours the harness:allow-file marker', runGuardrail('policy-gate', dir).status === 0, true);
}

console.log('\nVS Code hook protocol');

{
  const { dir } = sandbox();
  const out = runHook(
    'secret-block',
    {
      hook_event_name: 'PreToolUse',
      tool_name: 'editFiles',
      tool_input: { filePath: 'src/aws.ts', content: 'const k = "' + FAKE_AWS_ID + '";' },
    },
    dir
  );
  check('allows a credential inside a tool payload, with a warning the model sees', out.hookSpecificOutput?.permissionDecision === 'allow' && /looks like a AWS access key id/.test(out.systemMessage ?? ''), true);
  check('the warning says it was recorded and must be rotated', /recorded/.test(out.systemMessage ?? '') && /rotated/.test(out.systemMessage ?? ''), true);
  check('the record names the tool and never carries the value', /"event":"PreToolUse"/.test(secretsLog(dir)) && /"tool":"editFiles"/.test(secretsLog(dir)) && !secretsLog(dir).includes(FAKE_AWS_ID), true);
}

{
  const out = runHook('secret-block', {
    hook_event_name: 'PreToolUse',
    tool_name: 'editFiles',
    tool_input: { filePath: 'src/aws.ts', content: 'const k = process.env.AWS_KEY;' },
  });
  check('allows a clean tool payload', out.hookSpecificOutput?.permissionDecision, 'allow');
}

{
  const out = runHook('policy-gate', {
    hook_event_name: 'PreToolUse',
    tool_name: 'editFiles',
    tool_input: { filePath: 'infra/terraform.tfstate' },
  });
  check('denies writing Terraform state', out.hookSpecificOutput?.permissionDecision, 'deny');
}

{
  const out = runHook('destructive-git', {
    hook_event_name: 'PreToolUse',
    tool_name: 'runCommands',
    tool_input: { command: 'git push --force origin main' },
  });
  check('asks before a force push', out.hookSpecificOutput?.permissionDecision, 'ask');
}

{
  const out = runHook('session-context', { hook_event_name: 'SessionStart' });
  check('SessionStart returns additional context', typeof out.hookSpecificOutput?.additionalContext === 'string', true);
}

/* Two chats doing two unrelated adjustments are two open sessions. The start
   lists every one of them, with its phase and work branch, and never tells the
   second chat to wait for the first. */
{
  const { dir } = sandbox();
  const start = () => runHook('session-context', { hook_event_name: 'SessionStart' }, dir).hookSpecificOutput?.additionalContext ?? '';
  const session = (id, slug, phase, branch) =>
    write(dir, `specs/${id}-${slug}/session.md`, `# Session ${id}-${slug}\n\nid: ${id}\ntrack: patch\nbase branch: Production\nwork branch: ${branch}\nphase: ${phase}\n`);
  check('no session: the start says none is open', /## Open sessions\n\nNone\./.test(start()), true);
  session('001', 'export-label', 'implement', 'patch/export-label');
  session('002', 'retry-policy', 'review', 'fix/retry-policy');
  session('003', 'closed', 'done', 'patch/closed');
  const out = start();
  check('two open sessions are both listed, with phase and work branch',
    /## Open sessions \(2\)/.test(out) &&
      /- 001-export-label \(phase: implement, work branch: patch\/export-label\)/.test(out) &&
      /- 002-retry-policy \(phase: review, work branch: fix\/retry-policy\)/.test(out),
    true);
  check('the newest is shown in full and a closed one is not listed', /### Newest: 002-retry-policy/.test(out) && !/003-closed/.test(out), true);
  check('the start never forbids a second session', !/Do not start a new session/.test(out) && /\/feature starts another/.test(out), true);
}

/* The Azure DevOps quadrant gate: the decision has to come from the command,
   not from the agent remembering the rule. */
const adoGate = (command) =>
  runHook('ado-gate', {
    hook_event_name: 'PreToolUse',
    tool_name: 'runCommands',
    tool_input: { command },
  }).hookSpecificOutput?.permissionDecision;

{
  check('a draft pull request runs without asking', adoGate('node .github/tools/ado/pr-create.mjs --title=x --description-file=b.md'), 'allow');
  check('a comment runs without asking', adoGate('node .github/tools/ado/pr-comment.mjs --pr=1 --content=x'), 'allow');
  check('publishing a pull request asks first', adoGate('node .github/tools/ado/pr-create.mjs --title=x --description-file=b.md --publish'), 'ask');
  check('queueing a validation pipeline asks first', adoGate('node .github/tools/ado/pipeline-run.mjs --name=\"billing-api CI\"'), 'ask');
  check('a release pipeline is denied', adoGate('node .github/tools/ado/pipeline-run.mjs --name=\"Release prod\"'), 'deny');
  check('completing a merge is denied', adoGate('az repos pr update --id 5 --status completed'), 'deny');
  check('a dry run needs no gate', adoGate('node .github/tools/ado/pipeline-run.mjs --name=\"Release prod\" --dry-run'), 'allow');
}

/* read-guard: a credential file must not enter the context, on either path style.
   The content rule is exercised too: a public certificate in a .pem is allowed. */
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-rg-'));
  fs.writeFileSync(path.join(dir, '.env'), 'TOKEN=abc');
  fs.writeFileSync(path.join(dir, 'ca.pem'), '-----BEGIN CERTIFICATE-----');
  fs.writeFileSync(path.join(dir, 'srv.pem'), '-----BEGIN PRIVATE KEY-----');
  fs.mkdirSync(path.join(dir, '.aws'));
  fs.writeFileSync(path.join(dir, '.aws', 'credentials'), '[default]');
  const guard = (file) =>
    runHook('read-guard', {
      hook_event_name: 'PreToolUse',
      tool_name: 'readFile',
      tool_input: { filePath: path.join(dir, file) },
    }).hookSpecificOutput?.permissionDecision;
  check('read-guard denies reading an env file', guard('.env'), 'deny');
  check('read-guard denies a private key in a pem', guard('srv.pem'), 'deny');
  check('read-guard allows a public certificate pem', guard('ca.pem'), 'allow');
  check('read-guard denies the aws credentials file', guard(path.join('.aws', 'credentials')), 'deny');
}

// Kiro passes the mode in argv and carries no env block, so every decision has
// to come out the same way through both doors. A guardrail that only works
// under one runtime is a guardrail nobody can rely on.
{
  const { dir } = sandbox();
  fs.writeFileSync(path.join(dir, '.env'), 'TOKEN=abc');
  fs.writeFileSync(path.join(dir, 'ca.pem'), '-----BEGIN CERTIFICATE-----');

  const cases = [
    ['read-guard', { hook_event_name: 'PreToolUse', tool_name: 'readFile', tool_input: { filePath: path.join(dir, '.env') } }],
    ['read-guard', { hook_event_name: 'PreToolUse', tool_name: 'readFile', tool_input: { filePath: path.join(dir, 'ca.pem') } }],
    ['secret-block', { hook_event_name: 'PreToolUse', tool_name: 'editFiles', tool_input: { filePath: 'src/aws.ts', content: 'const k = "' + FAKE_AWS_ID + '";' } }],
    ['destructive-git', { hook_event_name: 'PreToolUse', tool_name: 'runCommands', tool_input: { command: 'git push --force origin main' } }],
  ];

  // The expected decision is written down, so 'both returned nothing' cannot
  // pass as agreement. Case 3 is 'allow' because secret-block is advisory: the
  // credential goes through with a warning under both runtimes alike.
  const wanted = ['deny', 'allow', 'allow', 'ask'];
  cases.forEach(([name, payload], index) => {
    const viaEnv = runHook(name, payload, dir).hookSpecificOutput?.permissionDecision;
    const viaArgv = runKiroHook(name, payload, dir).hookSpecificOutput?.permissionDecision;
    check(name + ' decides ' + wanted[index] + ' under the vscode mode (case ' + (index + 1) + ')', viaEnv, wanted[index]);
    check(name + ' decides the same through --hook-mode=kiro (case ' + (index + 1) + ')', viaArgv, viaEnv);
  });

  const noMode = spawnSync(process.execPath, [script('read-guard')], {
    input: JSON.stringify(cases[0][1]),
    encoding: 'utf8',
    env: { ...process.env, HARNESS_HOOK_MODE: '' },
  });
  check('with no mode at all the hook stays a git hook and emits nothing', noMode.stdout.trim(), '');
}

/* burn-detect: the same file read three times without changing is circling;
   the same file read again after an edit is checking the edit. */
console.log('\nburn-detect: repetition that does and does not mean circling');

{
  const { dir } = sandbox();
  const file = write(dir, 'src/app.js', 'export const a = 1;\n');
  const session = 'burn-' + process.pid;
  const read = (input) =>
    runHook(
      'burn-detect',
      { hook_event_name: 'PostToolUse', session_id: session, tool_name: 'readFile', tool_input: input },
      dir
    );
  read({ filePath: file });
  const second = read({ filePath: file });
  const third = read({ filePath: file, startLine: 1, endLine: 5 });
  check('two reads of an unchanged file pass quietly', second.systemMessage === undefined, true);
  check('a third read of the same path warns, even as a different slice', typeof third.systemMessage === 'string', true);
  check('the warning says the file did not change in between', /without changing in between/.test(third.systemMessage ?? ''), true);

  write(dir, 'src/app.js', 'export const a = 2;\n');
  read({ filePath: file });
  const afterEdit = read({ filePath: file });
  check('re-reading a file after editing it does not warn', afterEdit.systemMessage === undefined, true);
  check('but the third read of the new content does', typeof read({ filePath: file }).systemMessage === 'string', true);

  const run = () =>
    runHook(
      'burn-detect',
      { hook_event_name: 'PostToolUse', session_id: session, tool_name: 'runCommands', tool_input: { command: 'npm test' } },
      dir
    );
  const outputs = [];
  for (let i = 0; i < 10; i += 1) outputs.push(run());
  check('the fourth identical command passes quietly', outputs[3].systemMessage === undefined, true);
  check('the fifth identical command warns', typeof outputs[4].systemMessage === 'string', true);
  check('the sixth is quiet again, so the warning is not a nag', outputs[5].systemMessage === undefined, true);
  check('the tenth warns again, because it is still circling', typeof outputs[9].systemMessage === 'string', true);
}

/* session-context: whether a token-saving server is configured is said once,
   by name, so no turn is spent probing for it. */
console.log('\nsession-context: Cross TK discovery by name');

{
  const { dir } = sandbox();
  const context = () => runHook('session-context', { hook_event_name: 'SessionStart' }, dir).hookSpecificOutput?.additionalContext ?? '';
  check('reports that no cross-tk server is configured', /No server matching cross-tk/.test(context()), true);
  write(dir, '.mcp.json', JSON.stringify({ servers: { 'cross-tk': { command: 'x' } } }));
  check('reports a configured cross-tk server by name and file', /`cross-tk` is configured in `\.mcp\.json`/.test(context()), true);
  write(dir, '.mcp.json', JSON.stringify({ servers: {}, disabled: { 'cross-tk': { command: 'x' } } }));
  check('a server left in the disabled block counts as absent', /No server matching cross-tk/.test(context()), true);
  write(dir, '.mcp.json', JSON.stringify({ mcpServers: { CrossTK: { command: 'x', disabled: true } } }));
  check('a Kiro-style server marked disabled counts as absent', /No server matching cross-tk/.test(context()), true);
  write(dir, '.mcp.json', JSON.stringify({ mcpServers: { crosstk: { command: 'x' } } }));
  check('any spelling of the name is found', /`crosstk` is configured/.test(context()), true);
  write(dir, '.mcp.json', '{ not json');
  fs.mkdirSync(path.join(dir, '.vscode'), { recursive: true });
  write(dir, '.vscode/mcp.json', JSON.stringify({ servers: { 'cross_tk': { command: 'x' } } }));
  check('a file that does not parse is skipped and the next one is read', /`cross_tk` is configured in `\.vscode\/mcp\.json`/.test(context()), true);
}

/* crosstk-first: with a Cross TK server declared, the first built-in read of a
   session is refused until a Cross TK tool has been used; without one, or once
   it has been used, everything passes. The rule is only worth having if the
   runtime enforces it. */
console.log('\ncrosstk-first: the first read goes through Cross TK');

{
  const { dir } = sandbox();
  const session = 'ctk-' + process.pid;
  const call = (tool_name, extra = {}, sid = session) =>
    runHook('crosstk-first', { hook_event_name: 'PreToolUse', session_id: sid, tool_name, tool_input: { filePath: path.join(dir, 'a.ts') }, ...extra }, dir);
  const decision = (out) => out.hookSpecificOutput?.permissionDecision;

  check('no server declared: a read passes', decision(call('readFile')), 'allow');

  write(dir, '.mcp.json', JSON.stringify({ servers: { 'cross-tk': { command: 'x' } } }));
  const refused = call('readFile');
  check('server declared: the first built-in read is refused', decision(refused), 'deny');
  check('the refusal names the server and says what to do', /Cross TK first: `cross-tk`/.test(refused.hookSpecificOutput?.permissionDecisionReason ?? '') && /descriptions/.test(refused.hookSpecificOutput?.permissionDecisionReason ?? ''), true);
  check('a search is refused too', decision(call('textSearch')), 'deny');
  check('an edit is not a read, so it passes', decision(call('editFiles')), 'allow');
  check('delegating to a sub-agent passes', decision(call('agent')), 'allow');
  check('a Cross TK tool, named after the server, passes and unlocks the session', decision(call('mcp_cross-tk_outline')), 'allow');
  check('after that, a built-in read passes as the fallback', decision(call('readFile')), 'allow');
  check('a different session is gated on its own', decision(call('readFile', {}, session + '-other')), 'deny');

  write(dir, '.mcp.json', JSON.stringify({ servers: { 'cross-tk': { command: 'x', tools: ['compact_read'] } } }));
  const fresh = session + '-declared';
  check('an unknown tool name is not gated, so an unrecorded Cross TK tool can never lock the session out', decision(call('compact_read_file', {}, fresh)), 'allow');
  check('while a built-in read handed over with its source prefix still is', decision(call('search/codebase', {}, fresh)), 'deny');
  check('but the declared tool name is recognised and unlocks', decision(call('compact_read', {}, fresh)) === 'allow' && decision(call('readFile', {}, fresh)) === 'allow', true);

  write(dir, '.mcp.json', JSON.stringify({ servers: { 'cross-tk': { command: 'x', mandatoryFirst: false } } }));
  const advisory = session + '-advisory';
  const first = call('readFile', {}, advisory);
  check('mandatoryFirst false: the first read passes with a reminder', decision(first) === 'allow' && /advisory/.test(first.systemMessage ?? ''), true);
  check('and the reminder is said once', call('readFile', {}, advisory).systemMessage === undefined, true);

  write(dir, '.mcp.json', JSON.stringify({ servers: { 'cross-tk': { command: 'x' } } }));
  const kiro = session + '-kiro';
  const viaEnv = decision(runHook('crosstk-first', { hook_event_name: 'PreToolUse', session_id: kiro, tool_name: 'readFile', tool_input: {} }, dir));
  const viaArgv = decision(runKiroHook('crosstk-first', { hook_event_name: 'PreToolUse', session_id: kiro + '2', tool_name: 'readFile', tool_input: {} }, dir));
  check('the same refusal comes out under the vscode mode and --hook-mode=kiro', viaEnv === 'deny' && viaArgv === 'deny', true);

  const start = runHook('session-context', { hook_event_name: 'SessionStart' }, dir).hookSpecificOutput?.additionalContext ?? '';
  check('the session start says the first read is mandatory', /Mandatory, before anything else/.test(start) && /refused until/.test(start), true);
}

/* The first run records what the agent saw in its tool list, in
   .harness/crosstk.json: no declaration in the repository is needed, no tool
   name is written anywhere shared, and from then on the gate arms and the
   calls are recognised by the recorded names, whole or by last segment. */
{
  const { dir } = sandbox();
  const session = 'ctk-rec-' + process.pid;
  const call = (tool_name, sid = session) =>
    runHook('crosstk-first', { hook_event_name: 'PreToolUse', session_id: sid, tool_name, tool_input: {} }, dir).hookSpecificOutput?.permissionDecision;
  const start = () => runHook('session-context', { hook_event_name: 'SessionStart' }, dir).hookSpecificOutput?.additionalContext ?? '';

  check('nothing known: the session start asks for the first-run discovery', /no first run has recorded one/.test(start()) && /Look for it in your tool list/.test(start()), true);
  check('nothing known: reads pass', call('readFile'), 'allow');

  write(dir, '.harness/crosstk.json', JSON.stringify({ server: 'acme-tk', tools: ['acme/acme-tk/outline_file', 'acme/acme-tk/search_lines'], discoveredAt: '2026-09-10' }));
  check('a record without any declaration arms the gate', call('readFile'), 'deny');
  check('the session start names the recorded server and its tools', /`acme-tk` was recorded in `\.harness\/crosstk\.json` on 2026-09-10/.test(start()) && /outline_file, acme\/acme-tk\/search_lines/.test(start()), true);
  check('a recorded name handed to the hook whole is recognised', call('acme/acme-tk/outline_file', session + '-whole'), 'allow');
  check('a recorded name handed to the hook as its last segment is recognised', call('search_lines', session + '-seg'), 'allow');
  check('and unlocks the reads that follow', call('readFile', session + '-seg'), 'allow');
  check('a name that is not recorded stays a refused read', call('list_dir', session + '-other'), 'deny');

  write(dir, '.harness/crosstk.json', JSON.stringify({ server: '', tools: ['x'] }));
  check('a record without a server name records nothing', call('readFile', session + '-empty'), 'allow');
  write(dir, '.harness/crosstk.json', '{ not json');
  check('a record that does not parse records nothing', call('readFile', session + '-bad'), 'allow');
}

/* A server configured in the user's own VS Code or Kiro profile is connected
   in every workspace, so it is found there too; otherwise the session start
   would tell the agent the server does not exist while it sits next to it. */
{
  const { dir } = sandbox();
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-home-'));
  const env = { HOME: home, USERPROFILE: home, APPDATA: home };
  const session = 'ctk-user-' + process.pid;
  const start = () => runHook('session-context', { hook_event_name: 'SessionStart' }, dir, env).hookSpecificOutput?.additionalContext ?? '';
  const read = (sid) =>
    runHook('crosstk-first', { hook_event_name: 'PreToolUse', session_id: sid, tool_name: 'readFile', tool_input: {} }, dir, env).hookSpecificOutput?.permissionDecision;

  check('an empty profile: nothing is found and reads pass', /No server matching cross-tk/.test(start()) && read(session) === 'allow', true);
  const [defaultProfile] = userMcpFiles({ home, appData: home });
  fs.mkdirSync(path.dirname(defaultProfile), { recursive: true });
  fs.writeFileSync(defaultProfile, JSON.stringify({ servers: { 'cross-tk': { command: 'x' } } }));
  check('a server in the VS Code user profile is found and said to be global', /`cross-tk` is configured in your user profile/.test(start()) && /every workspace/.test(start()), true);
  check('and it arms the gate with no file in the repository', read(session + '-2'), 'deny');
  fs.writeFileSync(defaultProfile, JSON.stringify({ servers: { 'cross-tk': { command: 'x', disabled: true } } }));
  check('disabled in the profile counts as absent', read(session + '-3'), 'allow');
  const kiro = userMcpFiles({ home, appData: home }).at(-1);
  fs.mkdirSync(path.dirname(kiro), { recursive: true });
  fs.writeFileSync(kiro, JSON.stringify({ mcpServers: { crosstk: { command: 'x' } } }));
  check('a server in the Kiro user settings is found too', /`crosstk` is configured in your user profile/.test(start()), true);
}

/* format: as an agent hook it fires after every tool call, and only an edit
   can leave something to format, so a read must cost nothing. */
console.log('\nformat: only an edit reaches the formatter');

{
  const { dir, git } = sandbox();
  const marker = path.join(dir, 'formatted.marker');
  write(dir, 'package.json', JSON.stringify({ name: 'x', scripts: { format: 'node -e "require(\'fs\').writeFileSync(\'' + marker.replace(/\\/g, '\\\\') + '\', \'1\')"' } }));
  write(dir, 'a.js', 'x\n');
  git('add', 'package.json', 'a.js');
  const call = (tool_name) => spawnSync(process.execPath, [script('format')], {
    input: JSON.stringify({ hook_event_name: 'PostToolUse', tool_name, tool_input: {} }),
    encoding: 'utf8',
    cwd: dir,
    env: { ...process.env, HARNESS_HOOK_MODE: 'vscode' },
  });
  call('readFile');
  check('a read does not run the formatter', fs.existsSync(marker), false);
  call('editFiles');
  check('an edit does', fs.existsSync(marker), true);
}

/* tool-hooks: VS Code runs every PreToolUse and PostToolUse hook on every
   tool call and ignores matchers, so the eight tool guardrails run in one
   process per event, in a fixed order, with one stdin read and one git
   lookup. Their answers combine the way the runtime combines them. */
console.log('\ntool-hooks: one process per tool event');

{
  const { dir } = sandbox();
  const pre = (tool_name, tool_input, extra = {}) =>
    runHook('tool-hooks', { hook_event_name: 'PreToolUse', session_id: 'th-' + process.pid, tool_name, tool_input, ...extra }, dir);
  const decision = (r) => r.hookSpecificOutput?.permissionDecision;
  write(dir, 'a.txt', 'plain\n');

  const plain = pre('readFile', { filePath: path.join(dir, 'a.txt') });
  check('a plain read is allowed with no message', decision(plain) === 'allow' && plain.systemMessage === undefined, true);
  write(dir, '.env', 'TOKEN=abc\n');
  check('deny wins: read-guard refuses a .env read through the dispatcher', decision(pre('readFile', { filePath: path.join(dir, '.env') })), 'deny');
  check('ask propagates: destructive-git asks before a force push', decision(pre('runCommands', { command: 'git push --force origin main' })), 'ask');
  check('deny outranks ask when both fire on one call', decision(pre('runCommands', { command: 'git push --force origin main && az repos pr update --status completed' })), 'deny');
  const warned = pre('editFiles', { filePath: path.join(dir, 'x.ts'), content: 'const k = "' + FAKE_AWS_ID + '";' });
  check('an allow keeps its warning: the secret-block message comes through', decision(warned) === 'allow' && /looks like a AWS access key id/.test(warned.systemMessage ?? ''), true);
  check('policy-gate denies through the dispatcher too', decision(pre('editFiles', { filePath: path.join(dir, 'infra', 'terraform.tfstate') })), 'deny');

  write(dir, '.mcp.json', JSON.stringify({ servers: { 'cross-tk': { command: 'x' } } }));
  const sid = 'th-ctk-' + process.pid;
  check('the Cross TK gate holds through the dispatcher', decision(pre('readFile', { filePath: path.join(dir, 'a.txt') }, { session_id: sid })), 'deny');
  check(
    'and a Cross TK call opens it for the reads that follow',
    decision(pre('cross-tk/read', {}, { session_id: sid })) === 'allow' && decision(pre('readFile', { filePath: path.join(dir, 'a.txt') }, { session_id: sid })) === 'allow',
    true
  );
  fs.rmSync(path.join(dir, '.mcp.json'));

  write(dir, 'b.txt', 'same\n');
  const post = () =>
    runHook('tool-hooks', { hook_event_name: 'PostToolUse', session_id: 'th-post-' + process.pid, tool_name: 'readFile', tool_input: { filePath: path.join(dir, 'b.txt') } }, dir);
  post();
  post();
  const third = post();
  check('PostToolUse runs burn-detect: the third unchanged read warns', /read 3 times/.test(third.systemMessage ?? ''), true);
  check('and a PostToolUse carries no permission decision', third.hookSpecificOutput?.permissionDecision, undefined);

  const noEvent = spawnSync(process.execPath, [script('tool-hooks')], {
    input: '{"tool_name":"readFile"}',
    encoding: 'utf8',
    cwd: dir,
    env: { ...process.env, HARNESS_HOOK_MODE: 'vscode' },
  });
  check('a payload without an event exits clean and silent', noEvent.status === 0 && noEvent.stdout.trim() === '', true);
  check('an event it does not own is ignored', Object.keys(runHook('tool-hooks', { hook_event_name: 'SessionStart' }, dir)).length, 0);
}

/* tree-state: one short line per state of the tree, so a verification result
   can be tied to the tree it ran on and reused only while that holds. */
console.log('\ntree-state: one line per state of the tree');

{
  const TREE_STATE = path.join(HERE, '..', '..', 'tools', 'verify', 'tree-state.mjs');
  const state = (cwd) => spawnSync(process.execPath, [TREE_STATE], { cwd, encoding: 'utf8' });
  const { dir, git } = sandbox();
  write(dir, 'a.txt', 'one\n');
  git('add', 'a.txt');
  git('-c', 'commit.gpgsign=false', 'commit', '-q', '-m', 'one');
  const clean = state(dir).stdout.trim();
  check('a clean tree is the short commit alone', /^[0-9a-f]{7,}$/.test(clean), true);
  write(dir, 'a.txt', 'two\n');
  const dirty = state(dir).stdout.trim();
  check('an uncommitted edit adds a suffix to the commit', dirty.startsWith(clean + '+') && dirty.length > clean.length + 1, true);
  check('the same edit reports the same state', state(dir).stdout.trim(), dirty);
  write(dir, 'b.txt', 'new\n');
  const withUntracked = state(dir).stdout.trim();
  check('an untracked file changes the state', withUntracked !== dirty, true);
  check('reverting the edit and removing the file restores the clean state', (fs.rmSync(path.join(dir, 'b.txt')), write(dir, 'a.txt', 'one\n'), state(dir).stdout.trim()), clean);
  const nogit = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-nogit-'));
  check('outside a repository it refuses instead of inventing a state', state(nogit).status, 2);
}

const failed = results.filter((ok) => !ok).length;
console.log('\n  ' + (results.length - failed) + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
