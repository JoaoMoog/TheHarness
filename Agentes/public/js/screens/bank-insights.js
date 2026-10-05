// Bank website, wave 4: revenue by source, structured funding, Jev threshold simulator, collusion, compliance and API.
import { FUNDING, fundingBook } from "../actions/index.js";
import { today } from "../store.js";
import { btn, chip, empty, esc, icon, kv, money, percent } from "../ui.js";
import { kpi, layout, panel, table } from "./web.js";

const MONTH_BASE = {
  interest: 41_200_000, float: 26_800_000, transaction: 9_600_000, insurance: 5_400_000, arbitration: 3_800_000, mdr: 7_100_000, funding: 0, saas: 18_000_000,
};
const SOURCE_LABEL = {
  interest: "Participação nos juros", float: "Float da custódia", transaction: "Taxa por transação", insurance: "Seguro da operação",
  arbitration: "Seguro de arbitragem", mdr: "Adquirência (MDR)", funding: "Funding estruturado (emissão)", saas: "Licenciamento da infraestrutura",
};
const FLOAT_MONTHLY = 0.008;
const TRANSACTION_FEE_CENTS = 1_990;
const INSURANCE_COMMISSION = 0.2;
const MDR_RATE = 0.025;

/** This demo's own contribution to each revenue source, computed from the session state. */
function sessionRevenue(s) {
  const interest = s.credits.reduce((a, c) => a + Math.max(0, c.installmentCents * c.count - c.principalCents), 0);
  const custody = s.contracts.reduce((a, c) => a + Math.max(0, c.paidInCents - c.refundedCents), 0);
  const premiums = s.contracts.filter((c) => c.insurance?.paid).reduce((a, c) => a + c.insurance.premiumCents, 0);
  const elo = s.ledger.filter((l) => l.label.startsWith("Entrada Elo")).reduce((a, l) => a + l.amountCents, 0);
  return {
    interest, float: Math.round(custody * FLOAT_MONTHLY), transaction: s.contracts.length * TRANSACTION_FEE_CENTS, insurance: Math.round(premiums * INSURANCE_COMMISSION),
    arbitration: s.contracts.reduce((a, c) => a + (c.arbitrationFeeCents ?? 0), 0), mdr: Math.round(elo * MDR_RATE), funding: s.funding.feeCents ?? 0, saas: 0,
  };
}

function receita(s) {
  const own = sessionRevenue(s);
  const rows = Object.keys(MONTH_BASE).map((k) => ({ k, value: MONTH_BASE[k] + own[k], own: own[k] })).sort((a, b) => b.value - a.value);
  const max = Math.max(...rows.map((r) => r.value));
  const total = rows.reduce((a, r) => a + r.value, 0);
  const bars = rows.map((r) => `<div class="hbar"><span class="hbar-label">${esc(SOURCE_LABEL[r.k])}</span><span class="hbar-track"><span class="hbar-fill" style="width:${(r.value / max) * 100}%" title="${esc(SOURCE_LABEL[r.k])}: ${money(r.value)}"></span></span><strong>${money(r.value)}</strong></div>`).join("");
  return layout("receita", "Receita do Aval", `<div class="kpis">${kpi("Receita no mês", money(total), "8 fontes, nenhuma depende só de juros")}${kpi("Contas Nexo abertas pelo Aval", "1.940", "+212 em 30 dias", "pos-text")}${kpi("Clientes com 2 produtos ou mais", "38%", "Seguros, investimentos e cartão", "pos-text")}${kpi("Crédito com garantia de custódia", "100%", "Dinheiro sempre vinculado a um serviço", "pos-text")}</div>
    <div class="split"><section class="panel grow"><h2>Receita por fonte</h2><small class="muted">R$ · mês corrente · inclui o que esta demonstração gerou</small><div class="hbars">${bars}</div><details><summary>Ver como tabela</summary>${table(["Fonte", "Mês", "Desta demonstração"], rows.map((r) => [esc(SOURCE_LABEL[r.k]), money(r.value), money(r.own)]))}</details></section>
    <section class="panel"><h2>Resultado para o Nexo</h2>${kv("Novas contas por mês", "212")}${kv("Crédito mais qualificado", "Garantido por custódia")}${kv("Inadimplência do crédito Aval", "2,4% contra 5,1% no pessoal")}${kv("Venda cruzada", "Seguros, investimentos, cartão")}${kv("Novo produto de funding", s.funding.issued ? "FIDC emitido" : "FIDC pronto para emitir")}<p class="small muted">O Aval nasce independente e já gera receita antes do ELO Marketplace existir.</p></section></div>`);
}

function funding(s) {
  const book = fundingBook(s);
  const senior = Math.round(book.total * FUNDING.seniorShare);
  const issued = s.funding.issued;
  const volume = s.funding.volumeCents ?? book.total;
  const investors = [["Clientes Nexo Investimentos", Math.round(volume * 0.56), "Cota sênior"], ["Family offices", Math.round(volume * 0.24), "Cota sênior"], ["Nexo (tesouraria)", Math.round(volume * 0.2), "Cota subordinada"]];
  return layout("funding", "Funding estruturado", `<div class="kpis three">${kpi("Carteira elegível", money(book.total), "Crédito Aval e recebíveis em custódia")}${kpi("Cota sênior", money(senior), FUNDING.seniorRate)}${kpi("Cota subordinada", money(book.total - senior), FUNDING.subordinateRate)}</div>
    <div class="split"><section class="panel grow"><h2>${esc(FUNDING.name)}</h2>${kv("Crédito ao contratante", money(book.credit))}${kv("Recebíveis em custódia", money(book.custody))}${kv("Lastro", "Contratos com custódia por marco")}${kv("Taxa de estruturação", percent(FUNDING.structuringFee))}
      ${issued ? `<div class="note pos">${icon("check-circle")}<span>Emitido em ${esc(s.funding.at)} · ${money(s.funding.volumeCents)} · receita de estruturação ${money(s.funding.feeCents)}</span></div>${table(["Investidor", "Volume", "Classe"], investors.map(([a, b, c]) => [`<strong>${a}</strong>`, money(b), c]))}` : btn("Emitir e distribuir", { action: "issueFunding", iconName: "chart-line-up" })}</section>
    <section class="panel"><h2>Por que funciona</h2><p class="small">Cada real do fundo está ligado a um serviço com etapas, custódia e seguro de arbitragem. O risco é de execução da obra, não de uso livre do dinheiro.</p>${kv("Perda esperada", "1,2% a.a.")}${kv("Subordinação", percent(1 - FUNDING.seniorShare))}</section></div>`);
}

// Threshold simulator: a synthetic calibration set (phase 6) plus this session's real readings
const GATED = { deliveryCoverage: 0.8, tacitConfirmation: 0.85, disputeReason: 0.75, evidenceSufficiency: 0.7, expertInspection: 0.65, suggestedStages: 0.8, assistantIntent: 0.9, reviewModeration: 0.8, conversationEscalation: 0.7, scheduleOnly: 0.8, evidenceConsistency: 0.75 };
const THRESHOLDS = [0.6, 0.7, 0.8, 0.9];
const CASES_PER_JUDGMENT = 60;
function calibration(name) {
  let seed = [...name].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 17);
  const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  return Array.from({ length: CASES_PER_JUDGMENT }, () => {
    const confidence = 0.35 + 0.65 * Math.pow(rand(), 0.6);
    return { confidence, correct: rand() < 0.5 + 0.5 * confidence };
  });
}
function simulate(name, threshold) {
  const cases = calibration(name);
  const auto = cases.filter((c) => c.confidence >= threshold);
  return { auto: auto.length / cases.length, errors: auto.filter((c) => !c.correct).length, queue: cases.length - auto.length };
}

function limiares(s) {
  const rows = Object.entries(GATED).map(([name, policy]) => {
    const chosen = Number(s.ui.drafts.limiar?.[name] ?? policy);
    const r = simulate(name, chosen);
    const pills = THRESHOLDS.map((t) => `<button type="button" class="pill-option small ${chosen === t ? "on" : ""}" data-action="setThreshold" data-judgment="${name}" data-value="${t}">${t.toFixed(1).replace(".", ",")}</button>`).join("");
    return [`<strong>${esc(name)}</strong><small>política atual ${policy.toFixed(2).replace(".", ",")}</small>`, `<div class="choice-list wrap">${pills}</div>`, percent(r.auto), String(r.queue), r.errors ? `<strong class="neg-text">${r.errors}</strong>` : `<strong class="pos-text">0</strong>`];
  });
  return layout("limiares", "Simulador de limiares do Jev", `<div class="filters">${chip(`Base de calibração sintética · ${CASES_PER_JUDGMENT} casos por julgamento`, "info")}${chip(`${s.judgmentLog.length} leitura(s) reais nesta sessão`)}</div>
    <section class="panel grow">${table(["Julgamento", "Limiar", "Automático", "Vai para pessoas", "Erros que passariam"], rows)}<p class="small muted">Subir o limiar manda mais casos para pessoas e reduz erros automáticos. Sinais de fraude e contestações ficam sempre com uma pessoa, em qualquer limiar.</p></section>`);
}

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
  const ai = s.judgmentLog.map((j) => ({ at: new Date(j.at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }), actor: "Aval IA (Jev)", action: j.name, detail: `${j.routing === "automatic" ? "automático" : "revisão humana"} · confiança ${percent(j.confidence)}`, ref: j.queueId ?? "" }));
  const trail = [...s.audit, ...ai].slice(0, TRAIL_SIZE);
  return layout("compliance", "Compliance e auditoria", `<div class="kpis">${kpi("Decisões registradas", String(s.audit.length + s.judgmentLog.length), "Pessoa, regra ou Aval IA")}${kpi("Decisões só da IA com dinheiro", "0", "Nenhum julgamento move dinheiro sozinho", "pos-text")}${kpi("Alertas PLD abertos", "1", "Prazo regulatório em dia")}${kpi("Pedidos LGPD", "2", "Atendidos no prazo", "pos-text")}</div>
    <section class="panel grow"><h2>Trilha de auditoria</h2>${trail.length ? table(["Data", "Quem decidiu", "O quê", "Detalhe", "Ref."], trail.map((a) => [esc(a.at), `<strong>${esc(a.actor)}</strong>`, esc(a.action), esc(a.detail), esc(a.ref)])) : empty("Nenhuma decisão ainda.")}</section>
    <div class="split"><section class="panel grow"><h2>Prevenção à lavagem (PLD)</h2>${table(["Alerta", "Sinal", "Cliente", "Situação"], PLD.map((r) => r.map(esc)))}</section><section class="panel grow"><h2>LGPD</h2>${table(["Pedido", "Tipo", "Titular", "Situação"], LGPD.map((r) => r.map(esc)))}</section></div>`);
}

const WEBHOOK = `{
  "event": "stage.released",
  "contract": "AV-2026-001",
  "stage": 2,
  "amount_cents": 480000,
  "mode": "manual_approval",
  "released_at": "2026-10-04T14:02:11-03:00"
}`;
const BASE_EVENTS_TODAY = 1_284;
function api(s) {
  const events = s.apiEvents;
  return layout("api", "API e integrações", `<div class="kpis three">${kpi("ELO Marketplace", "Conectado", "Sandbox · versão 2026-09", "pos-text")}${kpi("Eventos hoje", String(events.filter((e) => e.at === today()).length + BASE_EVENTS_TODAY), "Webhooks entregues: 99,97%")}${kpi("Contratos vindos de canais", "31%", "ELO, Aval Link e maquininha")}</div>
    <div class="split"><section class="panel grow"><h2>Eventos recentes</h2>${table(["Data", "Origem", "Evento", "Contrato"], events.map((e) => [esc(e.at), esc(e.source), `<code>${esc(e.event)}</code>`, esc(e.ref)]))}${btn("Simular contrato vindo do ELO", { kind: "secondary", action: "simulateEloContract", iconName: "link" })}</section>
    ${panel("Webhook de exemplo", `<pre class="code">${esc(WEBHOOK)}</pre>${kv("Chave de sandbox", "sk_sandbox_••••••3f9a")}${kv("Assinatura", "HMAC SHA-256")}<p class="small muted">O marketplace envia tarefa, valor, marcos e rateio. Todo o dinheiro circula dentro do Aval.</p>`)}</div>`);
}

export const bankInsightRoutes = {
  "banco/receita": receita, "banco/funding": funding, "banco/limiares": limiares, "banco/conluio": conluio, "banco/compliance": compliance, "banco/api": api,
};
