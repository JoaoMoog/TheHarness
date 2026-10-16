// Detalhe da solução: purpose, documentation, versions, access and ratings.
import { icon } from "../ui/icons.js";
import { ago, compact, ddmmyyyy, esc, rating } from "../ui/format.js";
import { ACCESS, LIFECYCLES, categoryOf } from "../domain/constants.js";
import { avgRating, confirmedUses, isPublic } from "../domain/catalog.js";
import { can } from "../domain/permissions.js";
import { approvalOf, band, btn, emptyState, innerTabs, secHead } from "../ui/components.js";
import { teamById, userById } from "../seed/people.js";
import { accessCta, side } from "./solution-side.js";

const TABS = [["visao", "Visão geral"], ["docs", "Documentação e uso"], ["versoes", "Versões e histórico"], ["acesso", "Acesso e contatos"], ["avaliacoes", "Avaliações"]];
const STEP_LABEL = { rascunho: "Rascunho", em_analise: "Enviada para aprovação", aprovada: "Aprovada", rejeitada: "Recusada", correcao: "Correção solicitada", arquivada: "Arquivada" };

export const canSee = (s, sol) => isPublic(sol) || sol.archived || sol.ownerId === s.userId || can(s.profile, "approvals.view") || can(s.profile, "admin.view");
const isOwner = (s, sol) => sol.ownerId === s.userId || s.profile === "admin";

function overview(sol) {
  const problems = sol.problems ?? [];
  const apps = sol.applications ?? [];
  return `<section class="panel">${secHead("Finalidade")}<p style="color:var(--text-2);line-height:24px">${esc(sol.purpose || sol.summary)}</p>
      ${problems.length ? `<h3>Problemas que resolve</h3>${problems.map((p) => `<div class="row" style="align-items:flex-start"><span style="color:var(--success)">${icon("check")}</span><span>${esc(p)}</span></div>`).join("")}` : ""}</section>
    ${apps.length ? `<section class="panel">${secHead("Possíveis aplicações", "Onde outras equipes já reaproveitaram")}<div class="grid-3">${apps.map(([t, d]) => `<div class="app-card"><h3>${esc(t)}</h3><p class="small" style="color:var(--text-2);margin-top:6px">${esc(d)}</p></div>`).join("")}</div></section>` : ""}
    ${docs(sol)}`;
}

function docs(sol) {
  const steps = sol.howTo ?? [];
  const files = sol.docs ?? (sol.links?.docs ? [{ name: sol.links.docs, size: "" }] : []);
  return `<section class="panel">${secHead("Como usar", "Instruções de uso e materiais da solução")}
    ${steps.length ? steps.map((t, i) => `<div class="row"><span class="step-num">${i + 1}</span><span>${esc(t)}</span></div>`).join("") : '<p class="muted">O manual de uso traz o passo a passo completo.</p>'}
    ${sol.code ? `<pre class="code">${esc(sol.code)}</pre>` : ""}
    ${files.length ? `<h3>Materiais</h3>${files.map((f) => `<div class="row" style="border:1px solid var(--line);border-radius:4px;padding:10px 12px">${icon("file", { size: 18 })}<span class="grow" style="color:var(--primary)">${esc(f.name)}</span><span class="small muted">${esc(f.size)}</span></div>`).join("")}` : ""}</section>`;
}

function versions(sol) {
  const hist = [...(sol.history ?? [])].reverse();
  return `<section class="panel">${secHead("Versões")}<ol class="timeline">${(sol.versions ?? []).map((v, i) => `<li class="${i === 0 ? "now" : ""}"><div><div class="row" style="gap:8px"><span class="mono" style="font-weight:500">${esc(v.version)}</span>${i === 0 ? '<span class="status pendente">Atual</span>' : ""}</div><div>${esc(v.note)}</div><div class="small muted">${ddmmyyyy(v.date)} · ${esc(userById(v.by).name)}</div></div></li>`).join("")}</ol></section>
    <section class="panel">${secHead("Histórico de aprovação", "Registro permanente de cada decisão")}${hist.length ? `<ol class="timeline">${hist.map((h) => `<li class="${h.to === "aprovada" ? "ok" : ""}"><div><strong style="font-weight:500">${esc(STEP_LABEL[h.to] ?? h.to)}</strong><div class="small muted">${ddmmyyyy(h.at)} · ${esc(userById(h.by).name)}</div>${h.note ? `<div class="quote" style="margin-top:6px">“${esc(h.note)}”</div>` : ""}</div></li>`).join("")}</ol>` : '<p class="muted">Ainda não enviada para aprovação.</p>'}</section>`;
}

function ratingsTab(s, sol) {
  const list = sol.ratings.filter((r) => r.comment);
  const reviews = [...(sol.reviews ?? []).map((v) => ({ who: v.who, stars: v.stars, comment: v.text })), ...list.map((r) => ({ who: userById(r.userId).name, stars: r.stars, comment: r.comment }))];
  return `<section class="panel">${secHead("Comentários", `${sol.ratings.length} avaliações · média ${rating(avgRating(sol))}`)}${reviews.length ? reviews.map((v) => `<div class="quote">“${esc(v.comment)}”<div class="small muted" style="margin-top:6px">${esc(v.who)} · ${"★".repeat(v.stars)}</div></div>`).join("") : '<p class="muted">Ainda sem comentários. Seja a primeira pessoa a comentar.</p>'}</section>`;
}

function ownerActions(s, sol) {
  if (!isOwner(s, sol) || !can(s.profile, "solution.publish")) return "";
  const editable = ["rascunho", "correcao", "rejeitada"].includes(sol.approval) && !sol.archived;
  return `<div class="note info" style="justify-content:space-between;align-items:center;flex-wrap:wrap">${icon("edit")}<span class="grow">Você é o responsável por esta solução.</span>
    <div class="row wrap-row">${editable ? btn(sol.approval === "correcao" ? "Corrigir e reenviar" : "Editar", { kind: "secondary", size: "sm", go: `#/publicar/${sol.id}` }) : ""}
    ${sol.approval === "aprovada" && !sol.archived ? btn("Nova versão", { kind: "secondary", size: "sm", action: "openModal", data: { modal: "version", id: sol.id } }) + btn("Arquivar", { kind: "danger", size: "sm", action: "openModal", data: { modal: "archive", id: sol.id } }) : ""}</div></div>`;
}

export function renderSolution(s, params) {
  const [id, tab = "visao"] = params;
  const sol = s.solutions.find((x) => x.id === id);
  if (!sol || !canSee(s, sol)) {
    return { band: band({ crumb: [["Início", "#/inicio"], ["Catálogo", "#/catalogo"], ["Solução", ""]], title: "Solução não disponível" }), body: `<div class="panel">${emptyState("Esta solução não está no catálogo", "Ela pode ter sido removida ou ainda não foi aprovada. Busque outra no catálogo.", btn("Ir para o catálogo", { go: "#/catalogo" }))}</div>` };
  }
  const cat = categoryOf(sol.category);
  const fav = s.favorites.includes(sol.id);
  const team = teamById(sol.teamId);
  const actions = sol.approval === "aprovada" && !sol.archived
    ? `<div class="row wrap-row">${btn(fav ? "★ Favorita" : "☆ Favoritar", { kind: "ghost-white", action: "favorite", data: { id: sol.id }, attrs: `aria-pressed="${fav}"` })}${btn("Confirmar uso", { kind: "ghost-white", action: "openModal", data: { modal: "use", id: sol.id } })}${accessCta(s, sol, "white")}</div>` : "";
  const above = `<div class="row wrap-row" style="gap:8px;margin-bottom:14px"><span class="pill-white">${esc(cat.type.toUpperCase())}</span><span class="pill-white outline">● ${esc(LIFECYCLES[sol.lifecycle])}</span><span class="pill-white mono">${esc(sol.version)}</span><span class="pill-white">${esc(ACCESS[sol.access])}</span>${sol.approval !== "aprovada" || sol.archived ? `<span class="pill-white" style="background:#fff;color:var(--warning)">${sol.archived ? "Arquivada" : esc(STEP_LABEL[sol.approval])}</span>` : ""}</div>`;
  const meta = `<div class="row wrap-row" style="gap:20px;margin-top:14px;font-size:14px;color:rgba(255,255,255,.82)"><span>Equipe: ${esc(team.name)}</span><span>Responsável: ${esc(userById(sol.ownerId).name)}</span><span>Atualizada ${ago(sol.updatedAt)}</span><span>★ ${rating(avgRating(sol))} (${sol.ratings.length} avaliações)</span><span>${compact(confirmedUses(sol))} usos confirmados</span></div>`;
  const tabs = innerTabs(TABS.map(([k, l]) => [k === "avaliacoes" ? `${l} (${sol.ratings.length})` : l, `#/solucao/${sol.id}/${k}`, k === tab]), "Seções da solução");
  const content = { visao: () => overview(sol), docs: () => docs(sol), versoes: () => versions(sol), acesso: () => `<section class="panel">${secHead("Acesso e contatos")}<p style="color:var(--text-2)">${sol.access === "direto" ? "Qualquer colaborador pode acessar sem pedir autorização." : "O responsável aprova cada pedido de acesso, com justificativa. Você acompanha o andamento em Solicitações de acesso."}</p>${sol.contactText ? `<p>${esc(sol.contactText)}</p>` : ""}</section>`, avaliacoes: () => ratingsTab(s, sol) }[tab] ?? (() => overview(sol));
  const archivedNote = sol.archived ? `<div class="note warn">${icon("archive")}<span>Solução arquivada: não aparece no catálogo, mas o histórico continua disponível.</span></div>` : "";
  return {
    band: band({ crumb: [["Início", "#/inicio"], ["Catálogo", "#/catalogo"], [sol.name, ""]], title: sol.name, sub: `${esc(sol.summary)}${meta}`, right: actions, above, tabs }),
    body: `${archivedNote}${ownerActions(s, sol)}<div class="split"><div class="stack" style="gap:24px">${content()}</div>${side(s, sol)}</div>`,
  };
}
