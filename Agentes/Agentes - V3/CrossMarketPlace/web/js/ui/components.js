// Reusable HTML fragments, mirroring the Figma components.
import { icon } from "./icons.js";
import { compact, esc, rating } from "./format.js";
import { ACCESS, APPROVALS, LIFECYCLES, REQUEST_STATUS, categoryOf } from "../domain/constants.js";
import { avgRating, confirmedUses } from "../domain/catalog.js";
import { teamById, userById } from "../seed/people.js";

export const status = (key) => `<span class="status ${esc(key)}">${esc(APPROVALS[key] ?? REQUEST_STATUS[key] ?? (key === "arquivada" ? "Arquivada" : key))}</span>`;
export const approvalOf = (s) => (s.archived ? status("arquivada") : status(s.approval));
export const cycle = (key) => `<span class="cycle ${esc(key)}">${esc(LIFECYCLES[key] ?? key)}</span>`;
export const access = (key) => `<span class="access ${esc(key)}">${icon(key === "direto" ? "unlock" : "lock", { size: 14 })}${esc(ACCESS[key])}</span>`;
export const selo = (name, { size = "", tone = "" } = {}) => `<span class="selo ${size} ${tone ? `tone-${tone}` : ""}">${icon(name, { size: size === "sm" ? 16 : size === "lg" ? 24 : 18 })}</span>`;
export const avatar = (userId, cls = "") => { const u = userById(userId); return `<span class="avatar ${cls}" title="${esc(u.name)}">${esc(u.initials)}</span>`; };
export const btn = (label, { kind = "primary", action = "", go = "", data = {}, size = "", attrs = "", iconName = "" } = {}) =>
  `<button type="button" class="btn ${kind} ${size}" ${action ? `data-action="${action}"` : ""} ${go ? `data-go="${esc(go)}"` : ""} ${Object.entries(data).map(([k, v]) => `data-${k}="${esc(v)}"`).join(" ")} ${attrs}>${iconName ? icon(iconName, { size: 18 }) : ""}${esc(label)}</button>`;
export const link = (label, go, cls = "") => `<button type="button" class="link ${cls}" data-go="${esc(go)}">${esc(label)}${icon("arrow", { size: 16 })}</button>`;

export const secHead = (title, sub = "", right = "", level = "h2") => `<div class="sec-head"><div><${level}>${esc(title)}</${level}>${sub ? `<p>${esc(sub)}</p>` : ""}</div>${right}</div>`;

export function band({ crumb = [], title, sub = "", right = "", tabs = "", above = "", flush = false }) {
  const trail = crumb.map(([label, go], i) => (i < crumb.length - 1 ? `<button type="button" data-go="${esc(go)}">${esc(label)}</button>  /  ` : esc(label))).join("");
  return `<section class="band on-blue ${flush || tabs ? "flush" : ""}"><div class="wrap">
    <nav class="crumb" aria-label="Trilha">${trail}</nav>${above}
    <div class="title-row"><div class="grow"><h1 id="titulo">${esc(title)}</h1>${sub ? `<p class="sub">${sub}</p>` : ""}</div>${right}</div>
    ${tabs}</div></section>`;
}

export const innerTabs = (items, label = "Seções") => `<div class="tabs" role="tablist" aria-label="${esc(label)}">${items.map(([text, go, on]) => `<button type="button" role="tab" class="tab inner ${on ? "on" : ""}" aria-selected="${!!on}" data-go="${esc(go)}">${text}</button>`).join("")}</div>`;

export function kpi(label, value, delta = "", cmp = "", tone = "") {
  return `<div class="kpi"><small>${esc(label)}</small><strong>${esc(value)}</strong>${delta || cmp ? `<div class="row" style="gap:6px">${delta ? `<span class="delta ${tone}">${esc(delta)}</span>` : ""}<span class="small muted">${esc(cmp)}</span></div>` : ""}</div>`;
}

export const bar = (pct, cls = "") => `<div class="bar ${cls}" role="presentation"><i style="width:${Math.max(0, Math.min(100, pct * 100)).toFixed(1)}%"></i></div>`;

export function spark(values, color = "var(--primary)") {
  if (!values?.length) return '<span class="muted">—</span>';
  const w = 96, h = 28, max = Math.max(...values), min = Math.min(...values);
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * w).toFixed(1)},${(h - 3 - ((v - min) / (max - min || 1)) * (h - 6)).toFixed(1)}`).join(" ");
  return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

export function solutionCard(s, favorites) {
  const cat = categoryOf(s.category);
  const fav = favorites.includes(s.id);
  const r = avgRating(s);
  return `<article class="card">
    <div class="row between"><div class="row" style="gap:8px">${selo(cat.icon, { size: "sm" })}<span class="type">${esc(cat.type)}</span></div>${cycle(s.lifecycle)}</div>
    <h3><button type="button" data-go="#/solucao/${esc(s.id)}">${esc(s.name)}</button></h3>
    <p class="desc">${esc(s.summary)}</p>
    <div class="row wrap-row" style="gap:6px">${s.tags.slice(0, 3).map((t) => `<span class="tag">#${esc(t)}</span>`).join("")}</div>
    <div class="metrics"><span style="color:var(--warning)">${icon("star", { size: 14 })}</span><strong>${rating(r)}</strong><span class="muted">(${s.ratings.length} avaliações)</span><span class="muted">·</span><span style="color:var(--success)">${icon("check", { size: 14 })}</span>${compact(confirmedUses(s))} usos confirmados</div>
    <div class="foot"><div class="row" style="gap:8px">${`<span class="avatar sm" style="background:var(--navy)">${esc(teamById(s.teamId).name.split(" ").map((p) => p[0]).slice(0, 2).join(""))}</span>`}<span class="small" style="font-weight:500">${esc(teamById(s.teamId).name)}</span></div>
      <div class="row" style="gap:8px">${access(s.access)}<button type="button" class="fav-btn" aria-pressed="${fav}" aria-label="${fav ? "Remover dos favoritos" : "Favoritar"} ${esc(s.name)}" data-action="favorite" data-id="${esc(s.id)}">${icon("star", { size: 16 })}</button></div></div>
  </article>`;
}

export const tile = (cat, count) => `<button type="button" class="tile" data-action="filterCategory" data-category="${cat.id}">${selo(cat.icon, { size: "lg" })}<div><strong>${esc(cat.label)}</strong><span>${count} ${count === 1 ? "solução" : "soluções"}</span></div></button>`;

export function favoriteRow(s) {
  const cat = categoryOf(s.category);
  return `<button type="button" class="list-row btn-row" data-go="#/solucao/${esc(s.id)}">${selo(cat.icon)}<div class="grow"><strong>${esc(s.name)}</strong><small>${esc(cat.type)} · ${esc(teamById(s.teamId).name)}</small></div><span class="small muted">★ ${rating(avgRating(s))}</span>${icon("arrow", { size: 18 })}</button>`;
}

/* Loading, empty, failure and unauthorized states: always distinct. */
export function loadingState(cards = 2) {
  const card = '<div class="card" aria-hidden="true"><div class="row"><span class="skeleton" style="width:28px;height:28px;border-radius:50%"></span><span class="skeleton" style="width:90px;height:12px"></span></div><span class="skeleton" style="width:60%;height:18px"></span><span class="skeleton" style="width:90%;height:12px"></span><span class="skeleton" style="width:70%;height:12px"></span></div>';
  return `<div class="stack" aria-busy="true"><span class="sr-only">Carregando…</span><div class="grid-2">${card.repeat(cards)}</div><p class="small muted row">${icon("clock", { size: 16 })}Buscando dados… os filtros já aplicados continuam valendo.</p></div>`;
}
export const emptyState = (title, text, actions = "") => `<div class="state">${selo("search")}<h2>${esc(title)}</h2><p>${esc(text)}</p>${actions ? `<div class="row wrap-row" style="justify-content:center">${actions}</div>` : ""}</div>`;
export const errorState = (title = "Não foi possível carregar os dados", text = "O serviço não respondeu. Seus filtros foram mantidos; tente de novo em alguns segundos.") =>
  `<div class="state" role="alert">${selo("inbox", { tone: "danger" })}<h2>${esc(title)}</h2><p>${esc(text)}</p><span class="mono muted" style="background:var(--canvas);padding:4px 10px;border-radius:4px">Erro 503 · simulado</span>${btn("Tentar de novo", { action: "retry" })}</div>`;
export const noAccessState = (area, profileLabel) =>
  `<div class="panel"><div class="state">${selo("lock", { tone: "warning" })}<h2>Você não tem acesso a ${esc(area)}</h2><p>Esta área não está disponível para o perfil ${esc(profileLabel)}. Troque o perfil simulado no topo da página ou peça acesso ao administrador.</p><div class="row wrap-row" style="justify-content:center">${btn("Voltar ao início", { kind: "secondary", go: "#/inicio" })}${btn("Trocar perfil", { action: "openMenu", data: { menu: "profile" } })}</div></div></div>`;
