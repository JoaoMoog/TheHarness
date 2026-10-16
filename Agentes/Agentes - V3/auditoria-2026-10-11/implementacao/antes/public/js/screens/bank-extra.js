// Bank console: credit proposals (policy result plus logged exceptions) and the Seguro Aval book (policies and claims).
import { COVERAGES } from "../actions/index.js";
import { peopleOf, availableLimitOf, contractById, monthlyDebtOf } from "../store.js";
import { btn, chip, empty, esc, icon, kv, money, percent } from "../ui.js";
import { kpi, layout, panel, table, two } from "./web.js";

const BASE_BOOK_CENTS = 3_820_000_000;
const BASE_POLICIES = 412;
const DECISION = { analysis: ["Em análise", "info"], approved: ["Aprovado", "pos"], approvedLower: ["Valor menor", "warn"], denied: ["Negado", "neg"], signed: ["Contratado", "pos"], declined: ["Desistiu", "neutral"] };
const REASON = { late: "Parcela atrasada", limit: "Acima do limite", income: "Comprometimento de renda" };
const RISK_BANDS = [["A · baixo", "R$ 21,4 mi", "0,8%"], ["B · médio", "R$ 12,1 mi", "2,9%"], ["C · alto", "R$ 4,7 mi", "7,6%"]];
/** The book by days late (base numbers; above 30 days adds up to the 2,4% shown above) and the collection steps. */
const AGING = [["Em dia", "R$ 36,9 mi", "96,6%"], ["1 a 30 dias", "R$ 0,4 mi", "1,0%"], ["31 a 60 dias", "R$ 0,5 mi", "1,3%"], ["Acima de 60 dias", "R$ 0,4 mi", "1,1%"]];
const DUNNING = [["D-3", "Lembrete no app"], ["D+1", "Aviso no app e no WhatsApp"], ["D+5", "Limite pausado e antecipação bloqueada"], ["D+15", "Renegociação oferecida no app"], ["D+30", "Cobrança e negativação"]];
const latePanel = () => `<section class="panel grow late-panel"><h2>Inadimplência e régua de cobrança</h2>
  ${table(["Situação", "Saldo", "Da carteira"], AGING.map(([a, b, c], i) => [`<strong>${a}</strong>`, b, i ? `<span class="neg-text">${c}</span>` : c]))}
  <ol class="dunning">${DUNNING.map(([when, what]) => `<li><strong>${when}</strong><span>${what}</span></li>`).join("")}</ol>
  <p class="small muted">Quem atrasa perde o limite e a antecipação na hora: o risco não cresce enquanto a parcela está aberta.</p></section>`;

function creditPanel(s, r) {
  const owner = peopleOf(s)[r.owner];
  const d = r.decision;
  const commitment = (monthlyDebtOf(s, r.owner) + (d?.simulation.installmentCents ?? 0)) / r.incomeCents;
  const canDecide = r.status === "analysis";
  const canExcept = (r.status === "approvedLower" || r.status === "denied") && d?.reason !== "late";
  return panel(`${r.id} · ${owner.name}`, `${kv("Pedido", `${money(r.amountCents)} em ${r.count}x`)}${kv("Finalidade", r.purposeLabel)}${kv("Renda declarada", money(r.incomeCents))}${kv("Comprometimento com a parcela", percent(commitment))}${kv("Limite disponível", money(availableLimitOf(s, r.owner)))}${kv("Open Finance", r.openFinanceShared ? "Compartilhado" : "Não")}
    <div class="ia-box"><div class="row-between"><strong>Política de crédito</strong>${d ? chip(DECISION[r.status][0], DECISION[r.status][1]) : chip("Aguardando")}</div>${d ? `${kv("Aprovável", money(d.approvedCents))}${d.reason ? kv("Motivo", REASON[d.reason]) : ""}${kv("Taxa", `${(d.monthlyRate * 100).toFixed(2).replace(".", ",")}% a.m.`)}` : "<small>Regra fixa: limite, renda, atrasos e reputação.</small>"}<small class="muted">Decisão em código. O Aval IA não participa do crédito.</small></div>
    ${canDecide ? btn("Aplicar decisão da política", { action: "bankCreditDecide", data: { id: r.id } }) : ""}
    ${canExcept ? `${btn(`Aprovar exceção de ${money(r.amountCents)}`, { kind: "secondary", action: "bankCreditException", data: { id: r.id } })}<small class="muted">Exceções ficam na trilha de auditoria, com o nome do analista.</small>` : ""}
    ${r.exception ? `<div class="note info">${icon("check-circle")}<span>Exceção aprovada por Luiza Prado.</span></div>` : ""}`);
}

function credito(s, { item }) {
  const requests = s.creditRequests;
  const selected = requests.find((r) => r.id === item) ?? requests[0];
  const signed = s.credits.reduce((a, c) => a + c.principalCents, 0);
  const approved = requests.filter((r) => ["approved", "approvedLower", "signed"].includes(r.status)).length;
  const rows = requests.map((r) => [`<button type="button" class="cell-link" data-go="#/banco/credito/${esc(r.id)}">${two(r.id, peopleOf(s)[r.owner].name)}</button>`, `<strong>${money(r.amountCents)}</strong><small>${r.count}x · ${esc(r.purposeLabel)}</small>`, chip(DECISION[r.status][0], DECISION[r.status][1]), r.openFinanceShared ? chip("Sim", "pos") : chip("Não")]);
  return layout("credito", "Crédito", `<div class="kpis">${kpi("Carteira de crédito Aval", money(BASE_BOOK_CENTS + signed), "Crédito ao contratante")}${kpi("Crédito nesta sessão", money(signed), `${s.credits.length} contrato(s) · ${requests.length} pedido(s) de limite, ${approved} aprovado(s)`)}${kpi("Inadimplência acima de 30 dias", "2,4%", "+0,3 p.p. em 30 dias", "neg-text")}${kpi("Destino do dinheiro", "100% custódia", "Nenhum real vai direto ao cliente", "pos-text")}</div>
    <div class="split"><div class="grow">${requests.length ? table(["Proposta", "Valor", "Política", "Open Finance"], rows, requests.indexOf(selected)) : empty("Nenhum pedido de limite ainda. O empréstimo na hora usado nos pagamentos já entra na carteira.")}
      <section class="panel grow"><h2>Carteira por faixa de risco</h2>${table(["Faixa", "Saldo", "Atraso acima de 30 dias"], RISK_BANDS.map(([a, b, c]) => [`<strong>${a}</strong>`, b, c]))}</section>${latePanel()}</div>
    ${selected ? creditPanel(s, selected) : panel("Proposta", empty("Selecione uma proposta."))}</div>`);
}

function claimPanel(s, claim) {
  const c = contractById(s, claim.contractId);
  const d = s.disputes.find((x) => x.id === claim.disputeId);
  return panel(`${claim.id} · sinistro`, `${kv("Apólice", claim.policy)}${kv("Serviço", c.title)}${kv("Segurado", c.client)}${kv("Cobertura", COVERAGES[claim.coverage][0])}<p class="quote">“${esc(claim.reason)}”</p>
    <div class="ia-box"><strong>Regra de elegibilidade</strong>${kv("Disputa base", `${d.id} · encerrada`)}${kv("Devolvido à contratante", money(d.proposal.clientCents))}${kv("Liberado ao prestador", money(d.proposal.providerCents))}${kv("Franquia", money(claim.deductibleCents))}${kv("Indenização", money(claim.payoutCents), "pos-text")}<small class="muted">Elegível por regra: apólice paga e disputa decidida a favor da contratante.</small></div>
    ${claim.status === "analysis" ? `${btn("Aprovar e pagar indenização", { action: "bankApproveClaim", data: { id: claim.id } })}${btn("Recusar", { kind: "secondary", action: "bankDenyClaim", data: { id: claim.id } })}` : `<div class="note info">${icon("info")}<span>${claim.status === "paid" ? `Paga em ${esc(claim.paidAt)}.` : "Sinistro recusado."}</span></div>`}`);
}

function seguros(s, { item }) {
  const insured = s.contracts.filter((c) => c.insurance);
  const premiums = insured.filter((c) => c.insurance.paid).reduce((a, c) => a + c.insurance.premiumCents, 0);
  const arbitration = s.contracts.reduce((a, c) => a + (c.arbitrationFeeCents ?? 0), 0);
  const selected = s.claims.find((x) => x.id === item) ?? s.claims[0];
  const policyRows = insured.map((c) => [two(c.insurance.policy, c.id), two(c.title, c.client), `<strong>${money(c.insurance.coverageCents)}</strong>`, chip(c.insurance.paid ? "Ativa" : "Prêmio pendente", c.insurance.paid ? "pos" : "warn")]);
  const claimRows = s.claims.map((x) => [`<button type="button" class="cell-link" data-go="#/banco/seguros/${esc(x.id)}">${two(x.id, x.policy)}</button>`, `<strong>${money(x.payoutCents)}</strong>`, chip(x.status === "analysis" ? "Em análise" : x.status === "paid" ? "Paga" : "Recusada", x.status === "paid" ? "pos" : x.status === "analysis" ? "warn" : "neg")]);
  return layout("seguros", "Seguros", `<div class="kpis">${kpi("Apólices Seguro Aval", String(BASE_POLICIES + insured.length), "Opcional, contratado com o serviço")}${kpi("Prêmios nesta sessão", money(premiums), "Comissão de corretagem para o Aval")}${kpi("Seguro de arbitragem", money(arbitration), "Embutido em toda operação")}${kpi("Sinistralidade", "18%", "Meta abaixo de 35%", "pos-text")}</div>
    <div class="split"><div class="grow"><section class="panel grow"><h2>Apólices</h2>${table(["Apólice", "Serviço", "Cobertura", "Situação"], policyRows)}</section>
      <section class="panel grow"><h2>Sinistros</h2>${s.claims.length ? table(["Sinistro", "Indenização", "Situação"], claimRows, s.claims.indexOf(selected)) : empty("Nenhum sinistro. Eles nascem de disputas decididas a favor de quem contratou.")}</section></div>
    ${selected ? claimPanel(s, selected) : panel("Sinistro", empty("Selecione um sinistro."))}</div>`);
}

export const bankExtraRoutes = {
  "banco/credito": credito, "banco/credito/:item": credito, "banco/seguros": seguros, "banco/seguros/:item": seguros,
};
