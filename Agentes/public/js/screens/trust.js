// Contract chat, new date proposal and block appeal screens.
import { RESCHEDULE_OPTIONS } from "../actions/index.js";
import { addDays, canSee, contractById, draft, isProviderOf } from "../store.js";
import { appbar, btn, busyNote, card, circle, empty, esc, field, icon, kv, note, percent, screen, signal } from "../ui.js";

function chatHint(s, id) {
  const r = s.chatReadings[id];
  if (!r?.value?.escalating) return "";
  if (r.mediationAsked) return note(`Mediação Nexo convidada em ${r.mediationAsked}. Um mediador acompanha a conversa.`, "info", "scales");
  const sure = r.routing === "automatic";
  return card(`<div class="row-between"><strong>${sure ? "A conversa está ficando tensa" : "Parece que há um desentendimento"}</strong>${signal(`Aval IA · ${percent(r.confidence)}`, sure ? "ok" : "review")}</div><p class="small">Um mediador do Nexo pode ajudar agora, antes de virar disputa. Nada fica bloqueado.</p>${btn("Chamar a mediação Nexo", { kind: "secondary small", action: "askMediation", data: { id }, iconName: "scales" })}`, "warn-soft");
}

function conversa(s, { id }) {
  const c = contractById(s, id);
  if (!canSee(c, s)) return screen({ header: appbar({ title: "Conversa" }), body: empty("Conversa não encontrada.") });
  const meProvider = isProviderOf(c, s);
  const messages = s.messages[id] ?? [];
  const bubbles = messages.map((m) => {
    const mine = (m.from === "provider") === meProvider;
    return `<div class="bubble ${mine ? "user" : "ia"}"><small class="${mine ? "light" : "muted"}">${esc(m.from === "provider" ? c.provider : c.client)} · ${esc(m.at)}</small>${esc(m.text)}</div>`;
  }).join("");
  return screen({
    header: appbar({ title: meProvider ? c.client : c.provider }),
    body: `${note("Conversa registrada no contrato. Em uma disputa, ela entra como prova para as duas partes.", "info", "lock-simple")}
      <div class="chat">${bubbles || empty("Nenhuma mensagem ainda.")}</div>
      ${s.ui.busy[`chat-${id}`] ? busyNote("Aval IA lendo o tom da conversa") : chatHint(s, id)}`,
    footer: `<div class="chat-input"><input data-bind="msg.${esc(id)}" placeholder="Escreva para ${esc(meProvider ? c.client : c.provider)}" value="${esc(draft(`msg.${id}`, ""))}" aria-label="Mensagem"><button type="button" class="send" data-action="sendMessage" data-id="${esc(id)}" aria-label="Enviar">${icon("paper-plane-tilt")}</button></div>`,
  });
}

function novaData(s, { id, stage }) {
  const c = contractById(s, id);
  const idx = Number(stage);
  const st = canSee(c, s) ? c.stages[idx] : null;
  if (!st) return screen({ header: appbar({ title: "Nova data" }), body: empty("Etapa não encontrada.") });
  const days = Number(draft("novaData.days", RESCHEDULE_OPTIONS[0]));
  return screen({
    header: appbar({ title: "Propor nova data" }),
    body: `<div class="center-block">${circle("calendar-blank", "info", 56)}<h2>Só o prazo mudou</h2><p class="muted">Pela matriz de resolução, quando a divergência é só de prazo, vocês combinam uma nova data e o valor da etapa não muda.</p></div>
      ${card(`${kv("Etapa", `${idx + 1} · ${st.name}`)}${kv("Prazo atual", st.due)}${kv("Valor", "Não muda")}`)}
      <h3>Nova data</h3><div class="choice-list wrap">${RESCHEDULE_OPTIONS.map((d) => `<button type="button" class="pill-option ${days === d ? "on" : ""}" data-action="chooseNewDate" data-days="${d}">${addDays(d)} · +${d} dias</button>`).join("")}</div>
      ${note("Se o prestador recusar, você ainda pode abrir a disputa.", "info", "scales")}`,
    footer: `${btn("Enviar proposta", { action: "proposeNewDate", data: { id, stage }, iconName: "calendar-blank" })}${btn("Prefiro abrir a disputa", { kind: "text", go: `#/disputa/nova/${id}/${stage}` })}`,
  });
}

function contestar(s) {
  const acc = s.newAccount;
  if (!acc || acc.status !== "refused") return screen({ header: appbar({ title: "Contestar" }), body: empty("Não há bloqueio para contestar.") });
  return screen({
    header: appbar({ title: "Contestar decisão" }),
    body: `${card(`${kv("Decisão", "Conta não aprovada")}${kv("Motivo informado", acc.blockReason ?? "Dados do cadastro não conferem")}`)}
      ${card(field("Explique e diga o que pode enviar", { bind: "appeal.text", value: draft("appeal.text"), multiline: true, rows: 4 }))}
      ${note("Toda decisão automática de bloqueio pode ser contestada. Uma pessoa do Nexo revisa, com apoio do Aval IA.", "info", "shield-check")}`,
    footer: btn("Enviar contestação", { action: "submitAppeal", busy: s.ui.busy.appeal }),
  });
}

export const trustRoutes = { "conversa/:id": conversa, "nova-data/:id/:stage": novaData, contestar };
