import fs from 'node:fs';
import path from 'node:path';
import { harnessPath, HARNESS_ROOT } from './paths.mjs';

export const CONFIG_FILE = harnessPath('harness.config.json');

const DEFAULT_CONFIG = {
  version: 1,
  roots: [],
  defaults: { mode: 'link', gitHooks: true, depth: 2, targets: ['copilot'] },
  repos: {},
};

export function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return fallback;
    throw new Error(`${file} is not valid JSON: ${err.message}`);
  }
}

export function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

export function loadConfig() {
  const cfg = readJson(CONFIG_FILE, null);
  if (!cfg) return null;
  return { ...DEFAULT_CONFIG, ...cfg, defaults: { ...DEFAULT_CONFIG.defaults, ...cfg.defaults } };
}

export function loadConfigOrExit() {
  const cfg = loadConfig();
  if (!cfg) throw new Error('No harness.config.json found. Run "harness scan <folder>" first.');
  return cfg;
}

export function saveConfig(cfg) {
  writeJson(CONFIG_FILE, cfg);
}

export function repoSettings(cfg, name) {
  const entry = cfg.repos?.[name] ?? {};
  const settings = { mode: cfg.defaults.mode, gitHooks: cfg.defaults.gitHooks, skip: false, ...entry };
  // Targets live on the entry when scan detected them, and fall back to the
  // default rather than to nothing: a repository with no target installs nothing.
  const targets = entry.targets ?? cfg.defaults.targets ?? ['copilot'];
  return { ...settings, targets: Array.isArray(targets) ? targets : [targets] };
}

const norm = (p) => path.resolve(p).toLowerCase();

/**
 * Repositories the config knows about. `only` accepts a name or any path that
 * resolves to the same directory, because after a scan prints paths, typing a
 * path is the natural thing to do.
 */
export function selectedRepos(cfg, { only = null, includeSkipped = false } = {}) {
  const all = Object.entries(cfg.repos ?? {}).map(([name, entry]) => ({
    name,
    dir: path.resolve(HARNESS_ROOT, entry.path ?? name),
    settings: repoSettings(cfg, name),
    stacks: entry.stacks ?? [],
  }));

  const matches = only
    ? all.filter((r) => r.name === only || norm(r.dir) === norm(path.resolve(HARNESS_ROOT, only)) || path.basename(r.dir) === only)
    : all;

  return matches.filter((r) => (includeSkipped ? true : !r.settings.skip));
}
