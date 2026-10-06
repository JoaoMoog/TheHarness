// Demo calendar. Dates are stored as "dd/mm"; the demo year starts in July 2026.
export const BASE_DATE = new Date(2026, 9, 4);
const DAY_MS = 86_400_000;
const FIRST_MONTH_OF_DEMO_YEAR = 7;

const DEMO_YEAR = 2026;

/** "dd/mm" inside the demo year; "dd/mm/aa" otherwise, so later dates keep their year. */
export const fmtDate = (d) =>
  d.toLocaleDateString("pt-BR", d.getFullYear() === DEMO_YEAR ? { day: "2-digit", month: "2-digit" } : { day: "2-digit", month: "2-digit", year: "2-digit" });
export const shiftDate = (date, days) => new Date(date.getTime() + days * DAY_MS);

export function parseDdMm(text) {
  const [d, m, y] = String(text).split("/").map(Number);
  if (y) return new Date(y < 100 ? 2000 + y : y, m - 1, d);
  return new Date(m >= FIRST_MONTH_OF_DEMO_YEAR ? DEMO_YEAR : DEMO_YEAR + 1, m - 1, d);
}

export const daysBetween = (from, to) => Math.round((to.getTime() - from.getTime()) / DAY_MS);
