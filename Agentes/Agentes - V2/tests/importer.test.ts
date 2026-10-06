import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseImport } from "../web/js/domain/importer.js";

const good = { name: "Stress Test Bot", summary: "Gera cenários de estresse com IA", category: "agentes", tags: ["risco", "genai"] };

describe("structured import", () => {
  it("accepts valid JSON", () => {
    const r = parseImport(JSON.stringify(good));
    assert.equal(r.ok, true);
    assert.equal(r.value.name, "Stress Test Bot");
  });
  it("accepts a simple YAML document", () => {
    const r = parseImport("name: Stress Test Bot\nsummary: Gera cenários de estresse com IA\ncategory: agentes\ntags: [risco, genai]\naccess: autorizacao");
    assert.equal(r.ok, true);
    assert.deepEqual(r.value.tags, ["risco", "genai"]);
    assert.equal(r.value.access, "autorizacao");
  });
  it("reports field errors in Portuguese", () => {
    const r = parseImport(JSON.stringify({ name: "X", category: "foguete", tags: [] }));
    assert.equal(r.ok, false);
    assert.match(r.errors?.name ?? "", /3/);
    assert.match(r.errors?.summary ?? "", /obrigatória/i);
    assert.match(r.errors?.category ?? "", /categoria/i);
    assert.match(r.errors?.tags ?? "", /tag/i);
  });
  it("rejects unreadable content and empty input", () => {
    assert.equal(parseImport("{ quebrado").ok, false);
    assert.equal(parseImport("   ").ok, false);
  });
  it("rejects invalid optional values", () => {
    const r = parseImport(JSON.stringify({ ...good, access: "talvez", lifecycle: "beta" }));
    assert.equal(r.ok, false);
    assert.ok(r.errors?.access && r.errors?.lifecycle);
  });
});
