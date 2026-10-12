import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isValidCpf, maskCpf } from "../../public/js/domain/cpf.js";

describe("isValidCpf", () => {
  it("accepts a CPF with valid check digits, with or without punctuation", () => {
    // Arrange
    const formatted = "529.982.247-25";

    // Act
    const ok = isValidCpf(formatted);

    // Assert
    assert.equal(ok, true);
    assert.equal(isValidCpf("52998224725"), true);
  });

  it("rejects wrong check digits", () => {
    assert.equal(isValidCpf("529.982.247-24"), false);
  });

  it("rejects repeated digits, wrong length and text", () => {
    for (const text of ["111.111.111-11", "5299822472", "529982247250", "", "abc.def.ghi-jk"]) assert.equal(isValidCpf(text), false);
  });
});

describe("maskCpf", () => {
  it("shows only the middle digits", () => {
    assert.equal(maskCpf("529.982.247-25"), "CPF ***.982.247-**");
  });
});
