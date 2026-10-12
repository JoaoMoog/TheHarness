import { btn, card, circle, esc, note, statusbar } from "../ui.js";

const steps = [
  {
    icon: "shield-check", title: "Bem-vindo ao Aval", intro: "Uma forma de pagar por entregas, com cada etapa à vista.",
    items: [
      ["Cobrar", "Crie uma cobrança com destinatário, descrição e valor."],
      ["Pagar", "Confira a cobrança e acompanhe a liberação do valor conforme a entrega."],
    ],
    note: "Esta versão é uma simulação. Nenhum dinheiro real é movimentado.",
  },
  {
    icon: "hand-coins", title: "Cobrar começa por quem paga", intro: "Na opção Cobrar, siga estes passos:",
    items: [
      ["Identifique quem vai pagar", "Informe telefone, CPF/CNPJ ou e-mail."],
      ["Descreva a cobrança", "Preencha descrição, valor e prazo de entrega. Revise os dados antes de enviar."],
      ["Envie e acompanhe", "Escolha como compartilhar. A cobrança fica aguardando a resposta de quem paga."],
    ],
    note: "O envio e a resposta da outra pessoa são simulados nesta versão.",
  },
  {
    icon: "wallet", title: "Confira antes de pagar", intro: "Abra uma cobrança recebida ou use a opção Pagar para criar um pagamento.",
    items: [
      ["Revise todos os dados", "Confira quem recebe, descrição, valor, prazo e regras de liberação."],
      ["Escolha como pagar", "No pagamento simulado, o valor fica reservado para ser liberado por entrega, de uma vez ou por marcos."],
    ],
    note: "Pendente não significa concluído. Confira o status e a confirmação dentro do Aval.",
  },
  {
    icon: "list-checks", title: "Acompanhe até concluir", intro: "Acesse seus pagamentos para ver entregas, prazos e valores liberados.",
    items: [
      ["Confira a entrega", "Quem recebe envia a entrega; quem paga pode aprovar, pedir ajuste ou abrir uma disputa."],
      ["Observe o prazo de resposta", "Sem resposta em 7 dias após a entrega, o marco é liberado automaticamente. Uma disputa bloqueia essa liberação."],
      ["Sua conta fica neste aparelho", "O cadastro e o código de acesso são locais. Sair encerra a sessão; seus dados continuam salvos neste aparelho."],
    ],
    note: "Você pode rever esta apresentação em Ajuda → Conhecer o Aval.",
  },
];

export function onboardingView(step) {
  const page = steps[step];
  return `<section class="screen onboarding" role="dialog" aria-modal="true" aria-labelledby="onboarding-title" aria-describedby="onboarding-intro">
    ${statusbar()}
    <header class="onboarding-header"><strong>Aval</strong>${btn("Pular", { kind: "text", action: "finishOnboarding" })}</header>
    <div class="content onboarding-content">
      <div class="onboarding-progress" aria-label="Etapa ${step + 1} de ${steps.length}">${steps.map((_, i) => `<span class="${i <= step ? "on" : ""}" aria-hidden="true"></span>`).join("")}<small>${step + 1} de ${steps.length}</small></div>
      ${circle(page.icon, "info", 64)}
      <h1 id="onboarding-title" tabindex="-1">${esc(page.title)}</h1><p id="onboarding-intro">${esc(page.intro)}</p>
      ${card(`<ol class="onboarding-list">${page.items.map(([title, text], i) => `<li><span class="onboarding-number" aria-hidden="true">${i + 1}</span><div><h2>${esc(title)}</h2><p>${esc(text)}</p></div></li>`).join("")}</ol>`)}
      ${note(page.note)}
    </div>
    <footer class="footer"><div class="btn-row">${step > 0 ? btn("Voltar", { kind: "secondary", action: "previousOnboarding" }) : ""}${btn(step === steps.length - 1 ? "Começar a usar" : "Continuar", { action: step === steps.length - 1 ? "finishOnboarding" : "nextOnboarding" })}</div></footer>
  </section>`;
}
