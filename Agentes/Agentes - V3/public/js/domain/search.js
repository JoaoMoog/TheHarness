// Pure functions: free-text search over the services and payments of the app, ignoring accents and case.

/** Lower case without accents, so "Liberação" and "liberacao" are the same word. */
export const normText = (text) => String(text ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Every word of the query appears in the text, in any order. */
export function matches(text, query) {
  const haystack = normText(text);
  return normText(query).split(/\s+/).filter(Boolean).every((word) => haystack.includes(word));
}

/** The items whose title or detail match the query; nothing for an empty query. */
export function searchItems(items, query) {
  if (!String(query ?? "").trim()) return [];
  return items.filter((item) => matches(`${item.title} ${item.detail ?? ""}`, query));
}
