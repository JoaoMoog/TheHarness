#!/usr/bin/env node
/**
 * Guardrail: blocks files that must never enter history regardless of content,
 * plus oversized blobs that usually mean a build artifact was staged by mistake.
 *
 * Runs as a git pre-commit hook and as a VS Code PreToolUse hook on writes.
 */
import path from 'node:path';
import * as git from './lib/git.mjs';
import {
  readHookInput, isHookMode, toolFilePath, deny, allow, failSecure,
  EXIT_OK, EXIT_REFUSE,
} from './lib/io.mjs';

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ALLOW_MARKER = 'harness:allow-file';

/**
 * `content` narrows a rule to files that actually carry a secret: a .pem is
 * usually a public certificate chain and blocking every one of them trains
 * people to reach for --no-verify, which defeats the whole mechanism.
 */
const FORBIDDEN = [
  { re: /(^|\/)\.env(\.[a-z0-9_-]+)?$/i, why: 'environment file', except: /\.env\.(example|sample|template|dist)$/i },
  { re: /(^|\/)id_(rsa|dsa|ecdsa|ed25519)$/, why: 'private SSH key' },
  { re: /\.(pfx|p12|keystore|jks)$/i, why: 'key or certificate store' },
  { re: /\.pem$/i, why: 'PEM file containing a private key', content: /-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----/ },
  { re: /\.key$/i, why: 'private key', content: /-----BEGIN/ },
  { re: /(^|\/)\.npmrc$/, why: 'npm credentials file', content: /_auth|_authToken|_password/i },
  { re: /(^|\/)(secrets?|credentials?)\.(json|ya?ml)$/i, why: 'credential file' },
  { re: /\.tfstate(\.backup)?$/i, why: 'Terraform state, which stores secrets in clear text' },
  { re: /(^|\/)\.terraform\.lock\.hcl$/i, why: null },
  { re: /(^|\/)kubeconfig$|\.kubeconfig$/i, why: 'kubeconfig with cluster credentials' },
  { re: /(^|\/)\.aws\/credentials$/i, why: 'AWS credentials file' },
  { re: /(^|\/)(sa|service-account)[-_]?key\.json$/i, why: 'cloud service account key' },
  { re: /(^|\/)\.pypirc$|(^|\/)\.netrc$|(^|\/)\.docker\/config\.json$/i, why: 'stored registry credentials' },
];

function ruleFor(file, readContent) {
  for (const rule of FORBIDDEN) {
    if (!rule.re.test(file)) continue;
    if (!rule.why) return null;
    if (rule.except && rule.except.test(file)) continue;
    if (rule.content) {
      const text = readContent();
      if (text === null || !rule.content.test(text)) continue;
    }
    return rule;
  }
  return null;
}

function checkIndex() {
  if (!git.isInsideRepo()) {
    throw new git.GitUnavailable('not inside a git work tree, so the staged index cannot be read');
  }
  const violations = [];
  for (const file of git.stagedFiles()) {
    const read = () => {
      try {
        return git.decode(git.stagedContent(file)).text;
      } catch {
        return null;
      }
    };
    if (read()?.includes(ALLOW_MARKER)) continue;

    const rule = ruleFor(file, read);
    if (rule) violations.push(`${file}  ${rule.why}`);

    const size = git.stagedSize(file);
    if (size > MAX_FILE_BYTES) {
      violations.push(`${file}  ${(size / 1024 / 1024).toFixed(1)} MB exceeds the 5 MB limit`);
    }
  }
  return violations;
}

function runHook(input) {
  const file = toolFilePath(input);
  if (!file) return allow('PreToolUse');
  const rule = ruleFor(path.posix.normalize(String(file).split(path.sep).join('/')), () => null);
  if (!rule) return allow('PreToolUse');
  return deny(
    'PreToolUse',
    `Blocked: ${path.basename(String(file))} is a ${rule.why} and must not be written into the repository.`
  );
}

const input = await readHookInput();
try {
  if (isHookMode(input)) process.exit(runHook(input));
  const violations = checkIndex();
  if (violations.length === 0) process.exit(EXIT_OK);
  console.error('\nharness policy-gate: refused\n');
  for (const v of violations) console.error(`  ${v}`);
  console.error(`\nUnstage the file. If it is genuinely safe, add the comment ${ALLOW_MARKER} to it.`);
  console.error('Do not reach for --no-verify: that bypasses every guardrail at once.\n');
  process.exit(EXIT_REFUSE);
} catch (err) {
  process.exit(failSecure('policy-gate', err, isHookMode(input)));
}
