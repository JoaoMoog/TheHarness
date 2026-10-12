// The demonstration scenarios: one per chapter of the guide, told the way the audience sees them.
// Each one opens with the problem and what the Aval does (problem / solution) and closes with one sentence to keep
// (takeaway) next to the numbers the scenario produced. `pillars` says which pillars of the scope (slides.js PILLARS) it shows.

export const SCENARIOS = [
  {
    title: "O prestador cobra",
    pillars: [1, 2],
    intro: "Carlos, da Horizonte Reformas, cobra pelo WhatsApp a pintura que combinou. A cliente é do BTG, mas nunca usou o Aval: entra com a conta do banco, define os marcos e paga no cartão com seguro.",
    problem: "Quem contrata um serviço tem medo de pagar adiantado. Quem presta tem medo de não receber.",
    solution: "O Aval guarda o dinheiro no BTG e libera por marco, só quando quem paga aprova a entrega.",
    takeaway: "Uma cobrança pelo WhatsApp virou usuária nova do Aval, compra no cartão, aumento de limite e seguro, em minutos.",
  },
  {
    title: "Entregar e liberar",
    pillars: [1],
    intro: "Carlos entrega o primeiro marco e a cliente aprova. O segundo ela não aprova a tempo, e o dinheiro sai sozinho depois de 7 dias.",
    problem: "Depois de pagar, ninguém sabe quando nem como o dinheiro chega a quem trabalhou.",
    solution: "Cada entrega tem prova e prazo. Aprovou, saiu. Sem resposta em 7 dias, sai sozinho.",
    takeaway: "O prestador recebe por marco, com prova. Quem paga aprova em um toque e ainda ganha o rendimento.",
  },
  {
    title: "O cliente paga um prestador",
    pillars: [2],
    intro: "Agora quem paga abre o pagamento. A cliente descreve o serviço, monta os marcos com o assistente e paga a Marina com empréstimo na hora.",
    problem: "O saldo não cobre o serviço, e o crédito fica escondido em outra parte do app.",
    solution: "O empréstimo aparece na hora de pagar, já calculado para aquele valor, ao lado das outras opções.",
    takeaway: "O crédito é oferecido no momento exato da necessidade, e o dinheiro continua guardado.",
  },
  {
    title: "Pagar em conjunto",
    pillars: [1],
    intro: "Uma cobrança dividida por três pessoas. Uma delas não tem o app: entra pelo link do e-mail e paga com Pix.",
    problem: "Dividir uma obra entre várias pessoas vira planilha, cobrança e desconfiança.",
    solution: "Cada pessoa paga a sua parte pelo Aval. O serviço só começa quando todos pagarem.",
    takeaway: "Uma cobrança trouxe pessoas de fora do banco para dentro, cada uma com a sua conta.",
  },
  {
    title: "QR na hora",
    pillars: [1],
    intro: "Carlos está na casa da cliente. Ele gera um QR, ela lê com o celular e paga com Pix ali mesmo.",
    problem: "No serviço presencial, o pagamento é no dinheiro ou no Pix sem nenhuma garantia.",
    solution: "Um QR na hora cria o combinado no Aval. Pix de qualquer banco, guardado do mesmo jeito.",
    takeaway: "Aval também no balcão: do QR ao dinheiro guardado em segundos.",
  },
  {
    title: "Disputa",
    pillars: [1],
    intro: "A parede ficou manchada. A cliente abre uma disputa, Carlos responde e o banco propõe um acordo.",
    problem: "Quando algo dá errado, a briga vai para o Procon, para a Justiça ou para a rede social.",
    solution: "O valor do marco fica bloqueado. Os dois mostram provas e o banco media com regras claras.",
    takeaway: "Conflito resolvido dentro do app, em dias, com o dinheiro seguro o tempo todo.",
  },
  {
    title: "Antecipação",
    pillars: [2],
    intro: "Carlos não quer esperar a aprovação: recebe o marco hoje, com a taxa descontada.",
    problem: "O prestador precisa do dinheiro para comprar material e não pode esperar.",
    solution: "Com a entrega enviada, o banco antecipa o valor do marco, sem risco: o dinheiro já está guardado.",
    takeaway: "Crédito com garantia real: o banco antecipa o que já está guardado com ele.",
  },
  {
    title: "Pelo WhatsApp",
    pillars: [1],
    intro: "Carlos cobra uma pintura conversando com o BTG Aval no WhatsApp. Depois a Ana paga a Marina pelo WhatsApp, com marcos e Pix na própria conversa.",
    problem: "Nem todo mundo quer abrir mais um app para combinar um serviço. A conversa já acontece no WhatsApp.",
    solution: "O BTG Aval atende no WhatsApp: entende o que foi combinado, cria a cobrança ou o pagamento e guarda o dinheiro no BTG.",
    takeaway: "O Aval não depende do app: uma conversa no WhatsApp vira cobrança, marcos e Pix guardado no BTG.",
  },
  {
    title: "No banco",
    pillars: [3],
    intro: "O que o banco vê: as ofertas aceitas, de onde vem a receita, os riscos que ele barra e quem decidiu cada liberação.",
    problem: "Bancos oferecem crédito fora de contexto, e a conversão é baixa.",
    solution: "Cada oferta aparece dentro de um pagamento real, já calculada. O banco mede a conversão, o risco e cada decisão.",
    takeaway: "Cada pagamento com Aval é uma porta para crédito, seguro, captação e cliente novo.",
  },
];

/** The version for executives: the scenarios played (the ones in between run behind a cover). It covers the three
 * pillars of the scope: milestones (charge, deliver and release, dispute), credit and anticipation, and the bank. */
export const EXECUTIVE = [0, 1, 2, 5, 6, 7, 8];
/** Length of the executive version at normal speed in automatic mode, in minutes (estimated from the 17 min measured for 5 scenarios; shown on its buttons). */
export const EXECUTIVE_MIN = 24;
