// User-triggered ancestor plan only: no filesystem scans, timers or retained cache.
export function revealPlan(path) {
  const normalized = path.replaceAll("\\", "/").replace(/\/$/, "");
  if (!normalized || normalized.startsWith("/") || /^[a-z]:/i.test(normalized))
    throw new Error("Caminho relativo inválido.");
  const parts = normalized.split("/");
  if (parts.some((p) => !p || p === "." || p === ".."))
    throw new Error("Caminho relativo inválido.");
  const ancestors = [""];
  for (let i = 1; i < parts.length; i++) ancestors.push(parts.slice(0, i).join("/"));
  return { path: normalized, ancestors };
}
export function createNavigationGate() {
  let generation = 0;
  return {
    begin: () => ++generation,
    invalidate: () => ++generation,
    current: (token) => token === generation,
  };
}
export async function revealAncestors(plan, { active, expanded, load, limit }) {
  for (const path of plan.ancestors) {
    if (!active()) return false;
    if (!expanded.has(path) && expanded.size >= limit)
      throw new Error("Limite de pastas abertas; recolha pastas para revelar o caminho completo.");
    await load(path);
    if (!active()) return false;
    expanded.add(path);
  }
  return true;
}
