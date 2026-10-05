import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BOOST_DAYS, MARKETPLACE_TAKE_RATE, MAX_QUOTES, boostActive, canQuote, distanceKm, estimateRange, filterProviders, maskContacts, netForProvider,
  quoteSlotsLeft, rankProviders, takeRateCents,
} from "../../public/js/domain/marketplace.js";

const PINHEIROS = { lat: -23.5666, lng: -46.6913 };
const MOOCA = { lat: -23.5503, lng: -46.5996 };

const provider = (over: Record<string, unknown> = {}) => ({
  id: "p", name: "Prestador", categories: ["eletrica"], lat: PINHEIROS.lat, lng: PINHEIROS.lng,
  rating: 4.5, verified: true, acceptsCredit: true, priceFromCents: 20_000, ...over,
});

describe("distanceKm", () => {
  it("is zero for the same point and about 9.5 km from Pinheiros to Mooca", () => {
    assert.equal(distanceKm(PINHEIROS, PINHEIROS), 0);
    const d = distanceKm(PINHEIROS, MOOCA);
    assert.ok(d > 9 && d < 10, `got ${d}`);
  });

  it("rejects coordinates out of range", () => {
    assert.throws(() => distanceKm({ lat: 91, lng: 0 }, PINHEIROS), RangeError);
    assert.throws(() => distanceKm({ lat: Number.NaN, lng: 0 }, PINHEIROS), RangeError);
  });
});

describe("filterProviders", () => {
  const list = [
    provider({ id: "a", categories: ["eletrica"], rating: 4.9 }),
    provider({ id: "b", categories: ["pintura"], verified: false }),
    provider({ id: "c", categories: ["eletrica"], lat: MOOCA.lat, lng: MOOCA.lng, acceptsCredit: false, priceFromCents: 90_000 }),
  ];

  it("keeps everyone without filters and never mutates the list", () => {
    const copy = structuredClone(list);
    assert.equal(filterProviders(list, {}).length, 3);
    assert.deepEqual(list, copy);
  });

  it("filters by category, radius, rating, verification, credit and price", () => {
    assert.deepEqual(filterProviders(list, { categoryId: "eletrica" }).map((p) => p.id), ["a", "c"]);
    assert.deepEqual(filterProviders(list, { origin: PINHEIROS, radiusKm: 5 }).map((p) => p.id), ["a", "b"]);
    assert.deepEqual(filterProviders(list, { minRating: 4.8 }).map((p) => p.id), ["a"]);
    assert.deepEqual(filterProviders(list, { verifiedOnly: true }).map((p) => p.id), ["a", "c"]);
    assert.deepEqual(filterProviders(list, { creditOnly: true }).map((p) => p.id), ["a", "b"]);
    assert.deepEqual(filterProviders(list, { maxPriceCents: 50_000 }).map((p) => p.id), ["a", "b"]);
  });
});

describe("rankProviders", () => {
  const near = provider({ id: "near", name: "Perto", rating: 4.6 });
  const far = provider({ id: "far", name: "Longe", rating: 4.6, lat: MOOCA.lat, lng: MOOCA.lng });
  const best = provider({ id: "best", name: "Melhor", rating: 5, priceFromCents: 10_000 });

  it("puts the strongest text match first by relevance", () => {
    const ranked = rankProviders([near, far, best], { origin: PINHEIROS, matchScores: { far: 0.95, near: 0.2, best: 0.2 } });
    assert.equal(ranked[0].id, "far");
    assert.ok(ranked[0].relevance > ranked[1].relevance);
  });

  it("uses proximity when the match is the same", () => {
    const ranked = rankProviders([far, near], { origin: PINHEIROS, matchScores: { far: 0.5, near: 0.5 } });
    assert.deepEqual(ranked.map((p) => p.id), ["near", "far"]);
    assert.ok(ranked[0].distanceKm < 1 && ranked[1].distanceKm > 9);
  });

  it("sorts by rating, price or distance when asked", () => {
    assert.equal(rankProviders([near, far, best], { origin: PINHEIROS, sort: "rating" })[0].id, "best");
    assert.equal(rankProviders([near, far, best], { origin: PINHEIROS, sort: "price" })[0].id, "best");
    assert.equal(rankProviders([far, near], { origin: PINHEIROS, sort: "distance" })[0].id, "near");
  });

  it("lifts a provider with an active boost to the top of the relevance order and flags it", () => {
    const now = new Date(2026, 9, 4);
    const boosts = [{ providerId: "far", until: now.getTime() + 1000 }];
    const ranked = rankProviders([near, far], { origin: PINHEIROS, boosts, now });
    assert.equal(ranked[0].id, "far");
    assert.equal(ranked[0].boosted, true);
    assert.equal(ranked[1].boosted, false);
  });
});

describe("estimateRange", () => {
  const listings = [
    { categoryId: "eletrica", priceCents: 30_000 },
    { categoryId: "eletrica", priceCents: 120_000 },
    { categoryId: "pintura", priceCents: 500_000 },
  ];

  it("returns the lowest and highest reference price of the category", () => {
    assert.deepEqual(estimateRange(listings, "eletrica"), { minCents: 30_000, maxCents: 120_000 });
  });

  it("returns null when the category has no listings", () => {
    assert.equal(estimateRange(listings, "piscina"), null);
  });
});

describe("quotes on a request", () => {
  const request = { status: "open", quotes: [{ provider: "A" }, { provider: "B" }] };

  it("allows up to 4 quotes per request", () => {
    assert.equal(MAX_QUOTES, 4);
    assert.equal(quoteSlotsLeft(request), 2);
    assert.equal(quoteSlotsLeft({ status: "open", quotes: [1, 2, 3, 4, 5].map((n) => ({ provider: String(n) })) }), 0);
  });

  it("lets a provider quote once, only while the request is open and has room", () => {
    assert.equal(canQuote(request, "C"), true);
    assert.equal(canQuote(request, "A"), false);
    assert.equal(canQuote({ ...request, status: "closed" }, "C"), false);
    assert.equal(canQuote({ status: "open", quotes: ["A", "B", "C", "D"].map((p) => ({ provider: p })) }, "E"), false);
  });
});

describe("fees", () => {
  it("charges the take rate only on the closed contract and pays the rest to the provider", () => {
    assert.equal(takeRateCents(100_000), Math.round(100_000 * MARKETPLACE_TAKE_RATE));
    assert.equal(netForProvider(100_000) + takeRateCents(100_000), 100_000);
  });

  it("rejects negative or fractional cents", () => {
    assert.throws(() => takeRateCents(-1), RangeError);
    assert.throws(() => takeRateCents(10.5), RangeError);
  });
});

describe("maskContacts", () => {
  it("hides phones, emails and social handles before the contract exists", () => {
    const result = maskContacts("Me chama no zap (11) 98888-7777 ou paulo.reis@mail.com, insta @pauloreis");
    assert.equal(result.masked, true);
    assert.ok(!/\d{4}-\d{4}/.test(result.text), result.text);
    assert.ok(!result.text.includes("@mail.com"), result.text);
    assert.ok(!result.text.includes("@pauloreis"), result.text);
    assert.ok(result.text.includes("[contato oculto]"));
  });

  it("hides a phone written without separators", () => {
    assert.equal(maskContacts("liga 11988887777").masked, true);
  });

  it("keeps prices, dates and sizes untouched", () => {
    const text = "Faço por R$ 2.900,00 em 4 dias, começo dia 05/10, apartamento de 70 m² e CEP 05435-000.";
    assert.deepEqual(maskContacts(text), { text, masked: false });
  });
});

describe("boostActive", () => {
  it("is active until the end time and inactive after", () => {
    const now = new Date(2026, 9, 4);
    assert.equal(BOOST_DAYS, 7);
    assert.equal(boostActive({ providerId: "x", until: now.getTime() + 1 }, now), true);
    assert.equal(boostActive({ providerId: "x", until: now.getTime() - 1 }, now), false);
    assert.equal(boostActive(undefined, now), false);
  });
});
