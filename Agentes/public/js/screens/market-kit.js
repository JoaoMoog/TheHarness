// Nexo Serviços building blocks: search field, category grid, provider line with verified seal and rating, filter chips.
import { distanceKm, filterProviders } from "../domain/marketplace.js";
import { CATEGORIES } from "../seed-market.js";
import { draft } from "../store.js";
import { actionAttrs, esc, icon, money } from "../ui.js";
import { initialsOf } from "./nexo-kit.js";

const TOP_RATING = 4.7;
const NEAR_KM = 5;

export const ratingText = (r) => r.toFixed(1).replace(".", ",");
export const kmText = (km) => (km < 1 ? "menos de 1 km" : `${km.toFixed(1).replace(".", ",")} km`);
export const categoryLabel = (id) => CATEGORIES.find((c) => c.id === id)?.label ?? id;
export const distanceFrom = (origin, place) => (origin ? distanceKm(origin, place) : 0);

/** "O que você precisa?" with the magnifier, like the Nexo notifications search. Enter or the arrow runs the search. */
export const searchField = (value = "") =>
  `<div class="mk-search">${icon("magnifying-glass")}<input id="market-search" data-bind="busca.q" value="${esc(value)}" placeholder="O que você precisa? Ex.: trocar a fiação" aria-label="Buscar serviços"><button type="button" data-action="search" aria-label="Buscar">${icon("arrow-right")}</button></div>`;

export const categoryGrid = (limit = CATEGORIES.length) =>
  `<div class="bk-grid mk-cats">${CATEGORIES.slice(0, limit).map((c) => `<button type="button" class="bk-tile" data-go="#/categoria/${c.id}">${icon(c.icon)}<span>${esc(c.label)}</span></button>`).join("")}</div>`;

export const verifiedSeal = () => `<span class="mk-verified">${icon("seal-check")}Verificado Nexo</span>`;

/** One result line: avatar, name with seal, rating, jobs with custody, distance and the starting price. */
export function providerLine(p, { go = `#/prestador/${p.id}` } = {}) {
  const meta = [`${ratingText(p.rating)} de 5`, `${p.jobsDone} serviços`, p.distanceKm !== undefined ? kmText(p.distanceKm) : ""].filter(Boolean).join(" · ");
  return `<button type="button" class="mk-provider" data-go="${esc(go)}"><span class="bk-avatar sm">${esc(initialsOf(p.name))}</span>
    <span class="mk-provider-text">${p.boosted ? `<em class="mk-sponsored">Patrocinado</em>` : ""}<strong>${esc(p.name)}</strong><small>${icon("star")}${esc(meta)}</small>${p.verified ? verifiedSeal() : ""}</span>
    <span class="mk-price"><small>a partir de</small><strong>${money(p.priceFromCents)}</strong></span></button>`;
}

/** Compact card for the horizontal "near you" carousel. */
export const providerCard = (p) =>
  `<button type="button" class="mk-card" data-go="#/prestador/${esc(p.id)}"><span class="bk-avatar sm">${esc(initialsOf(p.name))}</span><strong>${esc(p.name)}</strong><small>${esc(p.activity)}</small><small>${icon("star")}${ratingText(p.rating)} · ${kmText(p.distanceKm ?? 0)}</small></button>`;

const FILTERS = [["verifiedOnly", "Verificado Nexo"], ["creditOnly", "Aceita crédito Aval"], ["topRated", "Nota 4,7 ou mais"], ["near", "Até 5 km"]];
const SORTS = [["relevance", "Relevância"], ["rating", "Nota"], ["price", "Preço"], ["distance", "Distância"]];

export const filterChips = () =>
  `<div class="mk-chips" role="group" aria-label="Filtros">${FILTERS.map(([key, label]) => {
    const on = Boolean(draft(`busca.${key}`, false));
    return `<button type="button" class="pill-option small ${on ? "on" : ""}" aria-pressed="${on}" ${actionAttrs({ action: "toggleSearchFilter", data: { key } })}>${esc(label)}</button>`;
  }).join("")}</div>`;

export const sortTabs = () => {
  const sort = draft("busca.sort", "relevance");
  return `<div class="seg mk-sort">${SORTS.map(([key, label]) => `<button type="button" class="${sort === key ? "on" : ""}" ${actionAttrs({ action: "setSearchSort", data: { sort: key } })}>${esc(label)}</button>`).join("")}</div>`;
};

/** Applies the chip filters (code only) to an already ranked list. */
export const applyChips = (ranked, origin) => filterProviders(ranked, {
  verifiedOnly: draft("busca.verifiedOnly", false), creditOnly: draft("busca.creditOnly", false),
  minRating: draft("busca.topRated", false) ? TOP_RATING : undefined, origin, radiusKm: draft("busca.near", false) ? NEAR_KM : undefined,
});
