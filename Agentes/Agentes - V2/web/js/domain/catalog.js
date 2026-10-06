// Discovery rules: what is public, how search, filters and sorting work.

/** Lowercase text without accents, for tolerant matching. */
export const normalize = (text) => String(text ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Only approved, non-archived solutions enter the general catalog. */
export const isPublic = (s) => s.approval === "aprovada" && !s.archived;

export function avgRating(s) {
  const list = s.ratings ?? [];
  if (!list.length) return null;
  return Math.round((list.reduce((sum, r) => sum + r.stars, 0) / list.length) * 10) / 10;
}

export const confirmedUses = (s) => (s.usage?.confirmed ?? 0) + (s.uses?.length ?? 0);

const relevance = (s, q) => {
  if (!q) return 0;
  const name = normalize(s.name), summary = normalize(s.summary), tags = (s.tags ?? []).map(normalize);
  return (name.includes(q) ? 3 : 0) + (tags.some((t) => t.includes(q)) ? 2 : 0) + (summary.includes(q) ? 1 : 0);
};

const SORTERS = {
  atualizacao: (a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)),
  uso: (a, b) => confirmedUses(b) - confirmedUses(a),
  avaliacao: (a, b) => (avgRating(b) ?? 0) - (avgRating(a) ?? 0),
};

const inList = (list, value) => !list?.length || list.includes(value);

/** Searches the public catalog. Returns a new, sorted array. */
export function searchCatalog(solutions, filters = {}) {
  const { q = "", categories = [], teams = [], lifecycles = [], access = [], minRating = 0, sort = "relevancia" } = filters;
  const query = normalize(q);
  const matches = solutions
    .filter(isPublic)
    .filter((s) => !query || relevance(s, query) > 0)
    .filter((s) => inList(categories, s.category) && inList(teams, s.teamId) && inList(lifecycles, s.lifecycle) && inList(access, s.access))
    .filter((s) => !minRating || (avgRating(s) ?? 0) >= minRating);
  const sorter = SORTERS[sort] ?? ((a, b) => relevance(b, query) - relevance(a, query) || SORTERS.atualizacao(a, b));
  return [...matches].sort(sorter);
}

/** Counts public solutions per value of a field (category, teamId, lifecycle, access). */
export function facetCounts(solutions, key) {
  return solutions.filter(isPublic).reduce((acc, s) => ({ ...acc, [s[key]]: (acc[s[key]] ?? 0) + 1 }), {});
}
