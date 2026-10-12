// What the BTG Aval says by itself on WhatsApp when something happens in the app: the other side accepted, the money
// is guarded. Called inside an update recipe; only chats started on WhatsApp get these messages.
import { money } from "../ui.js";

/** Adds one bot message to a person's chat (and moves the chat on), when that person has one. */
export function waPost(s, who, reply, patch = {}) {
  const thread = s.wa?.threads?.[who];
  if (!thread) return;
  s.wa.threads[who] = { ...thread, ...patch, messages: [...thread.messages, { from: "bot", ...reply }] };
}

/** The provider accepted a payment written on WhatsApp: the payer is asked how to pay, right there. */
export function waOnAccepted(s, invite, contractId) {
  if (invite.origin !== "whatsapp" || invite.from !== "client") return;
  waPost(s, invite.createdBy, { text: `${invite.provider} aceitou o pagamento de ${money(invite.totalCents)} · ${invite.title}. Como você quer pagar?`, buttons: ["Pagar com Pix", "Pagar no app"] },
    { step: "awaitingPay", contractId, draft: { totalCents: invite.totalCents } });
}

/** The money of a charge written on WhatsApp is guarded: the provider hears it there. */
export function waOnFunded(s, c) {
  const invite = (s.invites ?? []).find((i) => i.contractId === c.id && i.origin === "whatsapp" && i.from === "provider");
  if (invite) waPost(s, invite.createdBy, { text: `${c.client} pagou. ${money(c.totalCents)} guardados no BTG: pode começar o marco 1.` });
}
