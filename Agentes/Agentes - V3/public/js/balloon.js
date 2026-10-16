// The explanatory balloon of the presentation: it sits in the empty area beside the phone being shown, with a line to
// the element it explains. Without room beside the phone (small screens, the bank page) it floats above or below the
// element. It follows the element while it is visible, since the app re-renders under it.
import { esc, icon } from "./ui.js";

const WIDTH = 380;
const MIN_SIDE = 260; // the least room beside the phone for the balloon to sit there
const GAP = 28;
const EDGE = 16;
const TOP_BAR = 72; // below the presenter bar
const TOP_STAGE = 16; // while playing the presenter bar is hidden
const top = () => (document.body.classList.contains("playing") ? TOP_STAGE : TOP_BAR);
const FOLLOW_MS = 150;

const layer = Object.assign(document.createElement("div"), { className: "bl-layer", hidden: true });
layer.innerHTML = `<svg class="bl-svg" aria-hidden="true"><line class="bl-line"/><circle class="bl-dot" r="7"/></svg><div class="bl-box" role="status" aria-live="polite"></div>`;
document.body.append(layer);
const box = layer.querySelector(".bl-box");
const line = layer.querySelector(".bl-line");
const dot = layer.querySelector(".bl-dot");
let find = null;
let timer = 0;
let tone = "action";
let marked = null;

/** A tour point is lit (the rest of the phone dims around it); the class comes back after every re-render. */
function mark(el) {
  if (el === marked) return;
  marked?.classList.remove("tour-hit");
  marked = tone === "tour" ? el : null;
  marked?.classList.add("tour-hit");
}

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const footerTop = () => document.getElementById("dock")?.getBoundingClientRect().top ?? window.innerHeight;
function setLine(x1, y1, x2, y2) {
  Object.entries({ x1, y1, x2, y2 }).forEach(([k, v]) => line.setAttribute(k, String(Math.round(v))));
  dot.setAttribute("cx", String(Math.round(x2)));
  dot.setAttribute("cy", String(Math.round(y2)));
}

/** Beside the phone, on the side with more room, level with the element. */
function besidePhone(r, phone, half, side, bottom) {
  const room = side === "right" ? half.right - phone.right : phone.left - half.left;
  const width = Math.min(WIDTH, room - GAP * 2);
  box.style.width = `${width}px`;
  const h = box.offsetHeight;
  const cy = r.top + r.height / 2;
  const x = side === "right" ? phone.right + GAP : phone.left - GAP - width;
  const y = clamp(cy - h / 2, top(), bottom - h);
  setLine(side === "right" ? x : x + width, clamp(cy, y + 24, y + h - 24), side === "right" ? r.right : r.left, cy);
  return [x, y];
}

/** The vault counter sits between the phones: a balloon over the other half stays above it. */
function vaultTop(x) {
  const v = document.querySelector(".mm-vault:not([hidden])")?.getBoundingClientRect();
  return v && x < v.right && x + WIDTH > v.left ? v.top - GAP / 2 : Infinity;
}

/** No room beside the phone: at the edge of the other half (the phone that only watches), next to the dividing line. */
function overOtherHalf(r, half, outer, bottom) {
  box.style.width = `${WIDTH}px`;
  const h = box.offsetHeight;
  const cy = r.top + r.height / 2;
  const x = clamp(outer === "right" ? half.left - GAP / 2 - WIDTH : half.right + GAP / 2, EDGE, window.innerWidth - WIDTH - EDGE);
  const y = clamp(cy - h / 2, top(), Math.min(bottom, vaultTop(x)) - h);
  setLine(outer === "right" ? x + WIDTH : x, clamp(cy, y + 24, y + h - 24), outer === "right" ? r.left : r.right, cy);
  return [x, y];
}

/** Above or below the element, inside the screen (the bank page, with no phones). */
function nearElement(r, bottom) {
  box.style.width = `${WIDTH}px`;
  const h = box.offsetHeight;
  const cx = r.left + r.width / 2;
  const x = clamp(cx - WIDTH / 2, EDGE, window.innerWidth - WIDTH - EDGE);
  const below = r.bottom + GAP + h <= bottom;
  const y = below ? r.bottom + GAP : Math.max(top(), r.top - GAP - h);
  setLine(clamp(cx, x + 24, x + WIDTH - 24), below ? y : y + h, cx, below ? r.bottom : r.top);
  return [x, y];
}

function place() {
  const el = find?.();
  if (!el?.isConnected) return;
  mark(el);
  const r = el.getBoundingClientRect();
  const phone = el.closest(".device-fit")?.getBoundingClientRect();
  const half = el.closest(".phone-col")?.getBoundingClientRect();
  const left = phone && half ? phone.left - half.left : 0;
  const right = phone && half ? half.right - phone.right : 0;
  // The outer side first (away from the line between the phones, where the vault sits), then the other one.
  const outer = half && half.left + half.width / 2 > window.innerWidth / 2 ? "right" : "left";
  const inner = outer === "right" ? "left" : "right";
  const room = { left, right };
  const side = room[outer] >= MIN_SIDE ? outer : room[inner] >= MIN_SIDE ? inner : null;
  const bottom = footerTop() - EDGE;
  const dual = Boolean(half && el.closest(".dual"));
  const [x, y] = side ? besidePhone(r, phone, half, side, bottom) : dual ? overOtherHalf(r, half, outer, bottom) : nearElement(r, bottom);
  box.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  layer.dataset.side = side ?? (dual ? "other" : "float");
}

/** Shows the balloon for the element `target()` returns. kicker: who acts, or "Nesta tela"; hint: how to move on. */
export function showBalloon({ target, kicker, title, text, hint = "", tone: kind = "action" }) {
  find = target;
  tone = kind;
  box.className = `bl-box ${tone}`;
  box.innerHTML = `${kicker ? `<span class="bl-kicker">${tone === "tour" ? icon("info") : ""}${esc(kicker)}</span>` : ""}<strong class="bl-title">${esc(title)}</strong>${text ? `<p class="bl-text">${esc(text)}</p>` : ""}${hint ? `<small class="bl-hint">${esc(hint)}</small>` : ""}`;
  layer.hidden = false;
  box.classList.remove("bl-in");
  void box.offsetWidth;
  box.classList.add("bl-in");
  place();
  clearInterval(timer);
  timer = setInterval(place, FOLLOW_MS);
}

export function hideBalloon() {
  find = null;
  tone = "action";
  mark(null);
  layer.hidden = true;
  clearInterval(timer);
}

window.addEventListener("resize", place);
