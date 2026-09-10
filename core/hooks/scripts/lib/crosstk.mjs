/**
 * Whether a Cross TK MCP server is declared for this repository, and how a call
 * to it is recognised. Shared by the session start, which says it, and by
 * crosstk-first, which enforces it.
 *
 * Discovery is by name and never by an assumed tool: what the server offers is
 * read from its tool descriptions once it is connected. A server whose tool
 * names do not carry the server name lists them under `tools` in its entry, so
 * the gate can tell a Cross TK call from a built-in read.
 */
import fs from 'node:fs';
import path from 'node:path';

export const CROSS_TK = /cross[-_ ]?tk/i;

/**
 * Where a repository declares MCP servers, per tool. The harness copies its
 * own file to the first and the last; VS Code reads the middle one on its own.
 * Kiro spells the map `mcpServers` and marks a server off with `disabled`.
 */
export const MCP_FILES = ['.mcp.json', '.vscode/mcp.json', '.kiro/settings/mcp.json'];

/** The declared server: its name, the file it is in, and its entry. Declared but disabled counts as absent. */
export function crossTkServer(root) {
  for (const rel of MCP_FILES) {
    const file = path.join(root, ...rel.split('/'));
    if (!fs.existsSync(file)) continue;
    let config;
    try {
      config = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      continue; // A file that does not parse declares nothing.
    }
    const servers = { ...(config.servers ?? {}), ...(config.mcpServers ?? {}) };
    const name = Object.keys(servers).find((n) => CROSS_TK.test(n) && servers[n]?.disabled !== true);
    if (name) return { name, file: rel, entry: servers[name] ?? {} };
  }
  return null;
}

/** Mandatory unless the entry says `"mandatoryFirst": false`, which turns the gate into a one-time reminder. */
export const isMandatory = (server) => server?.entry?.mandatoryFirst !== false;

/** A call that went through Cross TK: the runtime puts the server name in the tool name, or the entry lists the names. */
export function isCrossTkTool(toolName, server) {
  const name = String(toolName ?? '');
  if (CROSS_TK.test(name)) return true;
  const declared = server?.entry?.tools;
  return Array.isArray(declared) && declared.some((t) => String(t) === name);
}
