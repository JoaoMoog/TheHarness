import { linkedQueueIds, proposalFor } from "../actions/index.js";
import { PEOPLE, availableLimitOf, contractById, custodyCents, lateInstallments, limitOf, outstandingOf, today } from "../store.js";
import { btn, busyNote, chip, empty, esc, icon, kv, money, percent, signal } from "../ui.js";
import { REASON_LABEL } from "./dispute.js";

const NAV = [["visao", "Visão geral", "chart-line-up"], ["servicos", "Nexo Serviços", "storefront"], ["operacoes/contratos", "Operações", "arrows-left-right"], ["fila", "Fila de trabalho", "list-checks"], ["clientes", "Clientes e limites", "users-three"], ["credito", "Crédito", "hand-coins"], ["seguros", "Seguros", "shield-check"], ["receita", "Receita", "chart-line-up"], ["funding", "Funding", "piggy-bank"], ["conluio", "Risco e conluio", "users-three"], ["compliance", "Compliance", "seal-check"], ["limiares", "Limiares do Jev", "sparkle"], ["api", "API", "link"], ["ia", "Aval IA", "sparkle"]];
const BASE_CUSTODY_CENTS = 480_000_000;
const BASE_ACTIVE = 1_281;
const BASE_DISPUTES = 22;
const DAILY = [92, 110, 98, 130, 124, 88, 70, 140, 152, 138, 160, 149, 120, 96, 170, 182, 165, 190, 178, 150, 120, 198, 210, 186, 205, 220, 214, 180, 160];
const JUDGMENT_LABEL = {
  tacitConfirmation: "Confirmação tácita", deliveryCoverage: "Conferência da entrega", disputeReason: "Motivo da disputa",
  evidenceSufficiency: "Provas suficientes", queuePriority: "Prioridade da fila", expertInspection: "Pedido de perícia",
  assistantIntent: "Intenção no Aval IA", suggestedStages: "Etapas sugeridas", fraudSignals: "Sinais de fraude", reviewModeration: "Moderação de avaliações",
  conversationEscalation: "Tom da conversa", scheduleOnly: "Divergência só de prazo", evidenceConsistency: "Coerência das provas", blockAppeal: "Contestação de bloqueio",
  requestCategory: "Categoria do pedido", requestCompleteness: "Pedido completo para orçar", serviceMatch: "Compatibilidade com o prestador", listingModeration: "Moderação de anúncios",
};
const APPEAL_LABEL = { newDocument: "Traz documento novo", misunderstanding: "Explica um mal-entendido", noNewInfo: "Sem informação nova" };
const FRAUD_LABEL = { nameMismatch: "Nome diferente do documento", offPlatformPayment: "Pagamento fora do Aval", notRealService: "Não parece um serviço real", urgencyPressure: "Pressão por pagamento urgente" };

export function layout(active, title, body) {
  return `<div class="web"><aside class="sidebar"><div class="side-brand"><img src="/img/btg-logo-white.png" alt="BTG Pactual"><span>Aval</span></div><nav aria-label="Áreas">${NAV.map(([k, l, ic]) => `<button type="button" class="${active === k.split("/")[0] ? "on" : ""}" data-go="#/banco/${k}">${icon(ic)}<span>${l}</span></button>`).join("")}</nav><div class="side-user"><span class="avatar light">LP</span><div><strong>Luiza Prado</strong><small>Operações · Nexo</small></div></div></aside>
    <main class="web-main"><header class="topbar"><h1>${esc(title)}</h1><div class="search">${icon("magnifying-glass")}<span>Buscar contrato, CPF ou CNPJ</span></div></header><div class="web-body">${body}</div></main></div>`;
}
export const kpi = (label, value, detail, tone = "") => `<div class="kpi"><small>${esc(label)}</small><strong>${esc(value)}</strong><span class="${tone}">${esc(detail)}</span></div>`;
export const table = (cols, rows, selectedIndex = -1) =>
  `<table class="table"><thead><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>${rows.map((r, i) => `<tr class="${i === selectedIndex ? "sel" : ""}">${r.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
export const two = (main, sub) => `<strong>${esc(main)}</strong><small>${esc(sub)}</small>`;
export const panel = (title, body, close = "") => `<section class="panel"><div class="panel-head"><h2>${esc(title)}</h2>${close}</div>${body}</section>`;

function visao(s) {
  const live = s.contracts.reduce((a, c) => a + custodyCents(c), 0);
  const active = BASE_ACTIVE + s.contracts.filter((c) => c.status === "active").length;
  const openDisputes = BASE_DISPUTES + s.disputes.filter((d) => d.status !== "closed").length;
  const todayIn = s.ledger.filter((l) => l.date === today() && l.amountCents > 0).reduce((a, l) => a + l.amountCents, 0);
  const values = [...DAILY, 160 + Math.round(todayIn / 100_000)];
  const max = 250;
  const lowConf = s.serverQueue.filter((q) => q.status === "open").length;
  const kycCount = 12 + (s.newAccount?.status === "review" ? 1 : 0);
  const bars = values.map((v, i) => `<div class="bar ${i === values.length - 1 ? "today" : ""}" style="height:${(Math.min(v, max) / max) * 100}%" tabindex="0" title="Dia ${i + 1}: R$ ${v} mil" aria-label="Dia ${i + 1}: R$ ${v} mil"></div>`).join("");
  const automatic = s.judgmentLog.filter((j) => j.routing === "automatic").length;
  return layout("visao", "Visão geral", `<div class="filters">${chip("Últimos 30 dias", "info")}${chip("Todos os produtos")}${chip("Todas as regiões")}</div>
    <div class="kpis">${kpi("Em custódia", money(BASE_CUSTODY_CENTS + live), "+6,1% em 30 dias", "pos-text")}${kpi("Contratos ativos", active.toLocaleString("pt-BR"), "+92 em 30 dias", "pos-text")}${kpi("Disputas abertas", String(openDisputes), "1,8% dos contratos")}${kpi("Parcelas atrasadas", "2,4%", "+0,3 p.p. em 30 dias", "neg-text")}</div>
    <div class="split"><section class="panel grow"><h2>Novas custódias por dia</h2><small class="muted">R$ mil · últimos 30 dias · hoje inclui os pagamentos desta demonstração</small><div class="chart" role="img" aria-label="Barras com as novas custódias diárias, de cerca de R$ 70 mil a R$ 220 mil">${[250, 200, 150, 100, 50, 0].map((g) => `<span class="grid" style="bottom:${(g / max) * 100}%"><em>${g}</em></span>`).join("")}<div class="bars">${bars}</div></div><div class="axis"><span>05/09</span><span>19/09</span><span>04/10</span></div><details><summary>Ver como tabela</summary>${table(["Dia", "R$ mil"], values.map((v, i) => [String(i + 1), String(v)]))}</details></section>
    <div class="col"><section class="panel"><h2>Precisa de você</h2>${[["scales", "neg", `${openDisputes - BASE_DISPUTES + 7} disputas vencem em 48 h`, "Mediação", "#/banco/fila"], ["identification-card", "warn", `${kycCount} contas em análise`, "KYC e antifraude", "#/banco/fila"], ["chart-line-up", "info", "3 limites para revisar", "Clientes e limites", "#/banco/clientes"], ["sparkle", "info", `${lowConf} julgamento(s) com baixa confiança`, "Aval IA", "#/banco/ia"]].map(([ic, tone, t, d, g]) => `<button type="button" class="line-btn" data-go="${g}"><span class="ic ${tone}">${icon(ic)}</span><span><strong>${t}</strong><small>${d}</small></span>${icon("caret-right")}</button>`).join("")}</section>
    <section class="panel soft"><div class="row-gap dest">${icon("sparkle")}<strong>Aval IA nesta sessão</strong></div><p class="small dest">${s.judgmentLog.length} julgamento(s) · ${s.judgmentLog.length ? percent(automatic / s.judgmentLog.length) : "0%"} automáticos · ${s.judgmentLog.length - automatic} com revisão humana</p></section></div></div>`);
}

function operacoes(s, { tab = "contratos" }) {
  const tabs = `<div class="tabs">${[["contratos", "Contratos"], ["cobranca", "Cobrança"], ["conciliacao", "Conciliação e histórico"]].map(([k, l]) => `<button type="button" class="${tab === k ? "on" : ""}" data-go="#/banco/operacoes/${k}">${l}</button>`).join("")}</div>`;
  if (tab === "cobranca") {
    const late = lateInstallments(s);
    const rows = late.map((i) => [two(i.contractId, contractById(s, i.contractId)?.title ?? ""), two(PEOPLE[i.owner]?.name ?? "", PEOPLE[i.owner]?.clientDoc ?? ""), `<strong>${money(i.valueCents + i.lateFeeCents)}</strong>`, `Parcela ${i.n} de ${i.of}`, chip("3 dias de atraso", "neg")]);
    const sel = late[0];
    const side = sel
      ? panel(`Cobrança · ${sel.contractId}`, `<div class="note danger">${icon("warning-circle")}<span>Parcela ${sel.n} de ${sel.of} atrasada há 3 dias · ${money(sel.valueCents)} + ${money(sel.lateFeeCents)} de juros</span></div>${kv("Cliente", PEOPLE[sel.owner]?.name ?? "")}${kv("Limite", "Pausado até o pagamento")}${kv("Custódia do contrato", money(custodyCents(contractById(s, sel.contractId))))}${kv("Histórico", "1 de 1 em dia antes")}<h3>Régua de cobrança</h3><ol class="timeline"><li class="ok">${icon("check-circle")}<div><strong>Aviso no app e e-mail · D+1</strong></div></li><li class="now">${icon("hourglass-medium")}<div><strong>Pix pré-preenchido · D+3</strong></div></li><li>${icon("clock")}<div><strong>Contato do gerente · D+7</strong></div></li><li>${icon("clock")}<div><strong>Negativação · D+${s.bankSettings.negativationDays}</strong></div></li></ol><div class="row-between"><small class="muted">Negativar em</small><div class="choice-list wrap">${[30, 45, 60].map((d) => `<button type="button" class="pill-option ${s.bankSettings.negativationDays === d ? "on" : ""}" data-action="setNegativationDays" data-days="${d}">D+${d}</button>`).join("")}</div></div>${btn("Enviar Pix de cobrança", { action: "bankCharge", data: { id: sel.id } })}`)
      : panel("Cobrança", empty("Nenhuma parcela atrasada. A carteira está em dia."));
    return layout("operacoes", "Operações", `${tabs}<div class="split"><div class="grow">${late.length ? table(["Contrato", "Cliente", "Valor", "Parcela", "Situação"], rows, 0) : empty("Sem parcelas atrasadas.")}</div>${side}</div>`);
  }
  if (tab === "conciliacao") {
    const inflow = s.ledger.filter((l) => l.amountCents > 0).reduce((a, l) => a + l.amountCents, 0);
    const outflow = -s.ledger.filter((l) => l.amountCents < 0).reduce((a, l) => a + l.amountCents, 0);
    const div = s.ledger.filter((l) => l.status === "Divergente");
    const rows = s.ledger.map((l, i) => [esc(l.date), esc(l.contractId), two(l.label, l.note ?? ""), `<strong>${l.amountCents < 0 ? "− " : ""}${money(Math.abs(l.amountCents))}</strong>`, l.status === "Divergente" ? `${chip("Divergente", "neg")} ${btn("Conciliar", { kind: "text small", action: "bankReconcile", data: { index: i } })}` : chip(l.status, l.status === "Conciliado" ? "pos" : "warn")]);
    return layout("operacoes", "Operações", `${tabs}<div class="kpis three">${kpi("Entradas em custódia", money(inflow), `${s.ledger.filter((l) => l.amountCents > 0).length} movimentos`)}${kpi("Saídas (liberações, devoluções e antecipações)", money(outflow), `${s.ledger.filter((l) => l.amountCents < 0).length} movimentos`)}${kpi("Divergências", String(div.length), div.length ? "Taxa MDR descontada na liquidação" : "Tudo conciliado", div.length ? "neg-text" : "pos-text")}</div>${table(["Data", "Contrato", "Movimento", "Valor", "Status"], rows)}`);
  }
  const statusChip = { awaitingPayment: chip("Aguardando pagamento", "warn"), funding: chip("Coletando", "warn"), active: chip("Em dia", "pos"), completed: chip("Concluído") };
  const rows = s.contracts.map((c) => {
    const late = s.installments.some((i) => i.contractId === c.id && i.status === "late");
    const disputed = s.disputes.some((d) => d.contractId === c.id && d.status !== "closed");
    const done = c.stages.filter((st) => ["released", "split"].includes(st.status)).length;
    return [two(c.id, c.title), two(c.client, c.provider), `<strong>${money(c.totalCents)}</strong>`, `${done} de ${c.stages.length}`, disputed ? chip("Em disputa", "neg") : late ? chip("Parcela atrasada", "neg") : statusChip[c.status]];
  });
  rows.push([two("AV-2026-022", "Elétrica"), two("Paulo Reis", "Volt Serviços"), "<strong>R$ 6.400,00</strong>", "1 de 2", chip("Em dia", "pos")]);
  rows.push([two("AV-2026-035", "Jardinagem"), two("Lia Torres", "Verde Vivo"), "<strong>R$ 3.200,00</strong>", "1 de 2", chip("Em disputa", "neg")]);
  return layout("operacoes", "Operações", `${tabs}<div class="filters">${chip("Status: todos")}${chip("Com atraso", "neg")}${chip("Coletivos")}</div>${table(["Contrato", "Partes", "Valor", "Etapa", "Situação"], rows)}`);
}

/** Work queue: disputes, KYC, reviews and low-confidence Jev readings, ordered by priority. */
export function queueItems(s) {
  const items = [];
  for (const d of s.disputes.filter((x) => x.status !== "closed")) {
    const p = d.judgments.priority?.value?.priority ?? 0.5;
    const ev = d.judgments.evidence?.value ?? [];
    const uneven = ev.length === 2 && ev[0].sufficient !== ev[1].sufficient;
    items.push({ id: d.id, type: "Disputa", tone: "neg", sub: d.contractId, priority: p, deadline: d.deadline, read: d.judgments.evidence ? signal(uneven ? "Provas desiguais" : "Provas lidas", uneven ? "review" : "ok") : chip("Lendo provas") });
  }
  if (s.newAccount?.status === "review") {
    const present = s.newAccount.fraud?.value?.present ?? [];
    items.push({ id: "KYC-NEW", type: "KYC", tone: "neutral", sub: s.newAccount.name, priority: present.length ? 0.8 : 0.55, deadline: "1 dia", read: s.newAccount.fraud ? signal(present.length ? `${present.length} sinal(is) de fraude` : "Dados coerentes", present.length ? "block" : "ok") : chip("Sem leitura") });
  }
  if (s.newAccount?.appeal?.status === "review") {
    items.push({ id: "KYC-NEW", type: "KYC", tone: "neutral", sub: `Contestação · ${s.newAccount.name}`, priority: 0.6, deadline: "2 dias", read: signal(APPEAL_LABEL[s.newAccount.appeal.reading?.value] ?? "Sem leitura", s.newAccount.appeal.reading?.value === "newDocument" ? "ok" : "review") });
  }
  for (const c of s.contracts) {
    c.stages.forEach((st, i) => {
      if (!st.fraudCheck?.risky || st.fraudCheck.decision) return;
      items.push({ id: `EV-${c.id}-${i}`, type: "Risco", tone: "warn", sub: `${c.provider} · etapa ${i + 1}`, priority: 0.75, deadline: "24 h", read: signal(`${st.fraudCheck.flags.length + (st.fraudCheck.reading?.value?.inconsistentCount ?? 0)} sinal(is) na evidência`, "block") });
    });
  }
  for (const r of s.reviews.filter((x) => x.status === "inReview")) {
    items.push({ id: r.id, type: "Reputação", tone: "info", sub: r.provider, priority: 0.3, deadline: "7 dias", read: signal(r.moderation?.value?.offensive ? "Avaliação ofensiva" : r.moderation?.value?.personalData ? "Dados pessoais" : "Confira", "review") });
  }
  const linked = linkedQueueIds(s);
  for (const q of s.serverQueue.filter((x) => x.status === "open" && !linked.has(x.id))) {
    items.push({ id: q.id, type: "Revisão IA", tone: "warn", sub: JUDGMENT_LABEL[q.judgment] ?? q.judgment, priority: 0.45, deadline: "24 h", read: signal(`Confiança ${percent(q.confidence)}`, "review") });
  }
  items.push({ id: "RK-0207", type: "Risco", tone: "warn", sub: "Volt Serviços", priority: 0.81, deadline: "24 h", read: signal("2 sinais de fraude", "block"), seeded: true });
  return items.sort((a, b) => b.priority - a.priority);
}
const prioLabel = (p) => `${p >= 0.66 ? "Alta" : p >= 0.4 ? "Média" : "Baixa"} · ${p.toFixed(2).replace(".", ",")}`;

function disputePanel(s, d) {
  const c = contractById(s, d.contractId);
  const j = d.judgments;
  const ev = j.evidence?.value ?? [];
  const evRead = (party) => {
    const r = ev.find((p) => p.party === party);
    if (!r) return chip(party === "provider" && !d.providerStatement ? "Sem resposta" : "—");
    return signal(`${r.sufficient ? "Suficientes" : "Incompletas"} · ${r.probability.toFixed(2).replace(".", ",")}`, r.sufficient && r.routing === "automatic" ? "ok" : "review");
  };
  const busy = s.ui.busy[`ev-${d.id}`] || s.ui.busy[`insp-${d.id}`];
  const p = proposalFor(d);
  const canAct = d.status === "mediation";
  return panel(`${d.id} · decidir`, `<p class="small">${esc(c.client)} contra ${esc(c.provider)} · etapa ${d.stage + 1} · ${money(d.amountCents)} bloqueados</p><p class="quote">“${esc(d.report)}”</p>${d.providerStatement ? `<p class="quote">Prestador: “${esc(d.providerStatement)}”</p>` : ""}
    <div class="ia-box"><div class="row-gap dest">${icon("sparkle")}<strong>Leitura do Aval IA</strong></div>${busy ? busyNote("Lendo o caso") : ""}
      <div class="row-between"><span>Motivo</span>${signal(REASON_LABEL[d.reason], "ok")}</div>
      <div class="row-between"><span>Provas da contratante</span>${evRead("client")}</div>
      <div class="row-between"><span>Provas do prestador</span>${evRead("provider")}</div>
      <div class="row-between"><span>Precisa de perícia</span>${j.inspection ? signal(`${j.inspection.value ? "Provável" : "Improvável"} · ${percent(j.inspection.confidence)}`, j.inspection.routing === "automatic" ? "ok" : "review") : chip("—")}</div>
      <small class="muted">Apoio à análise. A decisão é sua.</small></div>
    <h3>Proposta pela regra de mediação</h3>${kv("Prestador", `${money(p.providerCents)} (${percent(p.share)})`)}${kv("Contratante", `${money(p.clientCents)} (${percent(1 - p.share)})`)}
    ${canAct ? `${btn("Enviar proposta às partes", { action: "bankPropose", data: { id: d.id } })}<div class="btn-row">${btn("Pedir perícia", { kind: "secondary", action: "bankInspection", data: { id: d.id } })}${btn("Arbitragem", { kind: "secondary", action: "bankArbitration", data: { id: d.id } })}</div>` : `<div class="note info">${icon("info")}<span>Situação atual: ${esc(d.status === "proposal" ? "proposta enviada, aguardando as partes" : d.status === "inspection" ? "perícia agendada" : "em arbitragem")}.</span></div>`}`);
}

function kycPanel(s) {
  const a = s.newAccount;
  const probs = a.fraud?.value?.probabilities ?? {};
  return panel(`KYC · ${a.name}`, `${kv("Nome informado", a.name)}${kv("Nome no documento", a.documentName)}${kv("Enviado em", a.submittedAt)}<p class="quote">“${esc(a.services)}”</p>
    <div class="ia-box"><div class="row-gap dest">${icon("sparkle")}<strong>Sinais de fraude lidos pelo Aval IA</strong></div>${a.fraud ? Object.entries(FRAUD_LABEL).map(([k, l]) => `<div class="row-between"><span>${l}</span>${(probs[k] ?? 0) >= 0.5 ? signal(`Presente · ${percent(probs[k])}`, "block") : signal(`Ausente · ${percent(1 - (probs[k] ?? 0))}`, "ok")}</div>`).join("") : "<small>Sem leitura (Aval IA desligado ou indisponível).</small>"}<small class="muted">Sinais de fraude sempre passam por uma pessoa.</small></div>
    ${a.appeal ? `<h3>Contestação</h3><p class="quote">“${esc(a.appeal.text)}”</p><div class="ia-box"><div class="row-between"><span>Leitura do Aval IA</span>${a.appeal.reading ? signal(`${APPEAL_LABEL[a.appeal.reading.value]} · ${percent(a.appeal.reading.confidence)}`, "review") : chip("—")}</div><small class="muted">Contestações sempre passam por uma pessoa.</small></div>` : ""}
    ${btn(a.appeal ? "Aceitar contestação e aprovar" : "Aprovar conta", { action: "bankDecideAccount", data: { decision: "approve" } })}${btn(a.appeal ? "Manter a recusa" : "Recusar", { kind: "secondary", action: "bankDecideAccount", data: { decision: "refuse" } })}`);
}

function evidencePanel(s, itemId) {
  const [, contractId, stage] = itemId.match(/^EV-(.+)-(\d+)$/);
  const c = contractById(s, contractId);
  const st = c.stages[Number(stage)];
  const fc = st.fraudCheck;
  const odd = (fc.reading?.value?.items ?? []).filter((it) => !it.consistent);
  return panel(`${itemId} · risco`, `<p class="small">${esc(c.provider)} · ${esc(c.title)} · etapa ${Number(stage) + 1} · ${money(st.valueCents)}</p>
    <div class="ia-box"><strong>Checagens em código</strong>${fc.flags.length ? fc.flags.map((f) => `<div class="row-between"><span>${esc(f)}</span>${signal("Sinal", "block")}</div>`).join("") : "<small>Nenhum sinal nas regras.</small>"}</div>
    <div class="ia-box"><div class="row-gap dest">${icon("sparkle")}<strong>Coerência das provas (Aval IA)</strong></div>${odd.length ? odd.map((it) => `<div class="row-between"><span>${esc(it.caption)}</span>${signal(`Fora da etapa · ${percent(1 - it.probability)}`, "block")}</div>`).join("") : "<small>As legendas descrevem esta etapa.</small>"}<small class="muted">Antifraude: sempre uma pessoa decide.</small></div>
    ${btn("Liberar para a aprovação", { action: "bankEvidenceDecision", data: { id: contractId, stage, decision: "clear" } })}${btn("Bloquear e investigar", { kind: "danger", action: "bankEvidenceDecision", data: { id: contractId, stage, decision: "block" } })}`);
}

function reviewPanel(s, r) {
  const m = r.moderation?.value;
  return panel(`${r.id} · avaliação`, `${kv("Prestador", r.provider)}${kv("Nota", `${r.stars} de 5`)}<p class="quote">“${esc(r.comment)}”</p><div class="ia-box"><div class="row-between"><span>Ofensa</span>${m ? signal(m.offensive ? "Sim" : "Não", m.offensive ? "block" : "ok") : chip("—")}</div><div class="row-between"><span>Dados pessoais</span>${m ? signal(m.personalData ? "Sim" : "Não", m.personalData ? "block" : "ok") : chip("—")}</div><small class="muted">${r.moderation ? `Confiança ${percent(r.moderation.confidence)}` : "Sem leitura do Aval IA"}</small></div>${btn("Publicar", { action: "bankDecideReview", data: { id: r.id, decision: "publish" } })}${btn("Ocultar", { kind: "secondary", action: "bankDecideReview", data: { id: r.id, decision: "hide" } })}`);
}

function serverItemPanel(q) {
  const input = JSON.stringify(q.input, null, 1);
  return panel(`${q.id} · revisão`, `${kv("Julgamento", JUDGMENT_LABEL[q.judgment] ?? q.judgment)}${kv("Confiança", percent(q.confidence))}${kv("Criado", new Date(q.createdAt).toLocaleString("pt-BR"))}<h3>Leitura do Aval IA</h3><pre class="code">${esc(JSON.stringify(q.value, null, 1))}</pre><h3>Entrada</h3><pre class="code">${esc(input.length > 700 ? `${input.slice(0, 700)}…` : input)}</pre>${btn("Confirmar leitura", { action: "bankResolve", data: { id: q.id, decision: "Leitura confirmada" } })}${btn("Corrigir leitura", { kind: "secondary", action: "bankResolve", data: { id: q.id, decision: "Leitura corrigida pelo analista" } })}`);
}

function fila(s, { item }) {
  const items = queueItems(s);
  const selected = items.find((i) => i.id === item) ?? items[0];
  let side = panel("Fila", empty("Nada na fila."));
  if (selected) {
    const d = s.disputes.find((x) => x.id === selected.id);
    const r = s.reviews.find((x) => x.id === selected.id);
    const q = s.serverQueue.find((x) => x.id === selected.id);
    if (d) side = disputePanel(s, d);
    else if (selected.id === "KYC-NEW") side = kycPanel(s);
    else if (selected.id.startsWith("EV-")) side = evidencePanel(s, selected.id);
    else if (r) side = reviewPanel(s, r);
    else if (q) side = serverItemPanel(q);
    else side = panel(`${selected.id} · risco`, `<p class="small">Volt Serviços · conta aberta há 9 dias.</p><div class="ia-box"><div class="row-between"><span>Pagamento fora do Aval</span>${signal("Presente · 91%", "block")}</div><div class="row-between"><span>Pressão por pagamento urgente</span>${signal("Presente · 88%", "block")}</div><small class="muted">Sinais de fraude sempre passam por uma pessoa.</small></div>${btn("Bloquear e investigar", { kind: "danger", action: "bankResolve", data: { id: selected.id, decision: "Bloqueado" } })}`);
  }
  const counts = (t) => items.filter((i) => i.type === t).length;
  const rows = items.map((i) => [`<button type="button" class="cell-link" data-go="#/banco/fila/${esc(i.id)}">${two(i.id, i.sub)}</button>`, chip(i.type, i.tone), `<strong>${prioLabel(i.priority)}</strong>`, esc(i.deadline), i.read]);
  return layout("fila", "Fila de trabalho", `<div class="filters">${chip(`Todos · ${items.length}`, "info")}${chip(`Disputas · ${counts("Disputa")}`)}${chip(`Risco · ${counts("Risco")}`)}${chip(`KYC · ${counts("KYC")}`)}${chip(`Reputação · ${counts("Reputação")}`)}${chip(`Revisão IA · ${counts("Revisão IA")}`)}<span class="spacer"></span><small class="muted">Ordenado por prioridade do Aval IA ${s.ui.busy.queue ? "· atualizando" : ""}</small></div>
    <div class="split"><div class="grow">${table(["Caso", "Tipo", "Prioridade", "Prazo", "Leitura IA"], rows, items.indexOf(selected))}</div>${side}</div>`);
}

function clientes(s) {
  const late = lateInstallments(s).length > 0;
  const used = outstandingOf(s, "marina") / limitOf(s, "marina");
  const decision = s.bankNotes["Paulo Reis"];
  const rows = [
    [two("Marina Costa", "CPF ***.481.***-20 · MEI 45.118.903"), `<strong>${money(limitOf(s, "marina"))}</strong>`, percent(used), `<strong class="${late ? "warn-text" : "pos-text"}">${late ? "Médio" : "Baixo"}</strong>`, late ? chip("Parcela atrasada", "neg") : chip("Em dia", "pos")],
    [two("Paulo Reis", "CPF ***.112.***-07"), `<strong>${decision === "aprovado R$ 22.000,00" ? "R$ 22.000,00" : "R$ 15.000,00"}</strong>`, "43%", '<strong class="pos-text">Baixo</strong>', decision ? chip(decision, "pos") : chip("Pediu aumento", "warn")],
    [two("Carla Dias", "CPF ***.903.***-55"), "<strong>R$ 30.000,00</strong>", "12%", '<strong class="pos-text">Baixo</strong>', chip("Em dia", "pos")],
    [two("Lia Torres", "CPF ***.250.***-81"), "<strong>R$ 5.000,00</strong>", "64%", '<strong class="neg-text">Alto</strong>', chip("Em disputa", "neg")],
  ];
  const side = panel("Paulo Reis · limite", `<p class="small">Pediu aumento de R$ 15.000 para R$ 25.000 para contratar a reforma da cozinha.</p>${kv("Renda declarada", "R$ 14.200/mês")}${kv("Parcelas pagas em dia", "18 de 18", "pos-text")}${kv("Comprometimento com o novo limite", "27%")}${kv("Modelo de crédito Nexo", "Aprova até R$ 22.000")}<div class="ia-box"><div class="row-between"><strong>Reputação como contratante</strong>${signal("Nota 4,7")}</div><small class="muted">Aprova etapas no prazo e não abriu disputas. Lido pelo Aval IA a partir das avaliações dos prestadores.</small></div>${decision ? `<div class="note info">${icon("check-circle")}<span>Decisão registrada: ${esc(decision)}.</span></div>` : `${btn("Aprovar R$ 22.000,00", { action: "bankLimit", data: { name: "Paulo Reis", decision: "aprovado R$ 22.000,00" } })}<div class="btn-row">${btn("Manter", { kind: "secondary", action: "bankLimit", data: { name: "Paulo Reis", decision: "mantido" } })}${btn("Recusar", { kind: "secondary", action: "bankLimit", data: { name: "Paulo Reis", decision: "recusado" } })}</div>`}`);
  return layout("clientes", "Clientes e limites", `<div class="filters">${chip("Contratantes", "info")}${chip("Prestadores")}${chip("Com atraso")}${chip("Revisão de limite · 1", "warn")}</div><div class="split"><div class="grow">${table(["Cliente", "Limite", "Uso", "Risco", "Situação"], rows, 1)}<p class="small muted">Marina Costa: limite disponível ${money(availableLimitOf(s, "marina"))}${late ? ", crédito pausado pela parcela atrasada" : ""}.</p></div>${side}</div>`);
}

function avalIa(s) {
  const log = s.judgmentLog;
  const automatic = log.filter((j) => j.routing === "automatic").length;
  const toBank = log.filter((j) => j.escalateTo === "bankQueue").length;
  const toUser = log.filter((j) => j.escalateTo === "user").length;
  const policy = s.policy;
  const policyRows = policy
    ? Object.entries(JUDGMENT_LABEL).map(([k, l]) => {
      const rule = policy[k];
      const mine = log.filter((j) => j.name === k);
      const auto = mine.filter((j) => j.routing === "automatic").length;
      return [`<strong>${esc(l)}</strong>`, rule ? (rule.kind === "gated" ? rule.threshold.toFixed(2).replace(".", ",") : rule.kind === "alwaysHuman" ? "sempre humano" : "sem limiar") : "—", String(mine.length), mine.length ? percent(auto / mine.length) : "—", mine.length ? percent(mine.reduce((a, j) => a + j.confidence, 0) / mine.length) : "—"];
    })
    : [];
  const queueRows = s.serverQueue.map((q) => [esc(q.id), esc(JUDGMENT_LABEL[q.judgment] ?? q.judgment), percent(q.confidence), q.status === "open" ? chip("Aberto", "warn") : chip("Resolvido", "pos"), esc(q.decision ?? "")]);
  return layout("ia", "Aval IA", `<div class="kpis">${kpi("Julgamentos nesta sessão", String(log.length), "Modelo Jev da TypeSafe")}${kpi("Resolvidos automaticamente", log.length ? percent(automatic / log.length) : "0%", "Acima do limiar de confiança")}${kpi("Enviados à fila do banco", String(toBank), "Casos para analista")}${kpi("Confirmados pelo usuário", String(toUser), "Baixa confiança no app")}</div>
    <div class="split"><section class="panel grow"><h2>Limiares por julgamento</h2>${policy ? table(["Julgamento", "Limiar", "Chamadas", "Automáticos", "Confiança média"], policyRows) : busyNote("Carregando política")}<p class="small muted">Acima do limiar segue automático. Abaixo, vai para a pessoa certa: o usuário no app ou um analista na fila. Nenhum julgamento move dinheiro sozinho.</p></section></div>
    <div class="split"><section class="panel grow"><h2>Fila de revisão</h2>${s.serverQueue.length ? table(["Item", "Julgamento", "Confiança", "Status", "Decisão"], queueRows) : empty("Nenhum julgamento com baixa confiança até agora.")}${btn("Atualizar", { kind: "secondary", action: "loadServerQueue", busy: s.ui.busy.queue })}</section></div>`);
}

export const webRoutes = {
  "banco/visao": visao, "banco/operacoes/:tab": operacoes, "banco/operacoes": operacoes, "banco/fila": fila, "banco/fila/:item": fila,
  "banco/clientes": clientes, "banco/ia": avalIa,
};
