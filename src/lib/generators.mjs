/**
 * Which generator module belongs to which target.
 *
 * This lives apart from targets.mjs on purpose: kiro-gen.mjs imports TARGETS
 * from there, so naming the modules inside targets.mjs would close an import
 * cycle. Nothing imports this file except the two commands that write and
 * verify generated files.
 */
import * as kiroGen from './kiro-gen.mjs';
import * as claudeGen from './claude-gen.mjs';
import { getTarget } from './targets.mjs';

const GENERATOR_MODULES = { kiro: kiroGen, claude: claudeGen };

/**
 * The generated files for a repository's targets, deduped by path - the same
 * rule mergedSurfaces uses for links, and for the same reason: two targets may
 * legitimately want the same file.
 */
export function generatedFilesFor(targetIds) {
  const files = new Map();
  for (const id of targetIds ?? []) {
    for (const file of GENERATOR_MODULES[id]?.generatedFiles() ?? []) files.set(file.path, file);
  }
  return [...files.values()];
}

/**
 * Paths two targets both write but disagree about.
 *
 * `.mcp.json` is the real case: Copilot reads servers under `servers`, which
 * the harness authors and copies as it is, and Claude Code reads them under
 * `mcpServers`, which has to be generated. The two cannot share one file, so
 * the second target to install skips it and doctor says which one went
 * without - rather than one silently overwriting the other every install.
 */
export function contestedPaths(targetIds) {
  const ids = targetIds ?? [];
  const copied = new Set(ids.flatMap((id) => getTarget(id).fileSurfaces.map((s) => s.target)));
  const generated = new Set(generatedFilesFor(ids).map((file) => file.path));
  return [...generated].filter((target) => copied.has(target));
}
