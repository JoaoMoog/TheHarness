import assert from "node:assert/strict";
import { beforeEach, it } from "node:test";

Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: () => null, setItem: () => {}, removeItem: () => {} } });
const locationStub = { hash: "#/entrada" };
Object.defineProperty(globalThis, "location", { configurable: true, value: locationStub });
Object.defineProperty(globalThis, "document", { configurable: true, value: { querySelector: () => null } });
// @ts-expect-error Browser module intentionally uses plain JavaScript.
const { CHAPTERS } = await import("../../public/js/guide-steps.js");
// @ts-expect-error Browser module intentionally uses plain JavaScript.
const { EXECUTIVE, SCENARIOS, TRACKS, nextInTrack } = await import("../../public/js/scenarios.js");
// @ts-expect-error Browser module intentionally uses plain JavaScript.
const { FEATURE_GROUPS } = await import("../../public/js/features.js");
// @ts-expect-error Browser module intentionally uses plain JavaScript.
const { getState, onReset, reset, resetCount, update } = await import("../../public/js/store.js");
// @ts-expect-error Browser module intentionally uses plain JavaScript.
const { actions } = await import("../../public/js/actions/index.js");

type Step = { who: string; do: string; done: unknown; target?: unknown; feature?: string };
type Chapter = { title: string; steps: Step[]; solo?: boolean; whatsapp?: boolean; presets?: object };
const pitch = (): Chapter[] => EXECUTIVE.map((i: number) => CHAPTERS[i]);

beforeEach(() => {
  reset();
  locationStub.hash = "#/entrada";
});

it("every scenario has its chapter, and the full demo keeps its nine", () => {
  assert.equal(CHAPTERS.length, SCENARIOS.length);
  assert.deepEqual(TRACKS.full, [0, 1, 2, 3, 4, 5, 6, 7, 8]);
});

it("the executive pitch opens on one phone and has the three scenarios asked for, then the bank", () => {
  const titles = EXECUTIVE.map((i: number) => SCENARIOS[i].title);
  assert.deepEqual(titles, ["Conheça o BTG Aval", "A contratante paga o prestador", "O prestador cobra a contratante", "Pelo WhatsApp do BTG Aval", "O que o banco ganha"]);
  assert.equal(pitch()[0].solo, true);
  assert.equal(pitch()[3].whatsapp, true);
});

it("only Ana and Carlos act in the pitch (and the bank at the end)", () => {
  const actors = new Set(pitch().flatMap((c) => c.steps.map((st) => st.who)));
  assert.deepEqual([...actors].sort(), ["banco", "carlos", "voce"]);
});

it("every step of the pitch says what to do, where, and how the guide knows it was done", () => {
  for (const st of pitch().flatMap((c) => c.steps)) {
    assert.ok(st.do, "do");
    assert.equal(typeof st.done, "function", st.do);
    assert.ok(typeof st.target === "string" ? st.target.length > 0 : typeof st.target === "function", st.do);
  }
});

it("every feature lit by the opening exists in the features map", () => {
  const keys = new Set(FEATURE_GROUPS.flatMap((g: { items: [string][] }) => g.items.map(([k]) => k)));
  const lit = pitch().flatMap((c) => c.steps.map((st) => st.feature).filter(Boolean));
  assert.ok(lit.length >= 6);
  assert.ok(lit.every((k) => k === "all" || keys.has(k)), lit.join(", "));
});

it("the next scenario stays inside its own track", () => {
  assert.equal(nextInTrack(9), 10);
  assert.equal(nextInTrack(13), null);
  assert.equal(nextInTrack(8), null);
  assert.equal(nextInTrack(2), 3);
});

it("a scenario's preset fills what its person would type: Ana pays Carlos the R$ 16 mil painting", () => {
  // Arrange
  update((s: { session: object; people: Record<string, object>; ui: { agPreset: object } }) => {
    s.people.voce = { id: "voce", first: "Ana", name: "Ana Ribeiro", clientName: "Ana Ribeiro", providerName: "Ana Ribeiro", phone: "(11) 97777-3003" };
    s.session = { person: "voce", mode: "contratante", loggedIn: true };
    s.ui.agPreset = CHAPTERS[EXECUTIVE[1]].presets;
  });

  // Act
  actions.startPayment();

  // Assert
  const ag = getState().ui.drafts.ag;
  assert.equal(ag.person, "carlos");
  assert.equal(ag.total, "16.000,00");
  assert.match(ag.description, /pintar/);
});

it("a restart tells the modules that keep their own memory, and counts", () => {
  let heard = 0;
  onReset(() => { heard += 1; });
  const before = resetCount();
  reset();
  assert.equal(heard, 1);
  assert.equal(resetCount(), before + 1);
});
