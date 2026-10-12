// App mode (`?app=1`): the prototype fills a real phone screen, as the Android APK opens it. One phone, no frame,
// no presenter bar or dock; a small Demo tab keeps profile, clock and reset at hand. The native shell passes the
// heights of its status and navigation bars (`sb`, `nb`, in CSS px) and paints its status bar icons to match the
// screen below them.
import { icon } from "./ui.js";

const PARAMS = new URLSearchParams(location.search);
export const APP_MODE = PARAMS.has("app");

const LIGHT_LUMA = 0.6;

const px = (value) => `${Math.max(0, Number(value) || 0)}px`;

/** Called by the native shell whenever the system bars change size (rotation, gesture vs. button navigation). */
function setInsets(top, bottom) {
  document.documentElement.style.setProperty("--sb", px(top));
  document.documentElement.style.setProperty("--nb", px(bottom));
  // The keyboard counts as the bottom bar: keep the field being typed in above it.
  requestAnimationFrame(() => {
    const field = document.activeElement;
    if (field?.matches?.("input, textarea, select")) field.scrollIntoView({ block: "center" });
  });
}

function luma(color) {
  const [r, g, b, a = 1] = (color.match(/[\d.]+/g) ?? []).map(Number);
  if (a === 0 || r === undefined) return 1;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

let lastLight = null;
/** Dark icons over a light status bar, light icons over a dark one. */
export function syncSystemBars(stage) {
  const bar = stage.querySelector(".device.main .statusbar");
  const light = bar ? luma(getComputedStyle(bar).backgroundColor) > LIGHT_LUMA : true;
  if (light === lastLight) return;
  lastLight = light;
  window.AvalNative?.setLightStatusBar?.(light);
}

if (APP_MODE) {
  document.documentElement.classList.add("app-mode");
  setInsets(PARAMS.get("sb"), PARAMS.get("nb"));
  window.avalInsets = setInsets;
  const tab = Object.assign(document.createElement("button"), { type: "button", className: "app-demo", innerHTML: `${icon("sliders-horizontal")}<span>Demo</span>` });
  tab.dataset.action = "toggleDemoMenu";
  tab.setAttribute("aria-haspopup", "true");
  document.body.append(tab);
}
