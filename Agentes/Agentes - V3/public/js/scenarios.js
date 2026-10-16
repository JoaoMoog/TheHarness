// The demonstration scenarios: one per chapter of the guide, told the way the audience sees them.
// Each one opens with the problem and what the Aval does (problem / solution) and closes with one sentence to keep
// (takeaway) next to the numbers the scenario produced. `pillars` says which pillars of the scope (slides.js PILLARS) it shows.

const FULL_DEMO = [
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
    title: "A contratante paga",
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

/**
 * The executive pitch, told with only Ana (who pays) and Carlos (who does the job): the phone and what the Aval does,
 * then she pays him, he charges her, the same on WhatsApp, and what the bank gets. `facts` replace the problem and
 * solution on the opening card (the slides already told them).
 */
const PITCH = [
  {
    title: "Conheça o BTG Aval",
    pillars: [1, 2],
    facts: [["user", "Ana Ribeiro · cliente BTG"], ["paint-roller", "vai contratar uma pintura"], ["device-mobile", "abre o BTG Aval pela primeira vez"]],
    intro: "Este é o celular da Ana. Ela entra com a conta do BTG, sem cadastro novo, e vê tudo o que o Aval faz.",
    takeaway: "Uma cliente do BTG começa a pagar com Aval em segundos, com os dados e os limites que o banco já tem.",
  },
  {
    title: "A contratante paga o prestador",
    pillars: [1, 2],
    facts: [["user", "Ana · contratante"], ["paint-roller", "Carlos · prestador"], ["hand-coins", "R$ 16 mil · empréstimo na hora"]],
    intro: "Ana combinou a pintura do apartamento com o Carlos por R$ 16 mil. Ela cria o pagamento, define os marcos, paga com o empréstimo na hora e libera o primeiro marco quando ele entrega.",
    takeaway: "Quem paga só libera o que foi entregue. Quem presta vê o dinheiro guardado antes de começar.",
  },
  {
    title: "O prestador cobra a contratante",
    pillars: [1, 2],
    facts: [["hammer", "Carlos · prestador"], ["user", "Ana · contratante"], ["credit-card", "R$ 18 mil · cartão em 6x"]],
    intro: "Agora o Carlos cobra a reforma do banheiro. A Ana confere o código, define os marcos e paga no cartão em 6x com seguro. Carlos entrega e recebe hoje, antecipado.",
    takeaway: "Uma cobrança vira compra no cartão, aumento de limite, seguro e antecipação, tudo dentro do mesmo pagamento.",
  },
  {
    title: "Pelo WhatsApp do BTG Aval",
    pillars: [1],
    facts: [["whatsapp-logo", "sem abrir o app"], ["hammer", "Carlos cobra conversando"], ["qr-code", "Ana paga com Pix na conversa"]],
    intro: "Carlos cobra o reparo do telhado escrevendo para o BTG Aval no WhatsApp. A Ana recebe a cobrança no WhatsApp dela, escolhe os marcos e paga com Pix ali mesmo.",
    takeaway: "O Aval não depende do app: uma conversa vira cobrança, marcos e Pix guardado no BTG.",
  },
  {
    title: "O que o banco ganha",
    pillars: [3],
    facts: [["bank", "visão do BTG"], ["chart-line-up", "ofertas aceitas"], ["receipt", "de onde vem a receita"]],
    intro: "O que esta apresentação gerou para o banco: as ofertas aceitas dentro dos pagamentos e a receita de cada uma.",
    takeaway: "Cada pagamento com Aval é uma porta para crédito, seguro, captação e cliente novo.",
  },
];
export const SCENARIOS = [...FULL_DEMO, ...PITCH];

/** The orders the scenarios are told in. The executive pitch has its own chapters; the full demo keeps the nine. */
export const TRACKS = { executive: [9, 10, 11, 12, 13], full: [0, 1, 2, 3, 4, 5, 6, 7, 8] };
export const EXECUTIVE = TRACKS.executive;
/** Length of the executive pitch at normal speed, in minutes (shown on its buttons). */
export const EXECUTIVE_MIN = 12;
/** True for the scenarios of the executive pitch, told as "parts" with a short opening card. */
export const isPitch = (index) => EXECUTIVE.includes(index);
/** The scenario after this one in its own track, or null at the end. */
export function nextInTrack(index) {
  const track = Object.values(TRACKS).find((t) => t.includes(index)) ?? [];
  return track[track.indexOf(index) + 1] ?? null;
}
