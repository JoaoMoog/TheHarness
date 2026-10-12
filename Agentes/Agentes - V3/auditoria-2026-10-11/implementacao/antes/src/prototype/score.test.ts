import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NOTE_BANDS, creditNote } from "../../public/js/domain/score.js";

describe("creditNote", () => {
  it("starts at a regular note for someone new, with tips to improve", () => {
    // Act
    const note = creditNote({});

    // Assert
    assert.equal(note.score, 600);
    assert.equal(note.band, "regular");
    assert.ok(note.tips.length > 0 && note.tips.length <= 3);
  });

  it("rises with installments paid on time, finished payments, Pix Automático and Open Finance", () => {
    const note = creditNote({ paidInstallments: 6, completedPayments: 3, autoPix: true, openFinance: true });
    assert.equal(note.score, 600 + 60 + 60 + 40 + 60);
    assert.equal(note.band, "ótima");
    assert.deepEqual(note.tips.map((t) => t.key), ["complete"]);
  });

  it("drops hard with a late installment and puts paying it as the first tip", () => {
    const note = creditNote({ lateInstallments: 1, paidInstallments: 2 });
    assert.equal(note.score, 600 + 20 - 150);
    assert.equal(note.band, "baixa");
    assert.equal(note.tips[0].key, "late");
  });

  it("costs points when more than 30% of the loan is in use, and stays between 0 and 1000", () => {
    assert.equal(creditNote({ utilization: 0.8 }).score, 600 - 100);
    assert.equal(creditNote({ lateInstallments: 9 }).score, 0);
    assert.equal(creditNote({ paidInstallments: 99, completedPayments: 99, autoPix: true, openFinance: true }).score, 900);
  });

  it("names the bands from the highest", () => {
    assert.deepEqual(NOTE_BANDS.map(([, name]) => name), ["ótima", "boa", "regular", "baixa"]);
  });
});
