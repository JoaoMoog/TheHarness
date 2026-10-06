// Hash router: "#/catalogo", "#/solucao/leitor-contratos/versoes" -> { name, params }.
import { PROFILE_LABELS, canOpenRoute } from "./domain/permissions.js";
import { band, btn, emptyState, noAccessState } from "./ui/components.js";
import { renderHome } from "./screens/home.js";
import { renderCatalog } from "./screens/catalog.js";
import { renderSolution } from "./screens/solution.js";
import { renderPublish } from "./screens/publish.js";
import { renderApprovals } from "./screens/approvals.js";
import { renderAccess } from "./screens/access.js";
import { renderMe } from "./screens/me.js";
import { renderTeam } from "./screens/team.js";
import { renderAdmin } from "./screens/admin.js";

export const DEFAULT_ROUTE = "inicio";
const AREA = { aprovacoes: "Aprovações", admin: "Administração", publicar: "Publicar solução" };
export const LOADABLE = new Set(["catalogo", "aprovacoes", "acessos", "meu-time", "admin"]);

const SCREENS = {
  inicio: (s, p, ui) => renderHome(s, ui),
  catalogo: (s, p, ui) => renderCatalog(s, ui),
  solucao: (s, p) => renderSolution(s, p),
  publicar: (s) => renderPublish(s),
  aprovacoes: renderApprovals,
  acessos: renderAccess,
  "minha-area": (s, p) => renderMe(s, p),
  "meu-time": renderTeam,
  admin: renderAdmin,
};

export function parseHash(hash) {
  const parts = String(hash || "").replace(/^#\/?/, "").split("/").filter(Boolean).map((p) => { try { return decodeURIComponent(p); } catch { return p; } });
  const [name = DEFAULT_ROUTE, ...params] = parts;
  return { name, params };
}

export function resolveView(s, route, ui) {
  const screen = SCREENS[route.name];
  if (!screen) return { band: band({ crumb: [["Início", "#/inicio"], ["Página não encontrada", ""]], title: "Página não encontrada" }), body: `<div class="panel">${emptyState("Este endereço não existe", "Confira o link ou volte para o início.", btn("Ir para o início", { go: "#/inicio" }))}</div>` };
  if (!canOpenRoute(s.profile, route.name)) {
    const area = AREA[route.name] ?? "esta área";
    return { band: band({ crumb: [["Início", "#/inicio"], [area, ""]], title: area }), body: noAccessState(area, PROFILE_LABELS[s.profile]) };
  }
  if (route.name === "publicar" && !s.draft) return { band: band({ crumb: [["Início", "#/inicio"], ["Publicar solução", ""]], title: "Publicar solução" }), body: `<div class="panel">${emptyState("Não foi possível abrir o formulário", "Verifique se você é o responsável pela solução ou comece uma nova publicação.", btn("Nova publicação", { action: "newDraft" }))}</div>` };
  return screen(s, route.params, ui);
}
