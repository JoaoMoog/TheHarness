// Presenter side notes: what to try next, per person and side of the account.
import { esc } from "./ui.js";

const STEPS = {
  "marina:contratante": [
    ["Buscar \"trocar a fiação\"", "Nexo Serviços: Aval IA entende a categoria e ordena", "#/buscar"],
    ["Fazer um pedido", "Até 4 orçamentos; +1 dia traz mais um", "#/pedido/novo/1"],
    ["Comparar orçamentos do PD-101", "Aceite vira contrato com custódia", "#/pedido/PD-101"],
    ["Contratar um anúncio com preço", "Troca de fiação do Paulo Reis", "#/anuncio/AN-01"],
    ["Aprovar a etapa 2 da reforma", "Conferência do Aval IA e cascata para o eletricista", "#/servico/AV-2026-001"],
    ["Pedir crédito de R$ 15.000", "Negado com parcela atrasada; aprovado depois", "#/credito"],
    ["Pagar a parcela atrasada", "O crédito volta na hora", "#/financeiro"],
    ["Trazer dados do Open Finance", "Aumenta o pré-aprovado", "#/open-finance"],
    ["Contratar com Seguro Aval", "Prêmio e arbitragem no resumo", "#/novo/1"],
    ["Pedir ao Aval IA", "quero financiar a reforma da cozinha", "#/ia"],
    ["Ver o app Nexo por fora", "O Aval dentro do Nexo Banking", "#/nexo"],
    ["Ligar o Pix Automático", "Parcelas e piscina pagas no vencimento", "#/financeiro"],
  ],
  "marina:prestador": [
    ["Responder o pedido da Ana Lima", "Projeto de interiores em Pinheiros", "#/oportunidade/PD-105"],
    ["Enviar a entrega do projeto 3D", "Depois use +7 dias: confirmação tácita", "#/servico/AV-2026-040"],
    ["Antecipar a etapa enviada", "Limite de antecipação próprio", "#/financeiro"],
    ["Ver as contas conectadas", "PF para contratar, MEI para receber", "#/contas"],
    ["Ver as notas fiscais", "NFS-e emitida a cada liberação", "#/notas"],
  ],
  "carlos:prestador": [
    ["Ver oportunidades perto", "Responder é grátis; taxa só se fechar", "#/oportunidades"],
    ["Criar um anúncio", "Telefone no texto é barrado pela Aval IA", "#/anuncios/novo"],
    ["Impulsionar a vitrine", "Destaque de 7 dias, selo Patrocinado", "#/vitrine"],
    ["Mandar um orçamento à Marina", "Modelo de etapas ou sugestão do Aval IA", "#/orcamento/novo"],
    ["Cobrar na maquininha", "Cliente aceita no terminal e paga pelo link", "#/pos"],
    ["Gerar um Aval Link", "Checkout com custódia pelo WhatsApp", "#/link/novo"],
    ["Ver a agenda de recebíveis", "Antecipação parcial ou automática", "#/agenda"],
    ["Subcontratar o acabamento", "Liberado em cascata com a etapa da Marina", "#/subcontratar/AV-2026-001/2"],
    ["Aceitar um convite", "Crie antes um serviço como Marina", "#/servicos"],
    ["Enviar a entrega da etapa 3", "Conferência item a item pelo Aval IA", "#/servico/AV-2026-001"],
    ["Antecipar a etapa 2", "Requisitos checados em código", "#/antecipar/AV-2026-001/1"],
    ["Cobrar Rafael na maquininha", "Cartão Elo entra na custódia", "#/maquininha/AV-2026-014"],
  ],
  "carlos:contratante": [
    ["Ver o subcontrato do eletricista", "Liberado em cascata quando Marina aprovar", "#/servico/AV-2026-044"],
    ["Contratar um fornecedor", "Horizonte também contrata", "#/novo/1"],
  ],
};

export function guide(s) {
  const steps = STEPS[`${s.session.person}:${s.session.mode}`] ?? [];
  return `<aside class="guide" aria-label="Roteiro sugerido"><h2>Roteiro sugerido</h2><ol>${steps.map(([t, d, g]) => `<li><button type="button" data-go="${esc(g)}"><strong>${esc(t)}</strong><small>${esc(d)}</small></button></li>`).join("")}</ol><p>Troque de pessoa no topo. Cada uma contrata e presta: use Contratando e Prestando no Início. O relógio avança prazos de verdade.</p></aside>`;
}
