// Projetos do meu time: team indicators and every solution of the team, with status filters and owner actions.
import { icon } from "../ui/icons.js";
import { ago, esc, hours, int, rating } from "../ui/format.js";
import { categoryOf } from "../domain/constants.js";
import { avgRating, confirmedUses } from "../domain/catalog.js";
import { teamKpis } from "../domain/metrics.js";
import { can } from "../domain/permissions.js";
import { approvalOf, avatar, btn, cycle, emptyState, errorState, innerTabs, kpi, loadingState, spark } from "../ui/components.js";
import { USERS, teamById, userById } from "../seed/people.js";

const FILTERS = [["todas", "Todas"], ["aprovada", "Publicadas"], ["em_analise", "Em análise"], ["rascunho", "Rascunhos"], ["correcao", "Em correção"], ["arquivada", "Arquivadas"]];
const matches = (x, f) => f === "todas" || (f === "arquivada" ? x.archived : !x.archived && x.approval === f);
const hash = (id) => [...id].reduce((n, c) => n + c.charCodeAt(0), 0);

/** Six-month adoption trend derived deterministically from confirmed uses (synthetic). */
function trend(x) {
  if (x.approval !== "aprovada" || !confirmedUses(x)) return null;
  const base = confirmedUses(x) / 6;
  const wobble = (i) => ((hash(x.id) * (i + 3)) % 7) / 20;
  return Array.from({ length: 6 }, (_, i) => (x.archived ? base * (1.4 - i * 0.22) : base * (0.55 + i * 0.12 + wobble(i))));
}

function rowActions(s, x) {
  const mine = x.ownerId === s.userId || s.profile === "admin";
  const parts = [`<button type="button" class="icon-btn" style="width:32px;height:32px" aria-label="Abrir ${esc(x.name)}" data-go="#/solucao/${esc(x.id)}">${icon("eye", { size: 18 })}</button>`];
  if (mine && can(s.profile, "solution.publish")) {
    if (["rascunho", "correcao", "rejeitada"].includes(x.approval) && !x.archived) parts.push(`<button type="button" class="icon-btn" style="width:32px;height:32px" aria-label="Editar ${esc(x.name)}" data-go="#/publicar/${esc(x.id)}">${icon("edit", { size: 18 })}</button>`);
    if (x.approval === "aprovada" && !x.archived) parts.push(`<button type="button" class="icon-btn" style="width:32px;height:32px" aria-label="Nova versão de ${esc(x.name)}" data-action="openModal" data-modal="version" data-id="${esc(x.id)}">${icon("upload", { size: 18 })}</button><button type="button" class="icon-btn" style="width:32px;height:32px;color:var(--danger)" aria-label="Arquivar ${esc(x.name)}" data-action="openModal" data-modal="archive" data-id="${esc(x.id)}">${icon("archive", { size: 18 })}</button>`);
  }
  return `<div class="row" style="gap:2px">${parts.join("")}</div>`;
}

function table(s, list) {
  if (!list.length) return `<div style="padding:24px">${emptyState("Nenhuma solução neste filtro", "Troque o filtro de status ou publique uma nova solução do time.")}</div>`;
  return `<div class="table-scroll"><table class="table"><caption class="sr-only">Soluções do time</caption><thead><tr><th scope="col">Solução</th><th scope="col">Aprovação</th><th scope="col">Ciclo de vida</th><th scope="col">Versão</th><th scope="col">Responsável</th><th scope="col">Usos</th><th scope="col">Nota</th><th scope="col">Adoção · 6 meses</th><th scope="col">Atualizada</th><th scope="col"><span class="sr-only">Ações</span></th></tr></thead><tbody>
    ${list.map((x) => { const cat = categoryOf(x.category); const t = trend(x); return `<tr class="${x.archived ? "dim" : ""}"><td><div class="row" style="gap:12px"><span class="selo">${icon(cat.icon, { size: 16 })}</span><div><button type="button" class="link" style="color:var(--text);font-weight:500" data-go="#/solucao/${esc(x.id)}">${esc(x.name)}</button><div class="small muted">${esc(cat.type)}</div></div></div></td><td>${approvalOf(x)}</td><td>${x.archived ? '<span class="muted">—</span>' : cycle(x.lifecycle)}</td><td class="mono">${esc(x.version)}</td><td><div class="row" style="gap:8px">${avatar(x.ownerId, "sm")}<span>${esc(userById(x.ownerId).name)}</span></div></td><td style="font-weight:500">${x.approval === "aprovada" ? int(confirmedUses(x)) : "—"}</td><td>${x.approval === "aprovada" && avgRating(x) !== null ? `★ ${rating(avgRating(x))}` : "—"}</td><td>${spark(t, x.archived ? "var(--text-3)" : "var(--primary)")}</td><td>${ago(x.updatedAt)}</td><td>${rowActions(s, x)}</td></tr>`; }).join("")}
  </tbody></table></div>`;
}

function activity(s, teamId) {
  const events = s.solutions.filter((x) => x.teamId === teamId).flatMap((x) => (x.history ?? []).map((h) => ({ ...h, name: x.name })))
    .concat(s.solutions.filter((x) => x.teamId === teamId).flatMap((x) => x.uses.map((u) => ({ at: u.at, by: u.userId, to: "uso", name: x.name }))))
    .reverse().sort((a, b) => b.at.localeCompare(a.at)).slice(0, 5);
  const label = { em_analise: "enviada para aprovação", aprovada: "aprovada e publicada", correcao: "correção solicitada", rejeitada: "recusada", arquivada: "arquivada", rascunho: "reaberta como rascunho", uso: "uso confirmado" };
  const color = { aprovada: "success", correcao: "warning", rejeitada: "danger", uso: "primary" };
  return events.map((e) => `<div class="list-row" style="align-items:flex-start"><span style="width:8px;height:8px;border-radius:50%;margin-top:7px;flex:none;background:var(--${color[e.to] ?? "primary"})"></span><div class="grow"><strong style="font-weight:400">${esc(e.name)}: ${label[e.to] ?? e.to}</strong><small>${esc(userById(e.by).name)} · ${ago(e.at)}</small></div></div>`).join("");
}

export function renderTeam(s, params, ui) {
  const me = userById(s.userId);
  const team = teamById(me.teamId);
  const members = USERS.filter((u) => u.teamId === team.id);
  const all = s.solutions.filter((x) => x.teamId === team.id);
  const k = teamKpis(s.solutions, team.id);
  const filter = ui.teamFilter ?? "todas";
  const list = all.filter((x) => matches(x, filter)).sort((a, b) => Number(a.archived) - Number(b.archived) || (b.approval === "aprovada") - (a.approval === "aprovada") || confirmedUses(b) - confirmedUses(a));
  const owned = new Set(all.map((x) => x.id));
  const pendingReq = s.requests.filter((r) => r.status === "pendente" && owned.has(r.solutionId));
  const canPublish = can(s.profile, "solution.publish");
  const head = `<section class="band on-blue flush"><div class="wrap">
    <nav class="crumb" aria-label="Trilha"><button type="button" data-go="#/inicio">Início</button>  /  Projetos do meu time</nav>
    <div class="row wrap-row" style="gap:20px"><span class="big-avatar team">${icon("users", { size: 30 })}</span>
      <div class="grow"><h1 id="titulo">${esc(team.name)}</h1><div class="row wrap-row" style="gap:12px;margin-top:6px"><span class="sub" style="margin:0">${esc(team.area)}</span><span class="stack-avatars">${members.slice(0, 4).map((m) => `<span class="avatar" title="${esc(m.name)}">${esc(m.initials)}</span>`).join("")}${members.length > 4 ? `<span class="avatar" style="background:var(--primary-strong)">+${members.length - 4}</span>` : ""}</span><span class="small" style="color:rgba(255,255,255,.82)">${members.length} membros</span></div></div>
      <div class="seg on-blue" role="group" aria-label="Período">${["30 dias", "Trimestre", "2026"].map((p, i) => `<button type="button" class="${i === 2 ? "on" : ""}" aria-pressed="${i === 2}" data-action="period">${p}</button>`).join("")}</div>
      ${canPublish ? btn("Publicar solução", { kind: "white", go: "#/publicar" }) : ""}</div>
    ${innerTabs([[`Soluções (${all.length})`, "#/meu-time", true], [`Pedidos de acesso (${pendingReq.length})`, "#/acessos", false], [`Membros (${members.length})`, "#/meu-time", false]], "Seções do time")}</div></section>`;
  const chips = `<div class="row wrap-row" style="gap:6px" role="group" aria-label="Filtrar por status">${FILTERS.map(([key, l]) => `<button type="button" class="chip ${filter === key ? "on" : ""}" aria-pressed="${filter === key}" data-action="teamFilter" data-value="${key}">${l}<span class="n">${all.filter((x) => matches(x, key)).length}</span></button>`).join("")}</div>`;
  const content = s.sim.fail ? errorState() : ui.loading ? loadingState(2) : table(s, list);
  const body = `<div class="grid-4">${kpi("Soluções publicadas", String(k.published), "+2", "vs. 2025")}${kpi("Usos confirmados", int(k.confirmedUses), "+12%", "vs. 2025")}${kpi("Horas economizadas por outras equipes", hours(k.hoursSaved), "+21%", "vs. 2025")}${kpi("Nota média", rating(k.avgRating), "+0,2", "vs. 2025")}</div>
    <section class="panel flush" aria-label="Soluções do time"><div class="row between wrap-row" style="padding:16px 20px">${chips}</div>${content}
      <p class="small muted" style="padding:14px 20px;border-top:1px solid var(--line)">Status de aprovação, ciclo de vida e acesso são independentes: uma solução aprovada pode estar em piloto ou exigir autorização.</p></section>
    <div class="split"><section class="panel" style="gap:0"><div class="sec-head"><div><h2>Pedidos de acesso</h2><p>Para soluções do time que exigem autorização</p></div><button type="button" class="link sm" data-go="#/acessos">Ver todos</button></div>
      ${pendingReq.length ? pendingReq.map((r) => `<div class="list-row">${avatar(r.requesterId)}<div class="grow"><strong>${esc(userById(r.requesterId).name)} · ${esc(teamById(userById(r.requesterId).teamId).name)}</strong><small>${esc(s.solutions.find((x) => x.id === r.solutionId)?.name)} · ${ago(r.createdAt)}</small></div>${can(s.profile, "access.decide") && s.solutions.find((x) => x.id === r.solutionId)?.ownerId === s.userId ? btn("Recusar", { kind: "danger", size: "sm", action: "openModal", data: { modal: "reject", request: r.id } }) + btn("Aprovar", { size: "sm", action: "approveRequest", data: { request: r.id } }) : '<span class="small muted">Responsável decide</span>'}</div>`).join("") : '<p class="muted" style="padding-top:12px">Nenhum pedido pendente.</p>'}</section>
      <section class="panel" style="gap:0"><div class="sec-head"><div><h2>Atividade recente</h2><p>O que mudou nas soluções do time</p></div></div>${activity(s, team.id)}</section></div>`;
  return { band: head, body };
}
