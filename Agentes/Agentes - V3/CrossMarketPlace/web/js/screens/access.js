// Solicitações de acesso: requests received (owner decides) and requests sent (follow the status).
import { icon } from "../ui/icons.js";
import { ago, ddmm, esc } from "../ui/format.js";
import { can } from "../domain/permissions.js";
import { avatar, band, btn, emptyState, errorState, innerTabs, kpi, loadingState, status } from "../ui/components.js";
import { teamById, userById } from "../seed/people.js";

const STEPS = ["Enviado", "Em análise", "Decisão"];

const person = (id) => { const u = userById(id); return `<div class="row" style="gap:10px">${avatar(id)}<div><strong style="font-weight:500;display:block">${esc(u.name)}</strong><span class="small muted">${esc(teamById(u.teamId).name)}</span></div></div>`; };
const solLink = (s, id) => { const x = s.solutions.find((y) => y.id === id); return `<button type="button" class="link sm" data-go="#/solucao/${esc(id)}">${esc(x?.name ?? id)}</button>`; };

function actionsFor(r, decidable) {
  if (r.status !== "pendente") return `<span class="small muted">${r.status === "aprovada" ? `por ${esc(userById(r.decidedBy).name)} · ${ddmm(r.decidedAt)}` : esc(r.decisionNote)}</span>`;
  if (!decidable) return '<span class="small muted">Só o responsável decide</span>';
  return `<div class="row" style="gap:8px">${btn("Recusar", { kind: "danger", size: "sm", action: "openModal", data: { modal: "reject", request: r.id } })}${btn("Aprovar", { size: "sm", action: "approveRequest", data: { request: r.id } })}</div>`;
}

function receivedTable(s, rows, decidable) {
  if (!rows.length) return `<div class="panel">${emptyState("Nenhum pedido por aqui", "Quando alguém pedir acesso a uma solução sua que exige autorização, o pedido aparece nesta lista.")}</div>`;
  return `<div class="panel flush"><div class="table-scroll"><table class="table"><caption class="sr-only">Pedidos de acesso recebidos</caption>
    <thead><tr><th scope="col">Solicitante</th><th scope="col">Solução</th><th scope="col">Justificativa</th><th scope="col">Pedido em</th><th scope="col">Status</th><th scope="col">Ações</th></tr></thead>
    <tbody>${rows.map((r) => `<tr><td>${person(r.requesterId)}</td><td>${solLink(s, r.solutionId)}</td><td class="wrap-cell" style="color:var(--text-2)">“${esc(r.justification)}”</td><td>${ago(r.createdAt)}</td><td>${status(r.status)}</td><td>${actionsFor(r, decidable)}</td></tr>`).join("")}</tbody></table></div></div>`;
}

function sentCard(s, r) {
  const sol = s.solutions.find((x) => x.id === r.solutionId);
  const done = r.status === "pendente" ? 1 : 3;
  const color = (i) => (i >= done ? "line" : r.status === "rejeitada" && i === 2 ? "danger" : r.status === "aprovada" ? "success" : "primary");
  const info = r.status === "pendente" ? `Enviado ${ago(r.createdAt)} · aguardando ${esc(userById(sol?.ownerId).name)}` : r.status === "aprovada" ? `Aprovado em ${ddmm(r.decidedAt)} · acesso liberado` : `“${esc(r.decisionNote)}”`;
  return `<article class="panel" style="gap:12px"><div class="row between"><h3>${esc(sol?.name ?? r.solutionId)}</h3>${status(r.status)}</div>
    <p class="small muted">${esc(teamById(sol?.teamId).name)} · responsável: ${esc(userById(sol?.ownerId).name)}</p>
    <div class="row" style="gap:6px;align-items:flex-start">${STEPS.map((st, i) => `<div class="grow"><div style="height:4px;border-radius:2px;background:var(--${color(i)})"></div><span class="small ${i < done ? "" : "muted"}">${st}</span></div>`).join("")}</div>
    <p style="font-size:14px;color:var(--${r.status === "rejeitada" ? "danger" : "text-2"})">${info}</p>
    ${r.status === "aprovada" ? btn("Abrir solução", { kind: "secondary", size: "sm", go: `#/solucao/${r.solutionId}` }) : ""}</article>`;
}

const section = (title, sub, inner) => `<section class="section"><div class="sec-head"><div><h2>${title}</h2><p>${sub}</p></div></div>${inner}</section>`;

export function renderAccess(s, params, ui) {
  const decidable = can(s.profile, "access.decide");
  const tab = ["enviadas", "historico"].includes(params[0]) ? params[0] : "recebidas";
  const owned = new Set(s.solutions.filter((x) => x.ownerId === s.userId).map((x) => x.id));
  const received = s.requests.filter((r) => owned.has(r.solutionId));
  const sent = s.requests.filter((r) => r.requesterId === s.userId);
  const pending = received.filter((r) => r.status === "pendente");
  const approvedOct = received.filter((r) => r.status === "aprovada" && r.decidedAt >= "2026-10-01").length;
  const tabs = innerTabs([[`Recebidas (${pending.length})`, "#/acessos", tab === "recebidas"], [`Enviadas (${sent.length})`, "#/acessos/enviadas", tab === "enviadas"], ["Histórico", "#/acessos/historico", tab === "historico"]], "Pedidos de acesso");
  let body;
  if (s.sim.fail) body = errorState();
  else if (ui.loading) body = loadingState(2);
  else if (tab === "recebidas") {
    const kpis = `<div class="grid-4">${kpi("Aguardando sua resposta", String(pending.length), pending.length ? "prazo: 2 dias úteis" : "tudo em dia", "", pending.length ? "warn" : "")}${kpi("Aprovados em outubro", String(approvedOct + 13), "+4", "vs. setembro")}${kpi("Tempo médio de resposta", "6 h", "−2 h", "vs. setembro")}${kpi("Taxa de aprovação", "88%", "estável", "últimos 90 dias", "info")}</div>`;
    const lock = decidable ? "" : `<div class="note info">${icon("lock")}<span>Seu perfil atual só acompanha pedidos. Para aprovar ou recusar, troque para o perfil Publicador.</span></div>`;
    body = kpis + lock + section("Pedidos recebidos", "Para as soluções em que você é responsável", receivedTable(s, pending, decidable));
  } else if (tab === "enviadas") {
    const cards = sent.length ? `<div class="grid-3">${sent.map((r) => sentCard(s, r)).join("")}</div>` : `<div class="panel">${emptyState("Você ainda não pediu acesso", "Soluções que exigem autorização têm o botão Pedir acesso no detalhe.", btn("Explorar o catálogo", { go: "#/catalogo" }))}</div>`;
    body = section("Pedidos que você enviou", "Acompanhe o andamento das suas solicitações", cards);
  } else {
    body = section("Histórico de decisões", "Pedidos já aprovados ou recusados nas suas soluções", receivedTable(s, received.filter((r) => r.status !== "pendente"), decidable));
  }
  const note = `<div class="note info">${icon("unlock")}<span>Soluções com acesso direto não passam por aqui: o acesso é liberado na hora, a partir do detalhe da solução.</span></div>`;
  return { band: band({ crumb: [["Início", "#/inicio"], ["Solicitações de acesso", ""]], title: "Solicitações de acesso", sub: "Pedidos para usar soluções que exigem autorização do responsável", tabs }), body: body + note };
}
