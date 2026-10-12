// Escaping and Brazilian formatting helpers.
export const BASE_DATE = "2026-10-06";
const DAY_MS = 86_400_000;

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ESC[c]);

export const int = (n) => Number(n ?? 0).toLocaleString("pt-BR");
export const compact = (n) => (n >= 1000 ? `${(n / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil` : int(n));
export const hours = (n) => `${int(Math.round(n))} h`;
export const rating = (r) => (r === null || r === undefined ? "—" : r.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
export const pct = (n) => `${Math.round(n)}%`;

const toDate = (iso) => new Date(`${String(iso).slice(0, 10)}T12:00:00`);
export const ddmm = (iso) => { const d = toDate(iso); return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`; };
export const ddmmyyyy = (iso) => `${ddmm(iso)}/${toDate(iso).getFullYear()}`;

export function ago(iso) {
  if (!iso) return "—";
  const days = Math.round((toDate(BASE_DATE) - toDate(iso)) / DAY_MS);
  if (days <= 0) return "hoje";
  if (days === 1) return "ontem";
  if (days < 7) return `há ${days} dias`;
  if (days < 14) return "há 1 semana";
  if (days < 30) return `há ${Math.floor(days / 7)} semanas`;
  if (days < 60) return "há 1 mês";
  if (days < 180) return `há ${Math.floor(days / 30)} meses`;
  return ddmmyyyy(iso);
}
