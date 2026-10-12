// Minha área: pending items, notices, my publications, my access requests and favorites.
import { icon } from "../ui/icons.js";
import { ago, esc, int } from "../ui/format.js";
import { categoryOf } from "../domain/constants.js";
import { confirmedUses } from "../domain/catalog.js";
import { PROFILE_LABELS, can } from "../domain/permissions.js";
import { approvalOf, btn, cycle, emptyState, favoriteRow, innerTabs, secHead, status } from "../ui/components.js";
import { teamById, userById } from "../seed/people.js";

const KIND_COLOR = { ok: "success", warn: "warning", danger: "danger", info: "primary" };

function pendings(s) {
  const owned = new Set(s.solutions.filter((x) => x.ownerId === s.userId).map((x) => x.id));
  const items = [];
  const pendingReq = s.requests.filter((r) => r.status === "pendente" && owned.has(r.solutionId));
  if (pendingReq.length && can(s.profile, "access.decide")) items.push(["swap", "primary", `${pendingReq.length} ${pendingReq.length === 1 ? "pedido de acesso aguarda" : "pedidos de acesso aguardam"} sua resposta`, pendingReq.map((r) => s.solutions.find((x) => x.id === r.solutionId)?.name).join(" e "), btn("Responder", { kind: "secondary", go: "#/acessos" })]);
  for (const x of s.solutions.filter((y) => y.ownerId === s.userId && y.approval === "correcao")) items.push(["edit", "warning", `${x.name}: correção solicitada`, (x.history ?? []).filter((h) => h.to === "correcao").at(-1)?.note ?? "", btn("Corrigir e reenviar", { kind: "secondary", go: `#/publicar/${x.id}` })]);
  for (const x of s.solutions.filter((y) => y.ownerId === s.userId && y.approval === "rascunho")) items.push(["file", "primary", `Rascunho: ${x.name}`, `Atualizado ${ago(x.updatedAt)}`, btn("Continuar", { kind: "secondary", go: `#/publicar/${x.id}` })]);
  if (s.draft && !s.draft.id) items.push(["file", "primary", "Publicação não salva", s.draft.name || "Sem nome ainda", btn("Continuar", { kind: "secondary", go: "#/publicar" })]);
  const toConfirm = s.favorites.map((id) => s.solutions.find((x) => x.id === id)).find((x) => x && x.approval === "aprovada" && !x.uses.some((u) => u.userId === s.userId));
  if (toConfirm) items.push(["check", "success", `Você usou ${toConfirm.name} esta semana?`, "Confirme o uso e diga quanto tempo economizou", btn("Confirmar uso", { kind: "secondary", action: "openModal", data: { modal: "use", id: toConfirm.id } })]);
  return items;
}

const notices = (s, limit) => s.notifications.slice(0, limit).map((n) => `<button type="button" class="list-row btn-row" data-go="${esc(n.go)}" style="align-items:flex-start"><span style="width:8px;height:8px;border-radius:50%;margin-top:7px;flex:none;background:var(--${KIND_COLOR[n.kind] ?? "primary"});opacity:${n.read ? 0.35 : 1}"></span><span class="grow"><strong style="font-weight:${n.read ? 400 : 500}">${esc(n.text)}</strong><small>${esc(n.detail)} · ${ago(n.at)}</small></span></button>`).join("");

function publications(s) {
  const mine = s.solutions.filter((x) => x.ownerId === s.userId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  if (!mine.length) return emptyState("Nenhuma publicação ainda", "Publique uma ferramenta da sua equipe para outras áreas reutilizarem.", btn("Publicar solução", { go: "#/publicar" }));
  return `<div class="table-scroll"><table class="table"><thead><tr><th scope="col">Solução</th><th scope="col">Aprovação</th><th scope="col">Ciclo de vida</th><th scope="col">Versão</th><th scope="col">Usos</th></tr></thead><tbody>${mine.map((x) => `<tr class="${x.archived ? "dim" : ""}"><td><button type="button" class="link" style="color:var(--text);font-weight:500" data-go="#/solucao/${esc(x.id)}">${esc(x.name)}</button><div class="small muted">${esc(categoryOf(x.category).type)} · atualizada ${ago(x.updatedAt)}</div></td><td>${approvalOf(x)}</td><td>${cycle(x.lifecycle)}</td><td class="mono">${esc(x.version)}</td><td>${x.approval === "aprovada" ? int(confirmedUses(x)) : "—"}</td></tr>`).join("")}</tbody></table></div>`;
}

function requests(s) {
  const mine = s.requests.filter((r) => r.requesterId === s.userId);
  if (!mine.length) return '<p class="muted">Nenhum pedido enviado.</p>';
  return mine.map((r) => { const sol = s.solutions.find((x) => x.id === r.solutionId); return `<div class="list-row"><div class="grow"><strong>${esc(sol?.name)}</strong><small>${r.status === "pendente" ? `Enviado ${ago(r.createdAt)} · aguardando ${esc(userById(sol?.ownerId).name)}` : r.status === "aprovada" ? "Acesso liberado" : `“${esc(r.decisionNote)}”`}</small></div>${status(r.status)}</div>`; }).join("");
}

export function renderMe(s, params) {
  const tab = ["favoritos", "publicacoes", "solicitacoes", "avisos"].includes(params[0]) ? params[0] : "visao";
  const u = userById(s.userId);
  const favs = s.favorites.map((id) => s.solutions.find((x) => x.id === id)).filter(Boolean);
  const pend = pendings(s);
  const unread = s.notifications.filter((n) => !n.read).length;
  const nPub = s.solutions.filter((x) => x.ownerId === s.userId).length;
  const nReq = s.requests.filter((r) => r.requesterId === s.userId).length;
  const tabs = innerTabs([["Visão geral", "#/minha-area", tab === "visao"], [`Favoritos (${favs.length})`, "#/minha-area/favoritos", tab === "favoritos"], [`Minhas publicações (${nPub})`, "#/minha-area/publicacoes", tab === "publicacoes"], [`Minhas solicitações (${nReq})`, "#/minha-area/solicitacoes", tab === "solicitacoes"], [`Avisos (${unread})`, "#/minha-area/avisos", tab === "avisos"]], "Seções da minha área");
  const head = `<section class="band on-blue flush"><div class="wrap"><div class="row wrap-row" style="gap:20px"><span class="big-avatar">${esc(u.initials)}</span><div class="grow"><h1 id="titulo">${esc(u.name)}</h1><div class="row wrap-row" style="gap:8px;margin-top:6px"><span class="sub" style="margin:0">${esc(u.job)} · ${esc(teamById(u.teamId).name)}</span><span class="pill-white">${PROFILE_LABELS[s.profile]}</span></div></div>${btn("Preferências de avisos", { kind: "ghost-white", action: "prefs" })}</div>${tabs}</div></section>`;
  const favGrid = favs.length ? `<div class="grid-2" style="gap:0 32px">${favs.map(favoriteRow).join("")}</div>` : emptyState("Nenhum favorito", "Use a estrela nos cards do catálogo para salvar soluções aqui.", btn("Explorar o catálogo", { go: "#/catalogo" }));
  const pendList = pend.length ? pend.map(([ic, tone, t, d, cta]) => `<div class="list-row" style="padding:16px 0"><span class="selo lg tone-${tone}">${icon(ic)}</span><div class="grow"><strong>${esc(t)}</strong><small>${esc(d)}</small></div>${cta}</div>`).join("") : `<div class="note ok" style="margin-top:12px">${icon("check")}<span>Nenhuma pendência no momento.</span></div>`;
  const pendPanel = `<section class="panel" style="gap:0">${secHead("O que precisa de você", pend.length ? `${pend.length} ${pend.length === 1 ? "pendência" : "pendências"}` : "Tudo em dia")}${pendList}</section>`;
  const avisos = `<section class="panel" style="gap:0">${secHead("Avisos", "Decisões e mudanças relevantes", unread ? '<button type="button" class="link sm" data-action="markRead">Marcar como lidos</button>' : "")}${notices(s, tab === "avisos" ? 50 : 5)}</section>`;
  const pubPanel = (sub, more = "") => `<section class="panel">${secHead("Minhas publicações", sub, more)}${publications(s)}</section>`;
  const reqPanel = (more = "") => `<section class="panel" style="gap:0">${secHead("Minhas solicitações", "Pedidos de acesso enviados", more)}${requests(s)}</section>`;
  const favPanel = `<section class="panel" style="gap:4px">${secHead("Favoritos", `${favs.length} soluções salvas`)}${favGrid}</section>`;
  const views = {
    visao: `<div class="split">${pendPanel}${avisos}</div><div class="split">${pubPanel("Status de aprovação e ciclo de vida", '<button type="button" class="link sm" data-go="#/minha-area/publicacoes">Ver todas</button>')}${reqPanel('<button type="button" class="link sm" data-go="#/acessos/enviadas">Ver todas</button>')}</div>${favPanel}`,
    favoritos: favPanel,
    publicacoes: pubPanel("Inclui rascunhos, envios em análise e arquivadas"),
    solicitacoes: reqPanel(),
    avisos,
  };
  return { band: head, body: views[tab] };
}
