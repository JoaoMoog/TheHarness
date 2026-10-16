import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { matches, searchItems } from "../../public/js/domain/search.js";

const items = [
  { id: "a", title: "Pintura do apartamento", detail: "Horizonte Reformas · R$ 16.000,00" },
  { id: "b", title: "Projeto de interiores", detail: "Marina Costa · R$ 6.000,00" },
  { id: "c", title: "Pix recebido", detail: "Aval · liberação do marco" },
];

describe("matches", () => {
  it("ignores accents and upper case", () => {
    assert.equal(matches("Liberação do marco", "liberacao"), true);
    assert.equal(matches("Projeto de INTERIORES", "interiores"), true);
  });

  it("needs every word of the query, in any order", () => {
    assert.equal(matches("Pintura do apartamento", "apartamento pintura"), true);
    assert.equal(matches("Pintura do apartamento", "pintura cozinha"), false);
  });
});

describe("searchItems", () => {
  it("finds by the title or by the detail", () => {
    assert.deepEqual(searchItems(items, "horizonte").map((i) => i.id), ["a"]);
    assert.deepEqual(searchItems(items, "marco").map((i) => i.id), ["c"]);
  });

  it("returns nothing for an empty query", () => {
    assert.deepEqual(searchItems(items, "   "), []);
  });
});
