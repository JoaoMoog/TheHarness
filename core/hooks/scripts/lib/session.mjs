/**
 * Session state lives in the target repository, under specs/, and is committed.
 * That is deliberate: a session that only exists in the chat window cannot be
 * reviewed in a pull request, cannot be handed to a colleague, and cannot be
 * resumed tomorrow.
 *
 *   specs/_context.md          precomputed repository inventory, one per repo
 *   specs/NNN-slug/session.md  the state machine and the per-phase summaries
 *   specs/NNN-slug/spec.md     produced by the specifier
 *   specs/NNN-slug/plan.md     produced by the planner
 *   specs/NNN-slug/tasks.md    produced by the tasker
 */
import fs from 'node:fs';
import path from 'node:path';

export const PHASES = ['specify', 'plan', 'tasks', 'implement', 'review', 'deliver', 'done'];

export const specsDir = (root) => path.join(root, 'specs');
export const contextFile = (root) => path.join(specsDir(root), '_context.md');

const SESSION_DIR = /^(\d{3})-([a-z0-9][a-z0-9-]*)$/;

export function listSessions(root) {
  const dir = specsDir(root);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && SESSION_DIR.test(e.name))
    .map((e) => {
      const [, id, slug] = SESSION_DIR.exec(e.name);
      return { id, slug, dir: path.join(dir, e.name), file: path.join(dir, e.name, 'session.md') };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function nextSessionId(root) {
  const sessions = listSessions(root);
  const highest = sessions.length === 0 ? 0 : Number(sessions[sessions.length - 1].id);
  return String(highest + 1).padStart(3, '0');
}

/** The open session is the newest one whose phase is not done. */
export function openSession(root) {
  const sessions = listSessions(root).reverse();
  for (const session of sessions) {
    if (!fs.existsSync(session.file)) continue;
    const phase = currentPhase(fs.readFileSync(session.file, 'utf8'));
    if (phase !== 'done') return { ...session, phase };
  }
  return null;
}

const PHASE_LINE = /^phase:\s*([a-z]+)\s*$/im;

export function currentPhase(text) {
  const match = PHASE_LINE.exec(text);
  const phase = match?.[1]?.toLowerCase();
  return PHASES.includes(phase) ? phase : 'specify';
}

export function readSession(root) {
  const session = openSession(root);
  if (!session) return null;
  return { ...session, text: fs.readFileSync(session.file, 'utf8') };
}

/**
 * Appends a phase summary. This is the E-mem contract: the orchestrator keeps
 * summaries, the sub-agents keep detail, and the detail is discarded once the
 * summary is written.
 */
export function appendSummary(sessionFile, { phase, summary, agent, tokens }) {
  const stamp = new Date().toISOString();
  const block = [
    '',
    `### ${phase} — ${agent ?? 'unknown'} — ${stamp}`,
    '',
    summary.trim(),
    tokens ? `\n_tokens: ${tokens}_` : '',
  ].join('\n');
  fs.appendFileSync(sessionFile, block, 'utf8');
  return sessionFile;
}

/** Truncates injected context so a hook can never blow the window it feeds. */
export function clip(text, maxChars) {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n\n[clipped at ${maxChars} characters by the harness]`;
}
