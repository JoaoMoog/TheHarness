import { btgBrand, btn, byEnv, card, circle, esc, note, statusbar } from "../ui.js";

// The same four pages in the app and in the presentation; only the simulation notes depend on where it runs.
const steps = [
  {
    icon: "shield-check", title: "Bem-vindo ao Aval", intro: "Uma forma de pagar por entregas, com cada marco à vista.",
    items: [
      ["Cobrar", "Crie uma cobrança com quem vai pagar, a descrição e o valor."],
      ["Pagar", "Confira a cobrança e acompanhe a liberação do valor a cada entrega."],
    ],
    note: byEnv("O dinheiro fica guardado no BTG até quem paga aprovar cada marco.", "Esta versão é uma simulação. Nenhum dinheiro real é movimentado."),
  },
  {
    icon: "hand-coins", title: "Para cobrar", intro: "Quem presta o serviço começa em Cobrar:",
    items: [
      ["Identifique quem vai pagar", "Telefone, CPF/CNPJ ou e-mail."],
      ["Descreva o serviço", "Descrição, valor e prazo de entrega. Revise antes de enviar."],
      ["Envie e acompanhe", "Escolha como compartilhar. A cobrança espera a resposta de quem paga."],
    ],
    note: byEnv("Quem paga recebe um aviso e confere tudo antes de aceitar.", "O envio e a resposta da outra pessoa são simulados nesta versão."),
  },
  {
    icon: "wallet", title: "Confira antes de pagar", intro: "Abra uma cobrança recebida ou use Pagar para criar um pagamento.",
    items: [
      ["Revise todos os dados", "Quem recebe, descrição, valor, prazo e como o dinheiro é liberado."],
      ["Escolha como pagar", byEnv("O valor fica guardado no BTG e sai por entrega, de uma vez ou por marcos.", "No pagamento simulado, o valor fica reservado para ser liberado por entrega, de uma vez ou por marcos.")],
    ],
    note: byEnv("O pagamento está feito quando aparece como guardado no BTG.", "Um pagamento pendente ainda não foi concluído. Confira a situação dentro do Aval."),
  },
  {
    icon: "list-checks", title: "Acompanhe até concluir", intro: "Em cada pagamento você vê entregas, prazos e valores liberados.",
    items: [
      ["Confira a entrega", "Quem recebe envia a entrega; quem paga aprova, pede ajuste ou abre uma disputa."],
      ["Observe o prazo de resposta", "Sem resposta em 7 dias após a entrega, o marco é liberado automaticamente. Uma disputa bloqueia essa liberação."],
      byEnv(["Tudo no app do BTG", "Sua conta, seus pagamentos e seus marcos no mesmo lugar."],
        ["Sua conta fica neste aparelho", "O cadastro e o código de acesso são locais. Sair encerra a sessão; seus dados continuam salvos neste aparelho."]),
    ],
    note: "Você pode rever esta apresentação em Ajuda → Conhecer o Aval.",
  },
];

export function onboardingView(step) {
  const page = steps[step];
  return `<section class="screen onboarding" role="dialog" aria-modal="true" aria-labelledby="onboarding-title" aria-describedby="onboarding-intro">
    ${statusbar()}
    <header class="onboarding-header">${btgBrand("aval")}${btn("Pular", { kind: "text", action: "finishOnboarding" })}</header>
    <div class="content onboarding-content">
      <div class="onboarding-progress" aria-label="Passo ${step + 1} de ${steps.length}">${steps.map((_, i) => `<span class="${i <= step ? "on" : ""}" aria-hidden="true"></span>`).join("")}<small>${step + 1} de ${steps.length}</small></div>
      ${circle(page.icon, "info", 64)}
      <h1 id="onboarding-title" tabindex="-1">${esc(page.title)}</h1><p id="onboarding-intro">${esc(page.intro)}</p>
      ${card(`<ol class="onboarding-list">${page.items.map(([title, text], i) => `<li><span class="onboarding-number" aria-hidden="true">${i + 1}</span><div><h2>${esc(title)}</h2><p>${esc(text)}</p></div></li>`).join("")}</ol>`)}
      ${note(page.note)}
    </div>
    <footer class="footer"><div class="btn-row">${step > 0 ? btn("Voltar", { kind: "secondary", action: "previousOnboarding" }) : ""}${btn(step === steps.length - 1 ? "Começar a usar" : "Continuar", { action: step === steps.length - 1 ? "finishOnboarding" : "nextOnboarding" })}</div></footer>
  </section>`;
}
