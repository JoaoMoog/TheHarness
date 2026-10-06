import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PROFILES, can, canOpenRoute } from "../web/js/domain/permissions.js";

describe("permissions", () => {
  it("has the four product profiles", () => assert.deepEqual(PROFILES, ["colaborador", "publicador", "aprovador", "admin"]));
  it("lets every profile browse, favorite, request access and rate", () => {
    for (const p of PROFILES) for (const a of ["catalog.view", "solution.favorite", "solution.request", "solution.rate"]) assert.ok(can(p, a), p + " " + a);
  });
  it("restricts publishing, approvals and administration", () => {
    assert.equal(can("colaborador", "solution.publish"), false);
    assert.equal(can("publicador", "solution.publish"), true);
    assert.equal(can("publicador", "approvals.decide"), false);
    assert.equal(can("aprovador", "approvals.decide"), true);
    assert.equal(can("aprovador", "admin.view"), false);
    assert.equal(can("admin", "admin.view"), true);
  });
  it("only publishers and admins decide access requests", () => {
    assert.equal(can("colaborador", "access.decide"), false);
    assert.equal(can("publicador", "access.decide"), true);
  });
  it("denies unknown profiles and actions", () => {
    assert.equal(can("visitante", "catalog.view"), false);
    assert.equal(can("admin", "nada"), false);
  });
  it("maps protected routes to permissions", () => {
    assert.equal(canOpenRoute("colaborador", "admin"), false);
    assert.equal(canOpenRoute("colaborador", "aprovacoes"), false);
    assert.equal(canOpenRoute("colaborador", "publicar"), false);
    assert.equal(canOpenRoute("colaborador", "catalogo"), true);
    assert.equal(canOpenRoute("aprovador", "aprovacoes"), true);
  });
});
