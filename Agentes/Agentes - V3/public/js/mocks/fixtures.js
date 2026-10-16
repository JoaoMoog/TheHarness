import { seed, SELF, PEOPLE, freshAccount, makeStage } from "../seed.js";

export const MOCK_VERSION = 1;
export const IDS = { contract: "AV-2026-001", invite: "PG-001", dispute: "DP-001", credit: "CCB-001", request: "CR-001", claim: "SI-001", split: "DV-002" };
// Each row names the existing screen, its exact route and the state to reproduce.
const rows = [
  ["Conta", "Boas-vindas", "entrada", "signedOut"],
  ["Conta", "Cadastro local", "cadastro", "signup"],
  ["Conta", "Cadastro — acesso alternativo", "cadastro/dados", "signup"],
  ["Conta", "Entrar com código local", "biometria", "login"],
  ["Conta", "Perfil", "perfil"],
  ["Conta", "Conta em análise (legado)", "conta-analise", "accountAnalysis"],
  ["Conta", "Contestar bloqueio (legado)", "contestar", "accountRefused"],
  ["Conta", "Avisos", "avisos"],
  ["Conta", "Avisos — vazio", "avisos", "empty"],
  ["Início", "Início — quem paga", "inicio"],
  ["Início", "Início — quem recebe", "inicio", "provider"],
  ["Início", "Início — sem pagamentos", "inicio", "empty"],
  ["Início", "Buscar pagamentos", "buscar"],
  ["Início", "Menu", "menu"],
  ["Cobrar", "Quem vai pagar — telefone", "cobrar/destinatario", "chargePhone"],
  ["Cobrar", "Quem vai pagar — CPF/CNPJ", "cobrar/destinatario", "chargeDocument"],
  ["Cobrar", "Quem vai pagar — e-mail", "cobrar/destinatario", "chargeEmail"],
  ["Cobrar", "Destinatário inválido", "cobrar/destinatario", "chargeError"],
  ["Cobrar", "Dados da cobrança", "combinado/1", "chargeDetails"],
  ["Cobrar", "Revisar e compartilhar", "combinado/3", "chargeReview"],
  ["Cobrar", "Cobrança enviada", "combinado/enviado/PG-001", "chargeSent"],
  ["Cobrar", "Cobrança cancelada", "p/PG-001", "inviteCancelled"],
  ["Cobrar", "Marcos disponíveis para cobrar", "cobrar", "providerWork"],
  ["Pagar", "Dados do combinado", "combinado/1", "agreement"],
  ["Pagar", "Definir liberação por marcos", "combinado/2", "agreement"],
  ["Pagar", "Revisar e enviar combinado", "combinado/3", "agreement"],
  ["Pagar", "Combinado enviado", "combinado/enviado/PG-001", "inviteSent"],
  ["Pagar", "Conferir cobrança recebida", "p/PG-001"],
  ["Pagar", "Convite recusado", "p/PG-001", "inviteDeclined"],
  ["Pagar", "Link inexistente", "p/inexistente"],
  ["Pagar", "Ler QR simulado", "ler-qr"],
  ["Pagar", "Checkout — saldo", "pagar/AV-2026-001", "checkout"],
  ["Pagar", "Checkout — cartão", "pagar/AV-2026-001", "checkoutCard"],
  ["Pagar", "Checkout — crédito", "pagar/AV-2026-001", "checkoutCredit"],
  ["Pagar", "Checkout — sem saldo", "pagar/AV-2026-001", "checkoutNoBalance"],
  ["Pagar", "Pix aguardando confirmação", "pix", "pix"],
  ["Pagar", "Pagamento confirmado", "pago/AV-2026-001"],
  ["Pagar", "Pagamento não confirmado", "pago/AV-2026-001", "checkout"],
  ["Pagar", "Decidir entrada", "entrada-decidir/AV-2026-001", "downPayment"],
  ["Dividir", "Editar divisão", "dividir-pagamento/AV-2026-001", "checkout"],
  ["Dividir", "Grupo aguardando participantes", "coletivo/AV-2026-001", "collective"],
  ["Dividir", "Responder convite para dividir", "dividir/DV-002", "splitInvite"],
  ["Serviço", "Lista de pagamentos", "servicos"],
  ["Serviço", "Lista de pagamentos — vazia", "servicos", "empty"],
  ["Serviço", "Entrega aguardando aprovação", "servico/AV-2026-001"],
  ["Serviço", "Serviço em execução", "servico/AV-2026-001", "work"],
  ["Serviço", "Ajuste solicitado", "servico/AV-2026-001", "adjustment"],
  ["Serviço", "Serviço concluído", "servico/AV-2026-001", "completed"],
  ["Serviço", "Contrato", "contrato/AV-2026-001"],
  ["Serviço", "Comprovante de liberação", "comprovante/AV-2026-001/0", "released"],
  ["Serviço", "Pedir cancelamento", "servico/AV-2026-001", "cancellation"],
  ["Serviço", "Cancelamento pendente", "servico/AV-2026-001", "cancellationPending"],
  ["Serviço", "Devolução confirmada", "devolucao/AV-2026-001", "cancelled"],
  ["Serviço", "Conversa do contrato", "conversa/AV-2026-001"],
  ["Serviço", "Propor nova data", "nova-data/AV-2026-001/0", "work"],
  ["Serviço", "Avaliar serviço", "avaliar/AV-2026-001", "completed"],
  ["Receber", "Enviar entrega com evidências", "entrega/AV-2026-001/0", "delivery"],
  ["Receber", "Simular antecipação", "antecipar/AV-2026-001/0", "provider"],
  ["Receber", "Antecipação confirmada", "antecipado/AV-2026-001/0", "anticipated"],
  ["Receber", "Agenda de recebíveis", "agenda", "provider"],
  ["Receber", "Notas fiscais simuladas", "notas", "provider"],
  ["Receber", "Subcontratar marco", "subcontratar/AV-2026-001/0", "providerWork"],
  ["Disputa", "Lista de disputas", "disputas", "dispute"],
  ["Disputa", "Nenhuma disputa", "disputas", "empty"],
  ["Disputa", "Abrir disputa", "disputa/nova/AV-2026-001/0", "newDispute"],
  ["Disputa", "Mediação pendente", "disputa/DP-001", "dispute"],
  ["Disputa", "Prestador responde", "disputa/DP-001", "disputeProvider"],
  ["Disputa", "Proposta da mediação", "disputa/DP-001/resultado", "proposal"],
  ["Disputa", "Disputa encerrada", "disputa/DP-001/resultado", "disputeClosed"],
  ["Disputa", "Como funcionam as disputas", "arbitragem"],
  ["Seguro", "Apólice simulada", "seguro/AV-2026-001"],
  ["Seguro", "Sinistro em análise", "seguro/AV-2026-001", "claim"],
  ["Crédito", "Meus créditos", "creditos"],
  ["Crédito", "Meus créditos — vazio", "creditos", "empty"],
  ["Crédito", "CCB e parcelas", "ccb/CCB-001"],
  ["Crédito", "Parcela em atraso", "ccb/CCB-001", "lateCredit"],
  ["Financeiro", "Financeiro", "financeiro"],
  ["Financeiro", "Extrato", "extrato"],
  ["Financeiro", "Extrato — vazio", "extrato", "empty"],
  ["Benefícios", "Pontos e benefícios", "beneficios"],
  ["Benefícios", "Selo do prestador", "selo", "provider"],
  ["Benefícios", "Cofrinho do pagamento", "cofrinho/AV-2026-001", "checkout"],
  ["Assistente", "Assistente", "assistente"],
  ["Assistente", "Montar marcos", "etapas/novo", "agreement"],
  ["Assistente", "Ajuda", "ajuda"],
  ["Integrações simuladas", "Sem conta conectada", "sem-conta", "disconnected"],
  ["Integrações simuladas", "Entrada bancária existente (legado)", "btg"],
  ["Integrações simuladas", "Retorno do app externo — pontos", "no-app-btg/pontos"],
  ["Banco", "Visão operacional", "banco/visao", "bank"],
  ["Banco", "Operações", "banco/operacoes", "bank"],
  ["Banco", "Operações — contratos", "banco/operacoes/contratos", "bank"],
  ["Banco", "Fila operacional", "banco/fila", "bank"],
  ["Banco", "Detalhe da fila", "banco/fila/DP-001", "bankDispute"],
  ["Banco", "Clientes e limites", "banco/clientes", "bank"],
  ["Banco", "Carteira de crédito", "banco/credito", "bank"],
  ["Banco", "Pedido de crédito", "banco/credito/CR-001", "bank"],
  ["Banco", "Seguros", "banco/seguros", "bankClaim"],
  ["Banco", "Detalhe do sinistro", "banco/seguros/SI-001", "bankClaim"],
  ["Banco", "Receitas", "banco/receita", "bank"],
  ["Banco", "Funding", "banco/funding", "bank"],
  ["Banco", "Conluio", "banco/conluio", "bank"],
  ["Banco", "Compliance", "banco/compliance", "bank"],
  ["Banco", "API", "banco/api", "bank"],
  ["Banco", "Ofertas", "banco/ofertas", "bank"],
  ["Confirmações", "Revisar e aprovar entrega", "servico/AV-2026-001", "approveSheet", "aprovar"],
  ["Confirmações", "Ofertas do pagamento", "pagar/AV-2026-001", "offersSheet", "ofertas"],
  ["Confirmações", "Compartilhar comprovante", "servico/AV-2026-001", "proofSheet", "comprovante"],
  ["Confirmações", "Confirmar arbitragem", "disputa/DP-001", "arbitrationSheet", "arbitragem"],
  ...["repeat", "insurance", "points", "autoAnticipate", "pixAuto"].map((kind, i) => ["Confirmações", ["Repetir cobrança", "Contratar seguro", "Usar pontos", "Antecipação automática", "Pix Automático"][i], ["combinado/1", "pagar/AV-2026-001", "pagar/AV-2026-001", "agenda", "financeiro"][i], `confirm:${kind}`, "confirmar"]),
  ["Assistente", "Aguardando resposta do assistente", "assistente", "assistantLoading"],
  ["Onboarding", "Conhecer o Aval — boas-vindas", "entrada", "onboarding:0"],
  ["Onboarding", "Conhecer o Aval — cobrar", "entrada", "onboarding:1"],
  ["Onboarding", "Conhecer o Aval — pagar", "entrada", "onboarding:2"],
  ["Onboarding", "Conhecer o Aval — acompanhar", "entrada", "onboarding:3"],
];

export const MOCKS = rows.map(([group, title, path, variant = "default", sheet], index) => ({
  id: `mock-${String(index + 1).padStart(3, "0")}`, group, title, path, variant, sheet: sheet ?? null,
  surface: group === "Banco" ? "desktop" : "mobile",
  description: "Tela existente, com dados fictícios. As ações modificam somente este exemplo em memória; recarregar restaura o padrão.",
  limitation: /legado|Integrações|Banco|Seguro|Crédito/.test(`${group} ${title}`)
    ? "Referência do comportamento atual. Bancos, crédito, seguro, decisões e integrações não são serviços reais."
    : "Nenhum dinheiro é movimentado e nenhuma mensagem externa é enviada.",
}));

export function fixtureFor(mock) {
  if (!MOCKS.some((entry) => entry.id === mock?.id)) throw new Error("Mock desconhecido");
  const s = seed();
  const v = mock.variant;
  if (v.startsWith("onboarding:")) s.ui.onboarding = { step: Number(v.split(":")[1]) };
  s.people[SELF] = { ...PEOPLE.marina, id: SELF, name: "Pessoa Exemplo", first: "Exemplo", initials: "PE", clientName: "Pessoa Exemplo", providerName: "Serviços Exemplo", phone: "(11) 97777-3003", email: "pessoa@example.com" };
  s.accounts[SELF] = { ...freshAccount(), btg: { ...s.accounts.marina.btg } };
  s.session = { person: SELF, mode: "contratante", loggedIn: !["signedOut", "signup", "login"].includes(v) && !v.startsWith("onboarding:") };
  s.ui.dual = false;
  const c = {
    id: IDS.contract, title: "Pintura da sala", description: "Preparar as paredes e aplicar duas demãos de tinta na sala.",
    client: "Pessoa Exemplo", provider: PEOPLE.carlos.providerName, kind: "individual", protected: true, from: "provider", channel: "app",
    address: "Rua Exemplo, 100 · São Paulo/SP", dueDate: "20/11", release: "stages", totalCents: 120000,
    status: "active", signedAt: "04/10", arbitration: true, arbitrationFeeCents: 480,
    paidInCents: 120000, refundedCents: 0, payment: { method: "balance", origin: "Saldo simulado", label: "Saldo simulado" },
    paymentRecordedAt: "2026-10-04T12:00:00-03:00", entrada: null,
    insurance: { policy: "SG-2026-001", premiumCents: 3000, coverageCents: 120000, paid: true },
    stages: [makeStage("Preparação das paredes", 48000, "10/11", "awaitingApproval", ["Lixar as paredes", "Aplicar massa corrida"], {
      delivery: { sentAt: "04/10", deadline: "11/10", description: "Paredes lixadas e preparadas com massa corrida.", attachments: [{ kind: "photo", caption: "Paredes preparadas", file: "foto-simulada.jpg" }] },
    }), makeStage("Pintura e acabamento", 72000, "20/11", "pending", ["Duas demãos de tinta", "Limpeza do ambiente"])],
  };
  s.contracts = [c];
  s.invites = [{ id: IDS.invite, token: IDS.invite, ...Object.fromEntries(["title", "description", "client", "provider", "kind", "protected", "from", "channel", "address", "dueDate", "release", "totalCents", "arbitrationFeeCents"].map(key => [key, c[key]])),
    createdBy: "carlos", contact: s.people[SELF].phone, recipient: { kind: "phone", contact: s.people[SELF].phone, personId: SELF, name: c.client },
    stages: structuredClone(c.stages), participants: null, declined: [], status: "sent", createdAt: "04/10", sentAtMs: 0, repeat: false, origin: "app", insurance: null }];
  s.credits = [{ id: IDS.credit, owner: SELF, purpose: "Pintura da sala", principalCents: 120000, count: 12, installmentCents: 11000, monthlyRate: 0.02, cet: "29,05% ao ano", signedAt: "04/10", status: "active" }];
  s.installments = Array.from({ length: 12 }, (_, index) => { const n = index + 1; return { id: `PC-${n}`, creditId: IDS.credit, owner: SELF, n, of: 12, due: `10/${String(((index + 9) % 12) + 1).padStart(2, "0")}${index > 2 ? '/27' : ''}`, valueCents: 11000, status: n === 1 ? "paid" : "open" }; });
  s.creditRequests = [{ id: IDS.request, owner: SELF, amountCents: 120000, count: 12, incomeCents: 1000000, purposeLabel: "Contratar serviço", status: "analysis", openFinanceShared: false }];
  s.ledger = [{ id: "LG-001", contractId: c.id, label: "Pagamento simulado em custódia", amountCents: 120000, status: "Conciliado", date: "04/10" }];
  s.notifications = [{ id: "AV-001", to: c.client, mode: "contratante", text: "Entrega recebida", detail: "Confira o marco antes de liberar o valor.", icon: "check-circle", go: `#/servico/${c.id}`, read: false }];
  s.messages[c.id] = [{ from: "client", text: "Quando você conclui a preparação?", at: "03/10 · 10:00" }, { from: "provider", text: "Enviei a entrega para você conferir.", at: "04/10 · 12:00" }];
  s.invoices = [{ id: "NF-001", contractId: c.id, stage: 0, provider: c.provider, client: c.client, issuedAt: "04/10", amountCents: 48000 }];
  s.points = { [SELF]: 2500, carlos: 1200 };
  s.reserves = { [c.id]: { cents: 20000, since: "04/10" } };
  const ag = { from: "client", description: c.description, total: "1.200,00", dueDate: c.dueDate, dueIso: "2026-11-20", release: "stages", template: "pintura", channel: "app", person: "carlos", contact: PEOPLE.carlos.phone,
    cep: "05435-000", street: "Rua Exemplo", number: "100", district: "Vila Madalena", city: "São Paulo", uf: "SP", addressOpen: true };
  s.ui.drafts.ag = ag;
  if (v.startsWith("charge")) {
    s.session.person = "carlos"; s.session.mode = "prestador";
    const kind = v === "chargeDocument" ? "document" : v === "chargeEmail" ? "email" : "phone";
    const contact = kind === "document" ? "529.982.247-25" : kind === "email" ? "pessoa@example.com" : s.people[SELF].phone;
    Object.assign(ag, { from: "provider", recipientKind: kind, recipientInput: contact, payer: { kind, contact, personId: kind === "document" ? null : SELF, name: kind === "document" ? null : c.client }, person: SELF, contact, channel: "link" });
    if (["chargePhone", "chargeDocument", "chargeEmail", "chargeError"].includes(v)) { ag.recipientInput = ""; ag.payer = null; }
    if (v === "chargeError") { ag.recipientInput = "123"; s.ui.errors = { "ag.recipientInput": "Informe um telefone válido com DDD." }; }
  }
  if (["provider", "providerWork", "delivery", "anticipated", "proofSheet", "disputeProvider"].includes(v)) { s.session.person = "carlos"; s.session.mode = "prestador"; }
  if (["work", "providerWork", "delivery", "cancellation"].includes(v)) c.stages[0].status = "inProgress";
  if (v === "adjustment") { c.stages[0].status = "adjustRequested"; c.stages[0].reply = { text: "Revise a massa corrida no canto da parede." }; }
  if (v === "delivery") s.ui.drafts.entrega = { key: `${c.id}:0`, description: c.stages[0].delivery.description, attachments: structuredClone(c.stages[0].delivery.attachments), caption: "Paredes preparadas" };
  if (v === "anticipated") c.stages[0].anticipation = { grossCents: 45600, feeCents: 1322, netCents: 44278, at: "04/10" };
  if (["released", "completed", "proofSheet"].includes(v)) { c.stages[0].status = "released"; c.stages[0].releasedAt = "04/10"; c.stages[0].releaseMode = "manual"; }
  if (v === "completed") { c.status = "completed"; c.stages.forEach(st => { st.status = "released"; st.releasedAt = "04/10"; st.releaseMode = "manual"; }); }
  if (v.startsWith("checkout") || ["pix", "offersSheet", "downPayment", "confirm:insurance", "confirm:points"].includes(v)) { c.status = "awaitingPayment"; c.paidInCents = 0; c.payment = null; c.insurance = null; c.stages.forEach(st => st.status = "pending"); }
  if (v === "confirm:autoAnticipate" || v === "confirm:repeat") { s.session.person = "carlos"; s.session.mode = "prestador"; }
  if (v === "confirm:repeat") Object.assign(ag, { from: "provider", person: SELF, contact: s.people[SELF].phone, recipientKind: "phone", recipientInput: s.people[SELF].phone, payer: { kind: "phone", contact: s.people[SELF].phone, personId: SELF, name: c.client } });
  if (v === "checkoutCard") { s.ui.drafts.pay = { [c.id]: "card" }; s.ui.drafts.card = { [c.id]: 6 }; }
  if (v === "checkoutCredit") s.ui.drafts.pay = { [c.id]: "credit" };
  if (v === "checkoutNoBalance") s.accounts[SELF].balanceCents = 0;
  if (v === "pix") s.ui.payment = { kind: "contract", contractId: c.id, amountCents: c.totalCents, label: c.title, after: `#/pago/${c.id}` };
  if (v === "downPayment") c.entrada = { requestedCents: 20000, status: "requested" };
  if (v === "inviteSent") Object.assign(s.invites[0], { from: "client", createdBy: SELF });
  if (v === "inviteCancelled" || v === "inviteDeclined") s.invites[0].status = v === "inviteCancelled" ? "cancelled" : "declined";
  if (["collective", "splitInvite"].includes(v)) {
    c.kind = "collective"; c.status = "funding"; c.paidInCents = 0;
    c.participants = [{ name: c.client, me: true, token: "DV-001", bps: 5000, shareCents: 60000, status: "accepted", paid: false, contact: s.people[SELF].phone },
      { name: PEOPLE.marina.clientName, token: IDS.split, bps: 5000, shareCents: 60000, status: "pending", paid: false, contact: PEOPLE.marina.phone }];
    if (v === "splitInvite") s.session.person = "marina";
  }
  if (["cancellationPending", "cancelled"].includes(v)) c.cancellation = { status: v === "cancelled" ? "accepted" : "pending", requestedBy: SELF, amountCents: 120000, requestedAt: "04/10", completedAt: "2026-10-04T12:00:00-03:00" };
  if (["cancellation", "cancellationPending", "cancelled"].includes(v)) c.insurance = null;
  if (v === "cancelled") { c.status = "completed"; c.completionReason = "cancelled"; c.refundedCents = 120000; c.stages.forEach(st => st.status = "refunded"); }
  if (["dispute", "disputeProvider", "proposal", "disputeClosed", "claim", "arbitrationSheet", "bankDispute", "bankClaim"].includes(v)) {
    s.disputes = [{ id: IDS.dispute, contractId: c.id, stage: 0, reason: "deliveryQuality", amountCents: 48000, report: "A parede ainda apresenta irregularidades.",
      clientEvidence: ["Foto simulada da parede"], providerEvidence: [], providerStatement: null, deadline: "11/10", history: [["Disputa aberta", "04/10 · valor bloqueado", "ok"]],
      status: v === "proposal" ? "proposal" : ["disputeClosed", "claim", "bankClaim"].includes(v) ? "closed" : "mediation",
      proposal: { share: 0.25, clientCents: 36000, providerCents: 12000, rule: "Exemplo de decisão simulada" } }];
    c.stages[0].status = "disputed";
    if (s.disputes[0].status === "closed") {
      c.stages[0].status = "split"; c.stages[0].split = { providerCents: 12000, clientCents: 36000 }; c.stages[0].releasedAt = "04/10"; c.stages[0].releaseMode = "Acordo na mediação";
      c.refundedCents = 36000; c.stages[1].status = "inProgress"; s.disputes[0].closedAt = "04/10";
    }
  }
  if (v === "claim" || v === "bankClaim") s.claims = [{ id: IDS.claim, contractId: c.id, disputeId: IDS.dispute, policy: c.insurance.policy, coverage: "refazer", capCents: 12000, deductibleCents: 1200, payoutCents: 10800, status: "analysis", reason: "Refazer a preparação da parede.", createdAt: "04/10" }];
  if (v === "newDispute") s.ui.drafts.disputa = { reason: "deliveryQuality", report: "A parede ainda apresenta irregularidades.", files: [] };
  if (v === "lateCredit") s.installments[1].status = "late";
  if (v === "disconnected") s.accounts[SELF].btg.status = "none";
  if (v === "accountAnalysis" || v === "accountRefused") s.newAccount = { name: "Pessoa Exemplo", status: v === "accountAnalysis" ? "review" : "refused", blockReason: "Dados fictícios inconsistentes", submittedAt: "04/10", steps: [] };
  s.ui.drafts.stg = { novo: { messages: [{ from: "ai", text: "Confira a sugestão de marcos para este exemplo." }], proposal: { release: "stages", stages: c.stages.map(({ name, valueCents, due }) => ({ name, valueCents, due })) }, typing: false } };
  if (v === "assistantLoading") s.ui.drafts.asst = { messages: [{ from: "me", text: "Como funciona a liberação por marcos?" }], typing: true };
  if (v.startsWith("bank")) s.session = { person: "banco", mode: "banco", loggedIn: true };
  if (mock.sheet) s.ui.sheet = { name: mock.sheet, id: mock.sheet === "arbitragem" ? IDS.dispute : c.id, stage: 0, kind: v.split(":")[1], route: `#/${mock.path}` };
  if (v === "empty") for (const key of ["contracts", "invites", "credits", "installments", "creditRequests", "ledger", "notifications", "invoices"]) s[key] = [];
  return s;
}
