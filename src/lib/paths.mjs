import { fileURLToPath } from 'node:url';
import path from 'node:path';

/** Repository root of the harness itself (two levels up from src/lib). */
export const HARNESS_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..'
);

/**
 * Directory surfaces are linked (junction on Windows, symlink on POSIX) so an
 * edit in the harness is live in every target repository with no sync step.
 */
export const DIR_SURFACES = [
  { source: 'core/instructions', target: '.github/instructions' },
  { source: 'core/skills', target: '.github/skills' },
  { source: 'core/prompts', target: '.github/prompts' },
  { source: 'core/agents', target: '.github/agents' },
  { source: 'core/chatmodes', target: '.github/chatmodes' },
  { source: 'core/hooks', target: '.github/hooks' },
  { source: 'core/tools', target: '.github/tools' },
  { source: 'core/rubrics', target: '.github/rubrics' },
];

/**
 * Single files are copied, not linked: a file symlink on Windows requires
 * elevation, a junction cannot point at a file. Drift is caught by hash.
 */
export const FILE_SURFACES = [
  { source: 'core/copilot-instructions.md', target: '.github/copilot-instructions.md' },
  { source: 'core/AGENTS.md', target: 'AGENTS.md' },
  { source: 'core/mcp.json', target: '.mcp.json' },
];

/** Runtime state the hooks write inside a target repository; never committed. */
export const RUNTIME_DIRS = ['.harness'];

export const ALL_TARGETS = [
  ...DIR_SURFACES.map((s) => s.target),
  ...FILE_SURFACES.map((s) => s.target),
];

export const harnessPath = (...parts) => path.join(HARNESS_ROOT, ...parts);
