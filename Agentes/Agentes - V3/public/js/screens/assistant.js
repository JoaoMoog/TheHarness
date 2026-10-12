// Chat screens of the assistant (simulated by rules): defining the milestones of a payment, and questions about paying with Aval.
import { FAQ, SUGGESTED_QUESTIONS } from "../domain/assistant.js";
import { draft } from "../store.js";
import { stageShares } from "../domain/protected.js";
import { appbar, btn, empty, esc, icon, money, screen } from "../ui.js";

const STAGE_QUICK = ["Material na frente", "Quero 2 marcos", "Quero 3 marcos", "Valor único", "Como funcionam os marcos?"];
const dataAttrs = (data) => Object.entries(data).map(([k, v]) => `data-${k}="${esc(v)}"`).join(" ");

/** Messages as bubbles, the assistant on the left; three dots while it types. */
export function bubbles(messages, typing) {
  const one = (m) => `<div class="chat-msg ${m.from === "ai" ? "ai" : "me"}">${m.from === "ai" ? `<span class="chat-ai">${icon("sparkle")}</span>` : ""}<p>${esc(m.text).replace(/\n/g, "<br>")}</p></div>`;
  return `<div class="chat-log">${messages.map(one).join("")}${typing ? `<div class="chat-msg ai"><span class="chat-ai">${icon("sparkle")}</span><p class="typing"><span></span><span></span><span></span></p></div>` : ""}</div>`;
}

const composer = (bind, value, action, data, placeholder = "Pergunte ou peça uma mudança") =>
  `<div class="chat-compose chat-input"><input data-bind="${esc(bind)}" value="${esc(value)}" placeholder="${esc(placeholder)}" aria-label="Mensagem para o assistente"><button type="button" class="icon-btn send" data-action="${action}" ${dataAttrs(data)} aria-label="Enviar">${icon("paper-plane-tilt")}</button></div>`;

/** The proposal as the payer sees it: the total, a bar with the share of each milestone, and the list. */
function proposalCard(p, source) {
  const single = p.release === "single";
  const total = p.stages.reduce((sum, st) => sum + st.valueCents, 0);
  const shares = single ? [100] : stageShares(p.stages);
  const items = single ? [{ name: "Valor único, liberado na entrega", valueCents: total }] : p.stages;
  return `<section class="ms-card"><div class="ms-head"><span><small>${source ? `Sugestão de ${esc(source)}` : "Sugestão do assistente"}</small><strong>${single ? "Valor único" : `${p.stages.length} marcos`}</strong></span><b>${money(total)}</b></div>
    <div class="ms-bar" aria-hidden="true">${shares.map((share, i) => `<i style="flex:${share}" class="${i === 0 ? "first" : ""}"></i>`).join("")}</div>
    <ol class="ms-list">${items.map((st, i) => `<li><em>${i + 1}</em><span><b>${esc(st.name)}</b><small>${shares[i]}% do valor</small></span><strong>${money(st.valueCents)}</strong></li>`).join("")}</ol></section>`;
}

function etapas(s, { key }) {
  const chat = s.ui.drafts.stg?.[key];
  if (!chat?.messages) return screen({ header: appbar({ title: "Definir marcos" }), body: empty("Abra pelo pagamento para conversar com o assistente.") });
  const p = chat.proposal;
  const suggesting = key === "novo" && s.ui.drafts.ag?.from === "provider";
  const quick = `<div class="asst-chips" aria-label="Pedidos rápidos">${STAGE_QUICK.map((t) => `<button type="button" data-action="stagesQuick" data-key="${esc(key)}" data-text="${esc(t)}">${esc(t)}</button>`).join("")}</div>`;
  const use = suggesting ? "Mandar esta sugestão" : p.release === "single" ? "Usar valor único" : `Usar estes ${p.stages.length} marcos`;
  return screen({
    cls: "asst", header: appbar({ title: "Definir marcos" }),
    body: `<section class="asst-hero"><span class="asst-avatar">${icon("sparkle")}</span><div><h2>Como o dinheiro é liberado</h2><p>${suggesting ? "Você sugere; quem paga vê e decide." : "O assistente sugere; quem decide é você."}</p></div></section>
      ${proposalCard(p, chat.source)}<p class="asst-day">Conversa</p>${bubbles(chat.messages, chat.typing)}`,
    footer: `${quick}${composer(`stg.${key}.input`, draft(`stg.${key}.input`, ""), "stagesAsk", { key }, "Peça uma mudança nos marcos")}${btn(use, { action: "stagesUse", data: { key }, iconName: "check" })}`,
  });
}

/** One icon per suggested question, in the order of SUGGESTED_QUESTIONS. */
const QUESTION_ICONS = ["list-checks", "clock-countdown", "shield-check", "scales"];

function assistente(s) {
  const chat = s.ui.drafts.asst ?? { messages: [] };
  const talking = (chat.messages ?? []).length > 0;
  const hero = `<section class="asst-hero"><span class="asst-avatar">${icon("sparkle")}</span><div><h2>Olá! Sou o assistente do Aval</h2><p>Tiro dúvidas sobre pagar com Aval, na hora.</p></div></section>`;
  const faq = `<h3 class="bk-settings-title">Perguntas frequentes</h3><div class="asst-faq">${SUGGESTED_QUESTIONS.map((q, i) => `<button type="button" data-action="askSuggested" data-index="${i}"><span class="asst-faq-ic">${icon(QUESTION_ICONS[i])}</span><span>${esc(q)}</span>${icon("caret-right")}</button>`).join("")}</div>`;
  const asked = new Set((chat.messages ?? []).filter((m) => m.from === "me").map((m) => m.text));
  const left = SUGGESTED_QUESTIONS.map((q, i) => [q, i]).filter(([q]) => !asked.has(q));
  const others = left.length ? `<div class="asst-chips" aria-label="Outras perguntas">${left.map(([q, i]) => `<button type="button" data-action="askSuggested" data-index="${i}">${esc(q)}</button>`).join("")}</div>` : "";
  return screen({
    cls: "asst", header: appbar({ title: "Assistente" }),
    body: talking ? `${hero}<p class="asst-day">Hoje</p>${bubbles(chat.messages, chat.typing)}${others}` : `${hero}${faq}`,
    footer: `${composer("asst.input", draft("asst.input", ""), "askAssistant", {}, "Escreva sua dúvida")}<small class="asst-note">${icon("lock-simple")}O assistente não move dinheiro e não vê sua senha.</small>`,
  });
}

/** The help center, open before login like the BTG app's: frequent questions and where to talk to someone. */
function ajuda() {
  const faq = FAQ.map(({ question, text }) => `<details class="bk-faq"><summary>${esc(question)}${icon("caret-down")}</summary><p>${esc(text)}</p></details>`).join("");
  const contact = (ic, title, detail, go) => `<button type="button" class="bk-setting" data-go="${go}">${icon(ic)}<span><strong>${esc(title)}</strong><small>${esc(detail)}</small></span>${icon("caret-right")}</button>`;
  return screen({
    cls: "bk-paper", header: appbar({ title: "Ajuda" }),
    body: `<h2 class="bk-help-title">Como podemos ajudar?</h2>
      ${btn("Conhecer o Aval", { kind: "secondary", action: "openOnboarding", iconName: "info" })}
      <h3 class="bk-settings-title">Dúvidas frequentes</h3>${faq}
      <h3 class="bk-settings-title">Fale com a gente</h3>
      ${contact("sparkle", "Assistente do Aval", "Tire dúvidas na hora, a qualquer momento", "#/assistente")}${contact("scales", "Problema com um serviço", "Como a mediação BTG resolve disputas", "#/arbitragem")}`,
  });
}

export const assistantRoutes = { "etapas/:key": etapas, assistente, ajuda };
