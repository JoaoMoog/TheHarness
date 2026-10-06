// Starting state for the presentation: no services, credits or history. The presenter signs up as "Você"
// and runs every flow; Marina and Carlos are the other side (with connected Nexo accounts, balance, limit and card).

export const PEOPLE = {
  marina: {
    id: "marina", first: "Marina", name: "Marina Costa", initials: "MC", defaultMode: "contratante", rating: "4,9",
    clientName: "Marina Costa", providerName: "Marina Costa Interiores",
    clientDoc: "CPF ***.481.***-20", providerDoc: "MEI 45.118.903/0001-12", activity: "Projeto de interiores",
    phone: "(11) 98888-1001", email: "marina.costa@exemplo.com",
  },
  carlos: {
    id: "carlos", first: "Carlos", name: "Carlos Mendes", initials: "CM", defaultMode: "prestador", rating: "4,8",
    clientName: "Horizonte Reformas", providerName: "Horizonte Reformas",
    clientDoc: "CNPJ 12.345.678/0001-90", providerDoc: "CNPJ 12.345.678/0001-90", activity: "Reformas residenciais",
    phone: "(11) 98888-2002", email: "carlos@horizontereformas.com.br",
  },
};

/** Id the presenter's own signed-up person gets. */
export const SELF = "voce";

export const DEFAULTS = {
  "novo.title": "Reforma da cozinha",
  "novo.provider": "Horizonte Reformas",
  "novo.description": "Reforma da cozinha: retirada da bancada antiga, nova instalação elétrica, troca do piso e montagem dos armários.",
  "novo.total": "8.000,00",
  "novo.splitContact": "",
  "convite.entrada": "1.000,00",
  "entrada.counter": "500,00",
  "entrega.description": "Etapa concluída conforme o combinado, com fotos do antes e depois.",
  "disputa.report": "",
  "disputa.evidence": "",
  "resposta.statement": "",
  "resposta.evidence": "",
  "review.comment": "",
  "review.stars": 5,
  "credito.amount": "15.000,00",
  "credito.count": 12,
  "credito.grace": 0,
  "credito.income": "12.500,00",
  "credito.dueDay": 10,
  "orc.title": "Pintura da fachada",
  "orc.description": "Pintura da fachada: lavagem e preparo, aplicação de selador e duas demãos de tinta acrílica.",
  "orc.total": "6.000,00",
  "link.title": "Instalação de ar-condicionado",
  "link.total": "3.200,00",
  "link.phone": "(11) 98765-4321",
  "pos.title": "Troca do piso da sala",
  "pos.total": "4.800,00",
  "pos.phone": "(11) 97777-1234",
  "lk.name": "",
  "sub.value": "1.800,00",
  "sub.description": "",
  "appeal.text": "",
  "sinistro.reason": "",
};

export const makeStage = (name, valueCents, due, status, items, extra = {}) => ({
  name, valueCents, due, status, items, delivery: null, releasedAt: null, releaseMode: null, coverage: null, anticipation: null, reply: null, ...extra,
});

const SCOPES = ["Dados cadastrais", "Saldo e extrato da conta", "Débito para Pix", "Limite pré-aprovado"];

/** Account of a person who just signed up: balance, limit and card, Nexo account still to connect. */
export const freshAccount = () => ({
  nexo: { status: "none", kind: "PF", label: "", since: "", scopes: [] },
  pj: null,
  openFinance: { status: "none", banks: [] },
  creditLimitCents: 2_000_000, anticipationLimitCents: 1_000_000, balanceCents: 1_500_000, incomeCents: 1_000_000, reputation: 4.5,
  preApprovedCents: 2_000_000, reservedCredit: null,
  card: { label: "Cartão Nexo final 3390", limitCents: 1_500_000, usedCents: 0 },
});

function accounts() {
  return {
    marina: {
      nexo: { status: "connected", kind: "PF", label: "Conta corrente PF · ag 0001 · cc 4.281.993-1", since: "02/08", scopes: SCOPES },
      pj: { status: "connected", label: "Nexo Empresas · MEI 45.118.903/0001-12" },
      openFinance: { status: "none", banks: [] },
      creditLimitCents: 2_000_000, anticipationLimitCents: 800_000, balanceCents: 1_284_350, incomeCents: 1_250_000, reputation: 4.9,
      preApprovedCents: 2_000_000, reservedCredit: null,
      card: { label: "Cartão Nexo final 4821", limitCents: 1_500_000, usedCents: 0 },
    },
    carlos: {
      nexo: { status: "connected", kind: "PJ", label: "Nexo Empresas · CNPJ 12.345.678/0001-90", since: "14/06", scopes: SCOPES },
      pj: { status: "connected", label: "Nexo Empresas · CNPJ 12.345.678/0001-90" },
      openFinance: { status: "none", banks: [] },
      creditLimitCents: 5_000_000, anticipationLimitCents: 3_000_000, balanceCents: 4_812_000, incomeCents: 6_800_000, reputation: 4.8,
      preApprovedCents: 4_000_000, reservedCredit: null,
      card: { label: "Cartão Nexo Empresas final 7730", limitCents: 3_000_000, usedCents: 0 },
    },
  };
}

export function seed() {
  return {
    session: { person: SELF, mode: "contratante", loggedIn: false },
    people: {},
    clock: { offsetDays: 0, log: [] },
    newAccount: null,
    accounts: accounts(),
    contracts: [],
    installments: [],
    credits: [],
    creditRequests: [],
    claims: [],
    links: [],
    messages: {},
    chatReadings: {},
    bankSettings: { negativationDays: 30 },
    audit: [],
    funding: { issued: false },
    apiEvents: [],
    blacklist: [{ kind: "Documento", value: "CPF ***.774.***-10", reason: "Fraude confirmada em 08/2026" }, { kind: "Aparelho", value: "Android · id 7f3a…c21", reason: "Contas múltiplas da mesma pessoa" }],
    invoices: [],
    invites: [],
    disputes: [],
    reviews: [],
    ledger: [],
    notifications: [],
    bankNotes: {},
    ui: { sheet: null, toast: null, busy: {}, drafts: {}, hideValues: false },
  };
}
