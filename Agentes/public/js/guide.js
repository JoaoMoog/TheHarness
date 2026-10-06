// Presenter side notes for a presentation that starts from zero: what to do next, per person and side of the account.
import { esc } from "./ui.js";

const STEPS = {
  "voce:contratante": [
    ["Entrar com a conta Nexo", "Abre o app Nexo, autoriza e volta com os dados", "#/cadastro"],
    ["Contratar a Horizonte Reformas", "Novo serviço com etapas e custódia", "#/novo/1"],
    ["Aceitar como Carlos", "Troque para Carlos no topo e aceite o convite", "#/inicio"],
    ["Pagar o serviço", "Cartão em até 12x, Pix, saldo ou crédito Aval", "#/servicos"],
    ["Dividir um serviço", "Pagamento em conjunto: cada pessoa paga a sua parte", "#/novo/1"],
    ["Aprovar a etapa entregue", "O dinheiro sai da custódia para o prestador", "#/servicos"],
    ["Abrir uma disputa", "Quando a entrega não ficou como combinado", "#/disputas"],
    ["Pedir crédito", "Decisão na hora pelas regras do banco", "#/credito"],
  ],
  "voce:prestador": [
    ["Mandar um orçamento à Marina", "Ela aceita e paga com custódia", "#/orcamento/novo"],
    ["Gerar um Aval Link", "Cobrança com custódia pelo WhatsApp", "#/link/novo"],
    ["Cobrar na maquininha", "O cliente aceita no terminal", "#/pos"],
    ["Enviar a entrega de uma etapa", "Descrição e fotos para o contratante aprovar", "#/servicos"],
    ["Antecipar uma etapa", "Receba hoje o que está em custódia", "#/agenda"],
  ],
  "carlos:prestador": [
    ["Aceitar o convite", "Pode pedir uma entrada antes de começar", "#/inicio"],
    ["Enviar a entrega da etapa 1", "O contratante aprova e a etapa é liberada", "#/servicos"],
    ["Antecipar a etapa", "Receba hoje o que está em custódia", "#/agenda"],
    ["Cobrar na maquininha", "Parte de quem divide o serviço, no cartão", "#/servicos"],
  ],
  "carlos:contratante": [
    ["Pagar a sua parte", "Quando um serviço dividido incluir a Horizonte", "#/inicio"],
    ["Contratar quem se cadastrou", "Novo serviço para a pessoa da apresentação", "#/novo/1"],
  ],
  "marina:contratante": [
    ["Pagar a sua parte", "Quando um serviço dividido incluir a Marina", "#/inicio"],
    ["Aceitar um orçamento", "Enviado por quem se cadastrou", "#/inicio"],
  ],
  "marina:prestador": [
    ["Aceitar um convite", "Quando alguém contratar a Marina Costa Interiores", "#/inicio"],
    ["Enviar uma entrega", "O contratante aprova e a etapa é liberada", "#/servicos"],
  ],
};

export function guide(s) {
  const steps = STEPS[`${s.session.person}:${s.session.mode}`] ?? [];
  return `<aside class="guide" aria-label="Roteiro sugerido"><h2>Roteiro sugerido</h2><ol>${steps.map(([t, d, g]) => `<li><button type="button" data-go="${esc(g)}"><strong>${esc(t)}</strong><small>${esc(d)}</small></button></li>`).join("")}</ol><p>Comece entrando com a conta Nexo. Troque de pessoa no topo para fazer o outro lado: cada pessoa contrata e presta, nas abas Contratante e Prestador do Início. O relógio avança os prazos.</p></aside>`;
}
