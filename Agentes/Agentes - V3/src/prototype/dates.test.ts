import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BASE_DATE, brToIso, daysBetween, fmtDate, isoToBr, parseDdMm, shiftDate } from "../../public/js/domain/dates.js";

describe("demo dates", () => {
  it("prints dates of the demo year without the year", () => {
    assert.equal(fmtDate(new Date(2026, 9, 11)), "11/10");
  });

  it("keeps the year for dates after 2026, so a 12x credit does not look overdue", () => {
    const ninth = shiftDate(BASE_DATE, 270);
    const text = fmtDate(ninth);
    assert.match(text, /^\d{2}\/\d{2}\/27$/);
    assert.equal(parseDdMm(text).getTime(), new Date(ninth.getFullYear(), ninth.getMonth(), ninth.getDate()).getTime());
    assert.ok(daysBetween(BASE_DATE, parseDdMm(text)) > 0);
  });

  it("reads short seed dates: July to December in 2026, January to June in 2027", () => {
    assert.equal(parseDdMm("01/11").getFullYear(), 2026);
    assert.equal(parseDdMm("01/02").getFullYear(), 2027);
  });
});

describe("date picker", () => {
  it("turns the picker value into the date with the year", () => {
    assert.equal(isoToBr("2026-11-03"), "03/11/2026");
    assert.equal(isoToBr(""), "");
  });

  it("turns a stored date into the picker value, the short ones inside the demo year", () => {
    assert.equal(brToIso("03/11/2027"), "2027-11-03");
    assert.equal(brToIso("03/11"), "2026-11-03");
    assert.equal(brToIso("01/02"), "2027-02-01");
    assert.equal(brToIso(""), "");
  });
});
