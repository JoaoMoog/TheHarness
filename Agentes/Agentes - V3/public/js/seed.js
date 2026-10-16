// Starting state for the presentation: no services, credits or history. The presenter signs up as "Você"
// and runs every flow; Marina and Carlos are the other side (with connected BTG accounts, balance, limit and card).

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
  "novo.splitContact": "",
  "entrada.counter": "500,00",
  "entrega.description": "",
  "disputa.report": "",
  "disputa.files": [],
  "resposta.statement": "",
  "resposta.files": [],
  "review.comment": "",
  "review.stars": 5,
  "credito.amount": "15.000,00",
  "credito.count": 12,
  "credito.grace": 0,
  "credito.income": "12.500,00",
  "credito.dueDay": 10,
  "sub.value": "1.800,00",
  "sub.description": "",
  "appeal.text": "",
  "sinistro.reason": "",
};

export const makeStage = (name, valueCents, due, status, items, extra = {}) => ({
  name, valueCents, due, status, items, delivery: null, releasedAt: null, releaseMode: null, coverage: null, anticipation: null, reply: null, ...extra,
});

const SCOPES = ["Dados cadastrais", "Saldo e extrato da conta", "Débito para Pix", "Empréstimo na hora"];

/** Account of a person who just signed up: balance, limit and card, BTG account still to connect. */
export const freshAccount = () => ({
  btg: { status: "none", kind: "PF", label: "", since: "", scopes: [] },
  pj: null,
  openFinance: { status: "none", banks: [] },
  creditLimitCents: 2_000_000, anticipationLimitCents: 1_000_000, balanceCents: 1_500_000, incomeCents: 1_000_000, reputation: 4.5,
  preApprovedCents: 2_000_000, reservedCredit: null,
  card: { label: "Cartão BTG final 3390", limitCents: 1_500_000, usedCents: 0 },
});

function accounts() {
  return {
    marina: {
      btg: { status: "connected", kind: "PF", label: "Conta corrente PF · ag 0001 · cc 4.281.993-1", since: "02/08", scopes: SCOPES },
      pj: { status: "connected", label: "BTG Empresas · MEI 45.118.903/0001-12" },
      openFinance: { status: "none", banks: [] },
      creditLimitCents: 2_000_000, anticipationLimitCents: 800_000, balanceCents: 1_284_350, incomeCents: 1_250_000, reputation: 4.9, completedServices: 22, disputeRate: 0.02,
      preApprovedCents: 2_000_000, reservedCredit: null,
      card: { label: "Cartão BTG final 4821", limitCents: 1_500_000, usedCents: 0 },
    },
    carlos: {
      btg: { status: "connected", kind: "PJ", label: "BTG Empresas · CNPJ 12.345.678/0001-90", since: "14/06", scopes: SCOPES },
      pj: { status: "connected", label: "BTG Empresas · CNPJ 12.345.678/0001-90" },
      openFinance: { status: "none", banks: [] },
      creditLimitCents: 5_000_000, anticipationLimitCents: 3_000_000, balanceCents: 4_812_000, incomeCents: 6_800_000, reputation: 4.8, completedServices: 37, disputeRate: 0.03,
      preApprovedCents: 4_000_000, reservedCredit: null,
      card: { label: "Cartão BTG Empresas final 7730", limitCents: 3_000_000, usedCents: 0 },
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
    offerEvents: [],
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
    wa: { on: false, active: null, threads: {} },
    ui: { sheet: null, toast: null, busy: {}, drafts: {}, hideValues: false },
  };
}
