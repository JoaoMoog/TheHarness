/**
 * `harness dream` - the human end of consolidation.
 *
 * The collector gathers evidence and the next session extracts candidates, but
 * nothing reaches repository memory without someone saying so here. That is the
 * whole reason candidates and decisions are two files: an extraction mistake in
 * _dreams.md is a bad suggestion, and the same mistake in _decisions.md is a
 * rule every future session inherits.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { loadConfig, selectedRepos } from '../lib/config.mjs';
import { harnessPath } from '../lib/paths.mjs';
import {
  readDreams,
  openOnes,
  isTemplate,
  setStatus,
  renderDecision,
  insertDecision,
  decisionsFile,
} from '../lib/dreams.mjs';
import { log, c } from '../lib/log.mjs';

const COLLECTOR = harnessPath('core/hooks/scripts/dream-collect.mjs');
const MIN_SESSIONS = 2;

/** Which repository. Named explicitly, or the one the shell is standing in. */
function resolveRepo(args) {
  const only = args.repo ?? args._[0] ?? null;
  if (!only) return { name: path.basename(process.cwd()), dir: process.cwd() };

  const cfg = loadConfig();
  if (!cfg) throw new Error('No harness.config.json, so a repository name cannot be resolved.');
  const [match] = selectedRepos(cfg, { only, includeSkipped: true });
  if (!match) throw new Error(`No repository named "${only}" in harness.config.json.`);
  return { name: match.name, dir: match.dir };
}

const today = () => new Date().toISOString().slice(0, 10);

function listCandidates(repo) {
  const { file, candidates } = readDreams(repo.dir);
  const real = candidates.filter((candidate) => !isTemplate(candidate));
  const open = openOnes(real);

  log.title(`Dream candidates in ${repo.name}`);
  if (real.length === 0) {
    log.info(`Nothing yet. ${file} is empty or absent.`);
    log.info('Candidates appear after a session closes and the next one consolidates.');
    return 0;
  }

  for (const candidate of open) {
    const thin = candidate.sessions.length < MIN_SESSIONS;
    log.plain(`\n  ${c.bold(candidate.id)}  ${candidate.claim}`);
    log.plain(
      `      evidence: ${
        candidate.sessions.length ? candidate.sessions.join(', ') : c.red('none cited')
      }${thin ? c.red('  (needs two sessions)') : ''}`
    );
    if (candidate.fields.proposes) log.plain(`      proposes: ${c.dim(candidate.fields.proposes)}`);
    if (candidate.fields.contradicts && candidate.fields.contradicts !== 'none') {
      log.plain(`      ${c.yellow('contradicts')}: ${candidate.fields.contradicts}`);
    }
  }

  const settled = real.length - open.length;
  log.plain(
    `\n  ${open.length} open, ${settled} already promoted or discarded.` +
      `\n  ${c.dim('harness dream --promote=<id>   |   harness dream --discard=<id> --why="<reason>"')}`
  );
  return 0;
}

function promote(repo, id) {
  const { file, text, candidates } = readDreams(repo.dir);
  const candidate = candidates.find((entry) => entry.id === id);
  if (!candidate) throw new Error(`No candidate ${id} in ${file}.`);
  if (candidate.status !== 'open') throw new Error(`${id} is already ${candidate.status}.`);
  if (candidate.sessions.length < MIN_SESSIONS) {
    throw new Error(
      `${id} cites ${candidate.sessions.length} session(s). A pattern needs two.\n` +
        'Add the second one to its Evidence line, or discard it.'
    );
  }

  const stamp = today();
  const target = decisionsFile(repo.dir);
  const existing = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '# Decisions\n\n---\n';
  const updated = insertDecision(existing, renderDecision(candidate, stamp));
  const marked = setStatus(text, id, `promoted ${stamp}`);

  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, updated, 'utf8');
  fs.writeFileSync(file, marked, 'utf8');

  log.ok(`${id} promoted into ${path.relative(repo.dir, target)}, dated ${stamp}.`);
  log.info('It is injected at the start of every session in this repository from now on.');
  return 0;
}

function discard(repo, id, why) {
  if (!why || why === true) {
    throw new Error(
      'Pass --why="<reason>". A candidate discarded without one comes back next month, ' +
        'because the extraction has no way to know it was already refused.'
    );
  }
  const { file, text, candidates } = readDreams(repo.dir);
  const candidate = candidates.find((entry) => entry.id === id);
  if (!candidate) throw new Error(`No candidate ${id} in ${file}.`);

  const marked = setStatus(text, id, `discarded ${today()}`, `Why: ${why}`);
  fs.writeFileSync(file, marked, 'utf8');
  log.ok(`${id} discarded, with the reason recorded so it is not proposed again.`);
  return 0;
}

function collect(repo) {
  if (!fs.existsSync(COLLECTOR)) throw new Error(`Collector missing at ${COLLECTOR}.`);
  const result = spawnSync(process.execPath, [COLLECTOR], {
    cwd: repo.dir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.stdout) log.plain(`  ${result.stdout.trim().split('\n').join('\n  ')}`);
  if (result.stderr) log.warn(result.stderr.trim());
  return result.status ?? 0;
}

export default function dream(args) {
  const repo = resolveRepo(args);
  if (args.collect) return collect(repo);
  if (args.promote) return promote(repo, String(args.promote));
  if (args.discard) return discard(repo, String(args.discard), args.why);
  return listCandidates(repo);
}
