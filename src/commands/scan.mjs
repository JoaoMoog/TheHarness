import path from 'node:path';
import { detectStacks, findRepos } from '../detect/stacks.mjs';
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

      repos[name] = { ...(repos[name] ?? {}), path: rel, stacks };
      byPath.set(rel, name);
      found += 1;

      const label = stacks.length > 0 ? stacks.join(', ') : c.yellow('no stack detected');
      const status = repos[name].skip ? c.dim(' [skipped]') : '';
      log.info(`${name.padEnd(34)} ${label}${status}`);
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
