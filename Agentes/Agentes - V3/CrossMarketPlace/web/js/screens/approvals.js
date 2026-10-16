// Aprovações: queue of submissions, automatic checks, submitted data, history and the decision.
import { icon } from "../ui/icons.js";
import { ago, ddmmyyyy, esc } from "../ui/format.js";
import { ACCESS, LIFECYCLES, categoryOf } from "../domain/constants.js";
import { findSimilar } from "../domain/similarity.js";
import { approvalOf, band, btn, emptyState, errorState, innerTabs, loadingState } from "../ui/components.js";
import { teamById, userById } from "../seed/people.js";

const TABS = { pendentes: ["em_analise"], correcao: ["correcao"], decididas: ["aprovada", "rejeitada"] };
const DAY_MS = 86_400_000;
const SLA_DAYS = 2;
const SIMILAR_LIMIT = 0.3;
const MAX_ITEMS = 12;
const STEP_LABEL = { em_analise: "Enviada para aprovação", correcao: "Correção solicitada", aprovada: "Aprovada", rejeitada: "Recusada", rascunho: "Reaberta como rascunho" };

function deadline(sol) {
  const days = Math.round((new Date("2026-10-06T12:00:00") - new Date(`${sol.submittedAt ?? sol.updatedAt}T12:00:00`)) / DAY_MS);
  const left = SLA_DAYS - days;
  if (left < 0) return ["prazo vencido", "danger"];
  if (left === 0) return ["vence hoje", "warning"];
  return [`vence em ${left} ${left === 1 ? "dia" : "dias"}`, "text-3"];
}

function kindOf(sol) {
  if ((sol.history ?? []).some((x) => x.to === "correcao")) return ["Reenvio após correção", "warn"];
  if ((sol.versions?.length ?? 0) > 1) return ["Nova versão", ""];
  return ["Nova publicação", ""];
}

function checks(s, sol) {
  const similar = findSimilar(sol, s.solutions)[0];
  const docs = sol.docs?.map((d) => d.name).join(", ") || sol.links?.docs || "";
  return [
    [!!docs, "Documentação anexada", docs || "Nenhum documento anexado"],
    [!!sol.ownerId, "Responsável e contatos", `${userById(sol.ownerId).name}${sol.contactText ? ` · ${sol.contactText}` : ""}`],
    [!similar || similar.score < SIMILAR_LIMIT || !!sol.similarityNote, "Soluções parecidas", similar ? `${Math.round(similar.score * 100)}% com “${similar.solution.name}”${sol.similarityNote ? ", com justificativa" : ""}` : "Nenhuma solução parecida"],
    [!!(sol.links?.repo || sol.links?.endpoint), "Repositório ou endpoint", sol.links?.repo || sol.links?.endpoint || "Não informado"],
  ];
}

const kv = (k, v) => `<dl class="kv"><dt>${k}</dt><dd>${v}</dd></dl>`;

function history(sol, decidable) {
  const hist = sol.history ?? [];
  return `<ol class="timeline">${hist.map((h, i) => `<li class="${i === hist.length - 1 && decidable ? "now" : "ok"}"><div><strong style="font-weight:500">${esc(STEP_LABEL[h.to] ?? h.to)}</strong><div class="small muted">${ddmmyyyy(h.at)} · ${esc(userById(h.by).name)}</div>${h.note ? `<div class="small">“${esc(h.note)}”</div>` : ""}</div></li>`).join("")}</ol>`;
}

function decision(sol) {
  if (sol.approval !== "em_analise") {
    return `<div class="note info">${icon("clock")}<span>${sol.approval === "correcao" ? "Aguardando o publicador corrigir e reenviar." : "Decisão registrada. Ela fica no histórico da solução."}</span></div>`;
  }
  return `<div class="stack" style="background:var(--canvas);border-radius:4px;padding:20px;gap:12px">
    <label for="parecer" style="font-weight:500">Parecer</label>
    <textarea id="parecer" class="textarea" placeholder="Descreva o motivo da decisão. Obrigatório para recusar ou pedir correção; o publicador vê este texto."></textarea>
    <div class="row wrap-row">${btn("Recusar", { kind: "danger", action: "decideApproval", data: { id: sol.id, to: "rejeitada" } })}<span class="grow"></span>${btn("Pedir correção", { kind: "secondary", action: "decideApproval", data: { id: sol.id, to: "correcao" } })}${btn("Aprovar publicação", { action: "decideApproval", data: { id: sol.id, to: "aprovada" } })}</div>
  </div>`;
}

function review(s, sol) {
  const cat = categoryOf(sol.category);
  return `<section class="panel" style="gap:24px" aria-labelledby="rev-title">
    <div class="row wrap-row" style="gap:16px"><span class="selo lg">${icon(cat.icon, { size: 24 })}</span>
      <div class="grow"><div class="row wrap-row" style="gap:10px"><h2 id="rev-title" style="font-size:24px;line-height:30px">${esc(sol.name)}</h2>${approvalOf(sol)}<span class="mono muted">${esc(sol.version)}</span></div>
      <p class="small muted">Enviada por ${esc(userById(sol.ownerId).name)} · ${esc(teamById(sol.teamId).name)} · ${ddmmyyyy(sol.submittedAt ?? sol.updatedAt)}</p></div>
      ${btn("Pré-visualizar", { kind: "secondary", go: `#/solucao/${sol.id}` })}</div>
    <div><p class="eyebrow" style="margin-bottom:12px">Verificações automáticas</p><div class="grid-2" style="gap:12px">${checks(s, sol).map(([ok, t, d]) => `<div class="check-card ${ok ? "ok" : "warn"}">${icon(ok ? "check" : "eye")}<div><strong>${esc(t)}</strong><small>${esc(d)}</small></div></div>`).join("")}</div></div>
    <div><p class="eyebrow" style="margin-bottom:4px">Informações enviadas</p>
      ${kv("Tipo", esc(cat.type))}${kv("Ciclo de vida e acesso", `${esc(LIFECYCLES[sol.lifecycle])} · ${esc(ACCESS[sol.access])}`)}${kv("Descrição", esc(sol.summary))}
      ${sol.similarityNote ? kv("Por que é diferente", `“${esc(sol.similarityNote)}”`) : ""}
      ${kv("Repositório", `<span class="mono">${esc(sol.links?.repo || "—")}</span>`)}${kv("Endpoint", `<span class="mono">${esc(sol.links?.endpoint || "—")}</span>`)}${kv("Tags", sol.tags.map((t) => `#${esc(t)}`).join("  "))}</div>
    <div><p class="eyebrow" style="margin-bottom:12px">Histórico</p>${history(sol, sol.approval === "em_analise")}</div>
    ${decision(sol)}
  </section>`;
}

function queueItem(x, tab, selectedId) {
  const [kind, kindCls] = kindOf(x);
  const [due, dueColor] = deadline(x);
  const when = tab === "pendentes" ? `enviada ${ago(x.submittedAt ?? x.updatedAt)} · ${due}` : ago(x.updatedAt);
  return `<button type="button" class="queue-item" aria-current="${x.id === selectedId}" data-action="selectApproval" data-id="${esc(x.id)}">
    <span class="selo">${icon(categoryOf(x.category).icon, { size: 18 })}</span>
    <span class="grow"><strong>${esc(x.name)}</strong><span class="small muted" style="display:block">${esc(categoryOf(x.category).type)} · ${esc(teamById(x.teamId).name)}</span>
    <span class="row" style="gap:8px;margin-top:6px"><span class="kind ${kindCls}">${kind}</span><span class="small" style="color:var(--${tab === "pendentes" ? dueColor : "text-3"})">${when}</span></span></span></button>`;
}

function listFor(s, tab) {
  const recentlyDecided = (x) => (x.history ?? []).some((h) => ["aprovada", "rejeitada"].includes(h.to) && h.at >= "2026-09-01");
  return s.solutions
    .filter((x) => TABS[tab].includes(x.approval) && (tab !== "decididas" || recentlyDecided(x)))
    .sort((a, b) => String(a.submittedAt ?? a.updatedAt).localeCompare(String(b.submittedAt ?? b.updatedAt)))
    .slice(0, MAX_ITEMS);
}

export function renderApprovals(s, params, ui) {
  const tab = TABS[params[0]] ? params[0] : "pendentes";
  const list = listFor(s, tab);
  const pend = s.solutions.filter((x) => x.approval === "em_analise").length;
  const corr = s.solutions.filter((x) => x.approval === "correcao").length;
  const selected = list.find((x) => x.id === ui.selected) ?? list[0];
  const tabs = innerTabs([[`Pendentes (${pend})`, "#/aprovacoes/pendentes", tab === "pendentes"], [`Em correção (${corr})`, "#/aprovacoes/correcao", tab === "correcao"], ["Decididas recentemente", "#/aprovacoes/decididas", tab === "decididas"]], "Filtro de aprovações");
  const queue = `<section class="panel flush" aria-label="Fila"><div class="row between" style="padding:14px 20px"><span class="small muted">Ordenado por prazo</span>${icon("list", { size: 18 })}</div>${list.map((x) => queueItem(x, tab, selected?.id)).join("")}</section>`;
  let content;
  if (s.sim.fail) content = errorState();
  else if (ui.loading) content = loadingState(2);
  else if (!list.length) content = `<div class="panel">${emptyState("Nada por aqui", tab === "pendentes" ? "Nenhuma publicação aguardando análise. Bom trabalho!" : "Nenhuma publicação nesta situação.")}</div>`;
  else content = `<div class="split queue">${queue}${review(s, selected)}</div>`;
  const sub = `${pend} ${pend === 1 ? "publicação aguardando" : "publicações aguardando"} sua análise · prazo de resposta: ${SLA_DAYS} dias úteis`;
  return { band: band({ crumb: [["Início", "#/inicio"], ["Aprovações", ""]], title: "Aprovações", sub, tabs }), body: content };
}
