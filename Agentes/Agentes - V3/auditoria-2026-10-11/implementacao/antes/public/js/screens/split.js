// Paying together: invite each person by mobile (WhatsApp) or e-mail and set each one's percentage.
// Used by whoever pays, at checkout; equal parts until someone edits.
import { novoParticipants, splitPercentError } from "../actions/index.js";
import { equalBps, rebalance } from "../domain/split.js";
import { draft, parseReais, personOfContact } from "../store.js";
import { btn, card, esc, field, icon, money, note } from "../ui.js";

const CHANNEL_ICON = { whatsapp: "chat-circle-text", email: "paper-plane-tilt" };
export const channelLabel = (p) => (p.channel === "email" ? "Link por e-mail" : p.channel === "whatsapp" ? "Convite no WhatsApp" : "Quem organizou");

/** Shares of the payment when it is split, or null while the percentages do not add up. */
function splitPreview(s) {
  const people = novoParticipants(s);
  const total = parseReais(draft("novo.total")) ?? 0;
  return people && people.length >= 2 && total > 0 && !splitPercentError(s) ? rebalance(total, people) : null;
}

/** Live parts of the split: the amount of each person and the sum of the percentages. */
export function updateSplitAmounts(s) {
  const shares = splitPreview(s);
  const error = splitPercentError(s);
  (novoParticipants(s) ?? []).forEach((_, i) => {
    const el = document.getElementById(`split-amt-${i}`);
    if (el) el.textContent = shares ? money(shares[i].shareCents) : "—";
  });
  const sum = document.getElementById("novo-split-sum");
  if (sum) {
    sum.className = `pct-sum ${error ? "err" : "ok"}`;
    sum.textContent = error ?? "Soma: 100%";
  }
}

function splitPercents(s) {
  const people = novoParticipants(s) ?? [];
  if (people.length < 2) return card(`<p class="small muted">Convide pelo menos uma pessoa.</p>`);
  const typed = draft("novo.splitPct", []) ?? [];
  const equal = equalBps(people.length);
  const shares = splitPreview(s);
  const error = splitPercentError(s);
  const rows = people.map((p, i) => {
    const label = p.me ? `${p.name} (você)` : p.name;
    const value = typed[i] ?? String(equal[i] / 100).replace(".", ",");
    return `<div class="pct-row"><span class="pct-name">${esc(label)}</span><label class="pct-input"><input data-bind="novo.splitPct.${i}" inputmode="decimal" value="${esc(value)}" aria-label="Porcentagem de ${esc(label)}"><span>%</span></label><strong id="split-amt-${i}">${shares ? money(shares[i].shareCents) : "—"}</strong></div>`;
  }).join("");
  return card(`<div class="row-between"><strong>Quanto cada um paga</strong>${btn("Dividir igualmente", { kind: "text small", action: "equalSplit" })}</div>${rows}<div id="novo-split-sum" class="pct-sum ${error ? "err" : "ok"}">${esc(error ?? "Soma: 100%")}</div><small class="muted">Se alguém recusar, a parte dele é dividida entre os demais, na mesma proporção.</small>`);
}

/** Contacts and percentages of a split payment. */
export function splitEditor(s) {
  const invited = draft("novo.splitContacts", []);
  const rows = invited.map((x, i) => {
    const who = personOfContact(x.contact, s);
    return `<div class="row-between line"><div class="row-gap">${icon(CHANNEL_ICON[x.channel])}<div><strong>${esc(who?.clientName ?? x.contact)}</strong><small class="muted">${esc(x.channel === "email" ? `Link por e-mail · ${x.contact}` : `Convite no WhatsApp · ${x.contact}`)}</small></div></div><button type="button" class="icon-btn" data-action="removeSplitContact" data-index="${i}" aria-label="Remover ${esc(x.contact)}">${icon("x")}</button></div>`;
  }).join("");
  return `<h3>Quem paga com você</h3>
    ${card(`${field("Celular (WhatsApp) ou e-mail", { bind: "novo.splitContact", value: draft("novo.splitContact", ""), placeholder: "(11) 99999-9999 ou nome@email.com" })}${btn("Adicionar convite", { kind: "secondary", action: "addSplitContact", iconName: "plus" })}${rows}`)}
    ${note("Na demonstração, convide a Marina: (11) 98888-1001. Quem não está no app recebe o link e entra com a conta BTG para pagar.", "info", "info")}
    ${splitPercents(s)}`;
}
