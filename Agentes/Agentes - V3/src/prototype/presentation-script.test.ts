import assert from "node:assert/strict";
import { beforeEach, it } from "node:test";

Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: () => null, setItem: () => {}, removeItem: () => {} } });
const locationStub = { hash: "#/entrada" };
Object.defineProperty(globalThis, "location", { configurable: true, value: locationStub });
// @ts-expect-error Browser modules intentionally use plain JavaScript.
const { currentStep, position, stepAt } = await import("../../public/js/guide.js");
// @ts-expect-error Browser module intentionally uses plain JavaScript.
const { CHAPTERS } = await import("../../public/js/guide-steps.js");
// @ts-expect-error Browser module intentionally uses plain JavaScript.
const { getState, reset, setDraft, update } = await import("../../public/js/store.js");
// @ts-expect-error Browser module intentionally uses plain JavaScript.
const { commonRoutes } = await import("../../public/js/screens/common.js");
// @ts-expect-error Browser module intentionally uses plain JavaScript.
const { createOnboarding } = await import("../../public/js/domain/onboarding.js");
// @ts-expect-error Browser module intentionally uses plain JavaScript.
const { metricTiles } = await import("../../public/js/player-views.js");
// @ts-expect-error Browser module intentionally uses plain JavaScript.
const { screen } = await import("../../public/js/ui.js");
// @ts-expect-error Browser module intentionally uses plain JavaScript.
const { bkReceipt } = await import("../../public/js/screens/btg-kit.js");
// @ts-expect-error Browser module intentionally uses plain JavaScript.
const { protectedRoutes } = await import("../../public/js/screens/protected.js");

type Step = { target?: string | ((s: unknown) => string); type?: string; do: string; why?: string };
const steps = (): Step[] => CHAPTERS.flatMap((c: { steps: Step[] }) => c.steps);
const targetOf = (st: Step) => (typeof st.target === "string" ? st.target : "");
/** For every step that clicks `action`: whether an earlier step of the same chapter types into `bind`. */
function typedBefore(action: string, bind: string): boolean[] {
  const pairs: [Step, Step[]][] = CHAPTERS.flatMap((c: { steps: Step[] }) => c.steps.map((st, i): [Step, Step[]] => [st, c.steps.slice(0, i)]));
  return pairs
    .filter(([st]) => targetOf(st).includes(`data-action="${action}"`))
    .map(([, before]) => before.some((b) => targetOf(b).includes(`data-bind="${bind}"`) && Boolean(b.type)));
}

beforeEach(() => {
  reset();
  locationStub.hash = "#/entrada";
});

it("the guide never waits for the notices window, which the app does not show", () => {
  update((s: { invites: unknown[] }) => { s.invites.push({ id: "PG-900", token: "PG-900", from: "provider", totalCents: 100_000, title: "Pintura" }); });
  locationStub.hash = "#/combinado/enviado/PG-900";
  const s = getState();
  assert.equal(currentStep(s).do, stepAt(position(s)).do);
});

it("every delivery in the script describes what was done before sending", () => {
  const checks = typedBefore("sendDelivery", "entrega.description");
  assert.ok(checks.length >= 4);
  assert.ok(checks.every(Boolean));
});

it("the dispute script tells what happened, answers and attaches evidence on both sides", () => {
  assert.deepEqual(typedBefore("submitDispute", "disputa.report"), [true]);
  assert.deepEqual(typedBefore("respondDispute", "resposta.statement"), [true]);
  const targets = steps().map(targetOf);
  assert.ok(targets.some((t) => t.includes('data-action="addDisputeFile"') && t.includes('data-key="disputa"')));
  assert.ok(targets.some((t) => t.includes('data-action="addDisputeFile"') && t.includes('data-key="resposta"')));
  assert.ok(steps().every((st) => !/já estão no caso/.test(st.why ?? "")));
});

it("in the demo, signing up goes through the BTG account, with the data and the limits", () => {
  const consent = commonRoutes.cadastro(getState());
  assert.match(consent, /data-action="btgAuthorize"/);
  assert.doesNotMatch(consent, /localSignup/);
  setDraft("login.authorized", { at: "04/10" });
  const data = commonRoutes["cadastro/dados"](getState());
  assert.match(data, /limits-card/);
  assert.match(data, /data-bind="signup.arbitration"/);
  assert.match(data, /data-action="importBtgAccount"/);
});

it("the onboarding can be kept from opening by itself, and still opens on request", () => {
  const storage = { getItem: () => null, setItem: () => {} };
  const flow = createOnboarding({ storage, key: "onboarding", automatic: false });
  assert.equal(flow.step, null);
  flow.open();
  assert.equal(flow.step, 0);
});

it("an offer accepted after being shown in an earlier scenario never reads as '1 de 0'", () => {
  const offerOf = (d: object) => metricTiles(d).find(([, label]: [string, string]) => /oferta/.test(label));
  assert.deepEqual(offerOf({ offersAccepted: 1, offersShown: 0 }), ["1", "oferta do banco aceita"]);
  assert.deepEqual(offerOf({ offersAccepted: 2, offersShown: 3 }), ["2 de 3", "ofertas do banco aceitas"]);
});

it("in front of the BTG, the demo speaks as the product: no test or simulation stamps", () => {
  const TEST_WORDING = /simula|de teste|sem validade|sem dinheiro real/i;
  assert.doesNotMatch(screen({ body: "" }), TEST_WORDING);
  assert.doesNotMatch(bkReceipt({ title: "Pagamento", when: "04/10", valueCents: 100, parties: [], auth: "X1" }), TEST_WORDING);
  update((s: { invites: unknown[] }) => {
    s.invites.push({ id: "PG-901", token: "PG-901", from: "provider", createdBy: "carlos", channel: "whatsapp", status: "sent", totalCents: 100_000,
      title: "Pintura", contact: "(11) 97777-3003", client: "Ana Ribeiro", provider: "Horizonte Reformas", sentAtMs: 0 });
  });
  update((s: { session: object }) => { s.session = { person: "carlos", mode: "prestador", loggedIn: true }; });
  assert.doesNotMatch(protectedRoutes["combinado/enviado/:id"](getState(), { id: "PG-901" }), TEST_WORDING);
});

it("a delivery without a description points at the description field, not at a notice over it", async () => {
  Object.defineProperty(globalThis, "document", { configurable: true, value: { querySelector: () => null } });
  Object.defineProperty(globalThis, "CSS", { configurable: true, value: { escape: (v: string) => v } });
  // @ts-expect-error Browser module intentionally uses plain JavaScript.
  const { actions } = await import("../../public/js/actions/index.js");
  setDraft("entrega.attachments", [{ kind: "photo", caption: "Foto" }]);
  actions.sendDelivery({ id: "AV-404", stage: "0" });
  assert.ok(getState().ui.errors?.["entrega.description"]);
});

it("money that left the vault is described the same way for approval, deadline or agreement", () => {
  const [, label] = metricTiles({ releasedCents: 800_000 })[0];
  assert.doesNotMatch(label, /aprovado/);
});

it("the QR scenario charges in person, without typing the payer's phone", () => {
  const qr = CHAPTERS.find((c: { title: string }) => c.title === "QR na hora").steps as Step[];
  assert.ok(qr.some((st) => targetOf(st).includes('data-action="chargeInPerson"')));
  assert.ok(qr.every((st) => !targetOf(st).includes("ag.recipientInput")));
});

it("charging in person keeps only the QR and skips the payer's identification", async () => {
  Object.defineProperty(globalThis, "document", { configurable: true, value: { querySelector: () => null } });
  // @ts-expect-error Browser module intentionally uses plain JavaScript.
  const { actions } = await import("../../public/js/actions/index.js");
  update((s: { session: object }) => { s.session = { person: "carlos", mode: "prestador", loggedIn: true }; });
  actions.newCharge();
  actions.chargeInPerson();
  const ag = getState().ui.drafts.ag;
  assert.equal(ag.payer.kind, "inPerson");
  assert.equal(ag.channel, "qr");
  assert.equal(locationStub.hash, "#/combinado/1");
});

it("the first time, the entry does not know who holds the phone: no name, no account, only the BTG sign-in", () => {
  const html = commonRoutes.entrada(getState());
  assert.doesNotMatch(html, /Olá, Ana/);
  assert.doesNotMatch(html, /Conta •••/);
  assert.match(html, /Entrar com a conta BTG/);
  assert.match(html, /data-go="#\/cadastro"/);
  for (const shortcut of ["Conhecer o Aval", "Arbitragem", "Ajuda"]) assert.match(html, new RegExp(shortcut));
});

it("once she has entered, the entry remembers her like the BTG Banking login: greeting, masked account, Entrar", async () => {
  // @ts-expect-error Browser module intentionally uses plain JavaScript.
  const { entrySheets } = await import("../../public/js/screens/common.js");
  update((s: { people: Record<string, object> }) => { s.people.voce = { id: "voce", first: "Ana", name: "Ana Ribeiro" }; });
  const html = commonRoutes.entrada(getState());
  assert.match(html, /Olá, Ana/);
  assert.match(html, /Conta •••/);
  assert.match(html, /data-action="openLoginBio"/);
  assert.match(html, /Acessar outra conta/);
  for (const shortcut of ["Conhecer o Aval", "Arbitragem", "Ajuda"]) assert.match(html, new RegExp(shortcut));
  assert.match(entrySheets.loginBio(getState()), /data-action="confirmLoginBio"/);
});

it("Entrar asks for biometrics on top of the entry, then opens the BTG authorization the first time", async () => {
  Object.defineProperty(globalThis, "document", { configurable: true, value: { querySelector: () => null } });
  // @ts-expect-error Browser module intentionally uses plain JavaScript.
  const { actions } = await import("../../public/js/actions/index.js");
  update((s: { session: object }) => { s.session = { person: "voce", mode: "contratante", loggedIn: false }; });
  actions.openLoginBio();
  assert.equal(getState().ui.sheet?.name, "loginBio");
  actions.confirmLoginBio();
  assert.equal(getState().ui.sheet, null);
  assert.equal(locationStub.hash, "#/cadastro");
});

it("with an Aval profile, the biometrics on the entry signs straight in", async () => {
  // @ts-expect-error Browser module intentionally uses plain JavaScript.
  const { actions } = await import("../../public/js/actions/index.js");
  update((s: { session: object; people: Record<string, object> }) => {
    s.people.voce = { id: "voce", first: "Ana", name: "Ana Ribeiro" };
    s.session = { person: "voce", mode: "contratante", loggedIn: false };
  });
  actions.openLoginBio();
  actions.confirmLoginBio();
  assert.equal(getState().session.loggedIn, true);
  assert.equal(locationStub.hash, "#/inicio");
});
