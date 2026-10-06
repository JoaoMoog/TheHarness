import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { avgRating, confirmedUses, facetCounts, isPublic, normalize, searchCatalog } from "../web/js/domain/catalog.js";
import { make } from "./fixtures.js";

const list = [
  make({ id: "a", name: "Leitor de Contratos", tags: ["ocr"], updatedAt: "2026-10-04" }),
  make({ id: "b", name: "Score de Liquidez", summary: "API de liquidez", tags: ["risco"], category: "apis", teamId: "risco", access: "autorizacao", lifecycle: "piloto", updatedAt: "2026-09-20", usage: { views: 1, interests: 1, confirmed: 500, hours: 1 }, ratings: [{ userId: "u", stars: 3 }] }),
  make({ id: "c", name: "Revisor de Contratos", approval: "em_analise" }),
  make({ id: "d", name: "Contratos antigos", archived: true }),
];

describe("catalog visibility", () => {
  it("only approved and non-archived solutions are public", () => {
    assert.deepEqual(list.filter(isPublic).map((s) => s.id), ["a", "b"]);
  });
});

describe("normalize", () => {
  it("lowercases and strips accents", () => assert.equal(normalize("Jurídico AÇÃO"), "juridico acao"));
});

describe("searchCatalog", () => {
  it("finds by name, description and tags ignoring accents and case", () => {
    assert.deepEqual(searchCatalog(list, { q: "CONTRATOS" }).map((s) => s.id), ["a"]);
    assert.deepEqual(searchCatalog(list, { q: "liquidez" }).map((s) => s.id), ["b"]);
    assert.deepEqual(searchCatalog(list, { q: "OCR" }).map((s) => s.id), ["a"]);
  });
  it("never returns solutions outside the public catalog", () => {
    assert.ok(searchCatalog(list, {}).every(isPublic));
  });
  it("filters by category, team, lifecycle, access and minimum rating", () => {
    assert.deepEqual(searchCatalog(list, { categories: ["apis"] }).map((s) => s.id), ["b"]);
    assert.deepEqual(searchCatalog(list, { teams: ["juridico"] }).map((s) => s.id), ["a"]);
    assert.deepEqual(searchCatalog(list, { lifecycles: ["piloto"] }).map((s) => s.id), ["b"]);
    assert.deepEqual(searchCatalog(list, { access: ["direto"] }).map((s) => s.id), ["a"]);
    assert.deepEqual(searchCatalog(list, { minRating: 4 }).map((s) => s.id), ["a"]);
  });
  it("sorts by update date, usage and rating", () => {
    assert.deepEqual(searchCatalog(list, { sort: "atualizacao" }).map((s) => s.id), ["a", "b"]);
    assert.deepEqual(searchCatalog(list, { sort: "uso" }).map((s) => s.id), ["b", "a"]);
    assert.deepEqual(searchCatalog(list, { sort: "avaliacao" }).map((s) => s.id), ["a", "b"]);
  });
  it("returns an empty list when nothing matches", () => {
    assert.deepEqual(searchCatalog(list, { q: "cripto" }), []);
  });
});

describe("indicators", () => {
  it("averages ratings with one decimal and returns null without ratings", () => {
    assert.equal(avgRating(make({})), 4.5);
    assert.equal(avgRating(make({ ratings: [] })), null);
  });
  it("adds confirmed uses registered in the session to the base count", () => {
    assert.equal(confirmedUses(make({ uses: [{}, {}] })), 102);
  });
  it("counts facets over public solutions only", () => {
    assert.deepEqual(facetCounts(list, "category"), { agentes: 1, apis: 1 });
  });
});
