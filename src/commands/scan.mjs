import path from 'node:path';
import fs from 'node:fs';
import { detectStacks, findRepos } from '../detect/stacks.mjs';
import { TARGETS, TARGET_IDS, DEFAULT_TARGET } from '../lib/targets.mjs';
import { loadConfig, saveConfig } from '../lib/config.mjs';
import { HARNESS_ROOT } from '../lib/paths.mjs';
import { log, c } from '../lib/log.mjs';

const relativeToHarness = (dir) => path.relative(HARNESS_ROOT, dir).split(path.sep).join('/');

/**
 * Discovers repositories and records their stacks. Existing per-repo overrides
 * survive a rescan: only the detected stack list is refreshed.
 *
 * Keys are basenames while they are unique, because that is what people type.
 * The moment two roots contain a repository of the same name, the second key
 * becomes its relative path rather than silently overwriting the first.
 */
/**
 * A repository that already has a tool's directory is using that tool. Both
 * present means both, and neither means the default: installing nothing is
 * never the useful answer to an ambiguous repository.
 */
function detectTargets(dir, args) {
  if (args.target) {
    const asked = String(args.target).split(',').map((t) => t.trim()).filter(Boolean);
    const unknown = asked.filter((t) => !TARGET_IDS.includes(t));
    if (unknown.length > 0) {
      throw new Error('Unknown target: ' + unknown.join(', ') + '. Known: ' + TARGET_IDS.join(', ') + '.');
    }
    return asked;
  }
  const found = TARGET_IDS.filter((id) => fs.existsSync(path.join(dir, TARGETS[id].detect)));
  return found.length > 0 ? found : [DEFAULT_TARGET];
}

export default function scan(args) {
  const roots = args._.length > 0 ? args._ : ['..'];
  const depth = Number(args.depth ?? 2);
  const existing = loadConfig() ?? {
    version: 1,
    roots: [],
    defaults: { mode: 'link', gitHooks: true, depth: 2 },
    repos: {},
  };

  const repos = { ...existing.repos };
  const byPath = new Map(
    Object.entries(repos).map(([name, entry]) => [entry.path ?? name, name])
  );
  let found = 0;
  let renamed = 0;

  for (const root of roots) {
    const absRoot = path.resolve(HARNESS_ROOT, root);
    log.step(`Scanning ${absRoot} (depth ${depth})`);

    for (const dir of findRepos(absRoot, depth)) {
      if (path.resolve(dir) === HARNESS_ROOT) continue;
      const rel = relativeToHarness(dir);
      const stacks = detectStacks(dir);

      let name = byPath.get(rel) ?? path.basename(dir);
      const taken = repos[name] && (repos[name].path ?? name) !== rel;
      if (taken) {
        name = rel;
        renamed += 1;
        log.warn(`two repositories are named ${path.basename(dir)}; this one is keyed as ${rel}`);
      }

      repos[name] = { ...(repos[name] ?? {}), path: rel, stacks, targets: detectTargets(dir, args) };
      byPath.set(rel, name);
      found += 1;

      const label = stacks.length > 0 ? stacks.join(', ') : c.yellow('no stack detected');
      const targetLabel = c.dim(' [' + repos[name].targets.join('+') + ']');
      const status = repos[name].skip ? c.dim(' [skipped]') : '';
      log.info(`${name.padEnd(34)} ${label}${targetLabel}${status}`);
    }
  }

  saveConfig({
    ...existing,
    roots: [...new Set([...(existing.roots ?? []), ...roots])],
    defaults: { ...existing.defaults, depth },
    repos,
  });

  log.plain('');
  log.ok(`${found} repositories recorded in harness.config.json`);
  if (renamed > 0) log.info(`${renamed} keyed by path to avoid a name collision`);
  if (found === 0) {
    log.info('Nothing found. If your repositories are nested deeper, pass --depth=3.');
  } else {
    log.info('Next: harness link --all');
  }
  return 0;
}
