// Presentation from bounded Git records, never from a workspace disk scan.
export const GIT_FOLDER_LIMITS = {
  entries: 2000,
  nodes: 8000,
  depth: 16,
  loaded: 16,
  rows: 200,
};
const key = (path) => path.replaceAll("\\", "/").replace(/\/$/, "");
const below = (path, parent) =>
  path === parent || path.startsWith(parent + "/");

export function groupGitChanges(entries) {
  const root = { children: new Map(), files: [], count: 0 };
  const folders = new Map();
  let compacted = false;
  for (const entry of entries.slice(0, GIT_FOLDER_LIMITS.entries)) {
    const parts = key(entry.path).split("/");
    const directories = entry.directory ? parts.length : parts.length - 1;
    let parent = root;
    parent.count += entry.empty ? 0 : 1;
    let i = 0;
    for (; i < directories; i++) {
      const prefix = parts.slice(0, i + 1).join("/");
      if (!parent.children.has(parts[i])) {
        if (
          i >= GIT_FOLDER_LIMITS.depth ||
          folders.size >= GIT_FOLDER_LIMITS.nodes
        ) {
          compacted = true;
          break;
        }
        const folder = {
          path: prefix,
          label: parts[i],
          children: new Map(),
          files: [],
          count: 0,
        };
        parent.children.set(parts[i], folder);
        folders.set(prefix, folder);
      }
      parent = parent.children.get(parts[i]);
      parent.count += entry.empty ? 0 : 1;
    }
    if (entry.directory && i === directories) parent.entry = entry;
    else
      parent.files.push({
        kind: "file",
        entry,
        label: parts.slice(i).join("/"),
        depth: i,
      });
  }
  return {
    root,
    folders,
    compacted: compacted || entries.length > GIT_FOLDER_LIMITS.entries,
  };
}

export function gitFolderRows(tree, expanded) {
  for (const path of expanded)
    if (!tree.folders.has(path)) expanded.delete(path);
  const rows = [];
  const stack = [{ node: tree.root, depth: 0 }];
  while (stack.length) {
    const { node, depth } = stack.pop();
    if (node.path) {
      rows.push({
        kind: "folder",
        path: node.path,
        label: node.label,
        count: node.count,
        entry: node.entry,
        depth: depth - 1,
        expanded: expanded.has(node.path),
      });
      if (!expanded.has(node.path)) continue;
    }
    rows.push(...node.files);
    const children = [...node.children.values()].sort((a, b) =>
      a.label.localeCompare(b.label),
    );
    for (let i = children.length - 1; i >= 0; i--)
      stack.push({ node: children[i], depth: depth + 1 });
  }
  return rows;
}

export function gitFolderPage(rows, requested = 0) {
  const pages = Math.max(1, Math.ceil(rows.length / GIT_FOLDER_LIMITS.rows));
  const page = Math.max(0, Math.min(requested, pages - 1));
  return {
    page,
    pages,
    rows: rows.slice(
      page * GIT_FOLDER_LIMITS.rows,
      (page + 1) * GIT_FOLDER_LIMITS.rows,
    ),
  };
}

export function createGitFolderState() {
  let scope = null,
    revision = 0,
    pending = null;
  const loaded = new Map();
  const expanded = [new Set(), new Set()];
  const collapsed = [new Set(), new Set()];
  const defaults = [true, true];
  let batch = false, attemptedRevision = -1;
  const state = {
    expanded,
    get pending() {
      return pending?.path ?? null;
    },
    get expanding() { return batch || !!pending; },
    get needsExpansion() { return attemptedRevision !== revision; },
    setRoot(root) {
      if (scope !== root) {
        state.invalidate();
        for (const set of expanded) set.clear();
        for (const set of collapsed) set.clear();
        defaults.fill(true);
        scope = root;
      }
    },
    invalidate() {
      revision++;
      for (const path of loaded.keys())
        for (const set of expanded)
          for (const open of set) if (below(open, path)) set.delete(open);
      loaded.clear();
      // Reads remain serialized until completion; late responses are ignored.
    },
    collapse(path, section = 1) {
      path = key(path);
      collapsed[section].add(path);
      for (const open of expanded[section])
        if (below(open, path)) expanded[section].delete(open);
      if (section === 1) {
        revision++;
        for (const cached of loaded.keys())
          if (below(cached, path)) loaded.delete(cached);
      }
    },
    sync(tree, section) {
      // Only bounded status nodes: no filesystem enumeration or DOM expansion.
      for (const set of [expanded[section], collapsed[section]])
        for (const path of set) if (!tree.folders.has(path)) set.delete(path);
      if (defaults[section])
        for (const path of tree.folders.keys())
          if (!collapsed[section].has(path)) expanded[section].add(path);
      return expanded[section];
    },
    expand(path, section = 1) {
      path = key(path);
      collapsed[section].delete(path);
      expanded[section].add(path);
    },
    expandAll(section) {
      defaults[section] = true;
      collapsed[section].clear();
      if (section === 1) revision++; // Explicit action permits one new bounded batch.
    },
    collapseAll(section) {
      defaults[section] = false;
      expanded[section].clear();
      collapsed[section].clear();
      if (section === 1) {
        revision++;
        loaded.clear();
      }
    },
    async loadExpanded(root, entries, read, { active = () => true, changed = () => {} } = {}) {
      state.setRoot(root);
      if (batch || pending || attemptedRevision === revision || !active()) return;
      const generation = revision;
      attemptedRevision = generation;
      const tree = groupGitChanges(state.project(entries).entries);
      const candidates = gitFolderRows(tree, state.sync(tree, 1))
        .filter(row => row.expanded && row.entry?.directory && !loaded.has(row.path));
      batch = true;
      try {
        for (const row of candidates.slice(0, GIT_FOLDER_LIMITS.loaded)) {
          if (scope !== root || revision !== generation) return;
          if (!active()) { attemptedRevision = -1; return; }
          const loading = state.load(root, entries, row.entry, read);
          changed();
          if (!(await loading)) return;
          changed();
        }
        if (candidates.length > GIT_FOLDER_LIMITS.loaded)
          throw new Error("Expansão limitada a 16 pastas novas/2.000 caminhos; recolha pastas para carregar outras.");
      } finally { batch = false; }
    },
    project(entries) {
      let partial = entries.length > GIT_FOLDER_LIMITS.entries;
      const projected = [];
      for (const entry of entries) {
        const group = entry.directory && loaded.get(key(entry.path));
        if (group) partial ||= group.partial;
        const records = group
          ? group.entries.length
            ? group.entries
            : [{ ...entry, empty: true }]
          : [entry];
        const remaining = GIT_FOLDER_LIMITS.entries - projected.length;
        if (records.length > remaining) partial = true;
        projected.push(...records.slice(0, remaining));
      }
      return { entries: projected, partial };
    },
    async load(root, entries, entry, read) {
      state.setRoot(root);
      const path = key(entry.path);
      if (pending) throw new Error("Aguarde o carregamento da pasta atual.");
      if (loaded.has(path)) return true;
      if (loaded.size >= GIT_FOLDER_LIMITS.loaded)
        throw new Error(
          "Limite de 16 pastas novas abertas; recolha uma para abrir outra.",
        );
      const capacity =
        GIT_FOLDER_LIMITS.entries - state.project(entries).entries.length + 1;
      if (capacity <= 0)
        throw new Error(
          "Limite de 2.000 caminhos; recolha uma pasta nova ou use o terminal.",
        );
      const token = { root, path, revision };
      pending = token;
      try {
        const result = await read({ root, path: entry.path });
        if (scope !== root || revision !== token.revision) return false;
        if (
          result.entries.some(
            (e) => !below(key(e.path), path) || key(e.path) === path,
          )
        )
          throw new Error(
            "Resposta Git fora da pasta solicitada; lista preservada.",
          );
        loaded.set(path, {
          entries: result.entries.slice(0, capacity),
          partial: !!result.partial || result.entries.length > capacity,
        });
        return true;
      } finally {
        if (pending === token) pending = null;
      }
    },
  };
  return state;
}
