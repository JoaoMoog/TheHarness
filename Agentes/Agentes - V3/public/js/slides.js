// The opening slides, before the live demonstration, and the closing one after it. One idea per slide: the title says
// the point, the picture proves it (assertion-evidence). Few words, one icon per idea: read at a glance. The phone
// pictures are real screens of this prototype (public/img/slides), captured from a finished executive run.

/** The three pillars of the scope: shown on the first slide, lit in the footer while the demo covers them, checked at the end. */
export const PILLARS = [
  { id: 1, icon: "lock-simple", name: "Custódia por marcos" },
  { id: 2, icon: "hand-coins", name: "Crédito e antecipação" },
  { id: 3, icon: "bank", name: "Banco" },
];

export const SLIDES = [
  {
    key: "agenda", nav: "Abertura",
    title: "Aval: a nova forma de pagar serviços do BTG",
    presenter: "João Moog · IT-CROSS",
    lead: "A cada marco aprovado, o valor segue para a conta de quem presta e é liberado no prazo do banco.",
    agenda: [
      ["O problema", "Pagar um serviço é um risco"],
      ["A solução", "Combina, guarda e libera por marco"],
      ["O negócio", "Canais e receita para o banco"],
    ],
    // The example of the "Exemplo" slide: R$ 16 mil in two milestones, the first (60%) approved.
    cards: [["lock-simple", "R$ 16 mil guardados", "no BTG, rendendo CDI"], ["check-circle", "Marco 1 aprovado", "R$ 9.600 indo para a conta do Carlos"]],
  },
  {
    key: "problem", nav: "Problema",
    title: "Pagar um serviço é um risco",
    flow: {
      steps: [["handshake", "Combina", "Ana e o prestador acertam o serviço"], ["wallet", "Paga adiantado", "R$ 16 mil por Pix, sem garantia"], ["hammer", "Espera a entrega", "O dinheiro já está com o prestador"]],
      ask: "Entregou?",
      yes: ["check-circle", "Deu certo", "Desta vez", ""],
      no: ["x", "Prejuízo", "O dinheiro já foi. Resta brigar no Procon", "neg"],
    },
    note: "Do outro lado, quem presta antes de receber corre o mesmo risco.",
  },
  {
    key: "solution", nav: "Solução",
    title: "A solução: pagar com Aval",
    lead: "O valor do serviço fica guardado no BTG e é liberado por marco. Os dois lados ganham.",
    sides: [
      ["user", "Para quem paga", [["check-circle", "Só paga pelo que foi entregue"], ["trend-up", "O dinheiro rende CDI enquanto espera"], ["credit-card", "Parcela no cartão ou com empréstimo na hora"]]],
      ["hammer", "Para quem presta", [["eye", "Vê que o valor já está guardado"], ["hand-coins", "Recebe a cada marco, ou antecipa"], ["scales", "Se houver conflito, a mediação do BTG decide"]]],
    ],
    hub: ["seal-check", "Aval", "nova forma de pagar serviços"],
  },
  {
    key: "milestones", nav: "Marcos",
    title: "O dinheiro só sai quando o marco é aprovado",
    analogy: ["hard-hat", "Como uma obra financiada pela Caixa"],
    // The same example as the cover and the "Exemplo" slide; the bar shows a bigger job.
    flow: {
      steps: [["handshake", "Combina", "Carlos manda o combinado e a Ana aceita"], ["lock-simple", "Paga com Aval", "R$ 16 mil guardados no BTG, rendendo CDI"], ["camera", "Entrega o marco", "Com fotos e descrição no app"]],
      ask: "Ana aprova?", hint: "7 dias sem resposta: aprovado",
      yes: ["check-circle", "Valor para o Carlos", "Vai para a conta dele e é liberado no prazo do banco", "pos"],
      no: ["scales", "Mediação do BTG", "Só esse marco fica bloqueado até a decisão", "accent"],
      loop: "Próximo marco: repete até o último",
      bar: { label: "Numa obra: quantos marcos precisar", stages: [["Demolição", 20], ["Instalações", 30], ["Acabamento", 30], ["Vistoria final", 20]] },
    },
  },
  {
    key: "channels", nav: "Canais",
    title: "Um pagamento que entra em qualquer canal do banco",
    channels: [
      ["device-mobile", "BTG Aval", "no app", { shot: "servico.png" }],
      ["cash-register", "BTG Pay", "na maquininha", { photo: ["btg-pay.webp", "Maquininha BTG Pay"] }],
      ["whatsapp-logo", "BTG Aval", "no WhatsApp", { shot: "whatsapp.png" }],
      ["code", "API", "sistemas do banco", { code: true }],
    ],
    hub: ["lock-simple", "Pagar com Aval", "Mesmos marcos e mesmas regras em todo canal"],
  },
  {
    key: "revenue", nav: "Receita",
    title: "Um pagamento, várias fontes de receita",
    lead: "O Aval conecta a operação, a proteção do serviço e a infraestrutura do banco.",
    groups: [
      { name: "Pagamento", line: "Na operação", items: [
        ["receipt", "Tarifa", "Por contrato"], ["percent", "Juros", "Crédito e antecipação"], ["piggy-bank", "Float", "Dinheiro guardado"],
      ] },
      { name: "Proteção", line: "No serviço", items: [
        ["shield-check", "Seguro", "Opcional, de quem paga"], ["scales", "Arbitragem", "Seguro embutido"],
      ] },
      { name: "Infraestrutura", line: "Na escala", items: [
        ["cash-register", "MDR", "BTG Pay"], ["gear", "Licença", "Uso da infraestrutura"], ["chart-line-up", "Funding", "FIDC com lastro"],
      ] },
    ],
    note: "Modelo proposto. As fontes dependem do meio de pagamento e dos serviços contratados.",
  },
  {
    key: "case", nav: "Exemplo",
    title: "A pintura do apartamento da Ana",
    deal: { from: ["user", "Ana", "contrata"], to: ["paint-roller", "Carlos", "pintor"], thousands: 16, due: "03/11", stages: [["Preparo e massa", 60], ["Pintura e acabamento", 40]] },
  },
];

/** One icon and one word for each scenario, for the agenda (same order as SCENARIOS). */
export const SCENARIO_CHIP = [
  ["hand-coins", "Cobrar"], ["check-circle", "Marcos"], ["wallet", "Pagar"], ["users-three", "Em conjunto"], ["qr-code", "QR"],
  ["scales", "Disputa"], ["lightning", "Antecipar"], ["whatsapp-logo", "WhatsApp"], ["bank", "Banco"],
];
