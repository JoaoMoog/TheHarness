import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { conversion, engagement, hoursSaved, teamKpis, teamRanking, usesByCategory } from "../web/js/domain/metrics.js";
import { make } from "./fixtures.js";

const list = [
  make({ id: "a", teamId: "risco", category: "apis", uses: [{ hoursSaved: 2 }] }),
  make({ id: "b", teamId: "risco", category: "agentes", ratings: [{ userId: "x", stars: 3 }] }),
  make({ id: "c", teamId: "risco", approval: "em_analise" }),
  make({ id: "d", teamId: "ops", category: "apis", usage: { views: 1, interests: 1, confirmed: 900, hours: 10 } }),
];

describe("metrics", () => {
  it("separates opening, interest and confirmed use", () => {
    assert.deepEqual(engagement(list[0]), { views: 1000, interests: 200, confirmed: 101 });
  });
  it("adds session hours to the base hours", () => assert.equal(hoursSaved(list[0]), 52));
  it("computes team indicators over published solutions", () => {
    assert.deepEqual(teamKpis(list, "risco"), { published: 2, total: 3, confirmedUses: 201, hoursSaved: 102, avgRating: 3.8 });
  });
  it("aggregates confirmed uses by category, highest first", () => {
    assert.deepEqual(usesByCategory(list), [{ category: "apis", uses: 1001 }, { category: "agentes", uses: 100 }]);
  });
  it("ranks teams by confirmed uses", () => {
    const r = teamRanking(list, [{ id: "risco", name: "Risco Quant" }, { id: "ops", name: "Ops Tech" }]);
    assert.deepEqual(r.map((t: { team: { id: string } }) => t.team.id), ["ops", "risco"]);
    assert.equal(r[1].solutions, 2);
  });
  it("computes interest-to-use conversion as a whole percentage", () => {
    assert.equal(conversion(52, 100), 52);
    assert.equal(conversion(1, 0), 0);
  });
});
