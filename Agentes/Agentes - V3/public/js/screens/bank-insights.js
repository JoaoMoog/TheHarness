// Bank website, wave 4: revenue by source, structured funding, collusion, compliance and API.
import { FUNDING, fundingBook } from "../actions/index.js";
import { FLOAT_MONTHLY, INSURANCE_COMMISSION, MDR_RATE, TRANSACTION_FEE_CENTS, contractEconomics } from "../domain/economics.js";
import { now, parseDdMm, today } from "../store.js";
import { btn, chip, empty, esc, icon, kv, money, percent } from "../ui.js";
import { kpi, layout, panel, table } from "./web.js";

const MONTH_BASE = {
  interest: 41_200_000, float: 26_800_000, transaction: 9_600_000, insurance: 5_400_000, arbitration: 3_800_000, mdr: 7_100_000, funding: 0, saas: 18_000_000,
};
const SOURCE_LABEL = {
  interest: "Participação nos juros", float: "Float da custódia", transaction: "Taxa por transação", insurance: "Seguro da operação",
  arbitration: "Seguro de arbitragem", mdr: "Adquirência (MDR)", funding: "Funding estruturado (emissão)", saas: "Licenciamento da infraestrutura",
};

/** This demo's own contribution to each revenue source, computed from the session state. */
function sessionRevenue(s) {
  const interest = s.credits.reduce((a, c) => a + Math.max(0, c.installmentCents * c.count - c.principalCents), 0);
  const custody = s.contracts.reduce((a, c) => a + Math.max(0, c.paidInCents - c.refundedCents), 0);
  const premiums = s.contracts.filter((c) => c.insurance?.paid).reduce((a, c) => a + c.insurance.premiumCents, 0);
  const pos = s.ledger.filter((l) => l.label.startsWith("Entrada maquininha")).reduce((a, l) => a + l.amountCents, 0);
  return {
    interest, float: Math.round(custody * FLOAT_MONTHLY), transaction: s.contracts.length * TRANSACTION_FEE_CENTS, insurance: Math.round(premiums * INSURANCE_COMMISSION),
    arbitration: s.contracts.reduce((a, c) => a + (c.arbitrationFeeCents ?? 0), 0), mdr: Math.round(pos * MDR_RATE), funding: s.funding.feeCents ?? 0, saas: 0,
  };
}

const ECON_LABEL = {
  creditInterest: "Juros do empréstimo na hora", cardInterest: "Juros do cartão", insurance: "Comissão do seguro (20% do prêmio)", anticipation: "Taxa de antecipação",
  arbitration: "Seguro de arbitragem", transaction: "Tarifa por transação", float: "Float da custódia (1 mês)",
};

/** One contract inside out: what the bank earns on it, line by line, and who pays each line. */
function contractPanel(s) {
  const first = [...s.contracts].reverse().find((c) => c.status !== "awaitingPayment");
  const e = first && contractEconomics(s, first.id);
  if (!e) return "";
  return `<section class="panel econ-panel"><h2>Um contrato por dentro</h2><small class="muted">${esc(first.id)} · ${esc(first.title)} · ${money(first.totalCents)}</small>
    ${table(["Linha", "Quem paga", "Receita"], e.rows.map((r) => [esc(ECON_LABEL[r.source]), esc(r.payer), `<strong>${money(r.cents)}</strong>`]))}
    ${kv("Receita do banco neste contrato", money(e.totalCents), "pos-text")}${kv("Sobre o valor do serviço", percent(e.share))}</section>`;
}

function receita(s) {
  const own = sessionRevenue(s);
  const rows = Object.keys(MONTH_BASE).map((k) => ({ k, value: MONTH_BASE[k] + own[k], own: own[k] })).sort((a, b) => b.value - a.value);
  const max = Math.max(...rows.map((r) => r.value));
  const total = rows.reduce((a, r) => a + r.value, 0);
  const bars = rows.map((r) => `<div class="hbar"><span class="hbar-label">${esc(SOURCE_LABEL[r.k])}</span><span class="hbar-track"><span class="hbar-fill" style="width:${(r.value / max) * 100}%" title="${esc(SOURCE_LABEL[r.k])}: ${money(r.value)}"></span></span><strong>${money(r.value)}</strong></div>`).join("");
  return layout("receita", "Receita do Aval", `<div class="kpis">${kpi("Receita no mês", money(total), "8 fontes, nenhuma depende só de juros")}${kpi("Contas BTG abertas pelo Aval", "1.940", "+212 em 30 dias", "pos-text")}${kpi("Clientes com 2 produtos ou mais", "38%", "Seguros, investimentos e cartão", "pos-text")}${kpi("Crédito com garantia de custódia", "100%", "Dinheiro sempre vinculado a um serviço", "pos-text")}</div>
    <div class="split"><section class="panel grow"><h2>Receita por fonte</h2><small class="muted">R$ · mês corrente · inclui o que esta demonstração gerou</small><div class="hbars">${bars}</div><details><summary>Ver como tabela</summary>${table(["Fonte", "Mês", "Desta demonstração"], rows.map((r) => [esc(SOURCE_LABEL[r.k]), money(r.value), money(r.own)]))}</details></section>
    <section class="panel"><h2>Resultado para o BTG</h2>${kv("Novas contas por mês", "212")}${kv("Crédito mais qualificado", "Garantido por custódia")}${kv("Inadimplência do crédito Aval", "2,4% contra 5,1% no pessoal")}${kv("Venda cruzada", "Seguros, investimentos, cartão")}${kv("Novo produto de funding", s.funding.issued ? "FIDC emitido" : "FIDC pronto para emitir")}<p class="small muted">O Aval nasce independente e já gera receita sozinho; o BTG Serviços é mais um canal que se liga por API.</p></section></div>${contractPanel(s)}`);
}

function funding(s) {
  const book = fundingBook(s);
  const senior = Math.round(book.total * FUNDING.seniorShare);
  const issued = s.funding.issued;
  const volume = s.funding.volumeCents ?? book.total;
  const investors = [["Clientes BTG Investimentos", Math.round(volume * 0.56), "Cota sênior"], ["Family offices", Math.round(volume * 0.24), "Cota sênior"], ["BTG (tesouraria)", Math.round(volume * 0.2), "Cota subordinada"]];
  return layout("funding", "Funding estruturado", `<div class="kpis three">${kpi("Carteira elegível", money(book.total), "Crédito Aval e recebíveis em custódia")}${kpi("Cota sênior", money(senior), FUNDING.seniorRate)}${kpi("Cota subordinada", money(book.total - senior), FUNDING.subordinateRate)}</div>
    <div class="split"><section class="panel grow"><h2>${esc(FUNDING.name)}</h2>${kv("Crédito ao contratante", money(book.credit))}${kv("Recebíveis em custódia", money(book.custody))}${kv("Lastro", "Contratos com custódia por marco")}${kv("Taxa de estruturação", percent(FUNDING.structuringFee))}
      ${issued ? `<div class="note pos">${icon("check-circle")}<span>Emitido em ${esc(s.funding.at)} · ${money(s.funding.volumeCents)} · receita de estruturação ${money(s.funding.feeCents)}</span></div>${table(["Investidor", "Volume", "Classe"], investors.map(([a, b, c]) => [`<strong>${a}</strong>`, money(b), c]))}` : btn("Emitir e distribuir", { action: "issueFunding", iconName: "chart-line-up" })}</section>
    <section class="panel"><h2>Por que funciona</h2><p class="small">Cada real do fundo está ligado a um serviço com marcos, custódia e seguro de arbitragem. O risco é de execução da obra, não de uso livre do dinheiro.</p>${kv("Perda esperada", "1,2% a.a.")}${kv("Subordinação", percent(1 - FUNDING.seniorShare))}</section></div>`);
}

// Threshold simulator: a synthetic calibration set (phase 6) plus this session's real readings
const PAIRS = [
  { pair: "Paulo Reis ↔ Volt Serviços", contracts: 14, value: "R$ 186.400", approval: "38 min", anticipation: "100%", risk: "high" },
  { pair: "Lia Torres ↔ Verde Vivo", contracts: 3, value: "R$ 9.600", approval: "2 dias", anticipation: "0%", risk: "low" },
  { pair: "Marina Costa ↔ Horizonte Reformas", contracts: 2, value: "R$ 30.000", approval: "3 dias", anticipation: "50%", risk: "low" },
  { pair: "Carla Dias ↔ Fix Já Manutenção", contracts: 6, value: "R$ 41.900", approval: "4 h", anticipation: "83%", risk: "medium" },
];
function conluio(s) {
  const blocked = new Set(s.blacklist.map((b) => b.value));
  const riskChip = { high: chip("Padrão de simulação de crédito", "neg"), medium: chip("Acompanhar", "warn"), low: chip("Normal", "pos") };
  const rows = PAIRS.map((p) => [`<strong>${esc(p.pair)}</strong>`, String(p.contracts), p.value, p.approval, p.anticipation, blocked.has(p.pair) ? chip("Bloqueado", "neg") : riskChip[p.risk], p.risk === "high" && !blocked.has(p.pair) ? btn("Bloquear par", { kind: "danger small", action: "blockPair", data: { pair: p.pair } }) : ""]);
  return layout("conluio", "Risco e conluio", `<div class="kpis three">${kpi("Pares monitorados", "3.418", "Contratante e prestador juntos")}${kpi("Pares em alerta", String(PAIRS.filter((p) => p.risk !== "low").length), "Regras de frequência, tempo e antecipação")}${kpi("Lista negra", String(s.blacklist.length), "Documentos, aparelhos e pares")}</div>
    <section class="panel grow"><h2>Pares contratante e prestador · 30 dias</h2>${table(["Par", "Contratos", "Valor", "Aprovação média", "Antecipado", "Sinal", ""], rows)}<p class="small muted">Regra: muitos contratos entre as mesmas partes, aprovação em minutos e antecipação total indicam crédito simulado ou lavagem. Toda decisão de bloqueio pode ser contestada.</p></section>
    <section class="panel grow"><h2>Lista negra compartilhada</h2>${table(["Tipo", "Item", "Motivo"], s.blacklist.map((b) => [esc(b.kind), `<strong>${esc(b.value)}</strong>`, esc(b.reason)]))}</section>`);
}

const PLD = [["PLD-118", "Pix fracionado em 9 transferências", "Volt Serviços", "Comunicado ao COAF"], ["PLD-121", "Valor incompatível com a renda", "Conta nova", "Em análise"]];
const LGPD = [["LG-044", "Exportação de dados", "Cliente PF", "Entregue em 2 dias"], ["LG-047", "Revogação de Open Finance", "Cliente PF", "Concluída"]];
const TRAIL_SIZE = 40;
function compliance(s) {
  const trail = s.audit.slice(0, TRAIL_SIZE);
  return layout("compliance", "Compliance e auditoria", `<div class="kpis">${kpi("Decisões registradas", String(s.audit.length), "Pessoa ou regra")}${kpi("Dinheiro movido sem pessoa ou regra", "0", "Toda liberação tem quem decidiu", "pos-text")}${kpi("Alertas PLD abertos", "1", "Prazo regulatório em dia")}${kpi("Pedidos LGPD", "2", "Atendidos no prazo", "pos-text")}</div>
    <section class="panel grow"><h2>Trilha de auditoria</h2>${trail.length ? table(["Data", "Quem decidiu", "O quê", "Detalhe", "Ref."], trail.map((a) => [esc(a.at), `<strong>${esc(a.actor)}</strong>`, esc(a.action), esc(a.detail), esc(a.ref)])) : empty("Nenhuma decisão ainda.")}</section>
    <div class="split"><section class="panel grow"><h2>Prevenção à lavagem (PLD)</h2>${table(["Alerta", "Sinal", "Cliente", "Situação"], PLD.map((r) => r.map(esc)))}</section><section class="panel grow"><h2>LGPD</h2>${table(["Pedido", "Tipo", "Titular", "Situação"], LGPD.map((r) => r.map(esc)))}</section></div>`);
}

const isoDay = (ddmm) => (ddmm ? parseDdMm(ddmm) : now()).toISOString().slice(0, 10);

/** The webhook the marketplace would get for the last stage released in the demo (a sample before any release). */
function webhookOf(s) {
  const released = s.contracts.flatMap((c) => c.stages.map((st, i) => ({ c, st, i }))).filter(({ st }) => st.status === "released");
  const last = released.at(-1);
  const body = last
    ? { event: "stage.released", contract: last.c.id, stage: last.i + 1, amount_cents: last.st.valueCents, released_at: isoDay(last.st.releasedAt) }
    : { event: "stage.released", contract: "AV-2026-001", stage: 1, amount_cents: 800000, released_at: isoDay() };
  return JSON.stringify(body, null, 2);
}
const BASE_EVENTS_TODAY = 1_284;
function api(s) {
  const events = s.apiEvents;
  return layout("api", "API e integrações", `<div class="kpis three">${kpi("BTG Serviços", "Conectado", "Sandbox · versão 2026-09", "pos-text")}${kpi("Eventos hoje", String(events.filter((e) => e.at === today()).length + BASE_EVENTS_TODAY), "Webhooks entregues: 99,97%")}${kpi("Contratos vindos de canais", "31%", "BTG Serviços, link, QR e WhatsApp")}</div>
    <div class="split"><section class="panel grow"><h2>Eventos recentes</h2>${table(["Data", "Origem", "Evento", "Contrato"], events.map((e) => [esc(e.at), esc(e.source), `<code>${esc(e.event)}</code>`, esc(e.ref)]))}${btn("Simular contrato vindo do BTG Serviços", { kind: "secondary", action: "simulateServicosContract", iconName: "link" })}</section>
    ${panel("Webhook de exemplo", `<pre class="code">${esc(webhookOf(s))}</pre>${kv("Chave de sandbox", "sk_sandbox_••••••3f9a")}${kv("Assinatura", "HMAC SHA-256")}<p class="small muted">O BTG Serviços envia tarefa, valor, marcos e rateio. Todo o dinheiro circula dentro do Aval.</p>`)}</div>`);
}

export const bankInsightRoutes = {
  "banco/receita": receita, "banco/funding": funding, "banco/conluio": conluio, "banco/compliance": compliance, "banco/api": api,
};
