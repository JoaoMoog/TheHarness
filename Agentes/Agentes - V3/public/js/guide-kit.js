// Building blocks of the presenter script, shared by the full demo (guide-steps.js) and the executive pitch
// (guide-pitch.js): how the guide reads the state, and the runs of steps every payment goes through.

/** True on the screens whose path starts with the prefix. */
export const at = (prefix) => ({ path }) => path.startsWith(prefix);
export const drafted = (s, key, id) => s.ui.drafts[key]?.[id];
export const waThread = (s, who) => s.wa?.threads?.[who];
/** How many messages the person wrote on WhatsApp. */
export const said = (s, who) => (waThread(s, who)?.messages ?? []).filter((m) => m.from === "me").length;
/** A live button of the newest message of the BTG Aval on WhatsApp. */
export const tap = (value) => `[data-action="waButton"][data-value="${value}"]:not([disabled])`;
export const attached = (s) => (s.ui.drafts.entrega?.attachments?.length ?? 0) > 0;

/** The payer of a charge defines how the money is released, with the assistant's suggestion. */
export const stagesSteps = (find) => [
  { who: "voce", target: '[data-action="openStages"]', do: "Defina os marcos", why: "Quem paga decide em quantas partes o dinheiro sai. O assistente sugere os marcos deste tipo de serviço.", done: (x) => at("etapas")(x) || Boolean(x.s.ui.drafts.stg?.[find(x.s)?.token]?.chosen) || Boolean(find(x.s)?.contractId) },
  { who: "voce", target: '[data-action="stagesUse"]', do: "Use a sugestão", why: "Cada marco vira um valor que só sai quando for aprovado. Dá para ajustar conversando.", done: (x) => Boolean(x.s.ui.drafts.stg?.[find(x.s)?.token]?.chosen) || Boolean(find(x.s)?.contractId) },
];

/** A new charge identifies the payer before the service details; in person, the payer is whoever reads the QR. */
export const chargeSteps = (why, done, { inPerson = false } = {}) => [
  { who: "carlos", go: "#/inicio", target: '[data-action="startCharge"]', do: "Toque em Cobrar", why: why || "Quem presta o serviço começa pela cobrança.", done: (x) => at("combinado")(x) || at("cobrar")(x) || done(x) },
  { who: "carlos", target: '[data-action="newCharge"]', do: "Nova cobrança", why: "Uma cobrança nova, para um serviço combinado com qualquer pessoa.", done: (x) => at("cobrar/destinatario")(x) || at("combinado")(x) || done(x) },
  inPerson
    ? { who: "carlos", target: '[data-action="chargeInPerson"]', do: "Cobre na hora, com QR", why: "A cliente está ali: não precisa de telefone. Ela lê o QR e confere tudo antes de pagar.", done: (x) => Boolean(x.s.ui.drafts.ag?.payer) || at("combinado")(x) || done(x) }
    : { who: "carlos", target: '[data-bind="ag.recipientInput"]', type: "(11) 97777-3003", then: '[data-action="chargeRecipientNext"]', do: "Identifique quem vai pagar", why: "Telefone, CPF/CNPJ ou e-mail. A identificação é mantida até a revisão da cobrança.", done: (x) => Boolean(x.s.ui.drafts.ag?.payer) || at("combinado")(x) || done(x) },
];

/** Checking what was agreed: tick the box, then accept. */
export const acceptSteps = (who, why, done, go) => [
  { who, ...(go ? { go } : {}), target: '[data-bind="ag.accept"]', do: "Marque a caixa", why: why || "Antes de aceitar, quem paga confere valor, prazo e as regras do Aval.", done: (x) => Boolean(x.s.ui.drafts.ag?.accept) || done(x) },
  { who, target: '[data-bind="ag.arbitration"]', do: "Aceite a arbitragem", why: "A cláusula tem caixa própria: se a mediação não resolver, um árbitro decide, sem ir à Justiça.", done: (x) => Boolean(x.s.ui.drafts.ag?.arbitration) || done(x) },
  { who, target: '[data-action="acceptAgreement"]', do: "Aceite", why: "Com o aceite, o combinado vira um pagamento Aval.", done },
];

/** The screens of a new payment, the same for Cobrar and Pagar. With `frontLoad`, the payer asks for the material up front. */
export const agreementSteps = (who, { channel = null, charge = true, frontLoad = false, done }) => [
  { who, target: '[data-action="improveDescription"]', do: "Melhore com a IA", why: "A pessoa escreve do jeito dela; a IA deixa a descrição clara e completa, para não haver dúvida depois.", done: (x) => Boolean(x.s.ui.drafts.ag?.improved) || done(x) },
  { who, target: '[data-action="agreementNext"]', do: "Continue", why: charge ? "Quem cobra pode sugerir os marcos; quem paga decide como o dinheiro sai." : "Agora, como o dinheiro vai sair: de uma vez ou por marcos.", done: (x) => at("combinado/2")(x) || at("combinado/3")(x) || done(x) },
  ...(charge ? [] : [
    { who, target: '[data-action="openStages"][data-key="novo"]', do: "Monte os marcos com o assistente", why: "Quem paga escolhe como o dinheiro sai.", done: (x) => at("etapas")(x) || Boolean(x.s.ui.drafts.ag?.custom) || done(x) },
    ...(frontLoad ? [{ who, target: '[data-action="stagesQuick"][data-text="Material na frente"]', do: "Peça material na frente", why: "A tinta e a massa são compradas no início: o primeiro marco fica com 60%.", done: (x) => (x.s.ui.drafts.stg?.novo?.messages?.length ?? 0) >= 3 || Boolean(x.s.ui.drafts.ag?.custom) || done(x) }] : []),
    { who, target: '[data-action="stagesUse"]', do: "Use a sugestão", why: "Cada marco só sai quando você aprovar.", done: (x) => Boolean(x.s.ui.drafts.ag?.custom) || done(x) },
    { who, target: '[data-action="agreementNext"]', do: "Continue", why: "Falta só escolher para quem vai e como enviar.", done: (x) => at("combinado/3")(x) || done(x) },
  ]),
  ...(channel ? [{ who, target: `[data-action="chooseChannel"][data-channel="${channel}"]`, do: "Escolha QR code", why: "A cliente está ali, na frente. Ela lê o QR e paga na hora.", done: (x) => x.s.ui.drafts.ag?.channel === channel || done(x) }] : []),
];
