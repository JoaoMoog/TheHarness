// What the BTG Aval does, for the features map beside Ana's phone in the opening of the pitch. Grouped by the three
// pillars of the scope; each item: [key, icon, name, part of the pitch where it is shown live (or null)].
// The guide steps of that opening light an item by its key (guide-pitch.js `feature`); "all" lights every one.

export const FEATURE_GROUPS = [
  {
    icon: "lock-simple", name: "Custódia por marcos",
    items: [
      ["guardado", "lock-simple", "Dinheiro guardado no BTG até a aprovação", 2],
      ["pagar", "wallet", "Pagar um serviço", 2],
      ["cobrar", "hand-coins", "Cobrar um serviço", 3],
      ["assistente", "sparkle", "Marcos sugeridos pelo assistente", 2],
      ["entrega", "camera", "Entrega com prova e liberação em 7 dias", 2],
      ["disputa", "scales", "Disputa com mediação do BTG", null],
      ["conjunto", "users-three", "Pagar em conjunto e QR na hora", null],
    ],
  },
  {
    icon: "hand-coins", name: "Crédito e antecipação",
    items: [
      ["credito", "hand-coins", "Empréstimo na hora de pagar", 2],
      ["cartao", "credit-card", "Cartão em até 12x, com mais limite", 3],
      ["seguro", "shield-check", "Seguro do serviço", 3],
      ["antecipar", "lightning", "Antecipação para quem presta", 3],
      ["beneficios", "star", "Pontos e benefícios", null],
    ],
  },
  {
    icon: "bank", name: "Canais e banco",
    items: [
      ["app", "device-mobile", "App BTG Aval", 1],
      ["whatsapp", "whatsapp-logo", "WhatsApp do BTG Aval", 4],
      ["pay", "cash-register", "BTG Pay na maquininha", null],
      ["api", "code", "API para outros sistemas do banco", null],
      ["banco", "chart-line-up", "Ofertas, receita e risco para o banco", 5],
    ],
  },
];
