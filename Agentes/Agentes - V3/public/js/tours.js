// What each screen means, for someone who never saw the app. The scenario player shows these balloons the first time
// a screen appears on the phone of the person acting (or on the bank page), before the next click.
// route: the screen; when: an element that must be on screen (a sheet, for example); points: [target, title, text].
// Targets are looked up inside the acting phone (or the bank page); a point whose target is missing is skipped.

export const TOURS = [
  {
    key: "inicio", route: /^inicio$/,
    points: [
      [".bk-balance", "Valor guardado", "O dinheiro guardado no BTG: já foi pago, mas ainda não saiu para quem recebe."],
      [".bk-lines", "Como pagar", "O saldo da conta e o empréstimo na hora. O crédito aparece no momento de pagar, já calculado."],
      [".bk-strip", "Cobrar e Pagar", "Tudo começa aqui. Quem presta o serviço cobra; quem contrata paga. Os dois com Aval."],
    ],
  },
  {
    key: "combinado1", route: /^combinado\/1$/,
    points: [
      [".ai-field", "O que foi combinado", "A pessoa escreve do jeito dela. O botão de IA deixa a descrição clara, para não haver dúvida depois."],
      ['label:has([data-bind="ag.total"])', "Valor e prazo", "O valor combinado e a data de entrega. É isso que vai ficar guardado e ser cobrado."],
      [".switch-row", "Serviço todo mês", "Para limpeza ou piscina: ao ligar, uma janela explica como funciona antes de confirmar."],
    ],
  },
  {
    key: "combinado2", route: /^combinado\/2$/,
    points: [
      [".ai-card", "O assistente monta os marcos", "Ele conhece o tipo de serviço e sugere as partes e os valores. Quem paga decide."],
      ['[data-action="chooseRelease"][data-release="stages"]', "Por marcos", "Cada parte só sai quando aquele marco é aprovado. Bom para obras e reformas."],
    ],
  },
  {
    key: "combinado3", route: /^combinado\/3$/,
    points: [
      ['[data-action="chooseChannel"][data-channel="whatsapp"]', "Três jeitos de enviar", "Aviso no app, link no WhatsApp ou QR na hora. Quem não tem conta abre uma pelo link."],
      [".card:has(.amount)", "O resumo", "O que vai ser cobrado, com prazo e endereço. A outra pessoa vê exatamente isso."],
    ],
  },
  {
    key: "enviado", route: /^combinado\/enviado\//,
    points: [
      [".wa-bubble", "A mensagem do WhatsApp", "Pronta para enviar, com um link seguro do BTG."],
      [".undo-bar", "Dá para desfazer", "Por 10 segundos, quem enviou pode desfazer, como num e-mail."],
    ],
  },
  {
    key: "link", route: /^p\//,
    points: [
      [".card:has(.amount)", "O combinado", "Quem recebe a cobrança confere valor, prazo e endereço antes de qualquer pagamento."],
      [".card:has(.protect-line)", "Como o Aval funciona", "Três regras simples: fica guardado, sai quando quem paga aprova, e sem resposta em 7 dias sai sozinho."],
    ],
  },
  {
    key: "cadastro", route: /^cadastro\/dados$/,
    points: [[".card:has(.kv)", "Dados do próprio BTG", "Nada de formulário: ela já é cliente, então os dados vêm da conta BTG, com a biometria."]],
  },
  {
    key: "etapas", route: /^etapas\//,
    points: [
      [".ms-card", "A sugestão do assistente", "Os marcos e os valores para este tipo de serviço. Cada marco vira um valor guardado separado."],
      [".footer .asst-chips", "Ajuste conversando", "Mais marcos, menos marcos ou valor único. Também responde dúvidas."],
    ],
  },
  {
    key: "ofertas", route: /^pagar\//, when: ".offer-cols",
    points: [
      [".offer-cols", "As opções lado a lado", "Parcela, total e custo de cada opção do banco, já calculados para este pagamento."],
      [".note-card", "A nota de crédito", "Mostra a nota da pessoa e como melhorar, sempre ligada a pagar bem."],
    ],
  },
  {
    key: "pagar", route: /^pagar\//,
    points: [
      [".offer-card", "Oferta na hora certa", "O saldo não cobre, então o banco oferece o empréstimo, já calculado para este valor."],
      [".switch-row", "Seguro opcional", "Se uma disputa terminar a favor de quem paga, o seguro cobre o que já tinha sido pago."],
      [".pay-summary", "Qualquer forma de pagar", "Saldo, empréstimo, cartão ou Pix: em todas, o dinheiro fica guardado até a aprovação."],
    ],
  },
  {
    key: "servico", route: /^servico\//,
    points: [
      [".card:has(.progress)", "Liberado e guardado", "Quanto já saiu para quem trabalhou e quanto continua guardado no banco."],
      [".now-bar", "O que acontece agora", "Quem precisa fazer o quê, e até quando. Os dois lados veem a mesma coisa."],
      [".timeline", "A linha do tempo", "Cada passo do pagamento, do combinado até a última liberação."],
    ],
  },
  {
    key: "entrega", route: /^entrega\//,
    points: [
      [".attach-grid", "A prova da entrega", "Fotos, vídeo, documento ou localização. Fica registrado no contrato."],
      ['label:has([data-bind="entrega.description"])', "O que foi feito", "Uma descrição curta, que o assistente compara com o que foi combinado."],
    ],
  },
  {
    key: "aprovar", route: /^servico\//, when: ".sheet .ai-card",
    points: [
      [".sheet .ai-card", "O assistente confere", "Ele verifica se as fotos e a descrição batem com o marco. A decisão é de quem paga."],
      [".sheet .card:has(.warn-text)", "Sinais de atenção", "O banco avisa quando algo parece estranho, como um marco grande feito no mesmo dia."],
    ],
  },
  {
    key: "dividir", route: /^dividir-pagamento\//,
    points: [['.card:has([data-bind="novo.splitContact"])', "Quem paga junto", "Convida pelo celular ou e-mail. Quem não tem o app paga pelo link, com Pix."]],
  },
  {
    key: "disputa", route: /^disputa\/nova\//,
    points: [
      ['label:has([data-bind="disputa.report"])', "O que aconteceu", "Quem paga conta o problema e anexa provas, tudo pelo app."],
      [".card:has(.neg-text)", "O dinheiro fica bloqueado", "O valor do marco não sai para ninguém até a decisão."],
    ],
  },
  {
    key: "fila", route: /^banco\/fila/,
    points: [
      [".filters", "A fila do banco", "Disputas e riscos em um lugar só, ordenados por valor em jogo e prazo."],
      [".table", "Cada caso", "Com a versão e as provas dos dois lados. Uma pessoa do banco decide."],
    ],
  },
  {
    key: "antecipar", route: /^antecipar\//,
    points: [
      [".card:has(.amount)", "Quanto cai hoje", "O valor que entra na conta do prestador agora, sem esperar a aprovação."],
      [".card:has(.pos-text)", "A conta", "95% do marco, menos a taxa. O banco recebe quando o marco for liberado."],
    ],
  },
  {
    key: "ofertas-banco", route: /^banco\/ofertas$/,
    points: [[".kpis", "O resultado para o banco", "Ofertas mostradas e aceitas, receita e dinheiro captado. Inclui os cenários que rodaram por trás da apresentação."]],
  },
];
