import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { addVersion, archiveSolution, compareSemver, confirmUse, createAccessRequest, decideAccess, rateSolution, transitionApproval } from "../web/js/domain/workflow.js";
import { make } from "./fixtures.js";

const who = { by: "u-jb", at: "2026-10-06" };

describe("approval workflow", () => {
  it("submits a draft for analysis and keeps history", () => {
    const draft = make({ approval: "rascunho", history: [] });
    const next = transitionApproval(draft, "em_analise", who);
    assert.equal(next.approval, "em_analise");
    assert.deepEqual(next.history.at(-1), { at: "2026-10-06", by: "u-jb", from: "rascunho", to: "em_analise", note: "" });
    assert.equal(draft.approval, "rascunho", "original is not mutated");
  });
  it("approves, rejects or requests correction from analysis", () => {
    const s = make({ approval: "em_analise" });
    assert.equal(transitionApproval(s, "aprovada", who).approval, "aprovada");
    assert.equal(transitionApproval(s, "correcao", { ...who, note: "Falta manual" }).approval, "correcao");
    assert.equal(transitionApproval(s, "rejeitada", { ...who, note: "Duplicada" }).approval, "rejeitada");
  });
  it("requires a justification to reject or request correction", () => {
    const s = make({ approval: "em_analise" });
    assert.throws(() => transitionApproval(s, "rejeitada", who), /justificativa/i);
    assert.throws(() => transitionApproval(s, "correcao", { ...who, note: "  " }), /justificativa/i);
  });
  it("allows resubmitting after correction", () => {
    assert.equal(transitionApproval(make({ approval: "correcao" }), "em_analise", who).approval, "em_analise");
  });
  it("refuses invalid transitions", () => {
    assert.throws(() => transitionApproval(make({ approval: "rascunho" }), "aprovada", who), /não permitida/i);
    assert.throws(() => transitionApproval(make({ approval: "aprovada" }), "rejeitada", { ...who, note: "x" }), /não permitida/i);
  });
  it("archives without changing the approval status", () => {
    const a = archiveSolution(make({}), who);
    assert.equal(a.archived, true);
    assert.equal(a.approval, "aprovada");
    assert.equal(a.history.at(-1).to, "arquivada");
    assert.throws(() => archiveSolution(a, who), /já está arquivada/i);
  });
});

describe("access requests", () => {
  const sol = make({ access: "autorizacao" });
  const valid = { id: "r1", solution: sol, requesterId: "u-ms", justification: "Usar no modelo de limite PJ", at: "2026-10-06" };
  it("creates a pending request with justification", () => {
    const r = createAccessRequest(valid);
    assert.equal(r.status, "pendente");
    assert.equal(r.solutionId, "s1");
  });
  it("refuses requests for direct-access solutions or without a real justification", () => {
    assert.throws(() => createAccessRequest({ ...valid, solution: make({ access: "direto" }) }), /acesso direto/i);
    assert.throws(() => createAccessRequest({ ...valid, justification: "quero" }), /justificativa/i);
  });
  it("approves or rejects only pending requests, with a reason to reject", () => {
    const r = createAccessRequest(valid);
    const ok = decideAccess(r, "aprovada", who);
    assert.equal(ok.status, "aprovada");
    assert.equal(ok.decidedBy, "u-jb");
    assert.throws(() => decideAccess(r, "rejeitada", who), /justificativa/i);
    assert.throws(() => decideAccess(ok, "rejeitada", { ...who, note: "x" }), /já foi decidida/i);
  });
});

describe("ratings and confirmed use", () => {
  it("keeps one rating per person and lets them update it", () => {
    const s = rateSolution(make({}), { userId: "u1", stars: 3, comment: "Mudou", at: "2026-10-06" });
    assert.equal(s.ratings.length, 2);
    assert.equal(s.ratings.find((r: { userId: string }) => r.userId === "u1").stars, 3);
    assert.throws(() => rateSolution(make({}), { userId: "u9", stars: 6, comment: "", at: "x" }), /1 e 5/);
  });
  it("records confirmed use with usefulness, reuse intent and time saved", () => {
    const s = confirmUse(make({}), { userId: "u-jb", useful: true, reuse: true, hoursSaved: 3, at: "2026-10-06" });
    assert.equal(s.uses.length, 1);
    assert.throws(() => confirmUse(make({}), { userId: "u", useful: true, reuse: true, hoursSaved: -1, at: "x" }), /tempo/i);
  });
});

describe("versions", () => {
  it("compares semantic versions", () => {
    assert.equal(compareSemver("v1.10.0", "v1.9.9") > 0, true);
    assert.equal(compareSemver("2.0.0", "v2.0.0"), 0);
  });
  it("adds a newer version to the top of the list", () => {
    const s = addVersion(make({ versions: [{ version: "v2.3.0" }] }), { version: "v2.4.0", note: "Planilhas", ...who });
    assert.equal(s.version, "v2.4.0");
    assert.equal(s.versions[0].version, "v2.4.0");
    assert.throws(() => addVersion(make({}), { version: "v2.3.0", note: "x", ...who }), /maior/i);
    assert.throws(() => addVersion(make({}), { version: "abc", note: "x", ...who }), /inválida/i);
  });
});
