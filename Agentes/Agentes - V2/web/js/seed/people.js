// Synthetic people and teams. No real data.
export const CURRENT_USER_ID = "u-jb";

export const TEAMS = [
  {
    id: "risco",
    name: "Risco Quant",
    area: "Diretoria de Riscos · Risco de Mercado",
  },
  { id: "juridico", name: "Jurídico Digital", area: "Jurídico" },
  { id: "credito", name: "Crédito Digital", area: "Crédito PJ" },
  { id: "ops", name: "Ops Tech", area: "Operações" },
  { id: "bi", name: "BI Varejo", area: "Varejo" },
  { id: "cambio", name: "Câmbio Tech", area: "Câmbio" },
  { id: "sustentabilidade", name: "Sustentabilidade", area: "ESG" },
  { id: "tesouraria", name: "Tesouraria", area: "Tesouraria" },
  { id: "fraudes", name: "Prevenção a Fraudes", area: "Segurança" },
  { id: "wealth", name: "Wealth Management", area: "Private" },
  { id: "marketing", name: "Marketing", area: "Marketing" },
  { id: "governanca", name: "Governança de TI", area: "Tecnologia" },
];

const U = (id, name, teamId, job) => ({
  id,
  name,
  teamId,
  job,
  initials: name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase(),
});
export const USERS = [
  U("u-jb", "João", "risco", "Engenheiro de dados"),
  U("u-ct", "Camila Torres", "risco", "Quant sênior"),
  U("u-rd", "Rafael Dias", "risco", "Analista de risco"),
  U("u-bs", "Bruno Sá", "risco", "Engenheiro de ML"),
  U("u-lf", "Larissa Freitas", "risco", "Quant"),
  U("u-mg", "Marcos Gil", "risco", "Desenvolvedor"),
  U("u-pv", "Paula Vidal", "risco", "Head de Risco Quant"),
  U("u-ar", "Ana Ribeiro", "juridico", "Gerente de produto"),
  U("u-cm", "Carlos Mendes", "juridico", "Engenheiro de software"),
  U("u-ms", "Maria Souza", "credito", "Cientista de dados"),
  U("u-rn", "Rafael Nunes", "credito", "Tech lead"),
  U("u-fr", "Felipe Ramos", "ops", "Coordenador de automação"),
  U("u-jp", "Júlia Prado", "bi", "Analista de BI"),
  U("u-gs", "Gabriel Santos", "cambio", "Engenheiro de dados"),
  U("u-hm", "Helena Matos", "sustentabilidade", "Especialista ESG"),
  U("u-pl", "Pedro Lima", "tesouraria", "Analista de tesouraria"),
  U("u-vs", "Vinícius Souza", "fraudes", "Cientista de dados"),
  U("u-la", "Lucas Alves", "wealth", "Analista de investimentos"),
  U("u-br", "Bianca Rocha", "marketing", "Analista de marketing"),
  U("u-al", "Ana Lima", "governanca", "Aprovadora do catálogo"),
  U("u-mc", "Marina Costa", "governanca", "Compradora"),
];

export const userById = (id) =>
  USERS.find((u) => u.id === id) ?? {
    id,
    name: "Pessoa",
    initials: "?",
    teamId: "",
    job: "",
  };
export const teamById = (id) =>
  TEAMS.find((t) => t.id === id) ?? { id, name: "Equipe", area: "" };
