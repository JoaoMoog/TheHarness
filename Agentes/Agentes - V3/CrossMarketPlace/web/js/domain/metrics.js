// Adoption and impact indicators. Base numbers come from the seed; session actions add on top.
import { avgRating, confirmedUses, isPublic } from "./catalog.js";

const round1 = (n) => Math.round(n * 10) / 10;

export const hoursSaved = (s) => (s.usage?.hours ?? 0) + (s.uses ?? []).reduce((sum, u) => sum + (u.hoursSaved ?? 0), 0);

export const engagement = (s) => ({ views: s.usage?.views ?? 0, interests: s.usage?.interests ?? 0, confirmed: confirmedUses(s) });

const meanRating = (list) => {
  const rated = list.map(avgRating).filter((r) => r !== null);
  return rated.length ? round1(rated.reduce((a, b) => a + b, 0) / rated.length) : null;
};

export function teamKpis(solutions, teamId) {
  const mine = solutions.filter((s) => s.teamId === teamId && !s.archived);
  const published = mine.filter(isPublic);
  return {
    published: published.length,
    total: mine.length,
    confirmedUses: published.reduce((sum, s) => sum + confirmedUses(s), 0),
    hoursSaved: published.reduce((sum, s) => sum + hoursSaved(s), 0),
    avgRating: meanRating(published),
  };
}

export function usesByCategory(solutions) {
  const totals = solutions.filter(isPublic).reduce((acc, s) => ({ ...acc, [s.category]: (acc[s.category] ?? 0) + confirmedUses(s) }), {});
  return Object.entries(totals).map(([category, uses]) => ({ category, uses })).sort((a, b) => b.uses - a.uses);
}

export function teamRanking(solutions, teams) {
  return teams
    .map((team) => {
      const list = solutions.filter((s) => s.teamId === team.id && isPublic(s));
      return { team, solutions: list.length, uses: list.reduce((n, s) => n + confirmedUses(s), 0), hours: list.reduce((n, s) => n + hoursSaved(s), 0), rating: meanRating(list) };
    })
    .filter((t) => t.solutions > 0)
    .sort((a, b) => b.uses - a.uses);
}

export const conversion = (confirmed, interests) => (interests > 0 ? Math.round((confirmed / interests) * 100) : 0);
