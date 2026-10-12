// Início: discovery hero inside the blue header, shortcuts, categories, recent solutions, favorites and my team.
import { icon } from "../ui/icons.js";
import { compact, esc, hours, int } from "../ui/format.js";
import { CATEGORIES } from "../domain/constants.js";
import { facetCounts, isPublic, searchCatalog } from "../domain/catalog.js";
import { hoursSaved, teamKpis } from "../domain/metrics.js";
import { can } from "../domain/permissions.js";
import { approvalOf, btn, favoriteRow, link, secHead, solutionCard, tile } from "../ui/components.js";
import { teamById, userById } from "../seed/people.js";

const TRENDING = ["genai", "ocr", "risco", "crédito", "rpa"];
const SORTS = [["atualizacao", "Atualização"], ["uso", "Mais usadas"], ["avaliacao", "Melhor avaliadas"]];

function hero(s) {
  const pub = s.solutions.filter(isPublic);
  const teams = new Set(pub.map((x) => x.teamId)).size;
  const saved = pub.reduce((n, x) => n + hoursSaved(x), 0);
  const confirmed = pub.reduce((n, x) => n + x.usage.confirmed + x.uses.length, 0);
  const first = userById(s.userId).name.split(" ")[0];
  return `<div class="hero">
    <div class="grow">
      <p class="hello">Olá, ${esc(first)}</p>
      <h1>Antes de construir, descubra o que já existe.</h1>
      <p class="lead">${pub.length} soluções de tecnologia e IA, criadas por ${teams} equipes, prontas para reutilizar.</p>
      <form class="searchbar" role="search" data-submit="homeSearch">
        <span style="color:var(--text-3)">${icon("search")}</span>
        <label class="sr-only" for="home-q">Buscar soluções</label>
        <input id="home-q" name="q" autocomplete="off" placeholder="Busque por nome, descrição ou tag: OCR, RAG, conciliação…">
        <button type="submit" class="btn dark">Buscar</button>
      </form>
      <div class="trending">Em alta: ${TRENDING.map((t) => `<button type="button" class="chip-white" data-action="searchTag" data-tag="${t}">#${t}</button>`).join("")}</div>
    </div>
    <div class="impact">
      <p style="font-size:15px;color:rgba(255,255,255,.88)">Horas economizadas com reutilização · 2026</p>
      <div class="big"><strong>${hours(saved)}</strong><span class="pill-white">${icon("trend", { size: 14 })}+18% vs. 2025</span></div>
      <p class="sub2">pelas equipes do banco ao reaproveitar soluções</p>
      <button type="button" class="line" data-go="#/catalogo"><span>Soluções publicadas</span><strong>${pub.length}</strong>${icon("arrow", { size: 16 })}</button>
      <button type="button" class="line" data-go="#/admin"><span>Equipes publicadoras</span><strong>${teams}</strong>${icon("arrow", { size: 16 })}</button>
      <button type="button" class="line" data-go="#/admin"><span>Reutilizações confirmadas</span><strong>${int(confirmed)}</strong>${icon("arrow", { size: 16 })}</button>
    </div>
  </div>`;
}

const strip = () => `<nav class="strip on-blue" aria-label="Atalhos"><div class="wrap">${[
  ["plus", "Publicar solução", 'data-go="#/publicar"'], ["upload", "Importar dados estruturados", 'data-action="startImport"'],
  ["swap", "Minhas solicitações", 'data-go="#/acessos/enviadas"'], ["star", "Favoritos", 'data-go="#/minha-area/favoritos"'],
  ["check", "Pendências", 'data-go="#/minha-area"'], ["chart", "Painel de impacto", 'data-go="#/admin"'], ["book", "Guia de publicação", 'data-action="guide"'],
].map(([ic, label, attr]) => `<button type="button" ${attr}>${icon(ic)}${label}</button>`).join("")}</div></nav>`;

function teamPanel(s) {
  const me = userById(s.userId);
  const team = teamById(me.teamId);
  const k = teamKpis(s.solutions, team.id);
  const recent = s.solutions.filter((x) => x.teamId === team.id && !x.archived).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 3);
  return `<section class="panel" aria-labelledby="home-team">
    <div class="row" style="gap:14px"><span class="selo lg" style="background:var(--primary);border:0;color:#fff">${icon("users", { size: 22 })}</span><div><h2 id="home-team">Projetos do meu time</h2><p class="small muted">${esc(team.name)} · ${k.total} soluções</p></div></div>
    <div class="grid-3" style="gap:0;border:1px solid var(--line);border-radius:4px">${[[k.published, "publicadas"], [int(k.confirmedUses), "usos confirmados"], [hours(k.hoursSaved), "economizadas"]].map(([n, l], i) => `<div style="padding:14px 16px;${i ? "border-left:1px solid var(--line)" : ""}"><strong style="font-size:22px;font-weight:500;display:block">${n}</strong><span class="small muted">${l}</span></div>`).join("")}</div>
    <div>${recent.map((x) => `<div class="list-row"><button type="button" class="link grow" style="color:var(--text);justify-content:flex-start" data-go="#/solucao/${esc(x.id)}">${esc(x.name)}</button><span class="small muted mono">${esc(x.version)}</span>${approvalOf(x)}</div>`).join("")}</div>
    ${btn("Abrir Projetos do meu time", { kind: "secondary", go: "#/meu-time", size: "block" })}
  </section>`;
}

export function renderHome(s, ui) {
  const counts = facetCounts(s.solutions, "category");
  const sort = ui.homeSort ?? "atualizacao";
  const recent = searchCatalog(s.solutions, { sort }).slice(0, 3);
  const favs = s.favorites.map((id) => s.solutions.find((x) => x.id === id)).filter(Boolean).slice(0, 4);
  const seg = `<div class="seg" role="group" aria-label="Ordenar">${SORTS.map(([k, l]) => `<button type="button" class="${sort === k ? "on" : ""}" aria-pressed="${sort === k}" data-action="homeSort" data-sort="${k}">${l}</button>`).join("")}</div>`;
  const canPublish = can(s.profile, "solution.publish");
  const body = `
    <section class="section" aria-labelledby="h-cat">${secHead("Explorar por categoria", "Encontre soluções pelo tipo de problema que resolvem", link("Ver catálogo completo", "#/catalogo")).replace("<h2>", '<h2 id="h-cat">')}
      <div class="grid-6">${CATEGORIES.map((c) => tile(c, counts[c.id] ?? 0)).join("")}</div></section>
    <section class="section" aria-labelledby="h-rec">${secHead("Atualizadas recentemente", "Novas versões e publicações aprovadas nas últimas semanas", seg).replace("<h2>", '<h2 id="h-rec">')}
      <div class="grid-3">${recent.map((x) => solutionCard(x, s.favorites)).join("")}</div></section>
    <section class="banner"><div class="copy"><h2>Sua equipe tem uma ferramenta que outras poderiam usar?</h2><p>Publique no CrossMarketPlace, acompanhe a adoção e o tempo economizado por quem reutiliza.</p></div>
      <div class="cta">${btn(canPublish ? "Publicar solução" : "Como publicar", { kind: "white", go: canPublish ? "#/publicar" : "", action: canPublish ? "" : "guide" })}</div>
      <div class="art" aria-hidden="true"><svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h15"/><path d="M15 4l4 4-4 4"/><path d="M20 16H5"/><path d="M9 12l-4 4 4 4"/></svg></div></section>
    <div class="split">
      <section class="panel" aria-labelledby="h-fav">${secHead("Seus favoritos", "Atalhos para o que você mais usa", link("Ver todos", "#/minha-area/favoritos")).replace("<h2>", '<h2 id="h-fav">')}
        <div>${favs.length ? favs.map(favoriteRow).join("") : '<p class="muted">Você ainda não favoritou nenhuma solução. Use a estrela nos cards.</p>'}</div></section>
      ${teamPanel(s)}
    </div>`;
  return { hero: hero(s), strip: strip(), body };
}
