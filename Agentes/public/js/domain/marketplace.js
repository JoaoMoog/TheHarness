// Nexo Serviços marketplace rules as pure functions: distance, filters, ranking, price range, quote slots, fees, boosts.
// The code decides the order; the Jev only contributes a text match score per provider.

/** Intermediation fee charged to the provider only when a contract closes. */
export const MARKETPLACE_TAKE_RATE = 0.06;
export const MAX_QUOTES = 4;
export const BOOST_DAYS = 7;
export const BOOST_PRICE_CENTS = 4_990;

const EARTH_RADIUS_KM = 6371;
const NEUTRAL_MATCH = 0.5;
const PROXIMITY_HORIZON_KM = 20;
const MAX_RATING = 5;
const WEIGHTS = { match: 0.5, rating: 0.25, proximity: 0.15, verified: 0.1 };

const rad = (deg) => (deg * Math.PI) / 180;
const validPoint = (p) => Number.isFinite(p?.lat) && Number.isFinite(p?.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180;

/** Great-circle distance in km between two { lat, lng } points. */
export function distanceKm(a, b) {
  if (!validPoint(a) || !validPoint(b)) throw new RangeError("Coordenadas inválidas");
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Keeps the providers that pass every filter given; filters left out do not restrict. */
export function filterProviders(list, { categoryId, origin, radiusKm, minRating, verifiedOnly, creditOnly, maxPriceCents } = {}) {
  return list.filter((p) =>
    (!categoryId || p.categories.includes(categoryId))
    && (!origin || !radiusKm || distanceKm(origin, p) <= radiusKm)
    && (!minRating || p.rating >= minRating)
    && (!verifiedOnly || p.verified)
    && (!creditOnly || p.acceptsCredit)
    && (!maxPriceCents || p.priceFromCents <= maxPriceCents));
}

export const boostActive = (boost, now) => Boolean(boost) && now.getTime() <= boost.until;

const SORTS = {
  relevance: (a, b) => Number(b.boosted) - Number(a.boosted) || b.relevance - a.relevance,
  rating: (a, b) => b.rating - a.rating,
  price: (a, b) => a.priceFromCents - b.priceFromCents,
  distance: (a, b) => a.distanceKm - b.distanceKm,
};

/**
 * Orders providers. Relevance mixes the Jev match score (neutral when missing), rating, proximity and verification;
 * an active boost puts the provider first in that order. Returns new objects with distanceKm, relevance and boosted.
 */
export function rankProviders(list, { matchScores = {}, origin, sort = "relevance", boosts = [], now = new Date() } = {}) {
  const scored = list.map((p) => {
    const dist = origin ? distanceKm(origin, p) : 0;
    const proximity = 1 - Math.min(dist, PROXIMITY_HORIZON_KM) / PROXIMITY_HORIZON_KM;
    const match = matchScores[p.id] ?? NEUTRAL_MATCH;
    const relevance = WEIGHTS.match * match + WEIGHTS.rating * (p.rating / MAX_RATING) + WEIGHTS.proximity * proximity + WEIGHTS.verified * (p.verified ? 1 : 0);
    const boosted = boosts.some((b) => b.providerId === p.id && boostActive(b, now));
    return { ...p, distanceKm: dist, relevance, boosted };
  });
  const compare = SORTS[sort] ?? SORTS.relevance;
  return [...scored].sort((a, b) => compare(a, b) || a.name.localeCompare(b.name, "pt-BR"));
}

/** Lowest and highest reference price among the listings of a category, or null. */
export function estimateRange(listings, categoryId) {
  const prices = listings.filter((l) => l.categoryId === categoryId).map((l) => l.priceCents);
  return prices.length ? { minCents: Math.min(...prices), maxCents: Math.max(...prices) } : null;
}

export const quoteSlotsLeft = (request) => Math.max(0, MAX_QUOTES - request.quotes.length);

export const canQuote = (request, providerName) =>
  request.status === "open" && quoteSlotsLeft(request) > 0 && !request.quotes.some((q) => q.provider === providerName);

export function takeRateCents(totalCents) {
  if (!Number.isInteger(totalCents) || totalCents < 0) throw new RangeError("Valor em centavos inválido");
  return Math.round(totalCents * MARKETPLACE_TAKE_RATE);
}

export const netForProvider = (totalCents) => totalCents - takeRateCents(totalCents);

const HIDDEN = "[contato oculto]";
const CONTACT_PATTERNS = [
  [/[\w.+-]+@[\w-]+\.[\w.]+/g, HIDDEN],
  [/(^|\s)@[\w.]{3,}/g, `$1${HIDDEN}`],
  [/(?<!\d)(\+?55\s?)?(\(?\d{2}\)?[\s-]?)?9?\d{4}[\s-]?\d{4}(?!\d)/g, HIDDEN],
];

/** Before a contract exists, phones, emails and handles are hidden so the deal stays protected inside the app. */
export function maskContacts(text) {
  const masked = CONTACT_PATTERNS.reduce((acc, [pattern, replacement]) => acc.replace(pattern, replacement), text);
  return { text: masked, masked: masked !== text };
}
