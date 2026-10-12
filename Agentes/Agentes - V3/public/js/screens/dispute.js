import { claimEligibility, proposalFor } from "../actions/index.js";
import { canSee, contractById, draft, isProviderOf, myContracts } from "../store.js";
import { appbar, btn, card, chip, circle, empty, esc, field, icon, kv, listCard, money, note, row, screen, sheet, timeline } from "../ui.js";
import { ATTACH } from "./provider.js";

const EVIDENCE_KINDS = ATTACH.filter(([k]) => k !== "location");
/** Evidence like a delivery: buttons for photo, video and document, and the list of what is attached. */
function evidencePicker(key) {
  const files = draft(`${key}.files`) ?? [];
  const icons = Object.fromEntries(ATTACH.map(([k, , ic]) => [k, ic]));
  const list = files.map((f, i) => row({ icon: icons[f.kind], title: f.caption, action: "removeDisputeFile", data: { key, index: i }, tone: "neutral", extra: `<small class="muted">remover</small>` })).join("");
  return `<strong>Suas provas</strong><div class="attach-grid">${EVIDENCE_KINDS.map(([k, l, ic]) => `<button type="button" class="attach" data-action="addDisputeFile" data-key="${key}" data-kind="${k}">${icon(ic)}<strong>${l}</strong><small>Adicionar</small></button>`).join("")}</div>${list}`;
}

export const REASON_LABEL = {
  deliveryQuality: "Qualidade da entrega", delay: "Atraso", scopeChange: "Escopo", payment: "Pagamento", abandonment: "Obra abandonada", other: "Outro",
};
const STATUS = {
  mediation: ["Em mediação", "warn"], proposal: ["Proposta de acordo", "info"], inspection: ["Perícia agendada", "warn"],
  arbitration: ["Em arbitragem", "neg"], closed: ["Encerrada", "pos"],
};

function disputas(s) {
  const ids = new Set(myContracts(s).map((c) => c.id));
  const list = s.disputes.filter((d) => ids.has(d.contractId));
  return screen({
    header: appbar({ title: "Disputas" }),
    body: list.length
      ? listCard("", list.map((d) => row({ icon: "scales", title: `${d.id} · ${contractById(s, d.contractId).title}`, detail: `${REASON_LABEL[d.reason]} · ${money(d.amountCents)}`, tone: d.status === "closed" ? "neutral" : "neg", go: `#/disputa/${d.id}`, extra: chip(STATUS[d.status][0], STATUS[d.status][1]) })).join(""))
      : `<div class="center-block">${circle("scales", "neutral", 56)}<h2>Nenhuma disputa</h2><p class="muted">Se algo der errado num marco, abra a disputa pela página do serviço. O valor fica bloqueado até a decisão.</p></div>`,
    footer: btn("Ver meus serviços", { kind: "secondary", go: "#/servicos" }),
  });
}

/** Matrix row "only timing": when the reason is a delay, offer a new date instead of blocking the stage value. */
function scheduleCard(reason, id, stage) {
  if (reason !== "delay") return "";
  return card(`<strong>Foi só atraso?</strong><p class="small">Pela matriz de resolução, o caminho é combinar uma nova data sem mexer no valor do marco. Nada fica bloqueado.</p>${btn("Propor nova data", { kind: "secondary small", go: `#/nova-data/${id}/${stage}`, iconName: "calendar-blank" })}`, "soft");
}

function novaDisputa(s, { id, stage }) {
  const c = contractById(s, id);
  const idx = Number(stage);
  const st = c?.stages[idx];
  if (!st) return screen({ header: appbar({ title: "Abrir disputa" }), body: empty("Marco não encontrado.") });
  const reason = draft("disputa.reason");
  const reasonChips = Object.entries(REASON_LABEL).map(([k, label]) =>
    `<button type="button" class="pill-option ${reason === k ? "on" : ""}" data-action="setDisputeReason" data-reason="${k}">${esc(label)}</button>`).join("");
  return screen({
    header: appbar({ title: "Abrir disputa" }),
    body: `${card(`<strong>Marco ${idx + 1} · ${esc(st.name)}</strong><small class="muted">${esc(c.title)} · ${money(st.valueCents)} guardado</small>`)}
      ${card(field("O que aconteceu?", { bind: "disputa.report", value: draft("disputa.report"), multiline: true, rows: 4 }))}
      ${card(`<strong>Motivo</strong><div class="choice-list wrap">${reasonChips}</div>`)}
      ${scheduleCard(reason, id, stage)}
      ${card(`${kv("Bloqueado até a decisão", money(st.valueCents), "neg-text")}${evidencePicker("disputa")}`)}`,
    footer: btn("Abrir disputa", { kind: "danger", action: "submitDispute", data: { id, stage }, disabled: !reason }),
  });
}

function evidenceLines(d) {
  const line = (label, list, waiting) => {
    const status = waiting ? chip("Aguardando", "neutral") : list.length ? chip("Com provas", "pos") : chip("Sem provas", "warn");
    return `<div class="row-between line"><div><strong>${esc(label)}</strong><small class="muted">${esc(list.join(", ") || (waiting ? "sem resposta ainda" : "nenhuma prova"))}</small></div>${status}</div>`;
  };
  return `${line("Contratante", d.clientEvidence, false)}${line("Prestador", d.providerEvidence, !d.providerStatement)}`;
}

function acompanhar(s, { id }) {
  const d = s.disputes.find((x) => x.id === id && canSee(contractById(s, x.contractId), s));
  if (!d) return screen({ header: appbar({ title: "Disputa" }), body: empty("Disputa não encontrada.") });
  const c = contractById(s, d.contractId);
  const isProvider = isProviderOf(contractById(s, d.contractId), s);
  const [label, tone] = STATUS[d.status];
  const next = { mediation: [["Mediação BTG", `Até ${d.deadline} · proposta de acordo`, "now"], ["Arbitragem", "Só se não houver acordo", "next"]], proposal: [["Decisão das partes", "Aceitar a proposta ou seguir", "now"]], inspection: [["Laudo da perícia", "Em até 10 dias", "now"]], arbitration: [["Decisão da câmara", "Final e obrigatória", "now"]], closed: [] }[d.status];
  const respond = isProvider && !d.providerStatement
    ? card(`<strong>Sua versão</strong>${field("O que você tem a dizer?", { bind: "resposta.statement", value: draft("resposta.statement"), multiline: true })}${evidencePicker("resposta")}${btn("Enviar resposta", { action: "respondDispute", data: { id } })}`)
    : "";
  let footer = "";
  if (d.status === "proposal" || d.status === "closed") footer = btn(d.status === "closed" ? "Ver resultado" : "Ver proposta", { go: `#/disputa/${id}/resultado` });
  return screen({
    header: appbar({ title: `Disputa ${d.id}` }),
    body: `${card(`<div class="row-between">${chip(label, tone)}<small class="muted">${d.slaBreached ? "Prazo vencido · prioridade alta" : `Prazo ${esc(d.deadline)}`}</small></div><h2>${money(d.amountCents)} ${d.status === "closed" ? "resolvidos" : "bloqueados"}</h2><small class="muted">${esc(c.title)} · marco ${d.stage + 1} · ${esc(REASON_LABEL[d.reason])}</small>`)}
      <p class="quote">“${esc(d.report)}”</p>
      ${card(`<strong>Prazos da disputa</strong>${kv("Provas das duas partes", `até ${d.evidenceDeadline ?? d.deadline} · 72 horas`)}${kv("Decisão da mediação", `até ${d.slaDeadline ?? d.deadline} · 7 dias corridos no cenário de teste`)}${d.chatCount ? kv("Conversa do contrato", `${d.chatCount} mensagens anexadas`) : ""}<p class="small muted">Envie informações sobre o ocorrido. As duas partes terão oportunidade de responder.</p>`, "dp-sla")}
      ${card(`<strong>Provas de cada lado</strong>${evidenceLines(d)}`)}
      ${card(`<strong>${d.providerStatement ? "Informações recebidas" : "Aguardando resposta do prestador"}</strong><p class="small">${d.providerStatement ? "A análise das evidências ainda não foi realizada por um responsável." : `Resposta até ${esc(d.evidenceDeadline ?? d.deadline)}. Não há decisão nesta etapa.`}</p>`, "soft dp-rule")}
      ${respond}
      ${card(`<strong>Andamento</strong>${timeline([...d.history, ...next])}`)}`,
    footer,
  });
}

function resultado(s, { id }) {
  const d = s.disputes.find((x) => x.id === id && canSee(contractById(s, x.contractId), s));
  if (!d) return screen({ header: appbar({ title: "Resultado" }), body: empty("Disputa não encontrada.") });
  const isProvider = isProviderOf(contractById(s, d.contractId), s);
  const p = d.proposal ?? proposalFor(d);
  const closed = d.status === "closed";
  const c = contractById(s, d.contractId);
  const insurance = closed && !isProvider ? claimEligibility(s, c) : null;
  const footer = insurance?.eligible
    ? btn(`Acionar Seguro Aval · ${money(insurance.payoutCents)}`, { go: `#/seguro/${c.id}`, iconName: "shield-check" })
    : d.status === "proposal" && !isProvider
    ? `${btn("Aceitar proposta", { action: "acceptProposal", data: { id } })}<div class="btn-row">${btn("Pedir perícia", { kind: "secondary", action: "clientInspection", data: { id } })}${btn("Ir à arbitragem", { kind: "secondary", action: "askArbitration", data: { id } })}</div>`
    : btn("Voltar à disputa", { kind: "secondary", go: `#/disputa/${id}` });
  return screen({
    header: appbar({ title: "Resultado" }),
    body: `<div class="center-block">${circle(closed ? "check-circle" : "scales", closed ? "pos" : "info", 56)}<h2>${closed ? "Acordo fechado" : d.status === "proposal" ? "Proposta da mediação" : STATUS[d.status][0]}</h2><p class="muted">Disputa ${esc(d.id)} · marco ${d.stage + 1}</p></div>
      ${card(`<strong>Divisão dos ${money(d.amountCents)}</strong><div class="split-bar"><span style="width:${p.share * 100}%"></span></div>${kv("Prestador recebe", money(p.providerCents), "pos-text")}${kv(isProvider ? "Volta para a contratante" : "Volta para você", money(p.clientCents), "dest")}<p class="small muted">Regra aplicada: ${esc(p.rule ?? proposalFor(d).rule)}.</p>`)}
      ${card(`<strong>Perícia técnica</strong><p class="small">Avaliação no local por um técnico. Custa R$ 380,00 e é paga por quem perder.</p>`)}
      ${card(`<div class="row-gap">${icon("gavel")}<strong>Sem acordo, vai para arbitragem</strong></div><p class="small">Um árbitro independente decide, pago pelo seguro de arbitragem que já vem em toda operação. Ninguém paga nada a mais. A decisão é final, como prevê a cláusula que vocês aceitaram.</p>`, "dp-arb")}`,
    footer,
  });
}

function avaliar(s, { id }) {
  const c = contractById(s, id);
  if (!c) return screen({ header: appbar({ title: "Avaliar" }), body: empty("Serviço não encontrado.") });
  const stars = draft("review.stars");
  const tags = draft("review.tags", ["Pontualidade", "Qualidade"]);
  return screen({
    header: appbar({ title: "Avaliar" }),
    body: `<div class="center-block">${circle("briefcase", "info", 56)}<h2>Como foi com ${esc(c.provider)}?</h2><p class="muted">${esc(c.title)} concluído</p><div class="stars">${[1, 2, 3, 4, 5].map((n) => `<button type="button" class="${n <= stars ? "on" : ""}" data-action="setStars" data-n="${n}" aria-label="${n} estrela(s)">${icon("star")}</button>`).join("")}</div></div>
      ${card(`<strong>O que se destacou?</strong><div class="choice-list wrap">${["Pontualidade", "Qualidade", "Limpeza", "Comunicação", "Preço justo"].map((t) => `<button type="button" class="pill-option ${tags.includes(t) ? "on" : ""}" data-action="toggleTag" data-tag="${t}">${t}</button>`).join("")}</div>`)}
      ${card(field("Comentário", { bind: "review.comment", value: draft("review.comment"), multiline: true }))}
      ${note("O BTG pode ocultar comentários com ofensas ou dados pessoais.", "info", "shield-check")}`,
    footer: btn("Publicar avaliação", { action: "publishReview", data: { id }, busy: s.ui.busy.review }),
  });
}

function arbitrationSheet(s) {
  const { id } = s.ui.sheet;
  return sheet("Ir à arbitragem", `<p>A câmara de arbitragem indicada pelo BTG analisa o caso. A decisão é final e vale para as duas partes.</p>${kv("Prazo estimado", "30 a 60 dias")}${kv("Valor bloqueado até lá", money(s.disputes.find((d) => d.id === id).amountCents))}${btn("Confirmar arbitragem", { kind: "danger", action: "confirmArbitration", data: { id } })}${btn("Voltar", { kind: "text", action: "closeSheet" })}`);
}

export const disputeRoutes = {
  disputas, "disputa/nova/:id/:stage": novaDisputa, "disputa/:id": acompanhar, "disputa/:id/resultado": resultado, "avaliar/:id": avaliar,
};
export const disputeSheets = { arbitragem: arbitrationSheet };
