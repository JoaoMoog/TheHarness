// Nexo Serviços requests: a 4-step wizard (what, details, where and when, review), my requests and the quote comparison.
import { insurancePremium } from "../actions/index.js";
import { categoryOf, homeOf, negotiationSide, providerById, threadKey } from "../actions/market.js";
import { MAX_QUOTES, estimateRange } from "../domain/marketplace.js";
import { CATEGORIES, PLACES, URGENCY } from "../seed-market.js";
import { draft, installmentCents } from "../store.js";
import { actionAttrs, appbar, btn, busyNote, card, checkbox, chip, empty, esc, field, icon, money, note, percent, screen, signal } from "../ui.js";
import { bkFacts, bkItem, bkSection } from "./nexo-kit.js";
import { categoryLabel, ratingText } from "./market-kit.js";

const STEPS = 4;
const CREDIT_INSTALLMENTS = 6;

const stepBar = (n) => `<div class="steps">${Array.from({ length: STEPS }, (_, i) => `<span class="${i < n ? "on" : ""}"></span>`).join("")}</div>`;
const pills = (options, current, action, dataKey, extra = {}) =>
  `<div class="choice-list wrap">${options.map(([value, label]) => `<button type="button" class="pill-option ${current === value ? "on" : ""}" ${actionAttrs({ action, data: { [dataKey]: value, ...extra } })}>${esc(label)}</button>`).join("")}</div>`;
const wizard = (s, n, title, body, footer) =>
  screen({ header: appbar({ title: "Fazer pedido" }), body: `${stepBar(n)}<h2 class="title">${esc(title)}</h2>${body}`, footer: s.ui.busy.pedido ? busyNote("Aval IA lendo o pedido") : footer });

function step1(s) {
  const target = draft("pedido.target") ? providerById(s, draft("pedido.target")) : null;
  return wizard(s, 1, "O que você precisa?", `${target ? note(`${target.name} recebe seu pedido, e outros prestadores verificados também podem responder.`, "info", "storefront") : ""}
    ${card(field("Descreva o serviço", { bind: "pedido.text", value: draft("pedido.text", ""), multiline: true, rows: 5, placeholder: "Ex.: trocar a fiação de um apartamento de 2 quartos; os disjuntores desarmam com o chuveiro ligado." }))}
    ${note("Quanto mais detalhe, melhores os orçamentos: o que fazer, tamanho, cômodos e o problema.", "info", "sparkle")}`,
  btn("Continuar", { action: "analyzeRequest" }));
}

function readingNote(reading) {
  if (!reading) return "";
  const cat = reading.category;
  const done = reading.complete;
  return `${cat ? `<div class="mk-notice">${cat.routing === "automatic" ? signal(`Categoria: ${categoryLabel(cat.value)} · ${percent(cat.confidence)}`) : signal("Confira a categoria", "review")}</div>` : ""}
    ${done && !done.value ? note("Faltam detalhes para orçar. Responda as perguntas abaixo.", "warn", "warning-circle") : ""}`;
}

function step2(s) {
  const catId = draft("pedido.categoryId");
  const cat = categoryOf(catId);
  const questions = cat ? cat.questions.map(([q, options], i) => `<h3>${esc(q)}</h3>${pills(options.map((o) => [o, o]), draft(`pedido.answers.${i}`), "setRequestAnswer", "value", { q: i })}`).join("") : "";
  return wizard(s, 2, "Detalhes do serviço", `${readingNote(draft("pedido.reading"))}
    <h3>Categoria</h3>${pills(CATEGORIES.map((c) => [c.id, c.label]), catId, "setRequestCategory", "id")}${questions}`,
  btn("Continuar", { action: "requestStep", data: { step: 3 } }));
}

function step3(s) {
  const place = draft("pedido.neighborhood", homeOf(s)?.neighborhood);
  return wizard(s, 3, "Onde e quando", `<h3>Bairro</h3>${pills(Object.keys(PLACES).map((p) => [p, p]), place, "setRequestPlace", "value")}
    <h3>Quando você precisa?</h3>${pills(URGENCY.map((u) => [u, u]), draft("pedido.when"), "setRequestWhen", "value")}`,
  btn("Continuar", { action: "requestStep", data: { step: 4 } }));
}

function step4(s) {
  const cat = categoryOf(draft("pedido.categoryId"));
  const range = cat ? estimateRange(s.listings.filter((l) => l.status === "published"), cat.id) : null;
  const answers = Object.values(draft("pedido.answers", {}) ?? {});
  return wizard(s, 4, "Revise e publique", `${card(`<p class="quote">${esc(draft("pedido.text", ""))}</p>${bkFacts([["Categoria", cat?.label ?? ""], ["Onde", draft("pedido.neighborhood", "")], ["Quando", draft("pedido.when", "")], ...(answers.length ? [["Detalhes", answers.join(", ")]] : [])])}`)}
    ${range ? card(`<small class="muted">Faixa de preço no Nexo Serviços</small><div class="amount dark">${money(range.minCents)} a ${money(range.maxCents)}</div><small class="muted">Calculada pelos anúncios publicados nesta categoria.</small>`, "soft") : ""}
    ${note(`Até ${MAX_QUOTES} prestadores verificados respondem. Para eles, responder é grátis; você só paga quando aceitar, com o dinheiro protegido pelo Aval.`, "info", "shield-check")}`,
  btn("Publicar pedido", { action: "publishRequest", iconName: "megaphone" }));
}

const STATUS = { open: ["Aberto", "info"], hired: ["Contratado", "pos"], closed: ["Encerrado", "neutral"] };

function pedidos(s) {
  const mine = s.requests.filter((r) => r.owner === s.session.person);
  return screen({
    cls: "bk-flat", header: appbar({ title: "Meus pedidos" }),
    body: bkSection("Pedidos", mine.map((r) => bkItem({
      icon: categoryOf(r.categoryId)?.icon ?? "megaphone", label: `${STATUS[r.status][0]} · ${r.quotes.length} de ${MAX_QUOTES} orçamentos · ${r.createdAt}`,
      title: r.title, tone: r.status === "open" && r.quotes.length ? "warn" : "", go: `#/pedido/${r.id}`,
    })), { empty: "Você ainda não fez pedidos." }),
    footer: btn("Fazer pedido", { go: "#/pedido/novo/1", iconName: "megaphone" }),
  });
}

/** Side-by-side numbers; the best value of each column is highlighted by code. */
function compareTable(s, quotes) {
  const ratingOf = (q) => providerById(s, q.providerId)?.rating ?? 0;
  const lowest = Math.min(...quotes.map((q) => q.totalCents));
  const best = Math.max(...quotes.map(ratingOf));
  const fastest = Math.min(...quotes.map((q) => q.days));
  const cell = (text, win) => `<td class="${win ? "pos-text" : ""}">${text}</td>`;
  return `<table class="mk-compare"><thead><tr><th>Prestador</th><th>Valor</th><th>Prazo</th><th>Nota</th></tr></thead><tbody>${quotes.map((q) => `<tr><td>${esc(q.provider)}</td>${cell(money(q.totalCents), q.totalCents === lowest)}${cell(`${q.days}d`, q.days === fastest)}${cell(ratingText(ratingOf(q)), ratingOf(q) === best)}</tr>`).join("")}</tbody></table>`;
}

function quoteCard(s, r, q) {
  const p = providerById(s, q.providerId);
  const chosen = draft("pedido.choice") === q.id;
  return card(`<div class="row-between"><strong>${esc(q.provider)}</strong>${p?.verified ? chip("Verificado Nexo", "info") : chip("Em verificação")}</div>
    <div class="amount dark">${money(q.totalCents)}</div>${p?.acceptsCredit ? `<small class="muted">ou ${CREDIT_INSTALLMENTS}x de ${money(installmentCents(q.totalCents, CREDIT_INSTALLMENTS))} no crédito Aval</small>` : ""}
    ${bkFacts([["Prazo", `${q.days} dias`], ["Etapas", q.stages.map((st) => st.name).join(", ")], ["Nota", p ? `${ratingText(p.rating)} · ${p.jobsDone} serviços` : "Sem histórico"]])}
    <p class="quote">${esc(q.message)}</p>
    <button type="button" class="bk-link" data-go="#/prestador/${esc(q.providerId)}">Ver perfil e avaliações</button>
    ${r.status === "open" ? `<div class="btn-row">${btn("Conversar", { kind: "secondary small", go: `#/negociacao/${r.id}/${q.providerId}`, iconName: "chat-circle-text" })}${btn(chosen ? "Escolhido" : "Escolher", { kind: chosen ? "primary small" : "secondary small", action: "chooseQuote", data: { quote: q.id } })}</div>` : ""}`, chosen ? "outline" : "");
}

/** Pre-hire chat between the client and one provider; contacts are masked by code until the contract exists. */
function negociacao(s, { request: requestId, provider: providerId }) {
  const r = s.requests.find((x) => x.id === requestId);
  const side = negotiationSide(s, r, providerId);
  const q = r?.quotes.find((x) => x.providerId === providerId);
  if (!side || !q) return screen({ header: appbar({ title: "Conversa" }), body: empty("Conversa não encontrada.") });
  const thread = (s.negotiations ?? {})[threadKey(r.id, providerId)] ?? [];
  const other = side === "client" ? q.provider : r.client;
  const bubbles = thread.map((m) => {
    const mine = m.from === side;
    return `<div class="bubble ${mine ? "user" : "ia"}"><small class="${mine ? "light" : "muted"}">${esc(m.from === "client" ? r.client : q.provider)} · ${esc(m.at)}</small>${esc(m.text)}${m.auto ? `<small class="muted">Resposta automática da demonstração</small>` : ""}</div>`;
  }).join("");
  const bind = `neg.${r.id}.${providerId}`;
  return screen({
    header: appbar({ title: other }),
    body: `${note("Antes do contrato, telefone e e-mail ficam ocultos. Negociando pelo app, o pagamento fica protegido pelo Aval.", "info", "lock-simple")}
      ${card(`<div class="row-between"><small class="muted">${esc(r.title)}</small>${chip(`${q.days} dias`)}</div><strong>${esc(q.provider)} · ${money(q.totalCents)}</strong>`)}
      <div class="chat">${bubbles || empty("Tire dúvidas sobre o orçamento antes de escolher.")}</div>
      ${side === "client" && r.status === "open" ? btn("Escolher este orçamento", { kind: "secondary", action: "chooseQuote", data: { quote: q.id, back: `#/pedido/${r.id}` } }) : ""}`,
    footer: `<div class="chat-input"><input data-bind="${esc(bind)}" placeholder="Escreva para ${esc(other)}" value="${esc(draft(bind, ""))}" aria-label="Mensagem"><button type="button" class="send" data-action="sendNegotiation" data-request="${esc(r.id)}" data-provider="${esc(providerId)}" aria-label="Enviar">${icon("paper-plane-tilt")}</button></div>`,
  });
}

function pedido(s, { id }) {
  const r = s.requests.find((x) => x.id === id);
  if (!r || r.owner !== s.session.person) return screen({ header: appbar({ title: "Pedido" }), body: empty("Pedido não encontrado.") });
  const choice = r.quotes.find((q) => q.id === draft("pedido.choice"));
  const insured = Boolean(draft("pedido.insurance", false));
  const accept = choice && r.status === "open"
    ? card(`<strong>Contratar ${esc(choice.provider)}</strong>${checkbox(`Incluir Seguro Aval da obra (${money(insurancePremium(choice.totalCents))})`, { bind: "pedido.insurance", checked: insured })}${checkbox("Li e aceito as condições e a cláusula compromissória.", { bind: "pedido.terms", checked: draft("pedido.terms", false) })}`, "soft") : "";
  const footer = r.status === "hired" ? btn("Ver serviço", { go: `#/servico/${r.contractId}` })
    : choice ? btn(`Aceitar e pagar ${money(choice.totalCents)}`, { action: "acceptRequestQuote", data: { id: r.id, quote: choice.id } })
      : r.status === "open" ? btn("Encerrar pedido", { kind: "text", action: "closeRequest", data: { id: r.id } }) : "";
  return screen({
    header: appbar({ title: `Pedido ${r.id}` }),
    body: `${card(`<div class="row-between">${chip(STATUS[r.status][0], STATUS[r.status][1])}<small class="muted">${esc(r.createdAt)} · ${esc(r.neighborhood)}</small></div><h3>${esc(r.title)}</h3><p class="small muted">${esc(r.description)}</p>`)}
      <div class="row-between"><h3>Orçamentos</h3>${chip(`${r.quotes.length} de ${MAX_QUOTES}`, "info")}</div>
      ${r.quotes.length > 1 ? compareTable(s, r.quotes) : ""}
      ${r.quotes.length ? r.quotes.map((q) => quoteCard(s, r, q)).join("") : empty("Os prestadores da região estão vendo seu pedido.")}
      ${r.status === "open" && r.incoming.length ? note("Outros prestadores estão orçando. Você recebe um aviso quando chegar.", "info", "clock") : ""}
      ${r.status === "hired" ? note("Contratado com proteção Aval. Acompanhe as etapas em Serviços.", "pos", "check-circle") : ""}
      ${accept}`,
    footer,
  });
}

export const marketRequestRoutes = {
  "pedido/novo/1": step1, "pedido/novo/2": step2, "pedido/novo/3": step3, "pedido/novo/4": step4, pedidos, "pedido/:id": pedido,
  "negociacao/:request/:provider": negociacao,
};
