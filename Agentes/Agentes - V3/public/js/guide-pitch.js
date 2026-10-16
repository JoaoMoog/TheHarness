// The executive pitch in five parts, told with only Ana (who pays, "voce") and Carlos (who does the job): her phone
// and what the Aval does, she pays him, he charges her, the same on WhatsApp, and what the bank gets.
// `solo` shows one phone; `presets` are what each person would type (actions/protected.js openDraft);
// `feature` lights the item of the features map (features.js) while the step is on screen.

import { SELF } from "./seed.js";
import { acceptSteps, agreementSteps, at, attached, chargeSteps, drafted, said, stagesSteps, tap } from "./guide-kit.js";

const CARLOS = "Horizonte Reformas";
const contractOf = (s, inv) => (inv?.contractId ? s.contracts.find((c) => c.id === inv.contractId) : undefined);
/** Part 2: Ana pays Carlos, opened in the app. */
const payInvite = (s) => s.invites.find((i) => i.from === "client" && i.provider === CARLOS && i.origin !== "whatsapp");
const painting = (s) => contractOf(s, payInvite(s));
/** Part 3: Carlos charges Ana, by a link. */
const chargeInvite = (s) => s.invites.find((i) => i.from === "provider" && i.createdBy === "carlos" && i.origin !== "whatsapp");
const bathroom = (s) => contractOf(s, chargeInvite(s));
/** Part 4: Carlos charges Ana on WhatsApp. */
const waCharge = (s) => s.invites.find((i) => i.origin === "whatsapp" && i.createdBy === "carlos");
const roof = (s) => contractOf(s, waCharge(s));

const stageOf = (find, idx) => (s) => find(s)?.stages[idx];
const delivered = (find, idx) => (x) => Boolean(stageOf(find, idx)(x.s)) && stageOf(find, idx)(x.s).status !== "inProgress";

/** Carlos sends a delivery from the payment's page: open, attach a photo, describe it, send. */
const deliverySteps = (find, idx, text, why) => [
  { who: "carlos", go: (s) => `#/servico/${find(s)?.id}`, target: (s) => `[data-action="startDelivery"][data-id="${find(s)?.id}"]`, do: `Envie a entrega do marco ${idx + 1}`, why, done: (x) => at("entrega")(x) || delivered(find, idx)(x) },
  { who: "carlos", target: '[data-action="addAttachment"][data-kind="photo"]', do: "Anexe uma foto", why: "A foto é a prova da entrega e fica registrada no pagamento.", done: (x) => attached(x.s) || delivered(find, idx)(x) },
  { who: "carlos", target: '[data-bind="entrega.description"]', type: text, do: "Descreva o que foi feito", why: "Uma frase curta. O assistente compara com o que foi combinado no marco.", done: (x) => Boolean(x.s.ui.drafts.entrega?.description?.trim()) || delivered(find, idx)(x) },
  { who: "carlos", target: '[data-action="sendDelivery"]', do: "Envie", why: "Quem paga tem 7 dias para aprovar. Sem resposta, o dinheiro sai sozinho.", done: delivered(find, idx) },
];

/** A tour step of part 1: the element stays highlighted while the item of the features map lights up. */
const feature = (key, target, title, why) => ({ who: SELF, go: "#/inicio", target, show: true, feature: key, do: title, why, done: () => false });

const meet = {
  title: "Conheça o BTG Aval", sub: "O celular da Ana e tudo o que o Aval faz.", solo: true,
  steps: [
    { who: SELF, go: "#/entrada", target: ".bk-login-enter", show: true, feature: "app", do: "Este é o celular da Ana", why: "Ela já é cliente do BTG e vai abrir o BTG Aval pela primeira vez. O app ainda não sabe quem ela é.", done: () => false },
    { who: SELF, target: ".bk-login-enter", do: "Entre com a conta BTG", why: "Sem cadastro novo: o Aval pede ao app do BTG os dados que o banco já tem.", done: (x) => at("cadastro")(x) || Boolean(x.s.people[SELF]) },
    { who: SELF, target: '[data-action="btgAuthorize"]', do: "Autorize com biometria", why: "Como no app do banco: sem senha e sem digitar dados.", done: (x) => at("cadastro/dados")(x) || Boolean(x.s.people[SELF]) },
    { who: SELF, target: ".limits-card", show: true, feature: "credito", do: "Veja os limites dela", why: "O BTG já aprovou um limite para pagar parcelado e outro para antecipar, se ela prestar serviços.", done: () => false },
    { who: SELF, target: '[data-bind="signup.arbitration"]', do: "Marque os termos", why: "Ela confere os dados que vieram do BTG e aceita os termos e a cláusula de arbitragem.", done: (x) => Boolean(x.s.ui.drafts.signup?.arbitration) || Boolean(x.s.people[SELF]) },
    { who: SELF, target: '[data-action="importBtgAccount"]', do: "Comece a usar", why: "Pronto: a Ana já paga com Aval.", done: (x) => Boolean(x.s.people[SELF]) },
    feature("guardado", ".bk-balance", "Valor guardado no BTG", "Tudo o que ela pagar com Aval fica guardado no banco, rendendo, até ela aprovar cada entrega."),
    feature("pagar", '.bk-strip [data-action="startPayment"]', "Pagar", "Quem contrata cria o pagamento: descreve o serviço, monta os marcos e a outra pessoa confere antes."),
    feature("cobrar", '.bk-strip [data-action="startCharge"]', "Cobrar", "Quem presta o serviço cobra por link, WhatsApp ou QR na hora. Quem paga define os marcos."),
    feature("assistente", '.bk-strip [data-go="#/assistente"]', "Assistente", "Sugere os marcos, confere as fotos de cada entrega e responde dúvidas em linguagem simples."),
    feature("disputa", '.bk-strip [data-go="#/disputas"]', "Disputas", "Se algo der errado, só aquele marco fica bloqueado. O BTG media com regra clara; sem acordo, um árbitro decide."),
    feature("beneficios", '.bk-strip [data-go="#/beneficios"]', "Benefícios", "Pontos e vantagens por pagar com Aval e por indicar prestadores."),
    feature("all", ".bk-head", "Tudo isso, numa forma de pagar", "Agora três situações reais: ela paga, ela é cobrada, e tudo pelo WhatsApp."),
  ],
};

const pay = {
  title: "A contratante paga", sub: "Ana paga a pintura ao Carlos, por marcos.",
  presets: { client: { description: "pintar o apartamento todo, massa corrida e duas demãos", total: "16.000,00", dueDate: "03/11", person: "carlos", channel: "app" } },
  steps: [
    { who: SELF, go: "#/inicio", target: '[data-action="startPayment"]', do: "Toque em Pagar", why: "Ana combinou a pintura do apartamento com o Carlos: R$ 16 mil, entrega em 03/11.", done: (x) => at("combinado")(x) || Boolean(payInvite(x.s)) },
    ...agreementSteps(SELF, { charge: false, frontLoad: true, done: (x) => Boolean(payInvite(x.s)) }),
    { who: SELF, target: '[data-action="sendAgreement"]', do: "Envie para o Carlos", why: "O Carlos recebe um aviso no app e confere tudo antes de aceitar.", done: (x) => Boolean(payInvite(x.s)) },
    ...acceptSteps("carlos", "Carlos confere o valor, o prazo e os marcos que a Ana definiu.", (x) => Boolean(painting(x.s)), (s) => `#/p/${payInvite(s)?.token}`),
    { who: SELF, go: (s) => `#/pagar/${painting(s)?.id}`, target: '[data-action="openOffers"]', do: "Veja as opções de empréstimo", why: "O saldo não cobre. O banco mostra as opções lado a lado, já calculadas para este pagamento.", done: (x) => x.s.ui.sheet?.name === "ofertas" || drafted(x.s, "pay", painting(x.s)?.id) === "credit" || painting(x.s)?.status === "active" },
    { who: SELF, target: '[data-action="pickOffer"][data-product="credit"]', do: "Escolha o empréstimo na hora", why: "Parcela, total e custo por ano à vista, com a nota de crédito dela.", done: (x) => drafted(x.s, "pay", painting(x.s)?.id) === "credit" || painting(x.s)?.status === "active" },
    { who: SELF, target: '[data-action="confirmPay"]', do: "Pague", why: "Os R$ 16 mil ficam guardados no BTG. O Carlos vê que o dinheiro está lá e começa.", done: (x) => painting(x.s)?.status === "active" },
    ...deliverySteps(painting, 0, "Massa corrida aplicada e lixada em todos os cômodos.", "Carlos terminou o preparo e a massa. Ele pede a liberação do marco 1."),
    { who: SELF, go: (s) => `#/servico/${painting(s)?.id}`, target: '[data-action="openApprove"]', do: "Revise a entrega", why: "A Ana vê a foto e a conferência do assistente antes de liberar.", done: (x) => x.s.ui.sheet?.name === "aprovar" || painting(x.s)?.stages[0].status === "released" },
    { who: SELF, target: '[data-action="approveStage"]', do: "Aprove", why: "O marco 1, 60% do total, vai para a conta do Carlos. O resto continua guardado.", done: (x) => painting(x.s)?.stages[0].status === "released" },
  ],
};

const charge = {
  title: "O prestador cobra", sub: "Carlos cobra a reforma do banheiro e antecipa.",
  presets: { provider: { description: "reformar o banheiro: troca do piso, revestimento e louças", total: "18.000,00", dueDate: "20/11" } },
  steps: [
    ...chargeSteps("Agora quem começa é o Carlos: ele vai reformar o banheiro da Ana por R$ 18 mil.", (x) => Boolean(chargeInvite(x.s))),
    ...agreementSteps("carlos", { done: (x) => Boolean(chargeInvite(x.s)) }),
    { who: "carlos", target: '[data-action="sendAgreement"]', do: "Envie a cobrança", why: "Vai pelo WhatsApp com um link seguro do BTG e um código de segurança.", done: (x) => Boolean(chargeInvite(x.s)) },
    { who: "carlos", target: '[data-action="openAgreementLink"]', do: "Abra o link", why: "Agora vemos o que a Ana recebe.", done: (x) => at("p/")(x) || Boolean(bathroom(x.s)) },
    { who: SELF, target: ".code-card", show: true, do: "Confira o código", why: "O mesmo código aparece no app. Link falso não tem o código certo, e o BTG nunca pede senha por mensagem.", done: () => false },
    ...stagesSteps(chargeInvite),
    ...acceptSteps(SELF, "", (x) => Boolean(bathroom(x.s))),
    { who: SELF, target: '[data-action="askConfirm"][data-kind="insurance"]', do: "Ligue o seguro", why: "Opcional: se uma disputa terminar a favor dela, o seguro cobre o que já tinha sido pago.", done: (x) => x.s.ui.sheet?.name === "confirmar" || Boolean(bathroom(x.s)?.insurance) },
    { who: SELF, target: '[data-action="confirmToggle"]', do: "Confirme o seguro", why: "A janela mostra o que ele cobre e quanto custa.", done: (x) => Boolean(bathroom(x.s)?.insurance) },
    { who: SELF, target: '[data-action="choosePayMethod"][data-method="card"]', do: "Escolha o cartão", why: "No cartão BTG em até 12x. O valor inteiro fica guardado hoje.", done: (x) => drafted(x.s, "pay", bathroom(x.s)?.id) === "card" || bathroom(x.s)?.status === "active" },
    { who: SELF, target: '[data-action="chooseCardCount"][data-count="6"]', do: "Escolha 6x", why: "Parcela menor para quem paga. Quem recebe não espera nada a mais.", done: (x) => drafted(x.s, "card", bathroom(x.s)?.id) === 6 || bathroom(x.s)?.status === "active" },
    { who: SELF, target: '[data-action="acceptLimitIncrease"]', do: "Aumente o limite", why: "O limite não cobre. O banco oferece aumentar só o que falta, na hora.", done: (x) => (x.s.accounts[SELF]?.card.extraCents ?? 0) > 0 || bathroom(x.s)?.status === "active" },
    { who: SELF, target: '[data-action="confirmPay"]', do: "Pague", why: "Guardado no BTG até cada marco ser aprovado.", done: (x) => bathroom(x.s)?.status === "active" },
    ...deliverySteps(bathroom, 0, "Piso antigo retirado e contrapiso nivelado.", "Carlos terminou a demolição e o preparo."),
    { who: "carlos", go: (s) => `#/servico/${bathroom(s)?.id}`, target: '.offer-card [data-go^="#/antecipar"]', do: "Receba agora", why: "Oferta do banco: Carlos recebe hoje, sem esperar a aprovação da Ana, com uma taxa pequena.", done: (x) => at("antecipar")(x) || Boolean(bathroom(x.s)?.stages[0].anticipation) },
    { who: "carlos", target: ".antec-why", show: true, do: "Veja por que ele pode", why: "37 serviços concluídos, nota 4,8 e poucas disputas: a regra do banco, igual para todos, com um limite só dele.", done: () => false },
    { who: "carlos", target: '[data-action="confirmAnticipation"]', do: "Confirme", why: "O dinheiro cai na conta dele agora. O banco recebe quando a Ana aprovar o marco.", done: (x) => Boolean(bathroom(x.s)?.stages[0].anticipation) },
  ],
};

const whatsapp = {
  title: "Pelo WhatsApp", sub: "Carlos cobra e Ana paga sem abrir o app.", whatsapp: true,
  steps: [
    { who: "carlos", wa: "carlos", watch: SELF, go: "#/inicio", target: ".wa-head", show: true, feature: "whatsapp", do: "Fale com o BTG Aval", why: "O BTG reconhece o número da conta e atende no WhatsApp, com as mesmas regras do app.", done: () => false },
    { who: "carlos", wa: "carlos", watch: SELF, target: '[data-bind="wa.input"]', type: "Cobrar reparo do telhado, R$ 7.500, entrega 30/11, Rua Harmonia 410", then: '[data-action="waSend"]', do: "Escreva a cobrança", why: "Do jeito que ele fala. O BTG Aval entende valor, prazo, endereço e serviço.", done: (x) => said(x.s, "carlos") >= 1 },
    { who: "carlos", wa: "carlos", watch: SELF, target: tap("Ana Ribeiro"), do: "Escolha a Ana", why: "Um toque no contato. Não precisa digitar o celular.", done: (x) => said(x.s, "carlos") >= 2 || Boolean(waCharge(x.s)) },
    { who: "carlos", wa: "carlos", watch: SELF, target: tap("Enviar cobrança"), do: "Envie a cobrança", why: "Chega no WhatsApp da Ana, com o mesmo código de segurança do app.", done: (x) => Boolean(waCharge(x.s)) },
    { who: SELF, wa: SELF, watch: "carlos", target: tap("Usar marcos"), do: "Use os marcos sugeridos", why: "A cobrança chegou no WhatsApp da Ana. O BTG Aval sugere os marcos de um reparo de telhado; ela decide.", done: (x) => said(x.s, SELF) >= 1 || Boolean(roof(x.s)) },
    { who: SELF, wa: SELF, watch: "carlos", target: tap("Aceitar"), do: "Aceite", why: "Ela confere o resumo e aceita as regras do Aval ali mesmo, na conversa.", done: (x) => Boolean(roof(x.s)) },
    { who: SELF, wa: SELF, watch: "carlos", target: tap("Pagar com Pix"), do: "Pague com Pix", why: "Pix copia e cola, de qualquer banco, sem sair do WhatsApp.", done: (x) => x.s.wa?.threads?.[SELF]?.step === "pix" || roof(x.s)?.status === "active" },
    { who: SELF, wa: SELF, watch: "carlos", target: tap("Já paguei"), do: "Confirme o Pix", why: "Os R$ 7.500 ficam guardados no BTG, como em qualquer pagamento com Aval.", done: (x) => roof(x.s)?.status === "active" },
    { who: "carlos", wa: "carlos", watch: SELF, target: ".wa-log .wa-msg:last-child", show: true, do: "Carlos é avisado", why: "No WhatsApp dele: a Ana pagou e o dinheiro está guardado. Pode começar.", done: () => false },
  ],
};

const bank = {
  title: "O que o banco ganha", sub: "Ofertas aceitas e receita.",
  steps: [
    { who: "banco", go: "#/banco/ofertas", target: ".panel", show: true, do: "Veja o funil", why: "Cada oferta apareceu dentro de um pagamento, já calculada: empréstimo, limite, seguro e antecipação.", done: () => false },
    { who: "banco", go: "#/banco/receita", target: ".panel:has(.hbars)", show: true, do: "Veja de onde vem a receita", why: "Juros, float, seguro, tarifa e adquirência. O Aval não depende só de crédito.", done: () => false },
  ],
};

export const PITCH_CHAPTERS = [meet, pay, charge, whatsapp, bank];
