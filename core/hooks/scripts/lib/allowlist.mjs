/**
 * The false-positive list of the credential scan: what a person looked at and
 * said is not a secret, so the scanner stays quiet about it everywhere in the
 * repository from then on.
 *
 * It is a committed file at the repository root, .harness-allow.json, because
 * a false positive is a fact about the code the whole team shares - unlike the
 * runtime state under .harness/, which belongs to one machine.
 *
 * Two kinds of entry:
 *   { "id": "<16 hex>", "why": "..." }              one value, wherever it appears
 *   { "path": "tests/fixtures/**", "why": "..." }   every finding under a glob
 *
 * The id is the first 16 hex characters of the sha256 of the value, so the same
 * false positive gets the same id in every file, every commit and every machine,
 * and the list never holds the value itself. `why` is required by the command
 * that writes an entry and checked by doctor: a false positive nobody can
 * justify is a hole, not an exception.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const ALLOW_FILE = '.harness-allow.json';
export const ID_RE = /^[0-9a-f]{16}$/;
const ID_HEX = 16;
const COMMENT =
  'False positives of the harness credential scan, marked by a person; each entry says why. ' +
  'Written by "harness secrets --allow" and read on every commit and tool call. Commit it: it is the team\'s list.';

export const valueId = (value) =>
  crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, ID_HEX);

/** `**` spans directories, `*` and `?` stay within one, everything else is literal. */
export function globToRegExp(glob) {
  const g = String(glob).replace(/\\/g, '/').replace(/^\.\//, '');
  let re = '';
  for (let i = 0; i < g.length; i += 1) {
    if (g.startsWith('**/', i)) {
      re += '(?:.*/)?';
      i += 2;
    } else if (g.startsWith('**', i)) {
      re += '.*';
      i += 1;
    } else if (g[i] === '*') {
      re += '[^/]*';
    } else if (g[i] === '?') {
      re += '[^/]';
    } else {
      re += g[i].replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(`^${re}$`);
}

const empty = (file, error, raw = {}) => ({ file, raw, entries: [], ids: new Set(), paths: [], error });

/**
 * Absent means empty. Malformed means empty too, and says so: a scanner must
 * not go quiet because of a stray comma, and doctor reports the file.
 */
export function loadAllowlist(root) {
  const file = path.join(root, ALLOW_FILE);
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    return empty(file, err.code === 'ENOENT' ? null : err.message);
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return empty(file, 'the top level must be an object');
  const entries = (Array.isArray(raw.secrets) ? raw.secrets : []).filter((e) => e && typeof e === 'object');
  return {
    file,
    raw,
    entries,
    ids: new Set(entries.map((e) => String(e.id ?? '').toLowerCase()).filter((id) => ID_RE.test(id))),
    paths: entries
      .filter((e) => typeof e.path === 'string' && e.path.trim() !== '')
      .map((e) => ({ glob: e.path, re: globToRegExp(e.path) })),
    error: null,
  };
}

/** Whether a finding is on the list: by the value's id, or by the repository-relative file it sits in. */
export function isAllowed(list, { value, file = null }) {
  if (list.ids.has(valueId(value))) return true;
  if (!file) return false;
  const rel = String(file).replace(/\\/g, '/').replace(/^\.\//, '');
  return list.paths.some((p) => p.re.test(rel));
}

/** What doctor and the command check before trusting an entry. */
export function entryProblems(entry) {
  const problems = [];
  const hasId = typeof entry.id === 'string' && ID_RE.test(entry.id);
  const hasPath = typeof entry.path === 'string' && entry.path.trim() !== '';
  if (!hasId && !hasPath) problems.push('needs an id of 16 hex characters or a path glob');
  if (typeof entry.why !== 'string' || entry.why.trim() === '') problems.push('needs a why');
  return problems;
}

/** Appends an entry, creating the file. Returns what was written, or null when it was already there. */
export function addAllow(root, entry) {
  const problems = entryProblems(entry);
  if (problems.length > 0) throw new Error(`the entry ${problems.join(' and ')}`);
  const current = loadAllowlist(root);
  if (current.error) throw new Error(`${ALLOW_FILE} is not valid JSON: ${current.error}`);
  const same = current.entries.find(
    (e) => (entry.id && String(e.id).toLowerCase() === entry.id.toLowerCase()) || (entry.path && e.path === entry.path)
  );
  if (same) return null;
  const record = { ...entry, at: new Date().toISOString().slice(0, 10) };
  const next = { $comment: COMMENT, ...current.raw, secrets: [...current.entries, record] };
  fs.writeFileSync(current.file, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  return record;
}
