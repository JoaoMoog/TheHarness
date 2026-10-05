// Nexo Serviços, finding a provider: explore by category, search results ranked by code (Jev match + distance + rating), favorites.
import { categoryOf, homeOf, rankFor } from "../actions/market.js";
import { draft, person } from "../store.js";
import { appbar, empty, esc, money, percent, screen, signal } from "../ui.js";
import { bkBanner, bkItem, bkSection } from "./nexo-kit.js";
import { applyChips, categoryGrid, categoryLabel, filterChips, providerLine, searchField, sortTabs } from "./market-kit.js";

const requestBanner = () =>
  bkBanner({ text: "Não achou? Descreva o serviço e receba até 4 orçamentos de prestadores verificados.", cta: "Fazer pedido", art: "megaphone", go: "#/pedido/novo/1" });

function categoryNotice(search) {
  if (search.categoryId) {
    return `<div class="mk-notice">${signal(`Entendi: ${categoryLabel(search.categoryId)}${search.confidence ? ` · ${percent(search.confidence)}` : ""}`, "ok")}<button type="button" class="bk-link" data-action="clearSearchCategory">Todas as categorias</button></div>`;
  }
  if (search.suggestedCategory) {
    return `<div class="mk-notice">${signal("Confira a categoria", "review")}<span>Parece ${esc(categoryLabel(search.suggestedCategory))}.</span><button type="button" class="bk-link" data-action="useSearchCategory" data-id="${esc(search.suggestedCategory)}">Usar</button></div>`;
  }
  return "";
}

function buscar(s) {
  const search = s.ui.search;
  if (!search) {
    return screen({
      cls: "bk-flat", header: appbar({ title: "Nexo Serviços" }),
      body: `<div class="bk-pad">${searchField(draft("busca.q", ""))}</div>${bkSection("Categorias", [categoryGrid()])}${requestBanner()}`,
    });
  }
  const ranked = applyChips(rankFor(s, { scores: search.scores, categoryId: search.categoryId, sort: draft("busca.sort", "relevance") }), homeOf(s));
  return screen({
    cls: "bk-flat", header: appbar({ title: "Nexo Serviços" }),
    body: `<div class="bk-pad">${searchField(search.q)}${categoryNotice(search)}${filterChips()}${sortTabs()}</div>
      ${bkSection(`${ranked.length} ${ranked.length === 1 ? "prestador" : "prestadores"}`, ranked.map((p) => providerLine(p)), { aside: search.byAi ? signal("Ordenado com Aval IA") : "", empty: "Nenhum prestador com esses filtros." })}
      ${requestBanner()}`,
  });
}

function categoria(s, { id }) {
  const cat = categoryOf(id);
  if (!cat) return screen({ header: appbar({ title: "Categoria" }), body: empty("Categoria não encontrada.") });
  const ranked = applyChips(rankFor(s, { categoryId: id, sort: draft("busca.sort", "relevance") }), homeOf(s));
  const mine = person(s)?.providerId;
  const listings = s.listings.filter((l) => l.categoryId === id && l.status === "published" && l.providerId !== mine);
  const providerName = (pid) => s.marketProviders.find((p) => p.id === pid)?.name ?? "";
  return screen({
    cls: "bk-flat", header: appbar({ title: cat.label, tone: "ink" }),
    body: `<div class="bk-pad">${filterChips()}${sortTabs()}</div>
      ${bkSection("Serviços com preço", listings.map((l) => bkItem({ icon: cat.icon, label: `${providerName(l.providerId)} · ${l.days} ${l.days === 1 ? "dia" : "dias"}`, title: l.title, value: money(l.priceCents), go: `#/anuncio/${l.id}` })), { empty: "Ainda não há anúncios nesta categoria." })}
      ${bkSection("Prestadores", ranked.map((p) => providerLine(p)), { empty: "Nenhum prestador com esses filtros." })}
      ${requestBanner()}`,
  });
}

function favoritos(s) {
  const ids = s.favorites[s.session.person] ?? [];
  const list = rankFor(s, {}).filter((p) => ids.includes(p.id));
  return screen({
    cls: "bk-flat", header: appbar({ title: "Favoritos" }),
    body: bkSection("Prestadores salvos", list.map((p) => providerLine(p)), { empty: "Toque em Favoritar num perfil para salvar aqui." }),
  });
}

export const marketRoutes = { buscar, "categoria/:id": categoria, favoritos };
