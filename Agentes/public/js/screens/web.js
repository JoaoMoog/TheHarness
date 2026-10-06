import { disputePriority, proposalFor } from "../actions/index.js";
import { peopleOf, availableLimitOf, contractById, custodyCents, lateInstallments, limitOf, outstandingOf, today } from "../store.js";
import { btn, chip, empty, esc, icon, kv, money, percent } from "../ui.js";
import { REASON_LABEL } from "./dispute.js";

const NAV = [["visao", "Visão geral", "chart-line-up"], ["operacoes/contratos", "Operações", "arrows-left-right"], ["fila", "Fila de trabalho", "list-checks"], ["clientes", "Clientes e limites", "users-three"], ["credito", "Crédito", "hand-coins"], ["seguros", "Seguros", "shield-check"], ["receita", "Receita", "chart-line-up"], ["funding", "Funding", "piggy-bank"], ["conluio", "Risco e conluio", "users-three"], ["compliance", "Compliance", "seal-check"], ["api", "API", "link"]];
const BASE_CUSTODY_CENTS = 480_000_000;
const BASE_ACTIVE = 1_281;
const BASE_DISPUTES = 22;
const DAILY = [92, 110, 98, 130, 124, 88, 70, 140, 152, 138, 160, 149, 120, 96, 170, 182, 165, 190, 178, 150, 120, 198, 210, 186, 205, 220, 214, 180, 160];

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
  const kycCount = 12 + (s.newAccount?.status === "review" ? 1 : 0);
  const bars = values.map((v, i) => `<div class="bar ${i === values.length - 1 ? "today" : ""}" style="height:${(Math.min(v, max) / max) * 100}%" tabindex="0" title="Dia ${i + 1}: R$ ${v} mil" aria-label="Dia ${i + 1}: R$ ${v} mil"></div>`).join("");
  return layout("visao", "Visão geral", `<div class="filters">${chip("Últimos 30 dias", "info")}${chip("Todos os produtos")}${chip("Todas as regiões")}</div>
    <div class="kpis">${kpi("Em custódia", money(BASE_CUSTODY_CENTS + live), "+6,1% em 30 dias", "pos-text")}${kpi("Contratos ativos", active.toLocaleString("pt-BR"), "+92 em 30 dias", "pos-text")}${kpi("Disputas abertas", String(openDisputes), "1,8% dos contratos")}${kpi("Parcelas atrasadas", "2,4%", "+0,3 p.p. em 30 dias", "neg-text")}</div>
    <div class="split"><section class="panel grow"><h2>Novas custódias por dia</h2><small class="muted">R$ mil · últimos 30 dias · hoje inclui os pagamentos desta demonstração</small><div class="chart" role="img" aria-label="Barras com as novas custódias diárias, de cerca de R$ 70 mil a R$ 220 mil">${[250, 200, 150, 100, 50, 0].map((g) => `<span class="grid" style="bottom:${(g / max) * 100}%"><em>${g}</em></span>`).join("")}<div class="bars">${bars}</div></div><div class="axis"><span>05/09</span><span>19/09</span><span>04/10</span></div><details><summary>Ver como tabela</summary>${table(["Dia", "R$ mil"], values.map((v, i) => [String(i + 1), String(v)]))}</details></section>
    <div class="col"><section class="panel"><h2>Precisa de você</h2>${[["scales", "neg", `${openDisputes - BASE_DISPUTES + 7} disputas vencem em 48 h`, "Mediação", "#/banco/fila"], ["identification-card", "warn", `${kycCount} contas em análise`, "KYC e antifraude", "#/banco/fila"], ["chart-line-up", "info", "3 limites para revisar", "Clientes e limites", "#/banco/clientes"]].map(([ic, tone, t, d, g]) => `<button type="button" class="line-btn" data-go="${g}"><span class="ic ${tone}">${icon(ic)}</span><span><strong>${t}</strong><small>${d}</small></span>${icon("caret-right")}</button>`).join("")}</section></div></div>`);
}

function operacoes(s, { tab = "contratos" }) {
  const tabs = `<div class="tabs">${[["contratos", "Contratos"], ["cobranca", "Cobrança"], ["conciliacao", "Conciliação e histórico"]].map(([k, l]) => `<button type="button" class="${tab === k ? "on" : ""}" data-go="#/banco/operacoes/${k}">${l}</button>`).join("")}</div>`;
  if (tab === "cobranca") {
    const late = lateInstallments(s);
    const rows = late.map((i) => [two(i.contractId, contractById(s, i.contractId)?.title ?? ""), two(peopleOf(s)[i.owner]?.name ?? "", peopleOf(s)[i.owner]?.clientDoc ?? ""), `<strong>${money(i.valueCents + i.lateFeeCents)}</strong>`, `Parcela ${i.n} de ${i.of}`, chip("3 dias de atraso", "neg")]);
    const sel = late[0];
    const side = sel
      ? panel(`Cobrança · ${sel.contractId}`, `<div class="note danger">${icon("warning-circle")}<span>Parcela ${sel.n} de ${sel.of} atrasada há 3 dias · ${money(sel.valueCents)} + ${money(sel.lateFeeCents)} de juros</span></div>${kv("Cliente", peopleOf(s)[sel.owner]?.name ?? "")}${kv("Limite", "Pausado até o pagamento")}${kv("Custódia do contrato", money(custodyCents(contractById(s, sel.contractId))))}${kv("Histórico", "1 de 1 em dia antes")}<h3>Régua de cobrança</h3><ol class="timeline"><li class="ok">${icon("check-circle")}<div><strong>Aviso no app e e-mail · D+1</strong></div></li><li class="now">${icon("hourglass-medium")}<div><strong>Pix pré-preenchido · D+3</strong></div></li><li>${icon("clock")}<div><strong>Contato do gerente · D+7</strong></div></li><li>${icon("clock")}<div><strong>Negativação · D+${s.bankSettings.negativationDays}</strong></div></li></ol><div class="row-between"><small class="muted">Negativar em</small><div class="choice-list wrap">${[30, 45, 60].map((d) => `<button type="button" class="pill-option ${s.bankSettings.negativationDays === d ? "on" : ""}" data-action="setNegativationDays" data-days="${d}">D+${d}</button>`).join("")}</div></div>${btn("Enviar Pix de cobrança", { action: "bankCharge", data: { id: sel.id } })}`)
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
  return layout("operacoes", "Operações", `${tabs}<div class="filters">${chip("Status: todos")}${chip("Com atraso", "neg")}${chip("Coletivos")}</div>${table(["Contrato", "Partes", "Valor", "Etapa", "Situação"], rows)}`);
}

const evidenceChip = (d) => (!d.providerStatement ? chip("Aguardando o prestador") : d.clientEvidence.length && d.providerEvidence.length ? chip("Provas dos dois lados", "info") : chip("Provas de um lado só", "warn"));
const sameName = (a) => a.name.trim().toLocaleLowerCase("pt-BR") === a.documentName.trim().toLocaleLowerCase("pt-BR");

/** Work queue: disputes, KYC, evidence risk and reviews, ordered by rules (value at stake, deadline, signals). */
export function queueItems(s) {
  const items = [];
  for (const d of s.disputes.filter((x) => x.status !== "closed")) {
    items.push({ id: d.id, type: "Disputa", tone: "neg", sub: d.contractId, priority: disputePriority(d), deadline: d.deadline, read: evidenceChip(d) });
  }
  if (s.newAccount?.status === "review") {
    const ok = sameName(s.newAccount);
    items.push({ id: "KYC-NEW", type: "KYC", tone: "neutral", sub: s.newAccount.name, priority: ok ? 0.55 : 0.8, deadline: "1 dia", read: ok ? chip("Nome confere", "pos") : chip("Nome diferente do documento", "warn") });
  }
  if (s.newAccount?.appeal?.status === "review") {
    items.push({ id: "KYC-NEW", type: "KYC", tone: "neutral", sub: `Contestação · ${s.newAccount.name}`, priority: 0.6, deadline: "2 dias", read: chip("Contestação", "warn") });
  }
  for (const c of s.contracts) {
    c.stages.forEach((st, i) => {
      if (!st.fraudCheck?.risky || st.fraudCheck.decision) return;
      items.push({ id: `EV-${c.id}-${i}`, type: "Risco", tone: "warn", sub: `${c.provider} · etapa ${i + 1}`, priority: 0.75, deadline: "24 h", read: chip(`${st.fraudCheck.flags.length} sinal(is) nas regras`, "neg") });
    });
  }
  for (const r of s.reviews.filter((x) => x.status === "inReview")) {
    items.push({ id: r.id, type: "Reputação", tone: "info", sub: r.provider, priority: 0.3, deadline: "7 dias", read: chip("Confira") });
  }
  return items.sort((a, b) => b.priority - a.priority);
}
const prioLabel = (p) => `${p >= 0.66 ? "Alta" : p >= 0.4 ? "Média" : "Baixa"} · ${p.toFixed(2).replace(".", ",")}`;

function disputePanel(s, d) {
  const c = contractById(s, d.contractId);
  const p = proposalFor(d);
  const canAct = d.status === "mediation";
  return panel(`${d.id} · decidir`, `<p class="small">${esc(c.client)} contra ${esc(c.provider)} · etapa ${d.stage + 1} · ${money(d.amountCents)} bloqueados</p><p class="quote">“${esc(d.report)}”</p>${d.providerStatement ? `<p class="quote">Prestador: “${esc(d.providerStatement)}”</p>` : ""}
    <div class="ia-box"><strong>Provas</strong>
      <div class="row-between"><span>Motivo</span>${chip(REASON_LABEL[d.reason], "info")}</div>
      <div class="row-between"><span>Contratante</span><small>${esc(d.clientEvidence.join(", ") || "sem provas")}</small></div>
      <div class="row-between"><span>Prestador</span><small>${esc(d.providerStatement ? d.providerEvidence.join(", ") || "sem provas" : "sem resposta")}</small></div>
      <small class="muted">A proposta abaixo segue a matriz de mediação. A decisão é sua.</small></div>
    <h3>Proposta pela regra de mediação</h3>${kv("Prestador", `${money(p.providerCents)} (${percent(p.share)})`)}${kv("Contratante", `${money(p.clientCents)} (${percent(1 - p.share)})`)}
    ${canAct ? `${btn("Enviar proposta às partes", { action: "bankPropose", data: { id: d.id } })}<div class="btn-row">${btn("Pedir perícia", { kind: "secondary", action: "bankInspection", data: { id: d.id } })}${btn("Arbitragem", { kind: "secondary", action: "bankArbitration", data: { id: d.id } })}</div>` : `<div class="note info">${icon("info")}<span>Situação atual: ${esc(d.status === "proposal" ? "proposta enviada, aguardando as partes" : d.status === "inspection" ? "perícia agendada" : "em arbitragem")}.</span></div>`}`);
}

function kycPanel(s) {
  const a = s.newAccount;
  return panel(`KYC · ${a.name}`, `${kv("Nome informado", a.name)}${kv("Nome no documento", a.documentName)}${kv("Enviado em", a.submittedAt)}<p class="quote">“${esc(a.services)}”</p>
    <div class="ia-box"><strong>Checagens do cadastro</strong><div class="row-between"><span>Nome informado igual ao do documento</span>${sameName(a) ? chip("Sim", "pos") : chip("Não", "warn")}</div><div class="row-between"><span>Documento e selfie</span>${chip("Enviados", "pos")}</div><small class="muted">Toda conta nova passa por uma pessoa.</small></div>
    ${a.appeal ? `<h3>Contestação</h3><p class="quote">“${esc(a.appeal.text)}”</p>` : ""}
    ${btn(a.appeal ? "Aceitar contestação e aprovar" : "Aprovar conta", { action: "bankDecideAccount", data: { decision: "approve" } })}${btn(a.appeal ? "Manter a recusa" : "Recusar", { kind: "secondary", action: "bankDecideAccount", data: { decision: "refuse" } })}`);
}

function evidencePanel(s, itemId) {
  const [, contractId, stage] = itemId.match(/^EV-(.+)-(\d+)$/);
  const c = contractById(s, contractId);
  const st = c.stages[Number(stage)];
  const fc = st.fraudCheck;
  return panel(`${itemId} · risco`, `<p class="small">${esc(c.provider)} · ${esc(c.title)} · etapa ${Number(stage) + 1} · ${money(st.valueCents)}</p>
    <div class="ia-box"><strong>Checagens em código</strong>${fc.flags.length ? fc.flags.map((f) => `<div class="row-between"><span>${esc(f)}</span>${chip("Sinal", "neg")}</div>`).join("") : "<small>Nenhum sinal nas regras.</small>"}</div>
    <small class="muted">Antifraude: sempre uma pessoa decide.</small>
    ${btn("Liberar para a aprovação", { action: "bankEvidenceDecision", data: { id: contractId, stage, decision: "clear" } })}${btn("Bloquear e investigar", { kind: "danger", action: "bankEvidenceDecision", data: { id: contractId, stage, decision: "block" } })}`);
}

function reviewPanel(s, r) {
  return panel(`${r.id} · avaliação`, `${kv("Prestador", r.provider)}${kv("Nota", `${r.stars} de 5`)}<p class="quote">“${esc(r.comment)}”</p>${btn("Publicar", { action: "bankDecideReview", data: { id: r.id, decision: "publish" } })}${btn("Ocultar", { kind: "secondary", action: "bankDecideReview", data: { id: r.id, decision: "hide" } })}`);
}

function fila(s, { item }) {
  const items = queueItems(s);
  const selected = items.find((i) => i.id === item) ?? items[0];
  let side = panel("Fila", empty("Nada na fila."));
  if (selected) {
    const d = s.disputes.find((x) => x.id === selected.id);
    const r = s.reviews.find((x) => x.id === selected.id);
    if (d) side = disputePanel(s, d);
    else if (selected.id === "KYC-NEW") side = kycPanel(s);
    else if (selected.id.startsWith("EV-")) side = evidencePanel(s, selected.id);
    else if (r) side = reviewPanel(s, r);
  }
  const counts = (t) => items.filter((i) => i.type === t).length;
  const rows = items.map((i) => [`<button type="button" class="cell-link" data-go="#/banco/fila/${esc(i.id)}">${two(i.id, i.sub)}</button>`, chip(i.type, i.tone), `<strong>${prioLabel(i.priority)}</strong>`, esc(i.deadline), i.read]);
  return layout("fila", "Fila de trabalho", `<div class="filters">${chip(`Todos · ${items.length}`, "info")}${chip(`Disputas · ${counts("Disputa")}`)}${chip(`Risco · ${counts("Risco")}`)}${chip(`KYC · ${counts("KYC")}`)}${chip(`Reputação · ${counts("Reputação")}`)}<span class="spacer"></span><small class="muted">Ordenado por prioridade: valor em jogo, prazo e sinais</small></div>
    <div class="split"><div class="grow">${table(["Caso", "Tipo", "Prioridade", "Prazo", "Situação"], rows, items.indexOf(selected))}</div>${side}</div>`);
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
  const side = panel("Paulo Reis · limite", `<p class="small">Pediu aumento de R$ 15.000 para R$ 25.000 para contratar a reforma da cozinha.</p>${kv("Renda declarada", "R$ 14.200/mês")}${kv("Parcelas pagas em dia", "18 de 18", "pos-text")}${kv("Comprometimento com o novo limite", "27%")}${kv("Modelo de crédito Nexo", "Aprova até R$ 22.000")}<div class="ia-box"><div class="row-between"><strong>Reputação como contratante</strong>${chip("Nota 4,7", "pos")}</div><small class="muted">Aprova etapas no prazo e não abriu disputas. Média das avaliações dos prestadores.</small></div>${decision ? `<div class="note info">${icon("check-circle")}<span>Decisão registrada: ${esc(decision)}.</span></div>` : `${btn("Aprovar R$ 22.000,00", { action: "bankLimit", data: { name: "Paulo Reis", decision: "aprovado R$ 22.000,00" } })}<div class="btn-row">${btn("Manter", { kind: "secondary", action: "bankLimit", data: { name: "Paulo Reis", decision: "mantido" } })}${btn("Recusar", { kind: "secondary", action: "bankLimit", data: { name: "Paulo Reis", decision: "recusado" } })}</div>`}`);
  return layout("clientes", "Clientes e limites", `<div class="filters">${chip("Contratantes", "info")}${chip("Prestadores")}${chip("Com atraso")}${chip("Revisão de limite · 1", "warn")}</div><div class="split"><div class="grow">${table(["Cliente", "Limite", "Uso", "Risco", "Situação"], rows, 1)}<p class="small muted">Marina Costa: limite disponível ${money(availableLimitOf(s, "marina"))}${late ? ", crédito pausado pela parcela atrasada" : ""}.</p></div>${side}</div>`);
}

export const webRoutes = {
  "banco/visao": visao, "banco/operacoes/:tab": operacoes, "banco/operacoes": operacoes, "banco/fila": fila, "banco/fila/:item": fila,
  "banco/clientes": clientes,
};
