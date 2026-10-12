// Presenter script in chapters, starting from an empty app. Each step says who acts, where to click (target),
// the action in a few words (do), why it matters (why, optional), and how the guide knows it was done (done), so it moves on by itself.

import { SELF } from "./seed.js";

const of = (s, pred) => s.contracts.filter(pred);
/** Payments of each chapter, found by how they were made (the presentation starts empty and runs in order). */
const firstCharge = (s) => of(s, (c) => c.protected && c.from === "provider" && c.channel === "whatsapp").at(-1);
const toMarina = (s) => of(s, (c) => c.protected && c.from === "client")[0];
const group = (s) => of(s, (c) => c.protected && c.kind === "collective")[0];
const byQr = (s) => of(s, (c) => c.protected && c.channel === "qr")[0];
const charges = (s) => s.invites.filter((i) => i.protected && i.from === "provider" && i.channel === "whatsapp");
const qrInvite = (s) => s.invites.find((i) => i.protected && i.channel === "qr");
const payInvite = (s) => s.invites.find((i) => i.protected && i.from === "client");
const dispute = (s) => s.disputes.find((d) => d.contractId === byQr(s)?.id);
const at = (prefix) => ({ path }) => path.startsWith(prefix);
const drafted = (s, key, id) => s.ui.drafts[key]?.[id];
const guest = (s) => group(s)?.participants.find((p) => p.channel === "email");
const marinaShare = (s) => group(s)?.participants.find((p) => p.name === "Marina Costa");
const me = (s) => group(s)?.participants.find((p) => p.me);
const waThread = (s, who) => s.wa?.threads?.[who];
const said = (s, who) => (waThread(s, who)?.messages ?? []).filter((m) => m.from === "me").length;
const waInvite = (s, who) => s.invites.find((i) => i.id === waThread(s, who)?.inviteId);
const waContract = (s) => s.contracts.find((c) => c.id === waInvite(s, SELF)?.contractId);
const tap = (value) => `[data-action="waButton"][data-value="${value}"]:not([disabled])`;
const attached = (s) => (s.ui.drafts.entrega?.attachments?.length ?? 0) > 0;

/** The payer of a charge defines how the money is released, with the assistant's suggestion. */
const stagesSteps = (find) => [
  { who: "voce", target: '[data-action="openStages"]', do: "Defina os marcos", why: "Quem paga decide em quantas partes o dinheiro sai. O assistente sugere os marcos deste tipo de serviço.", done: (x) => at("etapas")(x) || Boolean(x.s.ui.drafts.stg?.[find(x.s)?.token]?.chosen) || Boolean(find(x.s)?.contractId) },
  { who: "voce", target: '[data-action="stagesUse"]', do: "Use a sugestão", why: "Cada marco vira um valor que só sai quando for aprovado. Dá para ajustar conversando.", done: (x) => Boolean(x.s.ui.drafts.stg?.[find(x.s)?.token]?.chosen) || Boolean(find(x.s)?.contractId) },
];

/** A new charge identifies the payer before the service details. */
const chargeSteps = (why, done) => [
  { who: "carlos", go: "#/inicio", target: '[data-action="startCharge"]', do: "Toque em Cobrar", why: why || "Quem presta o serviço começa pela cobrança.", done: (x) => at("combinado")(x) || at("cobrar")(x) || done(x) },
  { who: "carlos", target: '[data-action="newCharge"]', do: "Nova cobrança", why: "Uma cobrança nova, para um serviço combinado com qualquer pessoa.", done: (x) => at("cobrar/destinatario")(x) || at("combinado")(x) || done(x) },
  { who: "carlos", target: '[data-bind="ag.recipientInput"]', type: "(11) 97777-3003", then: '[data-action="chargeRecipientNext"]', do: "Identifique quem vai pagar", why: "Telefone, CPF/CNPJ ou e-mail. A identificação é mantida até a revisão da cobrança.", done: (x) => Boolean(x.s.ui.drafts.ag?.payer) || at("combinado")(x) || done(x) },
];

/** Checking what was agreed: tick the box, then accept. */
const acceptSteps = (who, why, done, go) => [
  { who, ...(go ? { go } : {}), target: '[data-bind="ag.accept"]', do: "Marque a caixa", why: why || "Antes de aceitar, quem paga confere valor, prazo e as regras do Aval.", done: (x) => Boolean(x.s.ui.drafts.ag?.accept) || done(x) },
  { who, target: '[data-bind="ag.arbitration"]', do: "Aceite a arbitragem", why: "A cláusula tem caixa própria: se a mediação não resolver, um árbitro decide, sem ir à Justiça.", done: (x) => Boolean(x.s.ui.drafts.ag?.arbitration) || done(x) },
  { who, target: '[data-action="acceptAgreement"]', do: "Aceite", why: "Com o aceite, o combinado vira um pagamento Aval.", done },
];

/** Whoever charges suggests the stages (material up front) before sending; the payer still decides. */
const proposalSteps = (done) => [
  { who: "carlos", target: '[data-action="openStages"][data-key="novo"]', do: "Sugira os marcos", why: "Quem cobra pode sugerir a divisão. Quem paga vê a sugestão e decide.", done: (x) => at("etapas/novo")(x) || Boolean(x.s.ui.drafts.ag?.custom) || done(x) },
  { who: "carlos", target: '[data-action="stagesQuick"][data-text="Material na frente"]', do: "Peça material na frente", why: "A tinta e a massa são compradas no início: o primeiro marco fica maior.", done: (x) => (x.s.ui.drafts.stg?.novo?.messages?.length ?? 0) >= 3 || Boolean(x.s.ui.drafts.ag?.custom) || done(x) },
  { who: "carlos", target: '[data-action="stagesUse"]', do: "Mande a sugestão", why: "A sugestão vai junto com a cobrança.", done: (x) => Boolean(x.s.ui.drafts.ag?.custom) || done(x) },
];

/** The screens of a new payment, the same for Cobrar and Pagar. */
const agreementSteps = (who, { channel = null, charge = true, done }) => [
  { who, target: '[data-action="improveDescription"]', do: "Melhore com a IA", why: "A pessoa escreve do jeito dela; a IA deixa a descrição clara e completa, para não haver dúvida depois.", done: (x) => Boolean(x.s.ui.drafts.ag?.improved) || done(x) },
  { who, target: '[data-action="agreementNext"]', do: "Continue", why: charge ? "Quem cobra pode sugerir os marcos; quem paga decide como o dinheiro sai." : "Agora, como o dinheiro vai sair: de uma vez ou por marcos.", done: (x) => at("combinado/2")(x) || at("combinado/3")(x) || done(x) },
  ...(charge ? [] : [
    { who, target: '[data-action="openStages"][data-key="novo"]', do: "Monte os marcos com o assistente", why: "Quem paga escolhe como o dinheiro sai.", done: (x) => at("etapas")(x) || Boolean(x.s.ui.drafts.ag?.custom) || done(x) },
    { who, target: '[data-action="stagesUse"]', do: "Use a sugestão", why: "Cada marco só sai quando você aprovar.", done: (x) => Boolean(x.s.ui.drafts.ag?.custom) || done(x) },
    { who, target: '[data-action="agreementNext"]', do: "Continue", why: "Falta só escolher para quem vai e como enviar.", done: (x) => at("combinado/3")(x) || done(x) },
  ]),
  ...(channel ? [{ who, target: `[data-action="chooseChannel"][data-channel="${channel}"]`, do: "Escolha QR code", why: "A cliente está ali, na frente. Ela lê o QR e paga na hora.", done: (x) => x.s.ui.drafts.ag?.channel === channel || done(x) }] : []),
];

/** Delivery of one stage by Carlos: open, attach a photo, send. */
const deliverySteps = (find, idx, why) => [
  { who: "carlos", go: "#/inicio", target: '[data-action="startCharge"]', do: "Toque em Cobrar", why: why || "Para receber, Carlos pede a liberação de um marco.", done: (x) => at("cobrar")(x) || at("entrega")(x) || find(x.s)?.stages[idx].status !== "inProgress" },
  { who: "carlos", target: '[data-go="#/cobrar"]', do: "Veja os marcos a cobrar", why: "Este serviço já tem cliente e dinheiro guardado. Selecione o marco que entregou.", done: (x) => x.path === "cobrar" || at("entrega")(x) || find(x.s)?.stages[idx].status !== "inProgress" },
  { who: "carlos", target: (s) => `[data-action="chargeStage"][data-id="${find(s)?.id}"][data-stage="${idx}"]`, do: `Cobre o marco ${idx + 1}`, why: "O dinheiro deste marco já está guardado no BTG. Carlos só pede a liberação.", done: (x) => at("entrega")(x) || find(x.s)?.stages[idx].status !== "inProgress" },
  { who: "carlos", target: '[data-action="addAttachment"][data-kind="photo"]', do: "Anexe uma foto", why: "A foto é a prova da entrega e fica registrada no contrato.", done: (x) => attached(x.s) || find(x.s)?.stages[idx].status !== "inProgress" },
  { who: "carlos", target: '[data-action="sendDelivery"]', do: "Envie a entrega", why: "Quem paga tem 7 dias para aprovar. Sem resposta, o dinheiro sai sozinho.", done: (x) => find(x.s)?.stages[idx].status !== "inProgress" },
];

export const CHAPTERS = [
  {
    title: "Cobrar e pagar", sub: "WhatsApp, conta na hora, cartão com seguro.",
    steps: [
      ...chargeSteps("Carlos registra a pintura que combinou.", (x) => charges(x.s).length > 0),
      ...agreementSteps("carlos", { done: (x) => charges(x.s).length > 0 }),
      ...proposalSteps((x) => charges(x.s).length > 0),
      { who: "carlos", target: '[data-action="sendAgreement"]', do: "Envie a cobrança", why: "Vai pelo WhatsApp, com um link seguro do BTG e um código de segurança. A cliente nunca usou o Aval.", done: (x) => charges(x.s).length > 0 },
      { who: "carlos", target: '[data-action="openAgreementLink"]', do: "Abra o link", why: "Agora vemos o que a cliente recebe ao abrir o link.", done: (x) => at("p/")(x) || at("cadastro")(x) || Boolean(firstCharge(x.s)) },
      { who: "voce", target: ".code-card", show: true, do: "Confira o código", why: "O mesmo código aparece no app Aval. Link falso não tem o código certo, e o BTG nunca pede senha por mensagem.", done: () => false },
      { who: "voce", target: '[data-action="enterBtgForLink"]', do: "Entre com a conta BTG", why: "Ela é cliente BTG, mas nunca usou o Aval. Entra com a conta do banco, sem cadastro novo.", done: (x) => at("cadastro")(x) || Boolean(x.s.people.voce) },
      { who: "voce", target: '[data-action="btgAuthorize"]', do: "Autorize com biometria", why: "Como no app do banco: sem senha e sem digitar dados.", done: (x) => at("cadastro/dados")(x) || Boolean(x.s.people.voce) },
      { who: "voce", target: ".limits-card", show: true, do: "Veja os limites dela", why: "Cada lado tem o seu limite, aprovado pelo BTG: um para pagar parcelado e outro para antecipar. Não é um limite dividido com quem cobra.", done: () => false },
      { who: "voce", target: '[data-bind="signup.arbitration"]', do: "Marque os termos", why: "Os dados vêm da conta BTG dela. Ela só confere e aceita os termos.", done: (x) => Boolean(x.s.ui.drafts.signup?.arbitration) || Boolean(x.s.people.voce) },
      { who: "voce", target: '[data-action="importBtgAccount"]', do: "Confirme", why: "Pronto, ela já usa o Aval. Volta direto para a cobrança.", done: (x) => Boolean(x.s.people.voce) },
      ...stagesSteps((s) => charges(s)[0]),
      ...acceptSteps("voce", "", (x) => Boolean(firstCharge(x.s))),
      { who: "voce", target: '[data-action="askConfirm"][data-kind="insurance"]', do: "Ligue o seguro", why: "Opcional: se uma disputa terminar a favor dela, o seguro cobre o que já tinha sido pago.", done: (x) => x.s.ui.sheet?.name === "confirmar" || Boolean(firstCharge(x.s)?.insurance) },
      { who: "voce", target: '[data-action="confirmToggle"]', do: "Confirme o seguro", why: "A janela explica o que ele cobre e quanto custa, antes de confirmar.", done: (x) => Boolean(firstCharge(x.s)?.insurance) },
      { who: "voce", target: '[data-action="choosePayMethod"][data-method="card"]', do: "Escolha o cartão", why: "No cartão BTG em até 12x. O valor inteiro fica guardado hoje.", done: (x) => drafted(x.s, "pay", firstCharge(x.s)?.id) === "card" },
      { who: "voce", target: '[data-action="chooseCardCount"][data-count="6"]', do: "Escolha 6x", why: "Parcela menor para quem paga. Quem recebe não espera nada a mais.", done: (x) => drafted(x.s, "card", firstCharge(x.s)?.id) === 6 },
      { who: "voce", target: '[data-action="acceptLimitIncrease"]', do: "Aumente o limite", why: "O limite não cobre. O banco oferece aumentar só o que falta, na hora.", done: (x) => (x.s.accounts.voce?.card.extraCents ?? 0) > 0 },
      { who: "voce", target: '[data-action="confirmPay"]', do: "Pague", why: "O dinheiro fica guardado no BTG, rendendo, até cada entrega ser aprovada.", done: (x) => firstCharge(x.s)?.status === "active" },
    ],
  },
  {
    title: "Entregar e liberar", sub: "Um marco aprovado, outro liberado sozinho.",
    steps: [
      ...deliverySteps(firstCharge, 0, "Carlos terminou o preparo."),
      { who: "voce", go: (s) => `#/servico/${firstCharge(s)?.id}`, target: '[data-action="openApprove"]', do: "Revise a entrega", why: "A cliente vê as fotos e a conferência do assistente antes de liberar.", done: (x) => x.s.ui.sheet?.name === "aprovar" || firstCharge(x.s)?.stages[0].status === "released" },
      { who: "voce", target: '[data-action="approveStage"]', do: "Aprove", why: "Aprovado: o valor do marco 1 vai para a conta do Carlos e é liberado no prazo do banco.", done: (x) => firstCharge(x.s)?.stages[0].status === "released" },
      ...deliverySteps(firstCharge, 1, "O acabamento."),
      { who: "voce", go: (s) => `#/servico/${firstCharge(s)?.id}`, target: '[data-action="advanceClock"][data-days="7"]', do: "Avance 7 dias", why: "Se a cliente não responder em 7 dias, o dinheiro sai sozinho. O que rendeu volta para ela.", done: (x) => firstCharge(x.s)?.status === "completed" },
      { who: "voce", go: "#/beneficios", target: '[data-action="shareReferral"][data-who="prestador"]', do: "Indique um prestador", why: "Ela ganhou pontos e benefícios por pagar com o Aval.", done: (x) => Boolean(x.s.ui.drafts.referral?.shared) },
      { who: "voce", go: "#/assistente", target: '[data-action="askSuggested"][data-index="1"]', do: "Pergunte ao assistente", why: "Dúvidas como “e se eu não aprovar a tempo?” são respondidas na hora, em linguagem simples.", done: (x) => (x.s.ui.drafts.asst?.messages?.length ?? 0) >= 2 },
    ],
  },
  {
    title: "Quem paga abre", sub: "A cliente paga a Marina com o empréstimo na hora.",
    steps: [
      { who: "voce", go: "#/inicio", target: '[data-action="startPayment"]', do: "Toque em Pagar", why: "Agora o caminho inverso: quem paga começa o pagamento.", done: (x) => at("combinado")(x) || Boolean(payInvite(x.s)) },
      ...agreementSteps("voce", { charge: false, done: (x) => Boolean(payInvite(x.s)) }),
      { who: "voce", target: '[data-action="sendAgreement"]', do: "Envie para a Marina", why: "A Marina recebe um aviso no app e confere tudo antes de aceitar.", done: (x) => Boolean(payInvite(x.s)) },
      ...acceptSteps("marina", "Marina confere o combinado.", (x) => Boolean(toMarina(x.s)), (s) => `#/p/${payInvite(s)?.token}`),
      { who: "voce", go: (s) => `#/pagar/${toMarina(s)?.id}`, target: '[data-action="openOffers"]', do: "Veja as opções de empréstimo", why: "O saldo não cobre. O banco mostra as opções lado a lado.", done: (x) => x.s.ui.sheet?.name === "ofertas" || drafted(x.s, "pay", toMarina(x.s)?.id) === "credit" },
      { who: "voce", target: '[data-action="pickOffer"][data-product="credit"]', do: "Escolha o empréstimo na hora", why: "Parcela, total e custo por ano à vista, com a nota de crédito.", done: (x) => drafted(x.s, "pay", toMarina(x.s)?.id) === "credit" },
      { who: "voce", target: '[data-action="confirmPay"]', do: "Pague", why: "O valor todo fica guardado hoje. Ela paga em parcelas, a primeira em 30 dias.", done: (x) => toMarina(x.s)?.status === "active" },
    ],
  },
  {
    title: "Pagar em conjunto", sub: "Três pessoas dividem a mesma cobrança.",
    steps: [
      ...chargeSteps("", (x) => charges(x.s).length > 1),
      ...agreementSteps("carlos", { done: (x) => charges(x.s).length > 1 }),
      { who: "carlos", target: '[data-action="sendAgreement"]', do: "Envie a cobrança", why: "A mesma cobrança, agora para um serviço que vai ser dividido.", done: (x) => charges(x.s).length > 1 },
      { who: "carlos", target: '[data-action="openAgreementLink"]', do: "Abra o link", why: "A cliente abre o link e confere o combinado.", done: (x) => x.s.session.person === "voce" || Boolean(charges(x.s)[1]?.contractId) },
      ...stagesSteps((s) => charges(s)[1]),
      ...acceptSteps("voce", "", (x) => Boolean(charges(x.s)[1]?.contractId)),
      { who: "voce", target: '[data-action="startSplitPayment"]', do: "Pagar em conjunto", why: "Uma cobrança, várias pessoas pagando: cada uma a sua parte.", done: (x) => at("dividir-pagamento")(x) || Boolean(group(x.s)) },
      { who: "voce", target: '[data-action="addSplitContact"]', do: "Adicione a Marina", why: "Convida pelo celular. Quem tem o app recebe um aviso.", done: (x) => (x.s.ui.drafts.novo?.splitContacts?.length ?? 0) > 0 || Boolean(group(x.s)) },
      { who: "voce", target: '[data-bind="novo.splitContact"]', type: "joao.souza@exemplo.com", then: '[data-action="addSplitContact"]', do: "Digite joao.souza@exemplo.com", why: "Alguém sem o app: recebe o convite por e-mail e paga pelo link.", done: (x) => (x.s.ui.drafts.novo?.splitContacts?.length ?? 0) > 1 || Boolean(group(x.s)) },
      { who: "voce", target: '[data-action="confirmSplitPayment"]', do: "Envie os convites", why: "Ninguém paga até todos aceitarem.", done: (x) => Boolean(group(x.s)) },
      { who: "marina", go: (s) => `#/dividir/${marinaShare(s)?.token}`, target: '[data-action="acceptSplit"]', do: "Aceite", why: "No celular da Marina: ela aceita a parte dela.", done: (x) => marinaShare(x.s)?.status === "accepted" },
      { who: "voce", go: (s) => `#/dividir/${guest(s)?.token}`, target: '[data-action="btgForShare"]', do: "Entre com a conta BTG", why: "Pelo link do e-mail. Sem conta, ele abre uma na hora.", done: (x) => Boolean(guest(x.s)?.btg) },
      { who: "voce", target: '[data-action="acceptSplit"]', do: "Aceite", why: "Ele confere a parte dele e aceita.", done: (x) => guest(x.s)?.status === "accepted" },
      { who: "voce", target: '[data-action="payShareByLink"]', do: "Pague com Pix", why: "Pix de qualquer banco. Também fica guardado.", done: (x) => Boolean(guest(x.s)?.paid) },
      { who: "marina", go: (s) => `#/pagar/${group(s)?.id}`, target: '[data-action="confirmPay"]', do: "Pague", why: "Marina paga a parte dela.", done: (x) => Boolean(marinaShare(x.s)?.paid) },
      { who: "voce", go: (s) => `#/pagar/${group(s)?.id}`, target: '[data-action="confirmPay"]', do: "Pague", why: "Todos pagaram: o serviço começa e o dinheiro está guardado.", done: (x) => Boolean(me(x.s)?.paid) },
    ],
  },
  {
    title: "QR na hora", sub: "Cobrança presencial, paga com Pix.",
    steps: [
      ...chargeSteps("Carlos está na casa da cliente.", (x) => Boolean(qrInvite(x.s))),
      ...agreementSteps("carlos", { channel: "qr", done: (x) => Boolean(qrInvite(x.s)) }),
      { who: "carlos", target: '[data-action="sendAgreement"]', do: "Gere o QR", why: "O combinado vira um QR na tela do Carlos.", done: (x) => Boolean(qrInvite(x.s)) },
      { who: "voce", go: "#/ler-qr", target: '[data-action="scanQr"]', do: "Leia o QR", why: "A cliente lê o QR com o celular e vê a cobrança na hora.", done: (x) => at("p/")(x) || Boolean(byQr(x.s)) },
      ...stagesSteps(qrInvite),
      ...acceptSteps("voce", "", (x) => Boolean(byQr(x.s))),
      { who: "voce", target: '[data-action="choosePayMethod"][data-method="pix"]', do: "Escolha Pix", why: "Pix na hora, guardado do mesmo jeito.", done: (x) => drafted(x.s, "pay", byQr(x.s)?.id) === "pix" || at("pix")(x) || byQr(x.s)?.status === "active" },
      { who: "voce", target: '[data-action="confirmPay"]', do: "Confirme", why: "Gera o Pix para pagar.", done: (x) => at("pix")(x) || byQr(x.s)?.status === "active" },
      { who: "voce", target: '[data-action="simulatePix"]:not([data-source])', do: "Simule o Pix", why: "Na vida real, a cliente paga no app do banco dela.", done: (x) => byQr(x.s)?.status === "active" },
    ],
  },
  {
    title: "Disputa", sub: "A cliente contesta e o banco media.",
    steps: [
      ...deliverySteps(byQr, 0, ""),
      { who: "voce", go: (s) => `#/servico/${byQr(s)?.id}`, target: '[data-action="startDispute"]', do: "Abra uma disputa", why: "A parede ficou manchada. A cliente contesta o marco pelo app.", done: (x) => at("disputa/nova")(x) || Boolean(dispute(x.s)) },
      { who: "voce", target: '[data-action="setDisputeReason"][data-reason="deliveryQuality"]', do: "Escolha o motivo", why: "O motivo define as regras da mediação. Relato e fotos já estão no caso.", done: (x) => Boolean(x.s.ui.drafts.disputa?.reason) || Boolean(dispute(x.s)) },
      { who: "voce", target: '[data-action="submitDispute"]', do: "Envie", why: "O valor do marco fica bloqueado até a decisão. Ninguém perde nada enquanto isso.", done: (x) => Boolean(dispute(x.s)) },
      { who: "voce", go: (s) => `#/disputa/${dispute(s)?.id}`, target: ".dp-sla", show: true, do: "Veja os prazos", why: "Provas em até 72 horas e decisão da mediação em até 5 dias úteis. O dinheiro não fica preso por meses.", done: () => false },
      { who: "carlos", go: (s) => `#/disputa/${dispute(s)?.id}`, target: '[data-action="respondDispute"]', do: "Responda", why: "Carlos responde com a versão e as provas dele.", done: (x) => Boolean(dispute(x.s)?.providerStatement) },
      { who: "carlos", go: (s) => `#/disputa/${dispute(s)?.id}`, target: ".dp-rule", show: true, do: "Veja a regra que vale", why: "A matriz de resolução decide pelas provas de cada lado, não pela opinião de alguém. Os dois veem a mesma regra.", done: () => false },
      { who: "banco", go: (s) => `#/banco/fila/${dispute(s)?.id}`, target: '[data-action="bankPropose"]', do: "Proponha o acordo", why: "O assistente resume o caso e a regra sugere a divisão. Uma pessoa do banco decide.", done: (x) => ["proposal", "closed"].includes(dispute(x.s)?.status) },
      { who: "voce", go: (s) => `#/disputa/${dispute(s)?.id}/resultado`, target: ".dp-arb", show: true, do: "Se não houver acordo", why: "Um árbitro independente decide, pago pelo seguro de arbitragem que já vem em toda operação. Ninguém paga nada a mais.", done: () => false },
      { who: "voce", go: (s) => `#/disputa/${dispute(s)?.id}/resultado`, target: '[data-action="acceptProposal"]', do: "Aceite o acordo", why: "Acordo aceito: cada lado recebe o que foi decidido, na hora.", done: (x) => dispute(x.s)?.status === "closed" },
    ],
  },
  {
    title: "Antecipação", sub: "Carlos recebe hoje, sem esperar.",
    steps: [
      ...deliverySteps(byQr, 1, ""),
      { who: "carlos", go: (s) => `#/servico/${byQr(s)?.id}`, target: '.offer-card [data-go^="#/antecipar"]', do: "Receba agora", why: "Oferta do banco: Carlos recebe hoje, sem esperar a aprovação, com uma taxa pequena.", done: (x) => at("antecipar")(x) || Boolean(byQr(x.s)?.stages[1].anticipation) },
      { who: "carlos", target: ".antec-why", show: true, do: "Veja por que ele pode", why: "37 serviços concluídos, nota 4,8, poucas disputas e nenhuma parcela atrasada: a regra do banco, igual para todos, com um limite só dele.", done: () => false },
      { who: "carlos", target: '[data-action="confirmAnticipation"]', do: "Confirme", why: "O dinheiro cai na conta dele agora. O banco recebe quando a marco for liberado.", done: (x) => Boolean(byQr(x.s)?.stages[1].anticipation) },
      { who: "carlos", go: "#/selo", target: '[data-action="shareSeal"]', do: "Compartilhe o selo", why: "Quem lê o QR já cai numa cobrança do Carlos.", done: (x) => Boolean(x.s.ui.drafts.seal?.shared) },
    ],
  },
  {
    title: "Pelo WhatsApp", sub: "Cobrar e pagar sem abrir o app.", whatsapp: true,
    steps: [
      { who: "carlos", wa: "carlos", watch: SELF, target: ".wa-head", show: true, do: "Fale com o BTG Aval", why: "Sem abrir o app: o BTG reconhece o número da conta e atende no WhatsApp, com as mesmas regras.", done: () => false },
      { who: "carlos", wa: "carlos", watch: SELF, target: '[data-bind="wa.input"]', type: "Cobrar pintura da varanda, R$ 4.500, entrega 30/11, Rua Harmonia 410", then: '[data-action="waSend"]', do: "Escreva a cobrança", why: "Do jeito que ele fala. O BTG Aval entende valor, prazo, endereço e serviço.", done: (x) => said(x.s, "carlos") >= 1 },
      { who: "carlos", wa: "carlos", watch: SELF, target: tap("Ana Ribeiro"), do: "Escolha a Ana", why: "Um toque no contato. Não precisa digitar celular.", done: (x) => said(x.s, "carlos") >= 2 || Boolean(waInvite(x.s, "carlos")) },
      { who: "carlos", wa: "carlos", watch: SELF, target: tap("Enviar cobrança"), do: "Envie a cobrança", why: "Chega no app da Ana com o código de segurança. Ela paga com Aval do mesmo jeito.", done: (x) => Boolean(waInvite(x.s, "carlos")) },
      { who: SELF, wa: SELF, watch: "marina", target: '[data-bind="wa.input"]', type: "Quero pagar a Marina 6 mil pelo projeto de interiores da varanda, até 20/11", then: '[data-action="waSend"]', do: "Agora a Ana paga pelo WhatsApp", why: "Ela também contrata a Marina sem abrir o app.", done: (x) => said(x.s, SELF) >= 1 },
      { who: SELF, wa: SELF, watch: "marina", target: tap("Usar marcos"), do: "Use os marcos", why: "O BTG Aval sugeriu os marcos de um projeto de interiores. Cada um só sai quando ela aprovar.", done: (x) => said(x.s, SELF) >= 2 || Boolean(waInvite(x.s, SELF)) },
      { who: SELF, wa: SELF, watch: "marina", target: tap("Enviar para Marina"), do: "Envie para a Marina", why: "A Marina recebe um aviso no app e confere tudo antes de aceitar.", done: (x) => Boolean(waInvite(x.s, SELF)) },
      ...acceptSteps("marina", "A Marina confere no app o que a Ana mandou pelo WhatsApp.", (x) => Boolean(waContract(x.s)), (s) => `#/p/${waInvite(s, SELF)?.token}`),
      { who: SELF, wa: SELF, watch: "marina", target: tap("Pagar com Pix"), do: "Pague com Pix", why: "Na própria conversa: Pix copia e cola, de qualquer banco.", done: (x) => waThread(x.s, SELF)?.step === "pix" || waContract(x.s)?.status === "active" },
      { who: SELF, wa: SELF, watch: "marina", target: tap("Já paguei"), do: "Confirme o Pix", why: "O dinheiro fica guardado no BTG, e a Marina vê na hora que pode começar.", done: (x) => waContract(x.s)?.status === "active" },
    ],
  },
  {
    title: "No banco", sub: "Ofertas, receita, risco e quem decidiu.",
    steps: [
      { who: "banco", go: "#/banco/ofertas", target: ".panel", show: true, do: "Veja o funil", why: "Cada oferta apareceu dentro de um pagamento, já calculada. O rendimento é automático e fica fora da conversão.", done: () => false },
      { who: "banco", go: "#/banco/receita", target: ".panel:has(.hbars)", show: true, do: "Veja de onde vem a receita", why: "Juros, float, seguro, tarifa e adquirência. O Aval não depende só de crédito.", done: () => false },
      { who: "banco", go: "#/banco/receita", target: ".econ-panel", show: true, do: "Veja um contrato por dentro", why: "Linha por linha, quanto o banco ganha num contrato desta apresentação e quem paga cada parte.", done: () => false },
      { who: "banco", go: "#/banco/conluio", target: ".panel", show: true, do: "Veja o risco", why: "Paulo e a Volt fecharam 14 contratos com aprovação em 38 minutos e antecipação total: padrão de crédito simulado. O banco vê antes de perder.", done: () => false },
      { who: "banco", go: "#/banco/credito", target: ".late-panel", show: true, do: "Veja a inadimplência", why: "Atraso tem régua automática: lembrete, aviso e, no quinto dia, o limite pausa e a antecipação trava. O risco não cresce enquanto a parcela está aberta.", done: () => false },
      { who: "banco", go: "#/banco/compliance", target: ".panel", show: true, do: "Veja quem decidiu", why: "Todo real que se moveu tem uma pessoa ou uma regra por trás, inclusive o acordo da disputa desta apresentação.", done: () => false },
      { who: "banco", go: "#/banco/funding", target: ".panel", show: true, do: "Veja o funding", why: "Os contratos com custódia viram lastro de um FIDC. O risco é de execução do serviço, não de uso livre do dinheiro.", done: () => false },
    ],
  },
];
