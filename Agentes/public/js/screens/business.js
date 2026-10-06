// Provider business screens: quote, agenda of receivables, invoices, subcontract and Aval Link.
import { ANTICIPATION_SHARES, TEMPLATES, quoteClients, anticipationCheck, anticipationValues } from "../actions/index.js";
import { contractById, providerList, draft, isProviderOf, myContracts, myName, parseDdMm, person } from "../store.js";
import { appbar, btn, card, checkbox, chip, circle, empty, esc, field, icon, kv, listCard, money, note, option, percent, row, screen, signal } from "../ui.js";

const templatePills = (current, action) =>
  `<div class="choice-list wrap">${Object.entries(TEMPLATES).map(([k, [label]]) => `<button type="button" class="pill-option ${current === k ? "on" : ""}" data-action="${action}" data-key="${k}">${esc(label)}</button>`).join("")}</div>`;

function orcamentoNovo(s) {
  const stages = draft("orc.stages", []);
  const client = draft("orc.client", quoteClients(s)[0]);
  return screen({
    header: appbar({ title: "Novo orçamento" }),
    body: `${card(`${field("Serviço", { bind: "orc.title", value: draft("orc.title") })}${field("Descrição", { bind: "orc.description", value: draft("orc.description"), multiline: true })}${field("Valor total (R$)", { bind: "orc.total", value: draft("orc.total"), inputmode: "decimal" })}`)}
      <h3>Para quem</h3><div class="choice-list wrap">${quoteClients(s).map((c) => `<button type="button" class="pill-option ${client === c ? "on" : ""}" data-action="chooseQuoteClient" data-name="${esc(c)}">${esc(c)}</button>`).join("")}</div>
      <h3>Etapas</h3>${templatePills(draft("orc.template"), "chooseQuoteTemplate")}
      ${stages.length ? card(`${stages.map((st, i) => kv(`${i + 1}. ${st.name} · até ${st.due}`, money(st.valueCents))).join("")}`) : note("Escolha um modelo de etapas. Você ajusta valores e prazos depois.", "info", "list-checks")}`,
    footer: btn("Enviar orçamento", { action: "sendQuote", iconName: "paper-plane-tilt", disabled: stages.length === 0 }),
  });
}

function orcamentoEnviado(s, { id }) {
  const q = s.invites.find((i) => i.id === id);
  return screen({
    header: appbar({ title: "Orçamento enviado" }),
    body: `<div class="center-block">${circle("file-text", "info", 64)}<h2>Orçamento enviado para ${esc(q?.client ?? "")}</h2><p class="muted">Quando o cliente aceitar e pagar, o dinheiro entra em custódia e você começa.</p></div>${q?.client === "Marina Costa" ? note("Na demonstração, troque para Marina no topo para aceitar o orçamento.", "info", "info") : ""}`,
    footer: btn("Ir para o início", { go: "#/inicio" }),
  });
}

function orcamento(s, { id }) {
  const p = person(s);
  const q = s.invites.find((i) => i.id === id && i.from === "provider" && (i.client === p?.clientName || i.provider === p?.providerName));
  if (!q) return screen({ header: appbar({ title: "Orçamento" }), body: empty("Orçamento não encontrado.") });
  const isClient = q.client === p.clientName;
  const insured = Boolean(draft("orcamento.insurance"));
  const provider = providerList(s).find((x) => x.name === q.provider);
  const open = isClient && q.status === "sent";
  return screen({
    header: appbar({ title: "Orçamento" }),
    body: `${card(`<div class="row-gap">${circle("briefcase")}<div><strong>${esc(q.provider)}</strong><small class="muted">${esc(provider?.activity ?? "")} · nota ${esc(provider?.rating ?? "")}</small></div></div><h2>${esc(q.title)}</h2><div class="amount dark">${money(q.totalCents)}</div><p class="small muted">${esc(q.description)}</p>${q.stages.map((st, i) => kv(`${i + 1}. ${st.name} · até ${st.due}`, money(st.valueCents))).join("")}`)}
      ${open ? card(`<div class="toggle-row">${circle("shield-check", "pos")}<div><strong>Seguro Aval da obra</strong><small>Prêmio de 2,5%, pago junto com o serviço.</small></div><button type="button" class="toggle ${insured ? "on" : ""}" role="switch" aria-checked="${insured}" aria-label="Seguro Aval da obra" data-action="toggleQuoteInsurance"><span></span></button></div>`) : ""}
      ${open ? checkbox("Li e aceito as condições e a cláusula compromissória de arbitragem.", { bind: "orcamento.terms", checked: draft("orcamento.terms") }) : chip(q.status === "sent" ? "Aguardando o cliente" : q.status === "accepted" ? "Aceito" : "Recusado", q.status === "accepted" ? "pos" : "neutral")}`,
    footer: open ? `${btn("Aceitar e pagar", { action: "acceptQuote", data: { id } })}${btn("Recusar", { kind: "text", action: "declineQuote", data: { id } })}` : q.contractId ? btn("Ver serviço", { go: `#/servico/${q.contractId}` }) : "",
  });
}

const stageChip = (st) => (st.anticipation ? chip("Antecipada", "info") : st.status === "awaitingApproval" ? chip("Entregue", "warn") : st.status === "disputed" ? chip("Em disputa", "neg") : chip("A executar"));

/** Receivables by month: what is in custody, when it is expected, and how much can be anticipated now. */
function agenda(s) {
  const mine = myContracts(s).filter((c) => c.status !== "completed");
  const items = mine.flatMap((c) => c.stages.map((st, i) => ({ c, st, i }))).filter(({ st }) => !["released", "split"].includes(st.status));
  items.sort((a, b) => parseDdMm(a.st.due) - parseDdMm(b.st.due));
  const byMonth = new Map();
  for (const it of items) {
    const label = parseDdMm(it.st.due).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    byMonth.set(label, [...(byMonth.get(label) ?? []), it]);
  }
  const share = Number(draft("antecipar.share", 0.95));
  const ready = items.find(({ c, i }) => anticipationCheck(s, c, i).every(([, okItem]) => okItem));
  const total = items.reduce((a, { st }) => a + st.valueCents, 0);
  const months = [...byMonth.entries()].map(([month, list]) => listCard(month, list.map(({ c, st, i }) => row({ icon: "calendar-blank", title: `${st.due} · ${c.title}`, detail: `Etapa ${i + 1} · ${st.name}`, value: money(st.valueCents), go: `#/servico/${c.id}`, extra: stageChip(st) })).join(""))).join("");
  const toggles = mine.map((c) => `<div class="toggle-row pad">${circle("lightning", c.autoAnticipate ? "pos" : "neutral", 32)}<div><strong>${esc(c.title)}</strong><small>Antecipa 95% assim que a entrega for enviada</small></div><button type="button" class="toggle ${c.autoAnticipate ? "on" : ""}" role="switch" aria-checked="${Boolean(c.autoAnticipate)}" aria-label="Antecipação automática de ${esc(c.title)}" data-action="toggleAutoAnticipation" data-id="${esc(c.id)}"><span></span></button></div>`).join("");
  return screen({
    header: appbar({ title: "Agenda de recebíveis" }),
    body: `${card(`<small>A receber nos próximos meses</small><div class="amount">${money(total)}</div><small>${items.length} etapa(s) em custódia ou a executar</small>`, "navy")}
      ${ready ? card(`<div class="row-between"><strong>Antecipar agora</strong>${chip(`etapa ${ready.i + 1} · ${ready.c.title}`, "info")}</div><div class="choice-list wrap">${ANTICIPATION_SHARES.map((v) => `<button type="button" class="pill-option ${share === v ? "on" : ""}" data-action="setAnticipationShare" data-share="${v}">${percent(v)}</button>`).join("")}</div>${kv("Você recebe hoje", money(anticipationValues(ready.st, share).netCents), "pos-text")}${btn("Antecipar", { kind: "secondary small", go: `#/antecipar/${ready.c.id}/${ready.i}`, iconName: "lightning" })}`, "soft") : note("Nenhuma etapa entregue para antecipar agora.", "info", "lightning")}
      ${months || empty("Nada a receber.")}
      ${toggles ? listCard("Antecipação automática", toggles) : ""}`,
  });
}

function notas(s) {
  const me = myName(s);
  const list = s.invoices.filter((n) => n.provider === me);
  const total = list.reduce((a, n) => a + n.amountCents, 0);
  return screen({
    header: appbar({ title: "Notas fiscais" }),
    body: `${card(`<small class="muted">Emitidas automaticamente a cada liberação</small><div class="amount dark">${money(total)}</div><small class="muted">${list.length} NFS-e · ${esc(person(s).providerDoc)}</small>`)}
      ${list.length ? listCard("", list.map((n) => row({ icon: "receipt", title: `${n.id} · ${n.client}`, detail: `${n.issuedAt} · ${contractById(s, n.contractId)?.title ?? n.contractId} · etapa ${n.stage + 1}`, value: money(n.amountCents), tone: "pos" })).join("")) : empty("Nenhuma nota emitida ainda.")}
      ${note("A NFS-e sai em nome do seu MEI ou CNPJ quando o dinheiro deixa a custódia. Você não precisa emitir nada.", "info", "file-text")}`,
  });
}

function subcontratar(s, { id, stage }) {
  const c = contractById(s, id);
  const idx = Number(stage);
  const st = c && isProviderOf(c, s) ? c.stages[idx] : null;
  if (!st) return screen({ header: appbar({ title: "Subcontratar" }), body: empty("Etapa não encontrada.") });
  const chosen = draft("sub.provider");
  const options = providerList(s).filter((p) => ![c.provider, c.client, person(s).providerName].includes(p.name));
  return screen({
    header: appbar({ title: "Subcontratar etapa" }),
    body: `${card(`<small class="muted">${esc(c.title)} · etapa ${idx + 1}</small><h3>${esc(st.name)}</h3>${kv("Valor da etapa", money(st.valueCents))}${kv("Prazo", st.due)}`)}
      <h3>Quem vai executar</h3>${options.map((p) => option({ title: p.name, sub: `${p.activity} · nota ${p.rating}`, selected: chosen === p.name, action: "chooseSubProvider", data: { name: p.name } })).join("")}
      ${card(`${field("Valor do subcontrato (R$)", { bind: "sub.value", value: draft("sub.value"), inputmode: "decimal" })}${field("O que ele entrega", { bind: "sub.description", value: draft("sub.description"), multiline: true, rows: 2 })}`)}
      ${note("O valor sai do seu saldo Nexo para a custódia. Quando a etapa da obra principal for aprovada, o subcontratado recebe na mesma hora.", "info", "tree-structure")}`,
    footer: btn("Criar subcontrato", { action: "createSubcontract", data: { id, stage }, iconName: "tree-structure" }),
  });
}

function linkNovo() {
  return screen({
    header: appbar({ title: "Aval Link" }),
    body: `<div class="center-block">${circle("link", "info", 56)}<h2>Cobre com custódia por link</h2><p class="muted">Seu cliente paga por Pix, sem baixar o app. O dinheiro fica protegido até cada etapa ser aprovada.</p></div>
      ${card(`${field("Serviço", { bind: "link.title", value: draft("link.title") })}${field("Valor (R$)", { bind: "link.total", value: draft("link.total"), inputmode: "decimal" })}${field("WhatsApp do cliente", { bind: "link.phone", value: draft("link.phone"), inputmode: "tel" })}`)}`,
    footer: btn("Gerar link", { action: "createLink", iconName: "link" }),
  });
}

function linkEnviado(s, { id }) {
  const l = s.links.find((x) => x.id === id && x.provider === myName(s));
  if (!l) return screen({ header: appbar({ title: "Aval Link" }), body: empty("Link não encontrado.") });
  return screen({
    header: appbar({ title: "Aval Link" }),
    body: `${card(`<div class="center-block"><div class="qr">${icon("qr-code")}</div><code class="pix-code">aval.banconexo.com.br/l/${esc(l.id)}</code></div>`)}
      <div class="wa">${icon("chat-circle-text")}<div><small>WhatsApp para ${esc(l.phone)}</small><p>Olá! Segue o link do serviço ${esc(l.title)} (${money(l.totalCents)}). O pagamento fica protegido no Nexo até você aprovar cada etapa: aval.banconexo.com.br/l/${esc(l.id)}</p></div></div>
      ${chip(l.status === "paid" ? `Pago por ${l.client}` : "Aguardando pagamento", l.status === "paid" ? "pos" : "warn")}`,
    footer: `${btn("Abrir como o cliente", { go: `#/link/${l.id}` })}${btn("Copiar link", { kind: "text", action: "copied" })}`,
  });
}

export const businessRoutes = {
  "orcamento/novo": orcamentoNovo, "orcamento/enviado/:id": orcamentoEnviado, "orcamento/:id": orcamento, agenda, notas,
  "subcontratar/:id/:stage": subcontratar, "link/novo": linkNovo, "link/enviado/:id": linkEnviado,
};
