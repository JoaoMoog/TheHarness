// The third phone: the WhatsApp of a person talking to the BTG Aval, the bank's verified business account. Only the
// newest bot message keeps its buttons live, as in WhatsApp; older ones stay on screen, greyed out.
import { openThread } from "../domain/wa-bot.js";
import { draft, peopleOf } from "../store.js";
import { esc, icon, statusbar } from "../ui.js";

const lines = (text) => esc(text).replace(/\n/g, "<br>");

function bubble(m, who, live) {
  const card = m.card
    ? `<div class="wa-card"><strong>${esc(m.card.title)}</strong>${m.card.lines.map(([k, v]) => `<div class="wa-kv"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join("")}</div>`
    : "";
  const buttons = m.buttons?.length
    ? `<div class="wa-buttons">${m.buttons.map((b) => `<button type="button" ${live ? "" : "disabled"} data-action="waButton" data-who="${esc(who)}" data-value="${esc(b)}">${esc(b)}</button>`).join("")}</div>`
    : "";
  return `<div class="wa-msg ${m.from === "me" ? "me" : "bot"}"><div class="wa-text"><p>${lines(m.text)}</p>${card}<small>9:41</small></div>${buttons}</div>`;
}

/** The chat of the person on the WhatsApp phone, or nothing when no one is there. */
export function waDevice(s) {
  const who = s.wa?.active;
  const me = who ? peopleOf(s)[who] : null;
  if (!me) return "";
  const thread = s.wa.threads?.[who] ?? openThread(me);
  const lastBot = thread.messages.map((m) => m.from).lastIndexOf("bot");
  const log = thread.messages.map((m, i) => bubble(m, who, i === lastBot && !thread.typing)).join("");
  const typing = thread.typing ? `<div class="wa-msg bot"><div class="wa-text"><p class="typing"><span></span><span></span><span></span></p></div></div>` : "";
  return `<div class="device whats"><div class="device-inner"><div class="screen wa-screen">${statusbar(true)}
    <header class="wa-head"><span class="wa-avatar">${icon("bank")}</span><div><strong>BTG Aval ${icon("seal-check")}</strong><small>Conta comercial oficial do BTG Pactual</small></div></header>
    <div class="content wa-log"><div class="wa-day">Hoje</div>${log}${typing}</div>
    <div class="wa-compose"><input data-bind="wa.input" value="${esc(draft("wa.input", ""))}" placeholder="Mensagem" aria-label="Mensagem para o BTG Aval"><button type="button" class="wa-send" data-action="waSend" data-who="${esc(who)}" aria-label="Enviar">${icon("paper-plane-tilt")}</button></div>
  </div></div></div>`;
}

/** The column of the third phone, labelled like the others. */
export function waColumn(s, fit) {
  const device = s.wa?.on ? waDevice(s) : "";
  if (!device) return "";
  const first = peopleOf(s)[s.wa.active]?.first ?? "";
  return `<section class="phone-col wa-col" aria-label="WhatsApp de ${esc(first)}"><div class="phone-label whats"><span class="wa-dot">${icon("chat-circle-text")}</span><span class="phone-who">WhatsApp de ${esc(first)}</span><small>sem abrir o app</small></div>${fit(device)}</section>`;
}
