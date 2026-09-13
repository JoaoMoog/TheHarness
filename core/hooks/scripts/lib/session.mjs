/**
 * Session state lives in the target repository, next to the specs, and is
 * committed. That is deliberate: a session that only exists in the chat window
 * cannot be reviewed in a pull request, cannot be handed to a colleague, and
 * cannot be resumed tomorrow.
 *
 *   <specs>/_context.md          precomputed repository inventory, one per repo
 *   <specs>/NNN-slug/session.md  the state machine and the per-phase summaries
 *   <specs>/NNN-slug/<spec>      produced by the specifier
 *   <specs>/NNN-slug/<plan>      produced by the planner
 *   <specs>/NNN-slug/tasks.md    produced by the tasker
 *
 * The names in angle brackets depend on the layout, which is resolved from the
 * repository itself rather than passed in - a hook is handed a directory and
 * nothing else.
 */
import fs from 'node:fs';
import path from 'node:path';

export const PHASES = ['specify', 'plan', 'tasks', 'implement', 'review', 'deliver', 'done'];

/**
 * Two layouts for the same four artifacts. Kiro's spec panel reads
 * requirements/design/tasks under .kiro/specs, so writing spec.md there would
 * produce files its own workflow cannot see.
 */
export const LAYOUTS = {
  harness: { id: 'harness', dir: 'specs', spec: 'spec.md', plan: 'plan.md', tasks: 'tasks.md' },
  kiro: { id: 'kiro', dir: '.kiro/specs', spec: 'requirements.md', plan: 'design.md', tasks: 'tasks.md' },
};

/**
 * .kiro/harness exists only where the harness installed its Kiro surfaces, so
 * it tells a repository wired for Kiro apart from one that merely has a .kiro
 * directory of its own.
 */
export function layoutFor(root) {
  return fs.existsSync(path.join(root, '.kiro', 'harness')) ? LAYOUTS.kiro : LAYOUTS.harness;
}

export const specsDir = (root) => path.join(root, layoutFor(root).dir);
export const contextFile = (root) => path.join(specsDir(root), '_context.md');

/**
 * The id prefix is the harness's, not Kiro's. A hand-made Kiro spec without
 * one is left alone rather than adopted as a session.
 */
const SESSION_DIR = /^(\d{3})-([a-z0-9][a-z0-9-]*)$/;

export function listSessions(root) {
  const layout = layoutFor(root);
  const dir = specsDir(root);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && SESSION_DIR.test(e.name))
    .map((e) => {
      const [, id, slug] = SESSION_DIR.exec(e.name);
      const sessionDir = path.join(dir, e.name);
      return {
        id,
        slug,
        layout,
        dir: sessionDir,
        file: path.join(sessionDir, 'session.md'),
        spec: path.join(sessionDir, layout.spec),
        plan: path.join(sessionDir, layout.plan),
        tasks: path.join(sessionDir, layout.tasks),
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function nextSessionId(root) {
  const sessions = listSessions(root);
  const highest = sessions.length === 0 ? 0 : Number(sessions[sessions.length - 1].id);
  return String(highest + 1).padStart(3, '0');
}

/**
 * Every session whose phase is not done, newest first. More than one may be
 * open: a person doing two unrelated adjustments in two chats has two
 * sessions, each with its own id, file and work branch, and the harness lists
 * them rather than refusing the second.
 */
export function openSessions(root) {
  const open = [];
  for (const session of listSessions(root).reverse()) {
    if (!fs.existsSync(session.file)) continue;
    const text = fs.readFileSync(session.file, 'utf8');
    const phase = currentPhase(text);
    if (phase !== 'done') open.push({ ...session, phase, workBranch: headerField(text, 'work branch') });
  }
  return open;
}

/** The newest open session, which is what a hook with room for one reports. */
export function openSession(root) {
  return openSessions(root)[0] ?? null;
}

/** A `key: value` line from the session header, ignoring unfilled placeholders. */
export function headerField(text, key) {
  const match = new RegExp(`^${key}:\\s*(.+)$`, 'im').exec(text);
  const value = match ? match[1].trim() : '';
  return value && !value.startsWith('<') ? value : null;
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
