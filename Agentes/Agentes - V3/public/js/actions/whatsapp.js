// The BTG Aval on WhatsApp: the person writes or taps a button, the bot (rules in domain/wa-bot.js) answers after a
// short pause, and what it decided happens in the demo: a charge or a payment is created, a Pix guards the money.
import { botTurn, incomingCharge, openThread } from "../domain/wa-bot.js";
import { securityCode } from "../domain/protected.js";
import { SELF, contractById, draft, getState, peopleOf, update } from "../store.js";
import { actions as A, warn } from "./core.js";
import { fund } from "./payment.js";
import { acceptInviteIn, announceInvite, buildInvite } from "./protected.js";

const TYPING_MS = 900;
const asContact = (p) => ({ id: p.id, first: p.first, clientName: p.clientName, providerName: p.providerName, phone: p.phone });

/** Who is writing and the contacts the bot knows for them (the demo customer first). */
function contextFor(s, who) {
  const people = peopleOf(s);
  const contacts = Object.values(people).filter((p) => p.id && p.id !== who && p.clientName).sort((a, b) => (a.id === SELF ? -1 : b.id === SELF ? 1 : 0));
  return { me: asContact(people[who]), contacts: contacts.map(asContact) };
}

/** The chat of a person, started with the greeting the first time. */
function ensureThread(s, who) {
  s.wa = { on: false, active: null, threads: {}, ...s.wa };
  if (!s.wa.threads[who]) s.wa.threads = { ...s.wa.threads, [who]: openThread(asContact(peopleOf(s)[who])) };
  return s.wa.threads[who];
}

/** A charge or a payment written on WhatsApp: the same invite the app creates, and the code that proves it. */
function createFromChat(s, who, e) {
  const people = peopleOf(s);
  const me = people[who];
  const other = people[e.counterpartId];
  const charging = e.role === "provider";
  const invite = buildInvite(s, {
    from: e.role, createdBy: who, channel: "whatsapp", contact: other.phone, description: e.description, address: e.address, dueDate: e.dueDate, release: e.release,
    client: charging ? other.clientName : me.clientName, provider: charging ? me.providerName : other.providerName, totalCents: e.totalCents, stages: e.stages, origin: "whatsapp",
  });
  s.invites.push(invite);
  announceInvite(s, invite, charging ? other.clientName : other.providerName);
  const thread = s.wa.threads[who];
  s.wa.threads[who] = { ...thread, inviteId: invite.id, messages: [...thread.messages, { from: "bot", text: `Código de segurança ${securityCode(invite.token)}: é o mesmo que ${other.first} vê no app Aval. Assim ninguém cai em link falso.` }] };
  // A charge also reaches the payer's own WhatsApp: they choose the stages, accept and pay by Pix right there.
  if (charging) {
    s.wa.threads = { ...s.wa.threads, [other.id]: incomingCharge(s.wa.threads[other.id], {
      inviteId: invite.id, from: me.first, title: invite.title, description: invite.description, totalCents: invite.totalCents, dueDate: invite.dueDate, code: securityCode(invite.token),
    }) };
  }
}

/** "Aceitar" on WhatsApp: the charge becomes a payment with the stages chosen in the chat, waiting for the Pix. */
function acceptFromChat(s, who, e) {
  const invite = s.invites.find((i) => i.id === e.inviteId);
  if (!invite || invite.status !== "sent") return;
  const c = acceptInviteIn(s, invite.token, who, { release: e.release, stages: e.stages });
  s.wa.threads[who] = { ...s.wa.threads[who], contractId: c.id };
}

/** "Já paguei": the Pix lands in custody, exactly like a Pix made from the app. */
function payFromChat(s, contractId) {
  const c = contractById(s, contractId);
  if (!c || c.paidInCents >= c.totalCents) return;
  c.payment = { method: "pix" };
  fund(s, c, c.totalCents - c.paidInCents, "Pix pelo WhatsApp");
}

/** One message from the person: shown at once; the bot answers after a pause and its effect is applied. */
function converse(who, text) {
  update((s) => {
    const thread = ensureThread(s, who);
    s.wa.threads[who] = { ...thread, typing: true, messages: [...thread.messages, { from: "me", text }] };
    s.ui.drafts.wa = { ...s.ui.drafts.wa, input: "" };
  });
  setTimeout(() => {
    const s0 = getState();
    const { next, replies, effect } = botTurn(s0.wa.threads[who], text, contextFor(s0, who));
    update((s) => {
      const thread = s.wa.threads[who];
      s.wa.threads[who] = { ...thread, ...next, typing: false, messages: [...thread.messages, ...replies.map((r) => ({ from: "bot", ...r }))] };
      if (effect?.kind === "createInvite") createFromChat(s, who, effect);
      if (effect?.kind === "acceptInvite") acceptFromChat(s, who, effect);
      if (effect?.kind === "payPix") payFromChat(s, effect.contractId);
    });
  }, TYPING_MS);
}

A.waSend = ({ who }) => {
  const text = String(draft("wa.input", "")).trim();
  if (!text) return warn("Escreva uma mensagem.");
  converse(who, text);
};
A.waButton = ({ who, value }) => converse(who, value);

/** Shows the WhatsApp phone with the chat of this person (the guide calls it when the scene moves there). */
A.waShow = ({ who }) => update((s) => {
  ensureThread(s, who);
  s.wa = { ...s.wa, on: true, active: who };
});
/** The presenter's switch: the third phone on or off, with the chat of whoever is acting. */
A.toggleWa = () => {
  const s0 = getState();
  if (s0.wa?.on) return update((s) => { s.wa = { ...s.wa, on: false }; });
  // Whoever acts may have no account yet (the "Você" who still signs up): the chat of someone who has one opens instead.
  const people = peopleOf(s0);
  const candidates = [s0.session.person, s0.wa?.active, s0.ui.second, "carlos"].filter((who) => who && who !== "banco");
  const who = candidates.find((p) => people[p]);
  if (!who) return warn("Crie uma conta para conversar no WhatsApp.");
  update((s) => {
    ensureThread(s, who);
    s.wa = { ...s.wa, on: true, active: who };
  });
};
