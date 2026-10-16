import assert from "node:assert/strict";
import { it } from "node:test";
// @ts-expect-error Browser module is intentionally plain JavaScript.
import { guardedPath, signedOutUi } from "../../public/js/session-policy.js";

it("blocks banking, receipts and pending-account data after logout, including bank profiles", () => {
  for (const person of ["voce", "marina", "banco"]) {
    for (const path of ["btg", "inicio", "perfil", "conta-analise", "pago/C1", "banco/visao", "assistente"]) {
      assert.equal(guardedPath(path, { person, loggedIn: false }), "entrada");
    }
  }
  assert.equal(guardedPath("p/invite", { person: "voce", loggedIn: false }), "p/invite");
});
it("logout removes private transient data and resumption routes", () => {
  const ui = signedOutUi({ drafts: { payment: "private" }, payment: { amount: 10 }, sheet: {}, second: "marina", resumeTo: "#/pix", returnTo: "#/btg", hideValues: false });
  assert.deepEqual(ui.drafts, {});
  assert.equal(ui.payment, null);
  assert.equal(ui.sheet, null);
  assert.equal(ui.second, undefined);
  assert.equal(ui.resumeTo, undefined);
  assert.equal(ui.hideValues, true);
});
