/**
 * `harness secrets` - the human end of the credential scan.
 *
 * The scanner warns and records; this is where a person reads the record and
 * says which findings are false positives, so the scanner stays quiet about
 * them everywhere in the repository from then on. Marking needs a reason for
 * the same reason discarding a dream does: an exception nobody can justify is
 * a hole, and the next person cannot tell it from a mistake.
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig, selectedRepos } from '../lib/config.mjs';
import { loadAllowlist, addAllow, ALLOW_FILE, ID_RE } from '../../core/hooks/scripts/lib/allowlist.mjs';
import { log, c } from '../lib/log.mjs';

const LOG_DIR = '.harness';
const LOG_FILES = ['secrets.log.1', 'secrets.log'];
const SHOW_FILES = 4;

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

/** Every record the scanner left, oldest first, rotation included. */
function readLog(dir) {
  const records = [];
  for (const name of LOG_FILES) {
    const file = path.join(dir, LOG_DIR, name);
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      if (!line.trim()) continue;
      try {
        records.push(JSON.parse(line));
      } catch {
        // A truncated last line while a hook is still writing it.
      }
    }
  }
  return records;
}

function groupById(records) {
  const groups = new Map();
  for (const r of records) {
    if (!r.id) continue;
    const g = groups.get(r.id) ?? { id: r.id, name: r.name, value: r.value, count: 0, files: new Set(), last: r.at ?? '' };
    g.count += 1;
    if (r.file && r.file !== '-') g.files.add(r.file);
    if ((r.at ?? '') > g.last) g.last = r.at;
    groups.set(r.id, g);
  }
  return [...groups.values()];
}

function list(repo) {
  const allowlist = loadAllowlist(repo.dir);
  const groups = groupById(readLog(repo.dir));
  const open = groups.filter((g) => !allowlist.ids.has(g.id)).sort((a, b) => b.count - a.count);

  log.title(`Credential warnings in ${repo.name}`);
  if (allowlist.error) {
    log.warn(`${ALLOW_FILE} is not valid JSON (${allowlist.error}); nothing in it is honoured until it parses`);
  }
  if (groups.length === 0) {
    log.info(`Nothing recorded yet in ${path.join(LOG_DIR, 'secrets.log')}.`);
    log.info('A record appears when a commit or a tool call carries a credential-shaped value.');
  }
  for (const g of open) {
    const files = [...g.files];
    const shown = files.slice(0, SHOW_FILES).join(', ') + (files.length > SHOW_FILES ? `, +${files.length - SHOW_FILES}` : '');
    log.plain(`\n  ${c.bold(g.id)}  ${g.name}  ${c.dim(g.value)}`);
    log.plain(`      ${g.count} time(s)${shown ? ` in ${shown}` : ''}, last ${String(g.last).slice(0, 10)}`);
  }
  log.plain(
    `\n  ${open.length} distinct value(s) still warning, ${groups.length - open.length} marked as false positives.`
  );
  if (allowlist.paths.length > 0) {
    log.plain(`  ${allowlist.paths.length} path rule(s): ${allowlist.paths.map((p) => p.glob).join(', ')}`);
  }
  log.plain(`  ${c.dim('harness secrets --allow=<id> --why="<reason>"   |   harness secrets --allow-path=<glob> --why="<reason>"')}`);
  log.plain(`  ${c.dim('Marked means quiet, not safe: a real value that reached history still needs rotation.')}`);
  return 0;
}

function mark(repo, entry, why) {
  if (!why || why === true) {
    throw new Error(
      'Pass --why="<reason>". A false positive nobody can justify is a hole, not an exception, ' +
        'and the next person cannot tell it from a mistake.'
    );
  }
  if (entry.id && !ID_RE.test(entry.id)) {
    throw new Error(`"${entry.id}" is not an id. Use the 16 hex characters the warning prints after "id:".`);
  }

  const seen = entry.id ? groupById(readLog(repo.dir)).find((g) => g.id === entry.id) : null;
  const written = addAllow(repo.dir, { ...entry, ...(seen?.name ? { name: seen.name } : {}), why: String(why) });
  if (!written) {
    log.info(`Already marked in ${ALLOW_FILE}; nothing changed.`);
    return 0;
  }
  if (entry.id && !seen) {
    log.warn(`${entry.id} was never recorded in this repository's log. Marked anyway; check the id was copied right.`);
  }
  log.ok(`Marked as a false positive in ${ALLOW_FILE}: ${entry.id ?? entry.path}.`);
  log.info("Commit that file. It is the team's list, and the scanner reads it on every commit and tool call.");
  return 0;
}

export default function secrets(args) {
  const repo = resolveRepo(args);
  if (args.allow) return mark(repo, { id: String(args.allow).toLowerCase() }, args.why);
  if (args['allow-path']) return mark(repo, { path: String(args['allow-path']) }, args.why);
  return list(repo);
}
