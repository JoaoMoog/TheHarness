/**
 * Whether a Cross TK MCP server is declared for this repository, and how a
 * call to it is recognised. Shared by the session start, which says it, by
 * crosstk-nudge, which points at it when a whole read would cost more, and by
 * the usage counters.
 *
 * Two sources, either enough. A declaration in one of the repository's MCP
 * files. A declaration in the user's own VS Code or Kiro profile, which is
 * where a server configured "globally" lives - looking only at the repository
 * told the agent the server did not exist while it sat next to it.
 *
 * Discovery is by name and never by an assumed tool: what the server offers is
 * read from its tool descriptions once it is connected, and no tool name has
 * to be written anywhere.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const CROSS_TK = /cross[-_ ]?tk/i;

/**
 * Where a repository declares MCP servers, per tool. The harness copies its
 * own file to the first and the last; VS Code reads the middle one on its own.
 * Kiro spells the map `mcpServers` and marks a server off with `disabled`.
 */
export const MCP_FILES = ['.mcp.json', '.vscode/mcp.json', '.kiro/settings/mcp.json'];

/**
 * Where VS Code and Kiro keep the user's own servers, outside any repository:
 * the default profile, every named profile, and Kiro's settings. Parameters
 * exist so the self-test can point at a sandbox home.
 */
export function userMcpFiles({ home = os.homedir(), appData = process.env.APPDATA, platform = process.platform } = {}) {
  const roots =
    platform === 'win32'
      ? [appData].filter(Boolean).flatMap((d) => [path.join(d, 'Code'), path.join(d, 'Code - Insiders')])
      : platform === 'darwin'
        ? ['Code', 'Code - Insiders'].map((d) => path.join(home, 'Library', 'Application Support', d))
        : ['Code', 'Code - Insiders'].map((d) => path.join(home, '.config', d));
  const files = [];
  for (const root of roots) {
    files.push(path.join(root, 'User', 'mcp.json'));
    const profiles = path.join(root, 'User', 'profiles');
    try {
      for (const entry of fs.readdirSync(profiles)) files.push(path.join(profiles, entry, 'mcp.json'));
    } catch {
      // No named profiles; the default one is the file above.
    }
  }
  files.push(path.join(home, '.kiro', 'settings', 'mcp.json'));
  return files;
}

/** The server declared in one MCP file, or null. Declared but disabled counts as absent. */
function declaredIn(file) {
  if (!fs.existsSync(file)) return null;
  let config;
  try {
    config = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null; // A file that does not parse declares nothing.
  }
  const servers = { ...(config?.servers ?? {}), ...(config?.mcpServers ?? {}) };
  const name = Object.keys(servers).find((n) => CROSS_TK.test(n) && servers[n]?.disabled !== true);
  return name ? { name, entry: servers[name] ?? {} } : null;
}

/**
 * The declared server: its name, where it is declared from (`scope` is
 * repository or user), its file and its entry. Null when nothing declares one.
 */
export function crossTkServer(root, userFiles = userMcpFiles()) {
  for (const rel of MCP_FILES) {
    const found = declaredIn(path.join(root, ...rel.split('/')));
    if (found) return { ...found, file: rel, scope: 'repository' };
  }
  for (const file of userFiles) {
    const found = declaredIn(file);
    if (found) return { ...found, file, scope: 'user' };
  }
  return null;
}

/**
 * A call that went through Cross TK: the runtime shows an MCP tool as
 * `source/server/tool` in one place and `mcp_server_tool` in another, and
 * either carries the server name. A team whose runtime shows bare names can
 * list them under `tools` in the server entry; the match is whole or by last
 * segment. Nothing here ever refuses a call, so a miss costs a count, not a read.
 */
const last = (name) => String(name).split('/').pop();
export function isCrossTkTool(toolName, server = null) {
  const name = String(toolName ?? '');
  if (name === '') return false;
  if (CROSS_TK.test(name)) return true;
  const declared = Array.isArray(server?.entry?.tools) ? server.entry.tools : [];
  return declared.some((t) => String(t) === name || last(t) === last(name));
}
