#!/usr/bin/env node
/**
 * Proves the guardrails refuse what they claim to refuse, and only that.
 *
 * Every case here exists because the previous version got it wrong: scanning
 * the working tree instead of the index, failing open when git was unavailable,
 * and a credential regex that matched none of the formats an AWS or Kubernetes
 * repository is actually made of.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

function runHook(name, payload) {
  const r = spawnSync(process.execPath, [script(name)], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
    env: { ...process.env, HARNESS_HOOK_MODE: 'vscode' },
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

{
  const { dir, git } = sandbox();
  write(dir, 'creds.js', 'const key = "' + FAKE_AWS_ID + '";\n');
  git('add', 'creds.js');
  // The bypass the previous version allowed: stage the secret, then clean the
  // file on disk. The commit still records the staged blob.
  write(dir, 'creds.js', 'const key = process.env.AWS_KEY;\n');
  check('refuses a secret staged but edited out of the working tree', runGuardrail('secret-block', dir).status !== 0, true);
}

{
  const { dir, git } = sandbox();
  write(dir, 'clean.js', 'export const a = 1;\n');
  git('add', 'clean.js');
  // The false positive the previous version produced: an unstaged secret
  // elsewhere in the tree must not refuse a clean staged hunk.
  write(dir, 'notes.txt', 'AWS_SECRET_ACCESS_KEY=' + FAKE_AWS_SECRET + '\n');
  check('allows a clean staged file while an unstaged secret sits nearby', runGuardrail('secret-block', dir).status === 0, true);
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
  check('refuses ' + label, runGuardrail('secret-block', dir).status !== 0, true);
}

{
  const { dir, git } = sandbox();
  write(dir, 'settings.yaml', 'password: ' + DOLLAR + '{DB_PASSWORD}\ntoken: !Ref ApiToken\napi_key: your-key-here\n');
  git('add', 'settings.yaml');
  check('allows references and placeholders in a file it does scan', runGuardrail('secret-block', dir).status === 0, true);
}

{
  const { dir, git } = sandbox();
  const utf16 = Buffer.concat([
    Buffer.from([0xff, 0xfe]),
    Buffer.from('AWS_SECRET_ACCESS_KEY=' + FAKE_AWS_SECRET + '\n', 'utf16le'),
  ]);
  fs.writeFileSync(path.join(dir, 'env.config'), utf16);
  git('add', 'env.config');
  check('refuses a UTF-16 file, which PowerShell writes by default', runGuardrail('secret-block', dir).status !== 0, true);
}

console.log('\nsecret-block: fail-secure');

{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-nogit-'));
  const r = runGuardrail('secret-block', dir);
  check('refuses when it is not in a git work tree', r.status !== 0, true);
  check('says why it refused', /cannot verify/.test(r.stderr), true);
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
  const out = runHook('secret-block', {
    hook_event_name: 'PreToolUse',
    tool_name: 'editFiles',
    tool_input: { filePath: 'src/aws.ts', content: 'const k = "' + FAKE_AWS_ID + '";' },
  });
  check('denies a credential inside a tool payload', out.hookSpecificOutput?.permissionDecision, 'deny');
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

const failed = results.filter((ok) => !ok).length;
console.log('\n  ' + (results.length - failed) + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
