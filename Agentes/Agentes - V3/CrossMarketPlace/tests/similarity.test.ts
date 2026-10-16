import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findSimilar, similarity, tokenize } from "../web/js/domain/similarity.js";
import { make } from "./fixtures.js";

describe("similarity", () => {
  it("tokenizes without accents, stopwords and short words", () => {
    assert.deepEqual([...tokenize("Simulador de Cenários de Estresse")], ["simulador", "cenarios", "estresse"]);
  });
  it("is 1 for identical content and 0 for unrelated content", () => {
    const a = make({});
    assert.equal(similarity(a, a), 1);
    assert.equal(similarity(a, make({ name: "Painel de churn", summary: "Clientes varejo", tags: ["bi"] })), 0);
  });
  it("finds the closest solutions above the threshold, excluding itself", () => {
    const draft = { id: "new", name: "Stress test de cenários", summary: "Gera cenários de estresse para carteiras", tags: ["risco", "estresse"] };
    const pool = [
      make({ id: "sim", name: "Simulador de Cenários de Estresse", summary: "Cenários de estresse para carteiras da mesa", tags: ["risco"] }),
      make({ id: "far", name: "Leitor de Contratos" }),
      make({ id: "new", name: "Stress test de cenários" }),
    ];
    const found = findSimilar(draft, pool);
    assert.deepEqual(found.map((f: { solution: { id: string } }) => f.solution.id), ["sim"]);
    assert.ok(found[0].score > 0.2 && found[0].score <= 1);
  });
});
