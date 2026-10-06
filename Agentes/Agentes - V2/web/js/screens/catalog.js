// Catálogo: search, filters by type, team, lifecycle, access and rating, sorting and pagination.
import { icon } from "../ui/icons.js";
import { esc } from "../ui/format.js";
import { ACCESS, CATEGORIES, LIFECYCLES } from "../domain/constants.js";
import { facetCounts, isPublic, searchCatalog } from "../domain/catalog.js";
import { band, btn, emptyState, errorState, loadingState, solutionCard } from "../ui/components.js";
import { teamById } from "../seed/people.js";

export const PAGE_SIZE = 6;
const SORTS = { relevancia: "Relevância", atualizacao: "Atualização", uso: "Mais usadas", avaliacao: "Melhor avaliadas" };
const RATINGS = [[0, "Todas"], [3, "3+ ★"], [4, "4+ ★"], [4.5, "4,5+ ★"]];

const check = (key, value, label, count, on) =>
  `<label class="check"><input type="checkbox" data-action="toggleFilter" data-key="${key}" data-value="${esc(value)}" ${on ? "checked" : ""}><span>${esc(label)}</span><span class="n">${count ?? 0}</span></label>`;
const group = (title, inner) => `<fieldset class="group"><legend class="eyebrow">${title}</legend><div class="stack" style="gap:10px">${inner}</div></fieldset>`;

function filtersPanel(s, f) {
  const cats = facetCounts(s.solutions, "category"), cyc = facetCounts(s.solutions, "lifecycle"), acc = facetCounts(s.solutions, "access");
  const topTeams = Object.entries(facetCounts(s.solutions, "teamId")).sort((a, b) => b[1] - a[1]);
  const shown = f.showAllTeams ? topTeams : topTeams.slice(0, 5);
  return `<aside class="panel filters" aria-label="Filtros">
    <div class="row between"><h2>Filtros</h2><button type="button" class="link sm" data-action="clearFilters">Limpar tudo</button></div>
    ${group("Tipo", CATEGORIES.map((c) => check("categories", c.id, c.label, cats[c.id], f.categories.includes(c.id))).join(""))}
    ${group("Ciclo de vida", Object.entries(LIFECYCLES).filter(([k]) => cyc[k]).map(([k, l]) => check("lifecycles", k, l, cyc[k], f.lifecycles.includes(k))).join(""))}
    ${group("Acesso", Object.entries(ACCESS).map(([k, l]) => check("access", k, l, acc[k], f.access.includes(k))).join(""))}
    ${group("Equipe", shown.map(([id, n]) => check("teams", id, teamById(id).name, n, f.teams.includes(id))).join("") + (topTeams.length > 5 ? `<button type="button" class="link sm" data-action="toggleAllTeams">${f.showAllTeams ? "Mostrar menos" : `Ver as ${topTeams.length} equipes`}</button>` : ""))}
    ${group("Avaliação mínima", `<div class="row wrap-row" style="gap:8px">${RATINGS.map(([v, l]) => `<button type="button" class="chip ${f.minRating === v ? "on" : ""}" aria-pressed="${f.minRating === v}" data-action="setMinRating" data-value="${v}">${l}</button>`).join("")}</div>`)}
  </aside>`;
}

function activeChips(f) {
  const chips = [
    ...f.categories.map((v) => ["categories", v, `Tipo: ${CATEGORIES.find((c) => c.id === v)?.label}`]),
    ...f.lifecycles.map((v) => ["lifecycles", v, `Ciclo: ${LIFECYCLES[v]}`]),
    ...f.access.map((v) => ["access", v, ACCESS[v]]),
    ...f.teams.map((v) => ["teams", v, `Equipe: ${teamById(v).name}`]),
    ...(f.minRating ? [["minRating", "0", `Nota ${String(f.minRating).replace(".", ",")}+`]] : []),
  ];
  return chips.length ? `<div class="active-filters">${chips.map(([k, v, l]) => `<button type="button" data-action="removeFilter" data-key="${k}" data-value="${esc(v)}" aria-label="Remover filtro ${esc(l)}">${esc(l)} ×</button>`).join("")}</div>` : "";
}

function pager(page, pages) {
  if (pages <= 1) return "";
  const nums = Array.from({ length: pages }, (_, i) => `<button type="button" class="${i + 1 === page ? "on" : ""}" ${i + 1 === page ? 'aria-current="page"' : ""} data-action="setPage" data-page="${i + 1}">${i + 1}</button>`).join("");
  const prev = page > 1 ? `<button type="button" data-action="setPage" data-page="${page - 1}" aria-label="Página anterior">‹</button>` : "";
  const next = page < pages ? `<button type="button" data-action="setPage" data-page="${page + 1}" aria-label="Próxima página">›</button>` : "";
  return `<nav class="pager" aria-label="Páginas">${prev}${nums}${next}</nav>`;
}

function results(s, f, ui) {
  if (s.sim.fail) return errorState("Não foi possível carregar o catálogo", "O serviço de busca não respondeu. Seus filtros foram mantidos. Desative a falha simulada no menu de perfil ou tente de novo.");
  if (ui.loading) return loadingState(4);
  const list = searchCatalog(s.solutions, f);
  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const page = Math.min(f.page, pages);
  const slice = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const title = f.q ? `${list.length} ${list.length === 1 ? "resultado" : "resultados"} para “${esc(f.q)}”` : `${list.length} soluções`;
  const sortSel = `<label class="row" style="gap:8px;background:var(--surface);border:1px solid var(--line);border-radius:4px;padding:0 6px 0 14px"><span class="small muted">Ordenar por:</span><select class="select" style="border:0;padding:8px 6px;width:auto;font-weight:500" data-action="setSort" aria-label="Ordenar por">${Object.entries(SORTS).map(([k, l]) => `<option value="${k}" ${f.sort === k ? "selected" : ""}>${l}</option>`).join("")}</select></label>`;
  const head = `<div class="row between" style="align-items:flex-start;flex-wrap:wrap"><div><h2 aria-live="polite">${title}</h2>${activeChips(f)}</div>${sortSel}</div>`;
  if (!list.length) {
    const actions = btn("Limpar filtros", { kind: "secondary", action: "clearFilters" }) + btn("Publicar solução", { go: "#/publicar" });
    return `${head}<div class="panel">${emptyState(f.q ? `Nenhuma solução para “${f.q}”` : "Nenhuma solução com esses filtros", "Tente outros termos ou remova filtros. Se ninguém resolveu isso ainda, sua equipe pode publicar a primeira solução.", actions)}</div>`;
  }
  return `${head}<div class="grid-2">${slice.map((x) => solutionCard(x, s.favorites)).join("")}</div>
    <div class="row between"><span class="small muted">Mostrando ${(page - 1) * PAGE_SIZE + 1}–${(page - 1) * PAGE_SIZE + slice.length} de ${list.length} soluções</span>${pager(page, pages)}</div>`;
}

export function renderCatalog(s, ui) {
  const f = s.filters;
  const pub = s.solutions.filter(isPublic);
  const teams = new Set(pub.map((x) => x.teamId)).size;
  const search = `<form class="searchbar" role="search" data-submit="catalogSearch" style="max-width:760px"><span style="color:var(--text-3)">${icon("search")}</span><label class="sr-only" for="cat-q">Buscar no catálogo</label><input id="cat-q" name="q" value="${esc(f.q)}" autocomplete="off" placeholder="Busque por nome, descrição ou tag">${f.q ? '<button type="button" class="link sm" data-action="clearQuery">Limpar</button>' : ""}<button type="submit" class="btn dark">Buscar</button></form>`;
  return {
    band: band({ crumb: [["Início", "#/inicio"], ["Catálogo", ""]], title: "Catálogo de soluções", sub: `${pub.length} soluções aprovadas por ${teams} equipes. Só aparecem aqui publicações aprovadas.`, above: "", right: "", tabs: `<div style="padding-bottom:36px">${search}</div>` }),
    body: `<div class="split left">${filtersPanel(s, f)}<section class="stack" style="gap:20px" aria-label="Resultados">${results(s, f, ui)}</section></div>`,
  };
}
