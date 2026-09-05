/**
 * The candidates file, read and rewritten.
 *
 * Kept separate from the command so the parsing can be exercised on a string,
 * and so the doctor asks the same questions of the same parser rather than
 * inventing a second, slightly different reading of the format.
 *
 * Nothing here mutates: every rewrite returns a new string, and every candidate
 * a new object.
 */
import fs from 'node:fs';
import path from 'node:path';

/** Kiro owns the spec panel where it is installed, and the candidates sit beside the specs. */
export function specsDirOf(repoDir) {
  return fs.existsSync(path.join(repoDir, '.kiro', 'harness'))
    ? path.join(repoDir, '.kiro', 'specs')
    : path.join(repoDir, 'specs');
}

export const dreamsFile = (repoDir) => path.join(specsDirOf(repoDir), '_dreams.md');
export const decisionsFile = (repoDir) => path.join(specsDirOf(repoDir), '_decisions.md');

const HEADING = /^##\s+(D-\d+)\s*[·|-]\s*(.+?)\s*$/;
const FIELD = /^([A-Za-z]+):\s*(.*)$/;

/** Session ids a candidate cites. Two is the minimum that makes it a pattern. */
export function citedSessions(evidence) {
  return [...new Set(String(evidence ?? '').match(/\b\d{3}\b/g) ?? [])];
}

/**
 * Every candidate in the file, in document order, each carrying the line range
 * it occupies so a rewrite can replace exactly one block.
 */
export function parseDreams(text) {
  const lines = text.split('\n');
  const candidates = [];
  let current = null;

  const close = (end) => {
    if (current) candidates.push({ ...current, end });
    current = null;
  };

  lines.forEach((line, index) => {
    const heading = HEADING.exec(line);
    if (heading) {
      close(index);
      current = {
        id: heading[1],
        claim: heading[2],
        status: 'open',
        fields: {},
        start: index,
        end: lines.length,
      };
      return;
    }
    if (!current) return;
    if (line.startsWith('## ')) {
      close(index);
      return;
    }
    const field = FIELD.exec(line.trim());
    if (!field) return;
    const key = field[1].toLowerCase();
    current = { ...current, fields: { ...current.fields, [key]: field[2].trim() } };
    if (key === 'status') {
      current = { ...current, status: field[2].trim().split(' ')[0].toLowerCase() || 'open' };
    }
  });
  close(lines.length);

  return candidates.map((candidate) => ({
    ...candidate,
    sessions: citedSessions(candidate.fields.evidence),
  }));
}

export function readDreams(repoDir) {
  const file = dreamsFile(repoDir);
  if (!fs.existsSync(file)) return { file, text: '', candidates: [] };
  const text = fs.readFileSync(file, 'utf8');
  return { file, text, candidates: parseDreams(text) };
}

export const openOnes = (candidates) => candidates.filter((c) => c.status === 'open');

/** A placeholder block copied from the template is not a candidate anybody wrote. */
export const isTemplate = (candidate) => candidate.claim.startsWith('<');

/** Rewrites one candidate's Status line, leaving the rest of the file untouched. */
export function setStatus(text, id, status, extra = null) {
  const lines = text.split('\n');
  const candidate = parseDreams(text).find((c) => c.id === id);
  if (!candidate) return null;

  const next = [...lines];
  const statusOffset = next
    .slice(candidate.start, candidate.end)
    .findIndex((line) => /^Status:/i.test(line.trim()));

  const rendered = `Status: ${status}`;
  if (statusOffset === -1) next.splice(candidate.start + 1, 0, '', rendered);
  else next[candidate.start + statusOffset] = rendered;

  if (extra) {
    const at = statusOffset === -1 ? candidate.start + 3 : candidate.start + statusOffset + 1;
    next.splice(at, 0, '', extra);
  }
  return next.join('\n');
}

/**
 * A promoted candidate becomes a decision in the shape templates/decisions.md
 * describes, inserted newest-first after the file's separator so the ordering
 * rule that file states keeps holding.
 */
export function renderDecision(candidate, today) {
  return [
    `## ${today} · ${candidate.claim}`,
    '',
    `Session: ${candidate.sessions.join(', ') || 'unrecorded'}`,
    '',
    `Rejected: ${candidate.fields.rejected ?? 'not recorded by the extraction'}`,
    '',
    `Constrains: ${candidate.fields.proposes ?? candidate.claim}`,
    '',
  ].join('\n');
}

export function insertDecision(decisionsText, block) {
  const marker = '\n---\n';
  const at = decisionsText.indexOf(marker);
  if (at === -1) return `${decisionsText.trimEnd()}\n\n---\n\n${block}`;
  const head = decisionsText.slice(0, at + marker.length);
  const tail = decisionsText.slice(at + marker.length).replace(/^\n+/, '');
  return `${head}\n${block}\n${tail}`;
}
