/**
 * Works out which organisation, project and repository a command applies to.
 *
 * Order: explicit flags, then environment, then the git remote, then the
 * machine-wide `az devops` defaults. The remote sits above those defaults on
 * purpose - they are global to the machine and are routinely stale for the
 * repository you happen to be standing in, while the remote is the repository.
 */
import { execFileSync } from 'node:child_process';
import { az, AdoError } from './ado.mjs';

const git = (args) => {
  try {
    return execFileSync('git', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
};

const decode = (part) => {
  try {
    return decodeURIComponent(part);
  } catch {
    return part;
  }
};

/**
 * Azure DevOps publishes four remote shapes and every one of them appears in
 * the wild, including the legacy visualstudio.com host on older collections.
 */
export function parseRemote(url) {
  if (!url) return null;
  const clean = url.trim().replace(/\.git$/, '');

  const modern = /^https?:\/\/(?:[^@/]+@)?dev\.azure\.com\/([^/]+)\/([^/]+)\/_git\/([^/]+)$/i.exec(clean);
  if (modern) return shape(modern, clean);

  const ssh = /^(?:ssh:\/\/)?git@ssh\.dev\.azure\.com:(?:v3\/)?([^/]+)\/([^/]+)\/([^/]+)$/i.exec(clean);
  if (ssh) return shape(ssh, clean);

  const legacy = /^https?:\/\/(?:[^@/]+@)?([^./]+)\.visualstudio\.com\/(?:DefaultCollection\/)?([^/]+)\/_git\/([^/]+)$/i.exec(clean);
  if (legacy) return shape(legacy, clean);

  return null;
}

const shape = (m, url) => ({
  org: decode(m[1]),
  project: decode(m[2]),
  repo: decode(m[3]),
  source: 'git remote',
  url,
});

/** `az devops configure --list` returns ini-style lines, not JSON. */
function azDefaults() {
  const raw = az(['devops', 'configure', '--list'], { allowFailure: true });
  if (!raw) return {};
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = /^\s*(organization|project)\s*=\s*(.+?)\s*$/i.exec(line);
    if (!m) continue;
    if (m[1].toLowerCase() === 'organization') {
      const org = /dev\.azure\.com\/([^/]+)/i.exec(m[2]);
      out.org = org ? decode(org[1]) : m[2];
    } else {
      out.project = m[2];
    }
  }
  return out;
}

export function currentBranch() {
  return git(['rev-parse', '--abbrev-ref', 'HEAD']);
}

/** The remote HEAD, falling back to main then master, so callers need no flag. */
export function defaultBranch() {
  const head = git(['symbolic-ref', 'refs/remotes/origin/HEAD']);
  if (head) return head.replace('refs/remotes/origin/', '');
  for (const candidate of ['main', 'master']) {
    if (git(['rev-parse', '--verify', `refs/remotes/origin/${candidate}`])) return candidate;
  }
  return 'main';
}

export function resolveContext(args = {}) {
  const remote = parseRemote(git(['remote', 'get-url', 'origin']));

  const org =
    args.org ?? process.env.AZURE_DEVOPS_ORG ?? remote?.org ?? azDefaults().org ?? null;
  const project =
    args.project ?? process.env.AZURE_DEVOPS_PROJECT ?? remote?.project ?? azDefaults().project ?? null;
  const repo = args.repo ?? process.env.AZURE_DEVOPS_REPO ?? remote?.repo ?? null;

  const missing = Object.entries({ org, project, repo })
    .filter(([, v]) => !v)
    .map(([k]) => k);

  if (missing.length > 0) {
    throw new AdoError(
      `cannot tell which Azure DevOps ${missing.join(', ')} this applies to`,
      remote === null
        ? 'The git remote does not look like Azure DevOps. Pass them explicitly:\n' +
          '  --org=<org> --project=<project> --repo=<repo>\n' +
          'or set AZURE_DEVOPS_ORG, AZURE_DEVOPS_PROJECT and AZURE_DEVOPS_REPO.'
        : 'Pass the missing value with --org, --project or --repo.'
    );
  }

  return {
    org,
    project,
    repo,
    orgUrl: `https://dev.azure.com/${encodeURIComponent(org)}`,
    source: remote ? remote.source : 'flags, environment or az defaults',
  };
}
