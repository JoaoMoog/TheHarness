// Global header: brand, search, notifications, simulated profile and the main tabs.
import { icon } from "./icons.js";
import { ago, esc } from "./format.js";
import { PROFILES, PROFILE_LABELS, can, canOpenRoute } from "../domain/permissions.js";
import { userById } from "../seed/people.js";

const TABS = [
  ["inicio", "Início"], ["catalogo", "Catálogo"], ["meu-time", "Projetos do meu time"], ["minha-area", "Minha área"],
  ["acessos", "Solicitações de acesso"], ["aprovacoes", "Aprovações"], ["admin", "Administração"],
];

const owned = (s) => new Set(s.solutions.filter((x) => x.ownerId === s.userId).map((x) => x.id));

export function counts(s) {
  const mine = owned(s);
  return {
    acessos: can(s.profile, "access.decide") ? s.requests.filter((r) => r.status === "pendente" && mine.has(r.solutionId)).length : 0,
    aprovacoes: can(s.profile, "approvals.view") ? s.solutions.filter((x) => x.approval === "em_analise").length : 0,
  };
}

function profileMenu(s) {
  return `<div class="menu" role="menu" aria-label="Perfil simulado" style="right:56px;top:64px">
    <h4>Perfil simulado</h4>
    ${PROFILES.map((p) => `<button type="button" class="opt" role="menuitemradio" aria-checked="${s.profile === p}" data-action="setProfile" data-profile="${p}">${s.profile === p ? icon("check", { size: 16 }) : '<span style="width:16px"></span>'}${PROFILE_LABELS[p]}</button>`).join("")}
    <hr><h4>Simular</h4>
    <label class="opt"><input type="checkbox" data-action="toggleSim" data-key="slow" ${s.sim.slow ? "checked" : ""}> Carregamento lento</label>
    <label class="opt"><input type="checkbox" data-action="toggleSim" data-key="fail" ${s.sim.fail ? "checked" : ""}> Falha ao carregar</label>
    <hr><button type="button" class="opt" data-action="resetDemo">${icon("swap", { size: 16 })}Reiniciar demonstração</button>
  </div>`;
}

function bellMenu(s) {
  const list = s.notifications.slice(0, 6);
  return `<div class="menu" role="menu" aria-label="Avisos" style="right:180px;top:64px;width:360px">
    <div class="row between" style="padding:4px 10px"><h4 style="padding:0">Avisos</h4><button type="button" class="link sm" data-action="markRead">Marcar como lidos</button></div>
    ${list.length ? list.map((n) => `<button type="button" class="opt" role="menuitem" data-go="${esc(n.go)}" style="align-items:flex-start"><span style="width:8px;height:8px;border-radius:50%;margin-top:6px;flex:none;background:var(--${n.kind === "ok" ? "success" : n.kind === "warn" ? "warning" : n.kind === "danger" ? "danger" : "primary"});opacity:${n.read ? 0.35 : 1}"></span><span><span style="display:block;font-weight:${n.read ? 400 : 500}">${esc(n.text)}</span><span class="small muted">${esc(n.detail)} · ${ago(n.at)}</span></span></button>`).join("") : '<p class="small muted" style="padding:10px">Nenhum aviso por aqui.</p>'}
  </div>`;
}

export function renderHeader(s, route, { hero = "", menu = null } = {}) {
  const user = userById(s.userId);
  const unread = s.notifications.filter((n) => !n.read).length;
  const c = counts(s);
  const tabs = TABS.map(([key, label]) => {
    const allowed = canOpenRoute(s.profile, key);
    const n = c[key] ?? 0;
    return `<button type="button" class="tab" ${route === key ? 'aria-current="page"' : ""} data-go="#/${key}">${esc(label)}${n ? `<span class="count">${n}</span>` : ""}${allowed ? "" : `<span class="lock" title="Sem acesso neste perfil">${icon("lock", { size: 14 })}</span>`}</button>`;
  }).join("");
  return `<header class="top on-blue"><div class="wrap" style="position:relative">
    <div class="top-row">
      <button type="button" class="brand" data-go="#/inicio" aria-label="CrossMarketPlace, ir para o início"><img src="/img/btg-logo-white.png" alt="BTG Pactual" width="81" height="32"><span class="sep"></span><strong>CrossMarketPlace</strong></button>
      <span class="grow"></span>
      <button type="button" class="icon-btn" aria-label="Buscar no catálogo" data-go="#/catalogo">${icon("search", { size: 24 })}</button>
      <button type="button" class="icon-btn" aria-label="Avisos, ${unread} não lidos" aria-expanded="${menu === "bell"}" data-action="openMenu" data-menu="bell">${icon("bell", { size: 24 })}${unread ? `<span class="dot-badge">${unread}</span>` : ""}</button>
      <button type="button" class="role-btn" aria-expanded="${menu === "profile"}" aria-haspopup="menu" data-action="openMenu" data-menu="profile"><span>Perfil:</span>${PROFILE_LABELS[s.profile]}${icon("chevron", { size: 16 })}</button>
      <span class="me-avatar" title="${esc(user.name)}">${esc(user.initials)}</span>
    </div>
    <nav class="tabs" aria-label="Áreas do CrossMarketPlace">${tabs}</nav>
    ${hero}
    ${menu === "profile" ? profileMenu(s) : ""}${menu === "bell" ? bellMenu(s) : ""}
  </div></header>`;
}
