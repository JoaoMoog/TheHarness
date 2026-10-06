// Initial demo state. Everything is synthetic.
import { CURRENT_USER_ID } from "./people.js";
import { buildSolutions } from "./solutions.js";

const req = (id, solutionId, requesterId, justification, createdAt, status = "pendente", decidedBy = null, decisionNote = "") =>
  ({ id, solutionId, requesterId, justification, status, createdAt, decidedAt: status === "pendente" ? null : createdAt, decidedBy, decisionNote });

export const DEFAULT_FILTERS = { q: "", categories: [], teams: [], lifecycles: [], access: [], minRating: 0, sort: "relevancia", page: 1 };

export function buildInitialState() {
  return {
    version: 1,
    userId: CURRENT_USER_ID,
    profile: "publicador",
    solutions: buildSolutions(),
    requests: [
      req("r1", "score-liquidez", "u-ms", "Usar no modelo de limite PJ para recalcular a exposição diária das carteiras.", "2026-10-06"),
      req("r2", "var-engine", "u-pl", "Integrar ao painel de risco da mesa de juros para o fechamento.", "2026-10-05"),
      req("r3", "score-liquidez", "u-la", "Teste em carteiras de clientes private antes do comitê de novembro.", "2026-10-02", "aprovada", "u-jb"),
      req("r4", "var-engine", "u-br", "Quero conhecer a ferramenta.", "2026-09-30", "rejeitada", "u-jb", "Justificativa sem caso de uso."),
      req("r5", "copiloto-credito", "u-jb", "Avaliar o copiloto nas análises de crédito dos clientes da mesa.", "2026-10-05"),
      req("r6", "painel-inadimplencia", "u-jb", "Cruzar inadimplência com o risco de liquidez das carteiras.", "2026-10-01", "aprovada", "u-jp"),
      req("r7", "motor-precificacao", "u-jb", "Comparar a precificação com o nosso modelo interno.", "2026-09-29", "rejeitada", "u-rn", "Use a versão pública da API de taxas."),
    ],
    favorites: ["conciliacao-d0", "copiloto-credito", "painel-inadimplencia", "leitor-contratos", "monitor-vencimentos", "extrator-garantias"],
    notifications: [
      { id: "n1", text: "Stress Test Bot está em análise", detail: "Aprovações", at: "2026-10-06", read: false, kind: "info", go: "#/minha-area" },
      { id: "n2", text: "Leitor de Contratos publicou a versão 2.3.0", detail: "Um favorito seu", at: "2026-10-04", read: false, kind: "info", go: "#/solucao/leitor-contratos/versoes" },
      { id: "n3", text: "Painel de Liquidez v2: correção solicitada", detail: "Ana Lima, aprovadora", at: "2026-10-05", read: false, kind: "warn", go: "#/meu-time" },
      { id: "n4", text: "Acesso ao Painel de Inadimplência aprovado", detail: "Júlia Prado", at: "2026-10-01", read: true, kind: "ok", go: "#/acessos/enviadas" },
      { id: "n5", text: "Pedido ao Motor de Precificação PJ recusado", detail: "Rafael Nunes", at: "2026-09-29", read: true, kind: "danger", go: "#/acessos/enviadas" },
    ],
    filters: { ...DEFAULT_FILTERS },
    draft: null,
    sim: { slow: false, fail: false },
    seq: 100,
  };
}
