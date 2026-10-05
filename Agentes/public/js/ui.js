import { ICONS } from "./icons.js";

const ENTITIES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ENTITIES[c]);
export const money = (cents) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const reais = (cents) => (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const percent = (x) => `${Math.round(x * 100)}%`;
const dataAttrs = (data = {}) => Object.entries(data).map(([k, v]) => `data-${k}="${esc(v)}"`).join(" ");
export const actionAttrs = ({ action, go, data }) =>
  [action && `data-action="${esc(action)}"`, go && `data-go="${esc(go)}"`, dataAttrs(data)].filter(Boolean).join(" ");

export const icon = (name, cls = "") =>
  `<svg class="i ${cls}" data-i="${name}" viewBox="0 0 256 256" aria-hidden="true" focusable="false"><path d="${ICONS[name] ?? ""}"/></svg>`;

export function btn(label, { action, go, kind = "primary", data, disabled = false, busy = false, iconName } = {}) {
  const inner = busy ? `<span class="spin"></span>Analisando` : `${iconName ? icon(iconName) : ""}${esc(label)}`;
  return `<button type="button" class="btn ${kind}" ${actionAttrs({ action, go, data })} ${disabled || busy ? "disabled" : ""}>${inner}</button>`;
}

export const chip = (text, tone = "neutral") => `<span class="chip ${tone}">${esc(text)}</span>`;
export const signal = (text, state = "ok") => `<span class="signal ${state}">${icon("sparkle")}${esc(text)}</span>`;

/** A Jev result as a badge: confident and automatic, or flagged for a person to check. */
export function judgmentSignal(result, okText) {
  if (!result || result.failed) return "";
  return result.routing === "automatic"
    ? signal(`${okText} · ${percent(result.confidence)}`, "ok")
    : signal(`Confira · ${percent(result.confidence)}`, "review");
}

export const circle = (name, tone = "info", size = 40) => `<span class="circle ${tone}" style="--s:${size}px">${icon(name)}</span>`;

export function row({ icon: ic = "briefcase", title, detail = "", value = "", go, action, data, tone = "info", extra = "" }) {
  const clickable = Boolean(go || action);
  const tag = clickable ? "button" : "div";
  return `<${tag} ${clickable ? 'type="button"' : ""} class="row" ${actionAttrs({ action, go, data })}>${circle(ic, tone)}<span class="row-text"><strong>${esc(title)}</strong>${detail ? `<small>${esc(detail)}</small>` : ""}</span>${value || extra ? `<span class="row-side">${value ? `<span class="row-value">${esc(value)}</span>` : ""}${extra}</span>` : ""}${clickable ? icon("caret-right", "caret") : ""}</${tag}>`;
}

export const kv = (k, v, tone = "") => `<div class="kv"><span>${esc(k)}</span><strong class="${tone}">${esc(v)}</strong></div>`;
export const progress = (ratio, tone = "pos") =>
  `<div class="progress"><span class="${tone}" style="width:${Math.max(0, Math.min(1, ratio)) * 100}%"></span></div>`;
export const note = (text, tone = "info", ic = "info") => `<div class="note ${tone}">${icon(ic)}<span>${esc(text)}</span></div>`;
export const card = (html, cls = "") => `<section class="card ${cls}">${html}</section>`;
export const listCard = (title, rowsHtml, linkHtml = "") =>
  `<section class="card flush">${title ? `<div class="card-head"><h3>${esc(title)}</h3>${linkHtml}</div>` : ""}${rowsHtml}</section>`;

export function field(label, { bind, value = "", multiline = false, placeholder = "", rows = 3, inputmode = "", id = "" }) {
  const common = `data-bind="${esc(bind)}" placeholder="${esc(placeholder)}" ${id ? `id="${esc(id)}"` : ""} ${inputmode ? `inputmode="${inputmode}"` : ""}`;
  const control = multiline ? `<textarea ${common} rows="${rows}">${esc(value)}</textarea>` : `<input ${common} value="${esc(value)}">`;
  return `<label class="field"><span>${esc(label)}</span>${control}</label>`;
}

export function checkbox(label, { bind, checked }) {
  return `<label class="check"><input type="checkbox" data-bind="${esc(bind)}" data-rerender="1" ${checked ? "checked" : ""}><span>${esc(label)}</span></label>`;
}

export function option({ title, sub = "", value = "", selected, disabled, action, data, extra = "" }) {
  return `<button type="button" class="option ${selected ? "selected" : ""}" ${disabled ? "disabled" : ""} ${actionAttrs({ action, data })}><span class="radio"></span><span class="option-text"><strong>${esc(title)}</strong>${sub ? `<small>${esc(sub)}</small>` : ""}${extra}</span>${value ? `<strong class="option-value">${esc(value)}</strong>` : ""}</button>`;
}

export const timeline = (steps) =>
  `<ol class="timeline">${steps
    .map(([label, detail, st]) => `<li class="${st}">${icon(st === "ok" ? "check-circle" : st === "now" ? "hourglass-medium" : "clock")}<div><strong>${esc(label)}</strong><small>${esc(detail)}</small></div></li>`)
    .join("")}</ol>`;

export const statusbar = (dark = false) => `<div class="statusbar ${dark ? "dark" : ""}"><span>9:41</span><span class="battery"></span></div>`;

/**
 * Inner header in the Nexo Banking style. light: "← Notificações" on the page color.
 * ink: navy band with the title large below the arrow, like "Cartões Black".
 * close: an X on the right for receipts; true goes back, a route string goes there.
 */
export function appbar({ title = "", tone = "light", close = false } = {}) {
  if (close) {
    const target = typeof close === "string" ? `data-go="${esc(close)}"` : 'data-action="back"';
    return `<header class="appbar bk-bar close"><button type="button" class="back" ${target} aria-label="Fechar">${icon("x")}</button></header>`;
  }
  const back = `<button type="button" class="back" data-action="back" aria-label="Voltar">${icon("arrow-left")}</button>`;
  if (tone === "ink") return `<header class="appbar bk-bar ink">${back}<h1>${esc(title)}</h1></header>`;
  return `<header class="appbar bk-bar">${back}<h1>${esc(title)}</h1></header>`;
}

/** The Nexo floating "Menu" pill. It replaces the bottom tab bar on the main screens. */
export const menuButton = () => `<button type="button" class="bk-menu" data-go="#/menu">${icon("list")}<span>Menu</span></button>`;
const iaButton = () => `<button type="button" class="fab" data-go="#/ia" aria-label="Abrir Assistente Aval">${icon("sparkle")}</button>`;

export function screen({ header = "", body, footer = "", tab = "", fab = false, overlay = "", cls = "", dark = false }) {
  const floating = tab ? menuButton() : fab ? iaButton() : "";
  return `<div class="screen ${cls} ${tab ? "has-menu" : fab ? "has-fab" : ""}">${statusbar(dark)}${header}<div class="content">${body}</div>${footer ? `<div class="footer">${footer}</div>` : ""}${floating}${overlay}</div>`;
}

export function sheet(title, body) {
  return `<div class="scrim" data-action="closeSheet"></div><div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="handle"></div><div class="sheet-head"><h2>${esc(title)}</h2><button type="button" class="icon-btn" data-action="closeSheet" aria-label="Fechar">${icon("x")}</button></div><div class="sheet-body">${body}</div></div>`;
}

export const busyNote = (text) => `<div class="busy-note"><span class="spin"></span>${esc(text)}</div>`;
export const empty = (text) => `<p class="empty">${esc(text)}</p>`;
