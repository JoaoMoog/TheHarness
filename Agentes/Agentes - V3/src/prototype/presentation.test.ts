import assert from "node:assert/strict";
import { beforeEach, it } from "node:test";

Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: () => null, setItem: () => {} } });
const locationStub = { hash: "#/entrada" };
Object.defineProperty(globalThis, "location", { configurable: true, value: locationStub });
// @ts-expect-error Browser modules intentionally use plain JavaScript.
const { bringScene, cancelScene, guide, position, setGuideActive, syncGuide } = await import("../../public/js/guide.js");
// @ts-expect-error Browser module intentionally uses plain JavaScript.
const { getState, reset, update } = await import("../../public/js/store.js");
// @ts-expect-error Browser module intentionally uses plain JavaScript.
const { actions } = await import("../../public/js/actions/core.js");

beforeEach(() => {
  setGuideActive(false);
  reset();
  locationStub.hash = "#/entrada";
});

it("manual exploration never synchronizes completed guide steps or shows skip controls", () => {
  locationStub.hash = "#/combinado/1";
  assert.equal(syncGuide(), false);
  assert.deepEqual(position(getState()), { chapter: 0, step: 0 });
  const html = guide(getState());
  assert.match(html, /Exploração livre/);
  assert.doesNotMatch(html, /data-action="guide(?:Next|Prev|Go)"/);
});

it("the guide advances completed steps only when explicitly enabled by the player", () => {
  locationStub.hash = "#/combinado/1";
  setGuideActive(true);
  assert.equal(syncGuide(), true);
  assert.deepEqual(position(getState()), { chapter: 0, step: 3 });
  setGuideActive(false);
});

it("manual exploration cannot schedule a change of person or screen", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const scene = t.mock.method(actions, "guideGo", () => {});
  bringScene(true);
  t.mock.timers.tick(701);
  assert.equal(scene.mock.callCount(), 0);
});

it("stopping or pausing cancels a scene already scheduled, even if a new presentation starts", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const scene = t.mock.method(actions, "guideGo", () => {});
  setGuideActive(true);
  bringScene(true);
  setGuideActive(false);
  setGuideActive(true);
  t.mock.timers.tick(701);
  assert.equal(scene.mock.callCount(), 0);
  setGuideActive(false);
});

it("a pending scene never overrides the user's newer navigation or selected step", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const scene = t.mock.method(actions, "guideGo", () => {});
  setGuideActive(true);
  bringScene(true);
  locationStub.hash = "#/menu";
  t.mock.timers.tick(701);
  assert.equal(scene.mock.callCount(), 0);
  bringScene(true);
  update((s: { ui: { guide: { chapter: number; step: number } } }) => { s.ui.guide = { chapter: 0, step: 1 }; }, { silent: true });
  t.mock.timers.tick(701);
  assert.equal(scene.mock.callCount(), 0);
  setGuideActive(false);
});

it("an active presentation brings the required scene once", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const scene = t.mock.method(actions, "guideGo", () => {});
  setGuideActive(true);
  bringScene(true);
  bringScene(true);
  t.mock.timers.tick(701);
  assert.equal(scene.mock.callCount(), 1);
  cancelScene();
  setGuideActive(false);
});
