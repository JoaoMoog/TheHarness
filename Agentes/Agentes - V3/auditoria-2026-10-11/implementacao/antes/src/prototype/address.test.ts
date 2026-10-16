import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { composeAddress, demoCep, formatCep, normalizeCep } from "../../public/js/domain/address.js";

describe("normalizeCep", () => {
  it("keeps only the eight digits of a CEP typed with or without the dash", () => {
    assert.equal(normalizeCep("05435-000"), "05435000");
    assert.equal(normalizeCep(" 05435000 "), "05435000");
  });

  it("refuses what is not a CEP", () => {
    assert.equal(normalizeCep("0543"), null);
    assert.equal(normalizeCep("abcdefgh"), null);
    assert.equal(normalizeCep(""), null);
  });
});

describe("formatCep", () => {
  it("prints the CEP with the dash", () => {
    assert.equal(formatCep("05435000"), "05435-000");
  });
});

describe("demoCep", () => {
  it("finds the street, district, city and state of a demo CEP", () => {
    assert.deepEqual(demoCep("05435-000"), { street: "Rua Harmonia", district: "Vila Madalena", city: "São Paulo", uf: "SP" });
  });

  it("returns null for a CEP outside the demo list", () => {
    assert.equal(demoCep("99999-999"), null);
  });
});

describe("composeAddress", () => {
  it("writes the address in one line, the way the rest of the app shows it", () => {
    const text = composeAddress({ street: "Rua Harmonia", number: "410", complement: "ap 32", district: "Vila Madalena", city: "São Paulo", uf: "SP" });
    assert.equal(text, "Rua Harmonia, 410 - ap 32 · Vila Madalena · São Paulo/SP");
  });

  it("leaves out the parts that are empty", () => {
    assert.equal(composeAddress({ street: "Rua Harmonia", number: "410", district: "", city: "São Paulo", uf: "SP" }), "Rua Harmonia, 410 · São Paulo/SP");
  });

  it("is empty without a street", () => {
    assert.equal(composeAddress({ street: "", number: "10" }), "");
  });
});
