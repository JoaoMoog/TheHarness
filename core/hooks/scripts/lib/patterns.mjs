/**
 * Credential detection.
 *
 * Two design rules, both learned from the previous version failing real cases:
 *
 *  1. No leading word boundary before the credential noun. AWS_SECRET_ACCESS_KEY
 *     and db_password are the NORMAL way to name these variables, and a leading
 *     \b never matches them because the preceding character is an underscore.
 *  2. Quotes are optional. .env, YAML, INI, shell export, tfvars, Dockerfile ENV
 *     and CloudFormation parameters carry no quotes, and those are exactly the
 *     formats an AWS or Kubernetes repository is made of.
 *
 * Every pattern captures the VALUE in group 1 (or the whole match where the
 * value is the match). Placeholder filtering is applied to that value only,
 * never to the surrounding line.
 */

const NAME = String.raw`[A-Za-z0-9_.\-]*(?:api[_-]?key|secret|password|passwd|pwd|token|credential|access[_-]?key|private[_-]?key)[A-Za-z0-9_.\-]*`;
const ASSIGN = String.raw`\s*[:=]\s*['"]?`;
const VALUE = String.raw`([^\s'",;#]{8,})`;

export const PATTERNS = [
  { name: 'AWS access key id', re: /\b((?:AKIA|ASIA|ABIA|ACCA)[0-9A-Z]{16})\b/, group: 1 },
  { name: 'private key block', re: /(-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----)/, group: 1 },
  { name: 'GitHub token', re: /\b(gh[pousr]_[A-Za-z0-9]{30,})\b/, group: 1 },
  { name: 'GitHub fine-grained token', re: /\b(github_pat_[A-Za-z0-9_]{20,})\b/, group: 1 },
  { name: 'Slack token', re: /\b(xox[abprs]-[A-Za-z0-9-]{10,})\b/, group: 1 },
  { name: 'Google API key', re: /\b(AIza[0-9A-Za-z_-]{35})\b/, group: 1 },
  { name: 'Stripe live key', re: /\b((?:sk|rk)_live_[0-9A-Za-z]{16,})\b/, group: 1 },
  { name: 'OpenAI key', re: /\b(sk-(?:proj-)?[A-Za-z0-9_-]{32,})\b/, group: 1 },
  { name: 'Azure storage key', re: /(?:AccountKey|SharedAccessSignature)=([A-Za-z0-9+/=]{20,})/, group: 1 },
  { name: 'JWT', re: /\b(eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{20,})\b/, group: 1 },
  {
    name: 'credential in connection URL',
    re: /[a-z][a-z0-9+.-]*:\/\/[^\s:/@]+:([^\s/@]{6,})@/i,
    group: 1,
  },
  {
    name: 'hardcoded credential',
    re: new RegExp(`${NAME}${ASSIGN}${VALUE}`, 'i'),
    group: 1,
  },
];

/** Values that are obviously not live credentials. Tested on the value alone. */
const PLACEHOLDER =
  /^(?:x{3,}|\*{3,}|\.{3,}|-{3,}|change[_-]?me|your[_-]|example|placeholder|dummy|fake|redacted|secret|password|token|todo|none|null|true|false|\d+)$/i;

const PLACEHOLDER_CONTAINS = /(?:xxx+|\*{4,}|<[^>]{1,40}>|change[_-]?me|your[_-]key|placeholder|redacted|\.\.\.)/i;

/** A reference to a credential is not a credential. This is the correct shape. */
const REFERENCE =
  /^(?:process\.env|os\.environ|System\.getenv|Environment\.|ENV\[|config\.|settings\.|secrets?\.|vault:|aws:|arn:|\$\{|\$\(|\{\{|<%|!Ref|!Sub|!GetAtt|@Microsoft\.KeyVault|valueFrom|secretKeyRef|fromSecret|#\{|%\()/i;

/** A value with no digit and under 16 chars is almost always a word, not a key. */
function looksLikeSecret(value) {
  if (value.length >= 16) return true;
  return /\d/.test(value);
}

export function isPlaceholder(value) {
  const v = value.trim().replace(/^['"]|['"]$/g, '');
  if (v.length < 8) return true;
  if (PLACEHOLDER.test(v)) return true;
  if (PLACEHOLDER_CONTAINS.test(v)) return true;
  if (REFERENCE.test(v)) return true;
  if (v.startsWith('$')) return true;
  return !looksLikeSecret(v);
}

/** Scans one line. Returns the finding, or null. */
export function scanLine(line) {
  for (const pattern of PATTERNS) {
    const match = pattern.re.exec(line);
    if (!match) continue;
    const value = match[pattern.group] ?? match[0];
    if (isPlaceholder(value)) continue;
    return { name: pattern.name, value };
  }
  return null;
}

const CREDENTIAL_KEY = new RegExp(String.raw`^\s*(` + NAME + String.raw`)\s*:\s*$`, 'i');
const DEFAULT_VALUE = /^\s*(?:Default|value|Value)\s*:\s*['"]?([^\s'",;#]{8,})['"]?\s*$/;

/**
 * CloudFormation and YAML put the credential noun on one line and the value on
 * another, so a line-at-a-time scan cannot see it:
 *
 *   DbPassword:
 *     Type: String
 *     Default: Pr0dPassw0rd
 *
 * This walks a short window forward from any credential-shaped key.
 */
export function scanStructured(lines) {
  const findings = [];
  const WINDOW = 4;
  for (let i = 0; i < lines.length; i += 1) {
    const key = CREDENTIAL_KEY.exec(lines[i]);
    if (!key) continue;
    for (let j = i + 1; j <= Math.min(i + WINDOW, lines.length - 1); j += 1) {
      if (CREDENTIAL_KEY.test(lines[j])) break;
      const value = DEFAULT_VALUE.exec(lines[j]);
      if (!value) continue;
      if (isPlaceholder(value[1])) break;
      findings.push({ line: j + 1, name: `default value for ${key[1]}`, value: value[1] });
      break;
    }
  }
  return findings;
}

/** Redacts a value so the guardrail never prints the secret it just found. */
export function redact(value) {
  if (value.length <= 8) return '*'.repeat(value.length);
  return `${value.slice(0, 4)}${'*'.repeat(Math.min(value.length - 8, 20))}${value.slice(-4)}`;
}

/**
 * Paths that must never enter history or an agent context, by name. Shared by
 * policy-gate (staging) and read-guard (reading), so the two lists cannot
 * drift apart. `content` narrows a rule to files that actually hold a secret,
 * so a public certificate in a .pem is not treated like a private key.
 */
export const FORBIDDEN_PATHS = [
  { re: /(^|[\\/])\.env(\.[a-z0-9_-]+)?$/i, why: 'environment file', except: /\.env\.(example|sample|template|dist)$/i },
  { re: /(^|[\\/])id_(rsa|dsa|ecdsa|ed25519)$/, why: 'private SSH key' },
  { re: /\.(pfx|p12|keystore|jks)$/i, why: 'key or certificate store' },
  { re: /\.pem$/i, why: 'PEM file containing a private key', content: /-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----/ },
  { re: /\.key$/i, why: 'private key', content: /-----BEGIN/ },
  { re: /(^|[\\/])\.npmrc$/, why: 'npm credentials file', content: /_auth|_authToken|_password/i },
  { re: /(^|[\\/])(secrets?|credentials?)\.(json|ya?ml)$/i, why: 'credential file' },
  { re: /\.tfstate(\.backup)?$/i, why: 'Terraform state, which stores secrets in clear text' },
  { re: /(^|[\\/])kubeconfig$|\.kubeconfig$/i, why: 'kubeconfig with cluster credentials' },
  { re: /(^|[\\/])\.aws[\\/]credentials$/i, why: 'AWS credentials file' },
  { re: /(^|[\\/])\.git-credentials$/i, why: 'git credential store' },
  { re: /(^|[\\/])\.docker[\\/]config\.json$/i, why: 'Docker registry credentials' },
];

/** Returns the matching rule for a path, honouring except and content narrowing. */
export function forbiddenPath(filePath, readContent = () => null) {
  for (const rule of FORBIDDEN_PATHS) {
    if (!rule.re.test(filePath)) continue;
    if (rule.except && rule.except.test(filePath)) continue;
    if (rule.content) {
      const head = readContent(filePath);
      if (head === null || !rule.content.test(head)) continue;
    }
    return rule;
  }
  return null;
}
