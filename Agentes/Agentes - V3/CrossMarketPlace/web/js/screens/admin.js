// Administração: adoption and impact by period, by category and by team, plus catalog management.
import { icon } from "../ui/icons.js";
import { esc, hours, int, rating } from "../ui/format.js";
import { CATEGORIES, categoryOf } from "../domain/constants.js";
import { avgRating, confirmedUses, isPublic } from "../domain/catalog.js";
import { conversion, hoursSaved, teamRanking, usesByCategory } from "../domain/metrics.js";
import { band, bar, btn, errorState, innerTabs, kpi, loadingState, secHead } from "../ui/components.js";
import { TEAMS } from "../seed/people.js";

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out"];
const CW = 780, CH = 220;

/** Monthly series derived from current totals (synthetic shape, real totals). */
function series(total, sessionUses) {
  const w = MONTHS.map((_, i) => 0.6 + 0.1 * i);
  const sum = w.reduce((a, b) => a + b, 0);
  const used = w.map((x, i) => Math.round((total * x) / sum) + (i === MONTHS.length - 1 ? sessionUses : 0));
  const interest = used.map((u, i) => Math.round(u * (2.1 - 0.06 * i)));
  return { used, interest };
}

function chart({ used, interest }) {
  const max = Math.ceil(Math.max(...interest) / 1000) * 1000 || 1000;
  const pts = (arr) => arr.map((v, i) => `${((i / (arr.length - 1)) * CW).toFixed(1)},${(CH - (v / max) * CH).toFixed(1)}`).join(" ");
  const grid = [0, 1, 2, 3, 4].map((i) => `<path d="M0 ${(CH - (i * CH) / 4).toFixed(1)}H${CW}" stroke="#e1e2e6"/>`).join("");
  const ticks = [4, 3, 2, 1, 0].map((i) => `<span>${int((max / 4) * i)}</span>`).join("");
  return `<div class="chart-wrap"><div class="y" aria-hidden="true">${ticks}</div>
    <svg viewBox="0 0 ${CW} ${CH}" preserveAspectRatio="none" role="img" aria-label="Uso confirmado e interesse por mês em 2026">${grid}<polygon points="0,${CH} ${pts(used)} ${CW},${CH}" fill="#2d5aaf" fill-opacity=".08"/><polyline points="${pts(interest)}" fill="none" stroke="#a9c1f0" stroke-width="2.5" vector-effect="non-scaling-stroke"/><polyline points="${pts(used)}" fill="none" stroke="#2d5aaf" stroke-width="2.5" vector-effect="non-scaling-stroke"/></svg></div>
    <div class="x-axis" aria-hidden="true">${MONTHS.map((m) => `<span>${m}</span>`).join("")}</div>
    <details><summary class="small">Ver como tabela</summary><table class="table"><thead><tr><th>Mês</th><th>Uso confirmado</th><th>Interesse</th></tr></thead><tbody>${MONTHS.map((m, i) => `<tr><td>${m}</td><td>${int(used[i])}</td><td>${int(interest[i])}</td></tr>`).join("")}</tbody></table></details>`;
}

function management(s) {
  const active = s.solutions.filter(isPublic).length;
  const disc = s.solutions.filter((x) => x.lifecycle === "descontinuada").length;
  const arch = s.solutions.filter((x) => x.archived).length;
  const stale = s.solutions.filter((x) => isPublic(x) && x.updatedAt < "2026-08-15").length;
  const rows = [["grid", "Categorias", `${CATEGORIES.length} categorias`], ["users", "Equipes", `${TEAMS.length} equipes cadastradas`], ["layout", "Soluções", `${active} ativas · ${disc} descontinuadas · ${arch} arquivadas`], ["lock", "Perfis e permissões", "4 perfis: colaborador, publicador, aprovador e administrador"]];
  return `<section class="panel" style="gap:0">${secHead("Gestão do catálogo", "Cadastros de apoio, conforme permissões")}
    ${rows.map(([ic, t, d]) => `<div class="list-row"><span class="selo">${icon(ic, { size: 16 })}</span><div class="grow"><strong>${t}</strong><small>${esc(d)}</small></div><button type="button" class="link sm" data-action="manage" data-what="${t}">Gerenciar</button></div>`).join("")}
    ${stale ? `<div class="note warn" style="margin-top:8px">${icon("clock")}<span>${stale} ${stale === 1 ? "solução publicada está" : "soluções publicadas estão"} sem atualização desde agosto. Revise o ciclo de vida.</span></div>` : ""}</section>`;
}

export function renderAdmin(s, params, ui) {
  const tab = params[0] ?? "indicadores";
  const pub = s.solutions.filter(isPublic);
  const confirmed = pub.reduce((n, x) => n + confirmedUses(x), 0);
  const interests = pub.reduce((n, x) => n + x.usage.interests, 0);
  const saved = pub.reduce((n, x) => n + hoursSaved(x), 0);
  const rated = pub.map(avgRating).filter((r) => r !== null);
  const mean = rated.length ? Math.round((rated.reduce((a, b) => a + b, 0) / rated.length) * 10) / 10 : null;
  const sessionUses = pub.reduce((n, x) => n + x.uses.length, 0);
  const cats = usesByCategory(s.solutions);
  const ranking = teamRanking(s.solutions, TEAMS).slice(0, 6);
  const per = `<div class="row wrap-row"><div class="seg on-blue" role="group" aria-label="Período">${["30 dias", "Trimestre", "2026"].map((p, i) => `<button type="button" class="${i === 2 ? "on" : ""}" aria-pressed="${i === 2}" data-action="period">${p}</button>`).join("")}</div>${btn("Exportar relatório", { kind: "ghost-white", action: "export" })}</div>`;
  const tabs = innerTabs([["Indicadores", "#/admin", true], ["Soluções", "#/admin", false], ["Categorias", "#/admin", false], ["Equipes", "#/admin", false], ["Perfis e permissões", "#/admin", false]], "Seções da administração");
  if (s.sim.fail || ui.loading) return { band: band({ crumb: [["Início", "#/inicio"], ["Administração", ""]], title: "Painel de adoção e impacto", sub: "Visão consolidada de soluções, categorias e equipes", right: per, tabs }), body: s.sim.fail ? errorState() : loadingState(4) };
  const legend = '<div class="row" style="gap:16px"><span class="legend"><i style="background:var(--primary)"></i>Uso confirmado</span><span class="legend"><i style="background:var(--accent)"></i>Interesse</span></div>';
  const body = `<div class="grid-4">${kpi("Soluções ativas no catálogo", String(pub.length), `${s.solutions.filter((x) => x.approval === "em_analise").length} em análise`, "", "info")}${kpi("Usos confirmados", int(confirmed), "+24%", "vs. 2025")}${kpi("Horas economizadas", hours(saved), "+18%", "vs. 2025")}${kpi("Nota média", rating(mean), "+0,1", "vs. 2025")}</div>
    <div class="split"><section class="panel">${secHead("Uso confirmado x interesse", "Por mês, em 2026. Interesse = favoritos, pedidos de acesso e aberturas com retorno.", legend)}${chart(series(confirmed, sessionUses))}
      <div class="note info">${icon("trend")}<span>No total, ${conversion(confirmed, interests)}% do interesse registrado virou uso confirmado.</span></div></section>
      <section class="panel">${secHead("Usos por categoria", "Confirmados em 2026")}${cats.map((c) => `<div><div class="row between small" style="margin-bottom:6px"><span class="row" style="gap:8px">${icon(categoryOf(c.category).icon, { size: 16 })}${esc(categoryOf(c.category).label)}</span><strong>${int(c.uses)}</strong></div>${bar(c.uses / cats[0].uses)}</div>`).join("")}</section></div>
    <div class="split"><section class="panel flush"><div style="padding:24px 24px 8px">${secHead("Ranking por equipe", "Ordenado por usos confirmados")}</div><div class="table-scroll"><table class="table"><thead><tr><th scope="col">Equipe</th><th scope="col">Soluções</th><th scope="col">Usos</th><th scope="col">Horas economizadas</th><th scope="col">Nota</th></tr></thead><tbody>
      ${ranking.map((t, i) => `<tr><td><div class="row" style="gap:12px"><span class="rank ${i === 0 ? "first" : ""}">${i + 1}</span><strong style="font-weight:500">${esc(t.team.name)}</strong></div></td><td>${t.solutions}</td><td style="font-weight:500">${int(t.uses)}</td><td>${hours(t.hours)}</td><td>★ ${rating(t.rating)}</td></tr>`).join("")}</tbody></table></div></section>
      ${management(s)}</div>`;
  return { band: band({ crumb: [["Início", "#/inicio"], ["Administração", ""]], title: "Painel de adoção e impacto", sub: `Visão consolidada de soluções, categorias e equipes · dados até 06/10/2026${tab !== "indicadores" ? "" : ""}`, right: per, tabs }), body };
}
