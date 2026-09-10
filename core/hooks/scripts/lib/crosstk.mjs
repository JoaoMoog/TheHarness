/**
 * Whether a Cross TK MCP server is known for this repository, and how a call to
 * it is recognised. Shared by the session start, which says it, and by
 * crosstk-first, which enforces it.
 *
 * Two sources, either one enough. A declaration in one of the repository's MCP
 * files, by a name matching cross-tk. Or the record the first agent of a
 * session writes when it finds the server in its own tool list:
 * .harness/crosstk.json, with the server name and the tool names exactly as the
 * runtime showed them. The record is machine-local and never committed, which
 * is what lets a team keep those names out of the repository.
 *
 * Discovery is by name and never by an assumed tool: what the server offers is
 * read from its tool descriptions once it is connected.
 */
import fs from 'node:fs';
import path from 'node:path';

export const CROSS_TK = /cross[-_ ]?tk/i;
export const DISCOVERY_FILE = '.harness/crosstk.json';

/**
 * Where a repository declares MCP servers, per tool. The harness copies its
 * own file to the first and the last; VS Code reads the middle one on its own.
 * Kiro spells the map `mcpServers` and marks a server off with `disabled`.
 */
export const MCP_FILES = ['.mcp.json', '.vscode/mcp.json', '.kiro/settings/mcp.json'];

/** What the first run recorded, or null. A record without a server name records nothing. */
export function discovered(root) {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(root, ...DISCOVERY_FILE.split('/')), 'utf8'));
    if (!raw || typeof raw.server !== 'string' || raw.server.trim() === '') return null;
    return {
      server: raw.server.trim(),
      tools: Array.isArray(raw.tools) ? raw.tools.map(String).filter(Boolean) : [],
      discoveredAt: typeof raw.discoveredAt === 'string' ? raw.discoveredAt : null,
      mandatoryFirst: raw.mandatoryFirst,
    };
  } catch {
    return null;
  }
}

/** The known server: its name, where it is known from, its entry, and the record if any. Declared but disabled counts as absent. */
export function crossTkServer(root) {
  const record = discovered(root);
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
    if (name) return { name, file: rel, entry: servers[name] ?? {}, discovered: record };
  }
  if (record) {
    return {
      name: record.server,
      file: DISCOVERY_FILE,
      entry: { tools: record.tools, mandatoryFirst: record.mandatoryFirst },
      discovered: record,
    };
  }
  return null;
}

/** Mandatory unless the entry says `"mandatoryFirst": false`, which turns the gate into a one-time reminder. */
export const isMandatory = (server) => server?.entry?.mandatoryFirst !== false;

/**
 * The runtime shows a tool as `source/server/tool` in one place and may hand
 * the hook only `tool` in another, so names match whole or by last segment.
 * A collision with a built-in name would only ever let a read through: the
 * failure is a missed reminder, never a block.
 */
const last = (name) => String(name).split('/').pop();
const sameTool = (a, b) => String(a) === String(b) || last(a) === last(b);

/** A call that went through Cross TK: by the server name in the tool name, or by a recorded or declared tool name. */
export function isCrossTkTool(toolName, server) {
  const name = String(toolName ?? '');
  if (name === '') return false;
  if (CROSS_TK.test(name)) return true;
  const known = [...(Array.isArray(server?.entry?.tools) ? server.entry.tools : []), ...(server?.discovered?.tools ?? [])];
  return known.some((t) => sameTool(t, name));
}
