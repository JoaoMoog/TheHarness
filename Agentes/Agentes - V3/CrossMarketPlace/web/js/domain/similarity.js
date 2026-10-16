// Duplicate detection before publishing: token overlap (Jaccard) on name, summary and tags.
import { normalize } from "./catalog.js";

const STOPWORDS = new Set(["para", "com", "por", "uma", "dos", "das", "que", "sem", "nos", "nas", "the", "and", "aos", "pelo", "pela", "seu", "sua", "como", "mais", "entre"]);
const MIN_LENGTH = 3;

export function tokenize(text) {
  return new Set(normalize(text).split(/[^a-z0-9]+/).filter((w) => w.length >= MIN_LENGTH && !STOPWORDS.has(w)));
}

const tokensOf = (s) => tokenize(`${s.name ?? ""} ${s.summary ?? ""} ${(s.tags ?? []).join(" ")}`);

export function similarity(a, b) {
  const ta = tokensOf(a), tb = tokensOf(b);
  if (!ta.size || !tb.size) return 0;
  const shared = [...ta].filter((t) => tb.has(t)).length;
  return shared / (ta.size + tb.size - shared);
}

/** Closest existing solutions to a draft, best first. */
export function findSimilar(draft, solutions, { threshold = 0.15, limit = 3 } = {}) {
  return solutions
    .filter((s) => s.id !== draft.id)
    .map((solution) => ({ solution, score: similarity(draft, solution) }))
    .filter((r) => r.score >= threshold)
    .sort((x, y) => y.score - x.score)
    .slice(0, limit);
}
