// The BTG Aval on WhatsApp, simulated by rules: a person writes the way they talk and the bot turns it into a charge
// or a payment with the same protection as the app. Pure functions: the chat state goes in, the next state, the
// replies and one effect (create the payment, pay by Pix) come out. The actions apply the effect to the demo.
import { normText } from "./search.js";
import { answer, classify, parseConversation, suggestStages } from "./assistant.js";
import { SINGLE_STAGE } from "./protected.js";

const NO_ADDRESS = "A combinar";
const norm = (text) => normText(text).trim();
/** Short messages outside the agreement: a greeting gets the two ways to start; cancelling drops the draft. */
const GREETING = /^(oi+|ola|bom dia|boa tarde|boa noite|menu|ajuda)[!.?\s]*$/;
const CANCEL = /^(cancelar|cancela|parar|sair)[!.\s]*$/;
const START = ["Cobrar", "Pagar"];

// In a chat people often write the value bare ("pagar 500", "4.500"). Dates, the address, phones, installments and
// counts are taken out first, so only a number that can be money is left.
const NOT_MONEY = [/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g, /\b(?:Rua|Avenida|Av\.|Alameda|Travessa|Praça)\s+[^,\n]+/gi, /\d{8,}/g,
  /\b\d+\s*(?:x|vezes|parcelas?|marcos?|etapas?|dias?|meses|%)(?![a-z])/gi];
const BARE_VALUE = /(?<![\d.,])(\d{1,3}(?:\.\d{3})+|\d{2,6})(?:,(\d{2}))?(?![\d.,])/;
/** A bare number that reads as money, in cents, or null. */
function bareValueCents(text) {
  const rest = NOT_MONEY.reduce((t, re) => t.replace(re, " "), String(text ?? ""));
  const m = rest.match(BARE_VALUE);
  return m ? Number(m[1].replace(/\./g, "")) * 100 + Number(m[2] ?? 0) : null;
}
const brl = (cents) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const word = (w) => new RegExp(`\\b${norm(w).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
const digits = (text) => String(text ?? "").replace(/\D/g, "");

/** The first message: the bot knows the person by the number linked to the BTG account. */
export function openThread(me) {
  return {
    step: "idle", draft: {}, contractId: null,
    messages: [{ from: "bot", text: `Oi, ${me.first}! Aqui é o BTG Aval. Reconheci seu número da conta BTG. Me conte o que você combinou, do seu jeito. Por exemplo: "cobrar pintura de R$ 4.500 até 30/11" ou "pagar a Marina 6 mil pelo projeto".` }],
  };
}

/** The stages a payer picks for a charge: the ones suggested for the kind of service, or one single value. */
function chosenStages(d, single) {
  return single ? { release: "single", stages: [{ name: SINGLE_STAGE, valueCents: d.totalCents }] } : { release: "stages", stages: d.suggestion };
}
const stageLines = (stages) => stages.map((st, i) => [stages.length > 1 ? `${i + 1}. ${st.name}` : st.name, brl(st.valueCents)]);

/**
 * A charge written on WhatsApp reaches the payer's own chat: who charged, the value, the security code that the app
 * also shows, and the stages to choose (the payer decides how the money is released). The charge is kept in the draft,
 * so the chat's own payment (`inviteId`) stays free for what the person writes.
 */
export function incomingCharge(thread, { inviteId, from, title, description, totalCents, dueDate, code }) {
  const base = thread ?? { step: "idle", draft: {}, contractId: null, messages: [] };
  const suggestion = suggestStages({ description, totalCents });
  const stages = suggestion.release === "stages" ? suggestion.stages : [{ name: SINGLE_STAGE, valueCents: totalCents }];
  const list = stages.map((st, i) => `${i + 1}. ${st.name}: ${brl(st.valueCents)}`).join("\n");
  const messages = [
    { from: "bot", text: `${from} te cobrou pelo BTG Aval. Código de segurança ${code}: é o mesmo que aparece no app Aval.`, card: { title: "Cobrança Aval", lines: [["Serviço", title], ["Valor", brl(totalCents)], ["Entrega", dueDate]] } },
    { from: "bot", text: `Quem paga decide como o dinheiro sai. Sugiro ${stages.length} ${stages.length === 1 ? "marco" : "marcos"}:\n${list}\nCada marco só sai quando você aprovar a entrega dele.`, buttons: ["Usar marcos", "Valor único"] },
  ];
  return { ...base, step: "incoming", contractId: null, draft: { inviteId, totalCents, suggestion: stages }, messages: [...base.messages, ...messages] };
}

/** A Pix "copia e cola" for one payment: always the same for the same payment and amount. */
export function pixCode(contractId, cents) {
  const amount = (cents / 100).toFixed(2);
  const key = `aval-${String(contractId).toLowerCase()}@btgpactual.com.br`;
  const body = `00020126${String(key.length + 14).padStart(2, "0")}0014BR.GOV.BCB.PIX01${String(key.length).padStart(2, "0")}${key}52040000530398654${String(amount.length).padStart(2, "0")}${amount}5802BR5916BTG PACTUAL AVAL6009SAO PAULO6304`;
  let crc = 0;
  for (const ch of body) crc = (crc * 31 + ch.charCodeAt(0)) % 65_536;
  return `${body}${crc.toString(16).toUpperCase().padStart(4, "0")}`;
}

/** A known contact named in the text (first name, full name or phone), never the person writing. */
function findContact(text, { me, contacts }) {
  const t = norm(text);
  const phone = digits(text);
  return contacts.find((c) => c.id !== me.id && (word(c.first).test(t) || word(c.clientName).test(t) || word(c.providerName).test(t) || (phone.length >= 10 && digits(c.phone).endsWith(phone.slice(-9))))) ?? null;
}

const roleIn = (t) => (/\bcobr/.test(t) ? "provider" : /\b(pag|contrat)/.test(t) ? "client" : null);
const contactOf = (ctx, id) => ctx.contacts.find((c) => c.id === id);

/** What the text adds to the agreement: role, value, date, address, service and the other person. */
function merge(draft, text, ctx) {
  const parsed = parseConversation(text);
  const who = findContact(text, ctx);
  const role = roleIn(norm(text)) ?? draft.role;
  const description = draft.description || parsed.description || (classify(text) ? "" : text.replace(/\s+/g, " ").trim());
  const next = {
    ...draft, role, description,
    totalCents: parsed.totalCents ?? draft.totalCents ?? bareValueCents(text) ?? undefined, dueDate: parsed.dueDate ?? draft.dueDate, address: parsed.address ?? draft.address, counterpartId: who?.id ?? draft.counterpartId,
  };
  const changed = ["role", "totalCents", "dueDate", "address", "counterpartId"].some((k) => next[k] !== draft[k]);
  return { draft: next, changed };
}

function summaryCard(d, ctx) {
  const other = contactOf(ctx, d.counterpartId);
  const lines = [
    ["Serviço", d.description.split(":")[0]], ["Valor", brl(d.totalCents)], ["Entrega", d.dueDate], ["Endereço", d.address ?? NO_ADDRESS],
    [d.role === "provider" ? "Quem paga" : "Quem recebe", d.role === "provider" ? other.clientName : other.providerName],
    ...(d.role === "provider" ? [["Marcos", "quem paga define"]] : d.stages.map((st, i) => [d.release === "single" ? st.name : `${i + 1}. ${st.name}`, brl(st.valueCents)])),
  ];
  return { title: d.role === "provider" ? "Cobrança Aval" : "Pagamento Aval", lines };
}

function confirm(d, ctx) {
  const other = contactOf(ctx, d.counterpartId);
  const send = d.role === "provider" ? "Enviar cobrança" : `Enviar para ${other.first}`;
  return { step: "confirm", draft: d, replies: [{ text: "Confere o que eu entendi:", card: summaryCard(d, ctx) }, { text: "Posso enviar?", buttons: [send, "Corrigir"] }] };
}

/** Asks for what is missing, suggests stages to whoever pays, or shows the summary to confirm. */
function advance(d, ctx) {
  if (!d.role) return { step: "collecting", replies: [{ text: "Você quer cobrar por um serviço ou pagar alguém?", buttons: ["Cobrar", "Pagar"] }] };
  if (!d.totalCents) return { step: "collecting", replies: [{ text: "Qual o valor combinado?" }] };
  if (!d.dueDate) return { step: "collecting", replies: [{ text: "Até quando fica pronto? Responda com a data, por exemplo 30/11." }] };
  if (!d.counterpartId) {
    const ask = d.role === "provider" ? "Quem paga?" : "Para quem vai o pagamento?";
    return { step: "collecting", replies: [{ text: `${ask} Escolha um contato ou mande o celular com DDD.`, buttons: ctx.contacts.filter((c) => c.id !== ctx.me.id).map((c) => c.clientName) }] };
  }
  if (d.role === "client" && !d.release) {
    const suggestion = suggestStages({ description: d.description, totalCents: d.totalCents });
    if (suggestion.release === "single") return confirm({ ...d, release: "single", stages: suggestion.stages }, ctx);
    const list = suggestion.stages.map((st, i) => `${i + 1}. ${st.name}: ${brl(st.valueCents)}`).join("\n");
    return { step: "stages", draft: { ...d, suggestion: suggestion.stages }, replies: [{ text: `Sugiro ${suggestion.stages.length} marcos para ${suggestion.title.toLowerCase()}:\n${list}\nCada marco só sai quando você aprovar a entrega dele.`, buttons: ["Usar marcos", "Valor único"] }] };
  }
  return confirm(d, ctx);
}

const result = (thread, patch, replies, effect = null) => ({ next: { step: thread.step, draft: thread.draft ?? {}, contractId: thread.contractId ?? null, ...patch }, replies, effect });

/** The steps that wait for one of the bot's buttons; anything else typed is read as a new or corrected agreement. */
function buttonTurn(thread, t, ctx) {
  const d = thread.draft ?? {};
  if (thread.step === "awaitingPay" && /pix/.test(t)) {
    const code = pixCode(thread.contractId, d.totalCents);
    return result(thread, { step: "pix" }, [
      { text: `Pix copia e cola de ${brl(d.totalCents)} para BTG Pactual · Aval:\n${code}` },
      { text: "Pague de qualquer banco. O dinheiro fica guardado no BTG até você aprovar cada marco.", buttons: ["Já paguei"] },
    ]);
  }
  if (thread.step === "awaitingPay" && /\bapp\b/.test(t)) {
    return result(thread, {}, [{ text: "No app Aval, abra o pagamento e toque em Pagar. Lá tem cartão em até 12x e empréstimo na hora." }]);
  }
  if (thread.step === "pix" && /paguei/.test(t)) {
    return result(thread, { step: "paid" }, [{ text: `Recebido! ${brl(d.totalCents)} guardados no BTG. Cada marco só sai quando você aprovar a entrega dele.` }], { kind: "payPix", contractId: thread.contractId });
  }
  if (thread.step === "incoming" && (/usar marcos/.test(t) || /valor unico/.test(t))) {
    const chosen = chosenStages(d, /valor unico/.test(t));
    return result(thread, { step: "incomingConfirm", draft: { ...d, ...chosen } }, [
      { text: "Confere como fica:", card: { title: "Pagamento Aval", lines: stageLines(chosen.stages) } },
      { text: "Ao aceitar, você concorda com as regras do Aval e com a cláusula de arbitragem: se a mediação não resolver, um árbitro decide.", buttons: ["Aceitar", "Ver no app"] },
    ]);
  }
  if (thread.step === "incomingConfirm" && /^aceitar/.test(t)) {
    return result(thread, { step: "awaitingPay", draft: { totalCents: d.totalCents } }, [{ text: "Combinado aceito. Como você quer pagar?", buttons: ["Pagar com Pix", "Pagar no app"] }],
      { kind: "acceptInvite", inviteId: d.inviteId, release: d.release, stages: d.stages });
  }
  if ((thread.step === "incoming" || thread.step === "incomingConfirm") && /ver no app/.test(t)) {
    return result(thread, {}, [{ text: "No app Aval, a cobrança está nos avisos, com o mesmo código. Lá você também pode pagar no cartão em até 12x." }]);
  }
  if (thread.step === "stages" && (/usar (etapas|marcos)/.test(t) || /valor unico/.test(t))) {
    const single = /valor unico/.test(t);
    const out = confirm({ ...d, release: single ? "single" : "stages", stages: single ? [{ name: SINGLE_STAGE, valueCents: d.totalCents }] : d.suggestion }, ctx);
    return result(thread, { step: out.step, draft: out.draft }, out.replies);
  }
  if (thread.step === "confirm" && /^enviar/.test(t)) {
    const other = contactOf(ctx, d.counterpartId);
    const effect = {
      kind: "createInvite", role: d.role, counterpartId: d.counterpartId, totalCents: d.totalCents, dueDate: d.dueDate, address: d.address ?? NO_ADDRESS,
      description: d.description, release: d.role === "provider" ? null : d.release, stages: d.role === "provider" ? [] : d.stages,
    };
    const done = d.role === "provider"
      ? `Pronto! ${other.first} recebe um aviso no app Aval para conferir e pagar. Te aviso aqui quando o dinheiro estiver guardado.`
      : `Pronto! ${other.first} recebe um aviso para conferir e aceitar. Te aviso aqui para pagar.`;
    return result(thread, { step: "sent" }, [{ text: done }], effect);
  }
  return null;
}

/** One turn: the person's text (or the button they tapped) in, the bot's answer and what to do out. */
export function botTurn(thread, input, ctx) {
  const text = String(input ?? "").trim();
  const t = norm(text);
  if (t === "corrigir") return result(thread, { step: "idle", draft: {} }, [{ text: "Sem problema. Escreva de novo o que foi combinado." }]);
  const byButton = buttonTurn(thread, t, ctx);
  if (byButton) return byButton;
  if (CANCEL.test(t)) return result(thread, { step: "idle", draft: {} }, [{ text: "Tudo bem, cancelei. Quer começar de novo?", buttons: START }]);
  if (GREETING.test(t)) return result(thread, {}, [{ text: "Oi! Quer cobrar por um serviço ou pagar alguém?", buttons: START }]);
  const fresh = ["sent", "paid", "awaitingPay", "pix", "incoming", "incomingConfirm"].includes(thread.step);
  const { draft, changed } = merge(fresh ? {} : thread.draft ?? {}, text, ctx);
  if (!changed) return result(thread, {}, [{ text: answer(text).text }]);
  const out = advance(draft, ctx);
  return result(thread, { step: out.step, draft: out.draft ?? draft, ...(fresh ? { contractId: null } : {}) }, out.replies);
}
