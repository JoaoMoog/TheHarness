// Nexo Banking building blocks for the home: blue balance header, shortcut strip, banner, activity list and the Menu button.
import { myNotifications, now, person } from "../store.js";
import { actionAttrs, esc, icon, money } from "../ui.js";
import { modeCounts, shown } from "./chrome.js";

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const MAX_BADGE = 9;

/** "Hoje 04/Out", the way the Nexo app labels the day in its activity list. */
export function todayLabel() {
  const d = now();
  return `Hoje <span>${String(d.getDate()).padStart(2, "0")}/${MONTHS[d.getMonth()]}</span>`;
}

function modeTabs(s) {
  const mode = s.session.mode;
  const { hiring, providing } = modeCounts(s);
  const tab = (key, label, count) =>
    `<button type="button" role="tab" aria-selected="${mode === key}" class="${mode === key ? "on" : ""}" data-action="setMode" data-mode="${key}">${label}<span class="bk-count">${count}</span></button>`;
  return `<div class="bk-tabs" role="tablist" aria-label="Lado da conta">${tab("contratante", "Contratando", hiring)}${tab("prestador", "Prestando", providing)}</div>`;
}

function topBar(s) {
  const p = person(s);
  const unread = myNotifications(s).filter((n) => !n.read).length;
  const badge = unread ? `<span class="bk-badge">${unread > MAX_BADGE ? `${MAX_BADGE}+` : unread}</span>` : "";
  return `<div class="bk-top">
    <button type="button" class="bk-hello" data-go="#/perfil"><span class="bk-avatar">${esc(p?.initials ?? "BT")}</span><span>Olá,<strong>${esc(p?.first ?? "")}${icon("caret-right")}</strong></span></button>
    <div class="bk-top-actions"><button type="button" data-go="#/avisos" aria-label="Avisos${unread ? `, ${unread} não lidos` : ""}">${icon("bell")}${badge}</button><button type="button" data-go="#/servicos" aria-label="Buscar serviços">${icon("magnifying-glass")}</button></div>
  </div>`;
}

/**
 * Blue header with the main balance, like "Conta corrente" in Nexo Banking.
 * lines: [label, value, go][] · cta: { label, go }
 */
export function bkHeader(s, { title, label, cents, sub, lines, cta, tabs = true }) {
  const hidden = s.ui.hideValues;
  const eye = `<button type="button" class="bk-eye" data-action="toggleValues" aria-pressed="${hidden}" aria-label="${hidden ? "Mostrar valores" : "Ocultar valores"}">${icon(hidden ? "eye" : "eye-slash")}</button>`;
  const line = ([l, v, go]) => `<button type="button" class="bk-line" data-go="${esc(go)}"><span>${esc(l)}</span><strong>${esc(v)}</strong>${icon("caret-right")}</button>`;
  return `<section class="bk-head">
    ${topBar(s)}
    ${tabs ? modeTabs(s) : ""}
    <h2 class="bk-title">${esc(title)}</h2>
    <div class="bk-balance"><div><small>${esc(label)}</small><strong>${shown(s, cents)}</strong></div>${eye}</div>
    <p class="bk-sub">${esc(sub)}</p>
    <div class="bk-lines">${lines.map(line).join("")}</div>
    <button type="button" class="bk-outline" data-go="${esc(cta.go)}">${esc(cta.label)}</button>
  </section>`;
}

/** Blue page header for the main areas reached from the Menu (Serviços, Financeiro), like "Gestão de contas". */
export function bkPageHeader(s, { title, sub = "", tabs = true }) {
  return `<header class="bk-page-head"><div class="bk-page-top"><button type="button" data-go="#/inicio" aria-label="Voltar ao início">${icon("arrow-left")}</button><button type="button" data-go="#/avisos" aria-label="Avisos">${icon("bell")}</button></div>
    <h1>${esc(title)}</h1>${sub ? `<p>${esc(sub)}</p>` : ""}${tabs ? modeTabs(s) : ""}</header>`;
}

/** Darker strip under the header with text shortcuts: [label, icon, go][]. */
export const bkStrip = (items) =>
  `<nav class="bk-strip" aria-label="Atalhos">${items.map(([label, ic, go]) => `<button type="button" data-go="${esc(go)}">${icon(ic)}<span>${esc(label)}</span></button>`).join("")}</nav>`;

/** Full-width navy banner with one offer and a white button. */
export function bkBanner({ text, cta, art = "hand-coins", go, action, data }) {
  return `<section class="bk-banner"><div class="bk-banner-copy"><p>${esc(text)}</p><button type="button" class="bk-white" ${actionAttrs({ go, action, data })}>${esc(cta)}</button></div><span class="bk-art" aria-hidden="true">${icon(art)}</span></section>`;
}

/**
 * One line of the activity list: small label on top, main text, value on the right.
 * extra is trusted HTML built by the app (a Jev signal), everything else is escaped.
 */
export function bkItem({ icon: ic = "briefcase", label = "", title, value = "", tone = "", extra = "", go, action, data }) {
  return `<button type="button" class="bk-item" ${actionAttrs({ go, action, data })}><span class="bk-ico ${tone}">${icon(ic)}</span><span class="bk-item-text">${label ? `<small class="${tone}">${esc(label)}</small>` : ""}<strong>${esc(title)}</strong>${extra}</span>${value ? `<span class="bk-value ${tone}">${esc(value)}</span>` : ""}</button>`;
}

export function bkSection(title, items, { aside = "", empty = "Nada por aqui." } = {}) {
  return `<section class="bk-section"><div class="bk-section-head"><h3>${esc(title)}</h3>${aside}</div>${items.length ? items.join("") : `<p class="bk-empty">${esc(empty)}</p>`}</section>`;
}

const MONTH_NAMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const BAR_STATE = { paid: "Paga", open: "Aberta", late: "Atrasada", future: "Futura" };

/** "02/Out", or "Hoje 04/Out" for the demo's today, from a "dd/mm" date. */
export function dayLabel(ddmm) {
  const [dd, mm] = ddmm.split("/").map(Number);
  const d = now();
  const isToday = dd === d.getDate() && mm === d.getMonth() + 1;
  return `${isToday ? "Hoje " : ""}<span>${String(dd).padStart(2, "0")}/${MONTHS[mm - 1]}</span>`;
}

export const fullDate = () => {
  const d = now();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};
export const monthName = (date) => MONTH_NAMES[date.getMonth()];
export const initialsOf = (name) => String(name).split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");

/** Stable 32-hex authentication code for a receipt, like the Nexo one. */
export function authCode(seed) {
  let h = 7;
  return Array.from({ length: 4 }, (_, k) => {
    for (const ch of `${seed}:${k}`) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return h.toString(16).padStart(8, "0");
  }).join("");
}

/** Limit block like "Limite Black": total with a chevron, a bar, used on the left and available on the right. */
export function bkLimit(s, { title, totalCents, usedCents, freeCents, go, usedLabel = "Utilizado", freeLabel = "Disponível", freeText }) {
  const ratio = totalCents ? Math.min(1, usedCents / totalCents) : 0;
  const head = `<span>${esc(title)}</span><strong>${shown(s, totalCents)}</strong>${go ? icon("caret-right") : ""}`;
  return `<div class="bk-limit">${go ? `<button type="button" class="bk-limit-head" data-go="${esc(go)}">${head}</button>` : `<div class="bk-limit-head">${head}</div>`}
    <div class="bk-limit-bar" role="img" aria-label="${Math.round(ratio * 100)}% utilizado"><span style="width:${ratio * 100}%"></span></div>
    <div class="bk-limit-legend"><div><strong>${shown(s, usedCents)}</strong><small>${esc(usedLabel)}</small></div><div><strong>${freeText ? esc(freeText) : shown(s, freeCents)}</strong><small>${esc(freeLabel)}</small></div></div></div>`;
}

/** Label and value lines, like "Melhor dia de compra · 12 de Outubro". */
export const bkFacts = (pairs) =>
  `<dl class="bk-facts">${pairs.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>`;

/** Monthly bars like the card bill chart. months: { label, cents, state: paid | open | late | future }[] */
export function bkMonthBars(s, months) {
  const max = Math.max(1, ...months.map((m) => m.cents));
  const col = (m) => `<div class="bk-bar-col ${m.state}" role="listitem"><small>${shown(s, m.cents)}</small><div class="bk-bar-track"><span style="height:${Math.max(4, Math.round((m.cents / max) * 100))}%"></span></div><strong>${esc(m.label)}</strong><em>${m.state === "paid" ? icon("check-circle") : ""}${BAR_STATE[m.state]}</em></div>`;
  return `<div class="bk-bars" role="list">${months.map(col).join("")}</div>`;
}

/**
 * Receipt in the Nexo layout: logo, title, date and value on white, then a grey block with the parties,
 * facts and the authentication code. parties: { label, name, lines[] }[] · facts: [label, value][]
 */
export function bkReceipt({ title, when, valueCents, parties, facts = [], auth }) {
  const party = (p) => `<section><small>${esc(p.label)}</small><div class="bk-party"><span class="bk-avatar sm">${esc(initialsOf(p.name))}<i>nexo</i></span><div><strong>${esc(p.name)}</strong>${p.lines.map((l) => `<small>${esc(l)}</small>`).join("")}</div></div></section>`;
  return `<article class="bk-receipt"><div class="bk-receipt-top"><img src="/img/btg-logo-navy.png" alt="BTG Pactual" class="bk-receipt-logo"><h1>${esc(title)}</h1><small>${esc(when)}</small><div class="bk-receipt-value"><span>Valor</span><strong>${money(valueCents)}</strong></div></div>
    <div class="bk-receipt-body">${parties.map(party).join("")}${facts.map(([k, v]) => `<section><small>${esc(k)}</small><p>${esc(v)}</p></section>`).join("")}${auth ? `<section><small>Código de autenticação</small><p class="bk-mono">${esc(auth)}</p></section>` : ""}</div></article>`;
}

export const bkLink = (label, go) => `<button type="button" class="bk-link" data-go="${esc(go)}">${esc(label)}${icon("caret-right")}</button>`;

export const bkSeal = () =>
  `<p class="bk-seal">${icon("shield-check")}<span>Protegido pelo Aval: o dinheiro fica em custódia até cada aprovação. Nexo Serviços, com custódia, crédito e seguros do Nexo.</span></p>`;

export { menuButton as bkMenuButton } from "../ui.js";
