// Synthetic demo data. Two people, each one both hires and provides services.
import { LISTINGS, MARKET_PROVIDERS, MARKET_REVIEWS, PLACES, marketRequests } from "./seed-market.js";

export const CLIENT = "Marina Costa";
export const PROVIDER = "Horizonte Reformas";
export const LATE_FEE_CENTS = 646;

export const PEOPLE = {
  marina: {
    id: "marina", first: "Marina", name: "Marina Costa", initials: "MC", defaultMode: "contratante",
    clientName: "Marina Costa", providerName: "Marina Costa Interiores",
    clientDoc: "CPF ***.481.***-20", providerDoc: "MEI 45.118.903/0001-12", activity: "Designer de interiores",
    providerId: "marina-interiores", home: { neighborhood: "Vila Madalena", ...PLACES["Vila Madalena"] },
  },
  carlos: {
    id: "carlos", first: "Carlos", name: "Carlos Mendes", initials: "CM", defaultMode: "prestador",
    clientName: "Horizonte Reformas", providerName: "Horizonte Reformas",
    clientDoc: "CNPJ 12.345.678/0001-90", providerDoc: "CNPJ 12.345.678/0001-90", activity: "Reformas residenciais",
    providerId: "horizonte", home: { neighborhood: "Mooca", ...PLACES.Mooca },
  },
};

/** Providers already in the demo contracts, in the short format the hiring flow uses. */
export const PROVIDERS = MARKET_PROVIDERS.filter((p) => p.core).map(({ name, doc, rating, activity }) => ({
  name, doc, rating: rating.toFixed(1).replace(".", ","), activity,
}));

export const DEFAULTS = {
  "signup.name": "Paulo Reis",
  "signup.documentName": "Paulo Reis",
  "signup.services": "Instalações elétricas residenciais, troca de quadros e tomadas.",
  "novo.title": "Reforma da cozinha",
  "novo.provider": "Horizonte Reformas",
  "novo.description": "Reforma da cozinha: retirada da bancada antiga, nova instalação elétrica, troca do piso e montagem dos armários.",
  "novo.total": "8.000,00",
  "convite.entrada": "1.000,00",
  "entrada.counter": "500,00",
  "entrega.description": "Revestimento das paredes aplicado, piso assentado e rejuntado, louças e metais instalados e testados.",
  "disputa.report": "O chuveiro elétrico não liga e o quadro foi instalado diferente do combinado. O prestador não responde há 4 dias.",
  "disputa.evidence": "2 fotos do quadro elétrico, vídeo do chuveiro sem ligar",
  "resposta.statement": "Instalei o quadro conforme o projeto aprovado e testei o chuveiro na entrega.",
  "resposta.evidence": "Foto da parede fechada",
  "review.comment": "Obra limpa e no prazo. Teve um problema no quadro elétrico, resolvido na mediação.",
  "review.stars": 4,
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
  "lk.name": "Lúcia Andrade",
  "sub.value": "1.800,00",
  "sub.description": "Revestimento cerâmico das paredes do banheiro.",
  "appeal.text": "Uso o nome de casada. Envio a certidão de casamento e o documento novo.",
  "sinistro.reason": "A etapa de instalações precisou ser refeita por outro eletricista depois da disputa.",
};

export const makeStage = (name, valueCents, due, status, items, extra = {}) => ({
  name, valueCents, due, status, items, delivery: null, releasedAt: null, releaseMode: null, coverage: null, anticipation: null, reply: null, ...extra,
});
const stage = makeStage;

const MARINA_INSTALLMENT = 215_302;

function contracts() {
  return [
    {
      id: "AV-2026-001", title: "Reforma do banheiro", client: CLIENT, provider: PROVIDER, kind: "individual",
      description: "Reforma completa do banheiro: demolição, troca de instalações hidráulicas e elétricas, revestimento e louças.",
      address: "Rua das Acácias, 120 · São Paulo",
      totalCents: 1_200_000, status: "active", signedAt: "15/09", arbitration: true, paidInCents: 1_200_000, refundedCents: 0,
      payment: { method: "credit", count: 6, valueCents: MARINA_INSTALLMENT, cet: "29,05% a.a.", creditId: "CCB-2026-001" }, entrada: null,
      insurance: { policy: "SG-2026-0193", premiumCents: 30_000, coverageCents: 1_200_000, paid: true },
      arbitrationFeeCents: 4_800,
      stages: [
        stage("Demolição e preparo", 360_000, "25/09", "released", ["Demolição do revestimento antigo", "Retirada do entulho"], {
          releasedAt: "28/09", releaseMode: "Aprovação manual",
          delivery: { description: "Revestimento antigo removido e entulho retirado.", sentAt: "26/09", deadline: "03/10",
            attachments: [{ kind: "photo", caption: "Banheiro sem revestimento" }, { kind: "photo", caption: "Caçamba retirada" }] },
        }),
        stage("Instalações", 480_000, "10/10", "awaitingApproval", ["Tubulação hidráulica trocada", "Quadro elétrico novo", "Pontos de tomada e luz", "Teste de pressão registrado"], {
          delivery: {
            description: "Tubulação hidráulica trocada, quadro elétrico novo instalado e pontos de tomada e luz prontos. Teste de pressão feito e gravado.",
            sentAt: "02/10", deadline: "09/10",
            attachments: [
              { kind: "photo", caption: "Tubulação nova antes de fechar a parede" }, { kind: "photo", caption: "Quadro elétrico novo" },
              { kind: "photo", caption: "Pontos de tomada e luz" }, { kind: "video", caption: "Teste de pressão com manômetro" },
              { kind: "document", caption: "Nota fiscal do material elétrico" }, { kind: "location", caption: "Rua das Acácias, 120" },
            ],
          },
        }),
        stage("Acabamento", 360_000, "30/10", "pending", ["Revestimento de parede aplicado", "Piso assentado e rejuntado", "Louças e metais instalados", "Nota fiscal dos materiais"]),
      ],
    },
    {
      id: "AV-2026-014", title: "Pintura do condomínio", client: "Condomínio Jardins", provider: PROVIDER, kind: "collective",
      description: "Pintura das áreas comuns: preparo e massa corrida, pintura das paredes e acabamento.", address: "Rua dos Ipês, 45 · São Paulo",
      totalCents: 1_800_000, status: "funding", signedAt: "20/09", arbitration: true, paidInCents: 900_000, refundedCents: 0, payment: null, entrada: null,
      insurance: null, arbitrationFeeCents: 7_200,
      participants: [
        { name: CLIENT, unit: "apto 21", shareCents: 450_000, paid: false, origin: null, me: true },
        { name: "João Souza", unit: "apto 32", shareCents: 450_000, paid: true, origin: "Cartão Elo · maquininha" },
        { name: "Ana Lima", unit: "apto 41", shareCents: 450_000, paid: true, origin: "Pix" },
        { name: "Rafael Prado", unit: "apto 52", shareCents: 450_000, paid: false, origin: null },
      ],
      stages: [
        stage("Preparo e massa", 900_000, "25/10", "pending", ["Paredes lixadas", "Massa corrida aplicada"]),
        stage("Pintura e acabamento", 900_000, "15/11", "pending", ["Duas demãos de tinta", "Rodapés e portas protegidos"]),
      ],
    },
    {
      id: "AV-2026-031", title: "Marcenaria do quarto", client: CLIENT, provider: "Oficina Lume", kind: "individual",
      description: "Guarda-roupa planejado e cabeceira.", totalCents: 975_000, status: "completed", signedAt: "02/08", arbitration: true,
      paidInCents: 975_000, refundedCents: 0, payment: { method: "pix" }, entrada: null, reviewed: false, insurance: null, arbitrationFeeCents: 3_900,
      stages: [
        stage("Guarda-roupa", 650_000, "20/08", "released", ["Guarda-roupa montado"], { releasedAt: "21/08", releaseMode: "Aprovação manual" }),
        stage("Cabeceira", 325_000, "05/09", "released", ["Cabeceira instalada"], { releasedAt: "06/09", releaseMode: "Confirmação tácita" }),
      ],
    },
    {
      id: "AV-2026-050", title: "Manutenção da piscina", client: CLIENT, provider: "Verde Água Piscinas", kind: "recurring",
      description: "Limpeza, tratamento da água e revisão do filtro, uma visita por mês.", address: "Rua das Acácias, 120 · São Paulo",
      totalCents: 90_000, monthlyCents: 45_000, status: "active", signedAt: "10/08", arbitration: true, paidInCents: 45_000, refundedCents: 0,
      payment: { method: "pixAuto" }, entrada: null, insurance: null, arbitrationFeeCents: 180,
      stages: [
        stage("Visita de setembro", 45_000, "10/09", "released", ["Limpeza e tratamento da água"], { releasedAt: "13/09", releaseMode: "Confirmação tácita" }),
        stage("Visita de outubro", 45_000, "10/10", "pending", ["Limpeza e tratamento da água"]),
      ],
    },
    {
      id: "AV-2026-040", title: "Projeto de interiores da clínica", client: "Clínica Sorriso", provider: "Marina Costa Interiores", kind: "individual",
      description: "Projeto de interiores da recepção e de 3 consultórios: medição, projeto 3D, memorial e acompanhamento da obra.",
      address: "Av. Paulista, 900 · São Paulo",
      totalCents: 960_000, status: "active", signedAt: "10/09", arbitration: true, paidInCents: 960_000, refundedCents: 0,
      payment: { method: "pix" }, entrada: null, insurance: null, arbitrationFeeCents: 3_840,
      stages: [
        stage("Medição e briefing", 240_000, "20/09", "released", ["Medição dos ambientes", "Briefing aprovado"], { releasedAt: "21/09", releaseMode: "Aprovação manual" }),
        stage("Projeto 3D e memorial", 480_000, "08/10", "inProgress", ["Planta humanizada", "Imagens 3D dos ambientes", "Memorial descritivo"]),
        stage("Acompanhamento da obra", 240_000, "30/11", "pending", ["4 visitas técnicas", "Relatório final"]),
      ],
    },
    {
      id: "AV-2026-044", title: "Elétrica do banheiro (subcontrato)", client: PROVIDER, provider: "Paulo Reis Elétrica", kind: "individual",
      description: "Quadro elétrico novo e pontos de tomada e luz do banheiro da Rua das Acácias, 120.", address: "Rua das Acácias, 120 · São Paulo",
      totalCents: 240_000, status: "active", signedAt: "16/09", arbitration: true, paidInCents: 240_000, refundedCents: 0,
      payment: { method: "pix" }, entrada: null, insurance: null, arbitrationFeeCents: 960,
      parent: { contractId: "AV-2026-001", stage: 1 },
      stages: [
        stage("Quadro e pontos elétricos", 240_000, "08/10", "awaitingApproval", ["Quadro elétrico novo", "Pontos de tomada e luz"], {
          linkedTo: { contractId: "AV-2026-001", stage: 1 },
          delivery: { description: "Quadro novo instalado e pontos de tomada e luz prontos e testados.", sentAt: "01/10", deadline: "08/10",
            attachments: [{ kind: "photo", caption: "Quadro elétrico novo" }, { kind: "photo", caption: "Pontos de tomada e luz" }] },
        }),
      ],
    },
  ];
}

function accounts() {
  const scopes = ["Dados cadastrais", "Saldo e extrato da conta", "Débito para Pix", "Limite pré-aprovado"];
  return {
    marina: {
      nexo: { status: "connected", kind: "PF", label: "Conta corrente PF · ag 0001 · cc 4.281.993-1", since: "02/08", scopes },
      pj: { status: "connected", label: "Nexo Empresas · MEI 45.118.903/0001-12" },
      openFinance: { status: "none", banks: [] },
      creditLimitCents: 2_000_000, anticipationLimitCents: 800_000, balanceCents: 1_284_350, incomeCents: 1_250_000, reputation: 4.9,
      preApprovedCents: 2_000_000, reservedCredit: null,
    },
    carlos: {
      nexo: { status: "connected", kind: "PJ", label: "Nexo Empresas · CNPJ 12.345.678/0001-90", since: "14/06", scopes },
      pj: { status: "connected", label: "Nexo Empresas · CNPJ 12.345.678/0001-90" },
      openFinance: { status: "none", banks: [] },
      creditLimitCents: 5_000_000, anticipationLimitCents: 3_000_000, balanceCents: 4_812_000, incomeCents: 6_800_000, reputation: 4.8,
      preApprovedCents: 4_000_000, reservedCredit: null,
    },
  };
}

function installments() {
  const due = ["01/09", "01/10", "01/11", "01/12", "01/01", "01/02"];
  return due.map((d, i) => ({
    id: `P${i + 1}`, owner: "marina", creditId: "CCB-2026-001", contractId: "AV-2026-001", n: i + 1, of: 6, valueCents: MARINA_INSTALLMENT, due: d,
    status: i === 0 ? "paid" : i === 1 ? "late" : "open", ...(i === 1 ? { lateFeeCents: LATE_FEE_CENTS } : {}),
  }));
}

export function seed() {
  return {
    session: { person: "marina", mode: "contratante", loggedIn: true },
    settings: { aiEnabled: true },
    clock: { offsetDays: 0, log: [] },
    newAccount: null,
    accounts: accounts(),
    contracts: contracts(),
    installments: installments(),
    credits: [
      { id: "CCB-2026-001", owner: "marina", contractId: "AV-2026-001", principalCents: 1_200_000, count: 6, installmentCents: MARINA_INSTALLMENT,
        monthlyRate: 0.0215, cet: "29,05% a.a.", signedAt: "15/09", purpose: "Reforma do banheiro", status: "active" },
    ],
    creditRequests: [],
    claims: [],
    links: [],
    messages: {
      "AV-2026-001": [
        { from: "provider", text: "Bom dia, Marina. Amanhã às 8h começo as instalações. O porteiro já está avisado?", at: "29/09" },
        { from: "client", text: "Está sim. Deixei a chave com ele.", at: "29/09" },
        { from: "provider", text: "Instalações prontas e teste de pressão gravado. Mandei tudo na entrega.", at: "02/10" },
      ],
    },
    chatReadings: {},
    bankSettings: { negativationDays: 30 },
    audit: [
      { at: "28/09", actor: "Marina Costa", action: "Liberação de etapa", detail: "AV-2026-001 etapa 1 · aprovação manual", ref: "AV-2026-001" },
      { at: "21/09", actor: "Regra: confirmação tácita", action: "Liberação de etapa", detail: "AV-2026-031 etapa 2 · prazo sem resposta", ref: "AV-2026-031" },
    ],
    funding: { issued: false },
    apiEvents: [
      { at: "04/10", source: "Aval", event: "stage.delivered", ref: "AV-2026-001" },
      { at: "03/10", source: "ELO Marketplace", event: "task.matched", ref: "ELO-88213" },
      { at: "28/09", source: "Aval", event: "stage.released", ref: "AV-2026-001" },
    ],
    blacklist: [{ kind: "Documento", value: "CPF ***.774.***-10", reason: "Fraude confirmada em 08/2026" }, { kind: "Aparelho", value: "Android · id 7f3a…c21", reason: "Contas múltiplas da mesma pessoa" }],
    invoices: [
      { id: "NFS-2026-001", contractId: "AV-2026-001", stage: 0, provider: PROVIDER, client: CLIENT, amountCents: 360_000, issuedAt: "28/09" },
      { id: "NFS-2026-002", contractId: "AV-2026-040", stage: 0, provider: "Marina Costa Interiores", client: "Clínica Sorriso", amountCents: 240_000, issuedAt: "21/09" },
    ],
    invites: [],
    marketProviders: structuredClone(MARKET_PROVIDERS),
    listings: structuredClone(LISTINGS),
    requests: marketRequests(),
    marketReviews: structuredClone(MARKET_REVIEWS),
    favorites: { marina: [], carlos: [] },
    negotiations: {},
    boosts: [],
    market: { takeRevenueCents: 0, boostRevenueCents: 0, profileViews: { horizonte: 412, "marina-interiores": 268 } },
    disputes: [],
    reviews: [],
    ledger: [
      { date: "28/09", contractId: "AV-2026-001", label: "Liberação etapa 1 para Horizonte Reformas", amountCents: -360_000, status: "Conciliado" },
      { date: "22/09", contractId: "AV-2026-014", label: "Entrada Elo · João Souza", amountCents: 450_000, status: "Divergente", note: "Liquidado R$ 4.387,50: taxa MDR descontada" },
      { date: "21/09", contractId: "AV-2026-014", label: "Entrada Pix · Ana Lima", amountCents: 450_000, status: "Conciliado" },
      { date: "21/09", contractId: "AV-2026-040", label: "Liberação etapa 1 para Marina Costa Interiores", amountCents: -240_000, status: "Conciliado" },
      { date: "16/09", contractId: "AV-2026-044", label: "Pix · Horizonte Reformas", amountCents: 240_000, status: "Conciliado" },
      { date: "15/09", contractId: "AV-2026-001", label: "Crédito Aval 6x · Marina Costa", amountCents: 1_200_000, status: "Conciliado" },
      { date: "10/09", contractId: "AV-2026-040", label: "Pix · Clínica Sorriso", amountCents: 960_000, status: "Conciliado" },
    ],
    notifications: [
      { id: "N1", to: CLIENT, mode: "contratante", icon: "upload-simple", text: "Entrega da etapa 2 recebida", detail: "Aprove até 09/10 · Horizonte", go: "#/servico/AV-2026-001", read: false },
      { id: "N2", to: CLIENT, mode: "contratante", icon: "warning-circle", text: "Parcela 2 atrasada", detail: "R$ 2.159,48 · pague com Pix", go: "#/financeiro", read: false },
      { id: "N5", to: "Marina Costa Interiores", mode: "prestador", icon: "clock", text: "Etapa 2 vence em 08/10", detail: "Projeto da clínica · envie a entrega", go: "#/servico/AV-2026-040", read: false },
      { id: "N3", to: PROVIDER, mode: "prestador", icon: "users-three", text: "Rafael ainda não pagou", detail: "Pintura do condomínio · 3 de 4 pagas", go: "#/coletivo/AV-2026-014", read: false },
      { id: "N6", to: PROVIDER, mode: "contratante", icon: "upload-simple", text: "Paulo enviou a entrega", detail: "Subcontrato da elétrica · aprove até 08/10", go: "#/servico/AV-2026-044", read: false },
      { id: "N4", to: CLIENT, mode: "contratante", icon: "shield-check", text: "Novo acesso à conta", detail: "iPhone · São Paulo · 01/10", go: "#/perfil", read: true },
    ],
    chat: [],
    judgmentLog: [],
    serverQueue: [],
    policy: null,
    bankNotes: {},
    ui: { sheet: null, toast: null, busy: {}, drafts: {}, hideValues: false },
  };
}
