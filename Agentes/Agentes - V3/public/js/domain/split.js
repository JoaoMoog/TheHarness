// Paying a service together: who is invited, by which channel, and how much each person pays. Pure functions.
// Percentages are kept in basis points (10000 = 100%) so the arithmetic stays exact.

const MOBILE_DIGITS = 11;
const COUNTRY_CODE = "55";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const FULL_BPS = 10_000;

/** Equal shares in whole cents; the last person takes the leftover so the shares add up to the total. */
export function splitShares(totalCents, names) {
  if (!Number.isInteger(totalCents) || totalCents <= 0) throw new RangeError("totalCents must be a positive whole number of cents");
  if (!Array.isArray(names) || names.length < 2) throw new RangeError("a shared payment needs at least two people");
  const base = Math.floor(totalCents / names.length);
  const leftover = totalCents - base * names.length;
  return names.map((name, i) => ({ name, shareCents: i === names.length - 1 ? base + leftover : base }));
}

/** A typed percentage ("50", "33,33", "12.5 %") in basis points; null when not between 0 (excl.) and 100 with up to 2 decimals. */
export function parsePercent(text) {
  const m = /^(\d{1,3})(?:[.,](\d{1,2}))?$/.exec(String(text ?? "").replace("%", "").trim());
  if (!m) return null;
  const bps = Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
  return bps > 0 && bps <= FULL_BPS ? bps : null;
}

/** 100% split evenly among n people; the last one takes the rounding. */
export function equalBps(n) {
  const base = Math.floor(FULL_BPS / n);
  return Array.from({ length: n }, (_, i) => (i === n - 1 ? FULL_BPS - base * (n - 1) : base));
}

const spread = (total, weights) => {
  const sum = weights.reduce((a, b) => a + b, 0);
  const parts = weights.map((w) => Math.floor((total * w) / sum));
  parts[parts.length - 1] += total - parts.reduce((a, b) => a + b, 0);
  return parts;
};

/** Cents for each percentage; the last person takes the leftover cents so the shares add up to the total. */
export function sharesFromBps(totalCents, bps) {
  if (!Number.isInteger(totalCents) || totalCents <= 0) throw new RangeError("totalCents must be a positive whole number of cents");
  if (bps.some((b) => !Number.isInteger(b) || b <= 0) || bps.reduce((a, b) => a + b, 0) !== FULL_BPS) {
    throw new RangeError("percentages must be positive and add up to 100%");
  }
  return spread(totalCents, bps);
}

/**
 * New percentages and shares for whoever is still in the group. Chosen percentages are kept; when someone left,
 * the rest is scaled up in proportion. Without percentages, everyone gets an equal part. Locked once someone paid.
 */
export function rebalance(totalCents, participants) {
  if (participants.some((p) => p.paid)) throw new RangeError("shares cannot change after someone has paid");
  if (!Number.isInteger(totalCents) || totalCents <= 0) throw new RangeError("totalCents must be a positive whole number of cents");
  const chosen = participants.every((p) => Number.isInteger(p.bps) && p.bps > 0);
  const weights = chosen ? participants.map((p) => p.bps) : participants.map(() => 1);
  // Cents come from the exact proportions, not from rounded percentages, so equal parts stay equal to the cent.
  const bps = spread(FULL_BPS, weights);
  const shares = spread(totalCents, weights);
  return participants.map((p, i) => ({ ...p, bps: bps[i], shareCents: shares[i] }));
}

/** "50%", "62,5%", "33,33%". */
export const formatBps = (bps) => `${String(bps / 100).replace(".", ",")}%`;

/**
 * An invite goes to a Brazilian mobile number (by WhatsApp) or to an e-mail (by link).
 * Returns the channel and the contact in a standard format, or null when it is neither.
 */
export function parseContact(text) {
  const raw = String(text ?? "").trim();
  if (EMAIL.test(raw)) return { channel: "email", contact: raw.toLowerCase() };
  const digits = raw.replace(/\D/g, "");
  const local = digits.length === MOBILE_DIGITS + COUNTRY_CODE.length && digits.startsWith(COUNTRY_CODE) ? digits.slice(COUNTRY_CODE.length) : digits;
  if (/[a-z]/i.test(raw) || local.length !== MOBILE_DIGITS || local[2] !== "9") return null;
  return { channel: "whatsapp", contact: `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}` };
}

/** How many invited people still have to accept or decline. */
export const pendingCount = (participants) => participants.filter((p) => p.status === "pending").length;
