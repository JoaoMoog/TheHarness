// Product vocabulary shared by domain rules and screens.
export const CATEGORIES = [
  { id: "agentes", label: "Agentes de IA", type: "Agente de IA", icon: "sparkle" },
  { id: "apis", label: "APIs e serviços", type: "API", icon: "code" },
  { id: "modelos", label: "Modelos de ML", type: "Modelo de ML", icon: "network" },
  { id: "automacoes", label: "Automações", type: "Automação", icon: "cog" },
  { id: "dashboards", label: "Dashboards", type: "Dashboard", icon: "layout" },
  { id: "bibliotecas", label: "Bibliotecas", type: "Biblioteca", icon: "book" },
];
export const CATEGORY_IDS = CATEGORIES.map((c) => c.id);
export const categoryOf = (id) => CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[0];

export const LIFECYCLES = { experimental: "Experimental", piloto: "Piloto", producao: "Produção", descontinuada: "Descontinuada" };
export const APPROVALS = { rascunho: "Rascunho", em_analise: "Em análise", correcao: "Em correção", aprovada: "Aprovada", rejeitada: "Rejeitada" };
export const ACCESS = { direto: "Acesso direto", autorizacao: "Exige autorização" };
export const REQUEST_STATUS = { pendente: "Pendente", aprovada: "Aprovada", rejeitada: "Rejeitada" };
