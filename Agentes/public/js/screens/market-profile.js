// Nexo Serviços public pages: the provider profile and a listing that can be hired right away with Aval protection.
import { insurancePremium } from "../actions/index.js";
import { categoryOf, homeOf, providerById } from "../actions/market.js";
import { boostActive } from "../domain/marketplace.js";
import { draft, installmentCents, now, person } from "../store.js";
import { appbar, btn, card, checkbox, empty, esc, icon, money, note, screen } from "../ui.js";
import { bkFacts, bkItem, bkSection, initialsOf } from "./nexo-kit.js";
import { categoryLabel, distanceFrom, kmText, ratingText, verifiedSeal } from "./market-kit.js";

const CREDIT_INSTALLMENTS = 6;
const MAX_STARS = 5;
const HOURS_PER_DAY = 24;

const hoursText = (h) => (h < HOURS_PER_DAY ? `até ${h} ${h === 1 ? "hora" : "horas"}` : `até ${Math.round(h / HOURS_PER_DAY)} dia(s)`);
const daysText = (d) => `${d} ${d === 1 ? "dia" : "dias"}`;

function profileHead(s, p) {
  const boosted = s.boosts.some((b) => b.providerId === p.id && boostActive(b, now(s)));
  return `<section class="mk-profile"><span class="bk-avatar lg">${esc(initialsOf(p.name))}</span><div><h2>${esc(p.name)}</h2><small>${esc(p.activity)} · ${esc(p.neighborhood)}, ${kmText(distanceFrom(homeOf(s), p))}</small>
    <div class="mk-badges">${p.verified ? verifiedSeal() : `<span class="mk-pending">Verificação em andamento</span>`}${boosted ? `<span class="mk-sponsored">Patrocinado</span>` : ""}</div></div></section>`;
}

const stars = (n) => `<span class="mk-stars" aria-label="${n} de ${MAX_STARS}">${Array.from({ length: MAX_STARS }, (_, i) => icon("star", i < n ? "on" : "")).join("")}</span>`;
const reviewItem = (r) => `<div class="mk-review"><div class="row-between"><strong>${esc(r.author)}</strong><small>${esc(r.date)}</small></div>${stars(r.stars)}<p>${esc(r.text)}</p><small>Avaliação de contrato pago com custódia</small></div>`;

function prestador(s, { id }) {
  const p = providerById(s, id);
  if (!p) return screen({ header: appbar({ title: "Prestador" }), body: empty("Perfil não encontrado.") });
  const own = p.id === person(s)?.providerId;
  const fav = (s.favorites[s.session.person] ?? []).includes(p.id);
  const listings = s.listings.filter((l) => l.providerId === p.id && l.status === "published");
  const reviews = s.marketReviews.filter((r) => r.providerId === p.id);
  return screen({
    cls: "bk-paper", header: appbar({ title: "Perfil", tone: "ink" }),
    body: `${profileHead(s, p)}
      <div class="mk-stats"><div><strong>${ratingText(p.rating)}</strong><small>nota</small></div><div><strong>${p.jobsDone}</strong><small>serviços com custódia</small></div><div><strong>${p.responseHours}h</strong><small>para responder</small></div></div>
      <p class="mk-bio">${esc(p.bio)}</p>
      <div class="mk-pad">${bkFacts([["Categorias", p.categories.map(categoryLabel).join(", ")], ["Atende", `até ${p.radiusKm} km de ${p.neighborhood}`], ["Responde", hoursText(p.responseHours)], ["Pagamento", p.acceptsCredit ? "Pix, saldo Nexo ou crédito Aval" : "Pix ou saldo Nexo"], ["Documento", p.doc]])}</div>
      ${p.portfolio.length ? bkSection("Portfólio", [`<div class="bk-grid">${p.portfolio.map((x) => `<div class="bk-tile mk-photo">${icon("image-square")}<span>${esc(x)}</span></div>`).join("")}</div>`]) : ""}
      ${bkSection("Serviços com preço", listings.map((l) => bkItem({ icon: categoryOf(l.categoryId)?.icon ?? "briefcase", label: `${daysText(l.days)} · ${l.stages.length} ${l.stages.length === 1 ? "etapa" : "etapas"}`, title: l.title, value: money(l.priceCents), go: `#/anuncio/${l.id}` })), { empty: "Sem anúncios publicados." })}
      ${bkSection("Avaliações", reviews.map(reviewItem), { empty: "Ainda sem avaliações." })}`,
    footer: own
      ? btn("Editar minha vitrine", { action: "goAs", data: { mode: "prestador", to: "#/vitrine" } })
      : `<div class="btn-row">${btn(fav ? "Salvo" : "Favoritar", { kind: "secondary", action: "toggleFavorite", data: { id: p.id }, iconName: "heart" })}${btn("Pedir orçamento", { action: "askQuoteFrom", data: { id: p.id } })}</div>`,
  });
}

function anuncio(s, { id }) {
  const l = s.listings.find((x) => x.id === id && x.status === "published");
  const p = l && providerById(s, l.providerId);
  if (!l || !p) return screen({ header: appbar({ title: "Anúncio" }), body: empty("Anúncio não encontrado.") });
  const own = p.id === person(s)?.providerId;
  const insured = Boolean(draft("anuncio.insurance", false));
  const total = l.priceCents + (insured ? insurancePremium(l.priceCents) : 0);
  return screen({
    cls: "bk-paper", header: appbar({ title: l.title, tone: "ink" }),
    body: `<button type="button" class="mk-owner" data-go="#/prestador/${esc(p.id)}"><span class="bk-avatar sm">${esc(initialsOf(p.name))}</span><span><strong>${esc(p.name)}</strong><small>${icon("star")}${ratingText(p.rating)} · ${p.jobsDone} serviços</small></span>${icon("caret-right")}</button>
      <div class="mk-pad"><div class="bk-big"><small>Preço do serviço</small><strong>${money(l.priceCents)}</strong></div>
      ${p.acceptsCredit ? `<small class="muted">ou ${CREDIT_INSTALLMENTS}x de ${money(installmentCents(total, CREDIT_INSTALLMENTS))} no crédito Aval</small>` : ""}
      ${bkFacts([["Prazo", daysText(l.days)], ["Categoria", categoryLabel(l.categoryId)], ["Etapas", l.stages.join(", ")]])}</div>
      ${bkSection("O que está incluso", l.includes.map((x) => `<p class="mk-check">${icon("check")}${esc(x)}</p>`))}
      <div class="bk-pad">${note("Protegido pelo Aval: o valor fica em custódia no Nexo e o prestador recebe por etapa aprovada.", "info", "shield-check")}
      ${own ? "" : card(`${checkbox(`Incluir Seguro Aval da obra (${money(insurancePremium(l.priceCents))})`, { bind: "anuncio.insurance", checked: insured })}${checkbox("Li e aceito as condições e a cláusula compromissória.", { bind: "anuncio.terms", checked: draft("anuncio.terms", false) })}`)}</div>`,
    footer: own ? btn("Ver meus anúncios", { go: "#/anuncios", kind: "secondary" })
      : `${btn(`Contratar com proteção Aval · ${money(total)}`, { action: "hireListing", data: { id: l.id } })}${btn("Pedir orçamento personalizado", { kind: "text", action: "askQuoteFrom", data: { id: p.id } })}`,
  });
}

export const marketProfileRoutes = { "prestador/:id": prestador, "anuncio/:id": anuncio };
