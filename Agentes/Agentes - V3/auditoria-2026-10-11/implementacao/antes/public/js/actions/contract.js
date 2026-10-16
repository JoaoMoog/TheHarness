// Contracts born from an accepted payment, paying together (split by percentage) and the down payment.
import { FULL_BPS, equalBps, formatBps, parseContact, parsePercent, pendingCount, rebalance } from "../domain/split.js";
import { activateIfFunded } from "./payment.js";
import {
  addLedger, contractById, draft, getState, makeStage, nextId, peopleOf, notify, notifyClient, notifyProvider, parseReais, person, personOfContact, personOfName, setDraft, splitInviteOf, today, update,
} from "../store.js";
import { money, reais } from "../ui.js";
import { actions as A, go, ok, warn } from "./core.js";

export const ARBITRATION_RATE = 0.004;
export { INSURANCE_RATE, insurancePremium } from "../domain/protected.js";
import { insurancePremium } from "../domain/protected.js";
export const arbitrationFee = (totalCents) => Math.round(totalCents * ARBITRATION_RATE);

// Paying together: the organizer splits the service with people in the app and people typed by name
/** Adds one person to the split by mobile number (invite by WhatsApp) or e-mail (invite by link). */
A.addSplitContact = () => {
  const s0 = getState();
  const parsed = parseContact(draft("novo.splitContact", ""));
  if (!parsed) return warn("Digite um celular com DDD (WhatsApp) ou um e-mail.");
  const list = draft("novo.splitContacts", []);
  if (list.some((x) => x.contact === parsed.contact)) return warn("Este contato já foi convidado.");
  const who = personOfContact(parsed.contact, s0);
  if (who && who.id === person(s0)?.id) return warn("Este contato é o seu.");
  if (who && who.providerName === draft("novo.provider")) return warn("O prestador não entra na divisão.");
  update((s) => { s.ui.drafts.novo = { ...s.ui.drafts.novo, splitContacts: [...list, parsed], splitContact: "", splitPct: undefined }; });
};
A.removeSplitContact = ({ index }) => update((s) => {
  s.ui.drafts.novo = { ...s.ui.drafts.novo, splitContacts: (s.ui.drafts.novo?.splitContacts ?? []).filter((_, i) => i !== Number(index)), splitPct: undefined };
});

/** The organizer and the invited people of the new service, before percentages. */
function splitPeople(s) {
  const me = person(s);
  const invited = draft("novo.splitContacts", []).map(({ channel, contact }) => ({ name: personOfContact(contact, s)?.clientName ?? contact, contact, channel }));
  return [{ name: me?.clientName ?? "", contact: me?.phone ?? "", channel: "app", me: true }, ...invited];
}
/** Percentages typed for each person (organizer first); null while untouched, which means equal parts. */
function typedBps(count) {
  const typed = draft("novo.splitPct", null);
  if (!Array.isArray(typed) || typed.every((v) => v == null || v === "")) return null;
  const equal = equalBps(count);
  return Array.from({ length: count }, (_, i) => parsePercent(typed[i] ?? String(equal[i] / 100)));
}
/** Why the typed percentages cannot be used, or null when they add up to 100% (or were not touched). */
export function splitPercentError(s = getState()) {
  if (!draft("novo.splitOn", false)) return null;
  const bps = typedBps(splitPeople(s).length);
  if (!bps) return null;
  if (bps.some((b) => b === null)) return "Cada pessoa precisa de uma porcentagem entre 0 e 100.";
  const sum = bps.reduce((a, b) => a + b, 0);
  return sum === FULL_BPS ? null : `As porcentagens somam ${formatBps(sum)}; precisam somar 100%.`;
}
/** Who pays the new service when it is split, organizer first, with the chosen percentages; null when one person pays. */
export function novoParticipants(s = getState()) {
  if (!draft("novo.splitOn", false)) return null;
  const people = splitPeople(s);
  const bps = typedBps(people.length);
  return bps && !splitPercentError(s) ? people.map((p, i) => ({ ...p, bps: bps[i] })) : people;
}
A.equalSplit = () => update((s) => { s.ui.drafts.novo = { ...s.ui.drafts.novo, splitPct: undefined }; });
/** Builds the invited group with a token for each link and equal shares; only the organizer starts accepted. */
function splitParticipants(s, totalCents, people) {
  const taken = [...s.invites, ...s.contracts].flatMap((h) => [...(h.participants ?? []), ...(h.declined ?? [])]).map((p) => p.token).filter(Boolean);
  const withTokens = people.map((p) => {
    const token = nextId("DV-", taken);
    taken.push(token);
    return { ...p, token, status: p.me ? "accepted" : "pending", unit: "", paid: false, origin: null };
  });
  return rebalance(totalCents, withTokens);
}
/** Turns an accepted invite, quote or link into a contract waiting for payment. Stages carry their due dates. */
export function contractFromInvite(s, invite, { entradaCents = null, insured = false } = {}) {
  const id = nextId("AV-2026-", s.contracts.map((c) => c.id));
  const premiumCents = invite.insurance?.premiumCents ?? insurancePremium(invite.totalCents);
  const policy = insured ? nextId("SG-2026-", s.contracts.map((c) => c.insurance?.policy).filter(Boolean)) : null;
  const collective = invite.kind === "collective" && Array.isArray(invite.participants);
  const contract = {
    id, title: invite.title, client: invite.client, provider: invite.provider, kind: collective ? "collective" : invite.repeat ? "recurring" : "individual", description: invite.description,
    ...(invite.repeat ? { monthlyCents: invite.totalCents } : {}),
    ...(collective ? { participants: invite.participants.map((p) => ({ ...p })), declined: [...(invite.declined ?? [])] } : {}),
    ...(invite.protected ? { protected: true, from: invite.from, channel: invite.channel, address: invite.address, dueDate: invite.dueDate, release: invite.release } : {}),
    totalCents: invite.totalCents, status: collective ? "funding" : "awaitingPayment", signedAt: today(), arbitration: true, paidInCents: 0, refundedCents: 0, payment: null,
    entrada: entradaCents && !collective ? { requestedCents: entradaCents, status: "requested" } : null,
    insurance: insured ? { policy, premiumCents, coverageCents: invite.totalCents, paid: false } : null,
    arbitrationFeeCents: invite.arbitrationFeeCents ?? arbitrationFee(invite.totalCents),
    stages: invite.stages.map((st) => makeStage(st.name, st.valueCents, st.due, "pending", [st.name])),
  };
  s.contracts.unshift(contract);
  if (invite.id) Object.assign(s.invites.find((i) => i.id === invite.id) ?? {}, { status: "accepted", contractId: id });
  return contract;
}

// Client decides on the down payment
A.chooseEntrada = ({ choice }) => setDraft("entrada.choice", choice, false);
A.confirmEntrada = ({ id }) => {
  const c = contractById(getState(), id);
  const choice = draft("entrada.choice", "pay");
  if (choice === "pay") {
    update((s) => { s.ui.payment = { kind: "entrada", contractId: id, amountCents: c.entrada.requestedCents, label: `Entrada · ${c.title}`, after: `#/pagar/${id}` }; });
    return go("#/pix");
  }
  if (choice === "counter") {
    const counter = parseReais(draft("entrada.counter"));
    if (!counter || counter >= c.entrada.requestedCents) return warn("A contraproposta deve ser menor que o valor pedido.");
    update((s) => {
      const ct = contractById(s, id);
      Object.assign(ct.entrada, { status: "countered", counterCents: counter });
      notifyProvider(s, ct, "Contraproposta de entrada", `${money(counter)} · ${c.title}`, "hand-coins", `#/servico/${id}`);
    });
    ok("Contraproposta enviada ao prestador.");
    return go(`#/servico/${id}`);
  }
  update((s) => {
    const ct = contractById(s, id);
    ct.entrada.status = "refused";
    notifyProvider(s, ct, "Entrada recusada", `${c.title} segue só com marcos`, "x", `#/servico/${id}`);
  });
  go(`#/pagar/${id}`);
};
A.acceptCounter = ({ id }) => {
  update((s) => {
    const ct = contractById(s, id);
    Object.assign(ct.entrada, { requestedCents: ct.entrada.counterCents, status: "requested" });
    notifyClient(s, ct, "Contraproposta aceita", `Entrada de ${money(ct.entrada.counterCents)}`, "hand-coins", `#/entrada-decidir/${id}`);
  });
  ok("Contraproposta aceita.");
};

const splitTarget = (s, holder) => `#/coletivo/${holder.id}`;
/** Once nobody is left to answer and the provider already accepted, everyone in the app is told to pay. */
function afterSplitAnswer(s, holder) {
  if (pendingCount(holder.participants) > 0 || !s.contracts.includes(holder)) return;
  for (const p of holder.participants) {
    if (!p.paid && personOfName(p.name, s)) notify(s, p.name, "Todos responderam: pague a sua parte", `${holder.title} · ${money(p.shareCents)}`, "users-three", `#/pagar/${holder.id}`, "contratante");
  }
}
function openSplitInvite(token) {
  const found = splitInviteOf(getState(), token);
  if (!found || found.declined) return warn("Este convite não está mais disponível.");
  if (found.participant.status !== "pending") return warn("Este convite já foi respondido.");
  return found;
}
A.acceptSplit = ({ token }) => {
  const found = openSplitInvite(token);
  if (!found?.participant) return;
  const outside = !personOfName(found.participant.name);
  const typed = found.participant.btg?.name ?? "";
  if (outside && !typed) return warn("Entre com a conta BTG para responder ao convite.");
  update((s) => {
    const { holder, participant } = splitInviteOf(s, token);
    Object.assign(participant, { status: "accepted", answeredAt: today(), ...(outside ? { name: typed } : {}) });
    notify(s, holder.client, `${participant.name} aceitou dividir`, holder.title, "users-three", splitTarget(s, holder), "contratante");
    afterSplitAnswer(s, holder);
    s.ui.drafts.dividir = undefined;
  });
  ok("Convite aceito.");
};
A.declineSplit = ({ token }) => {
  const found = openSplitInvite(token);
  if (!found?.participant) return;
  update((s) => {
    const { holder, participant } = splitInviteOf(s, token);
    holder.declined = [...(holder.declined ?? []), { name: participant.name, contact: participant.contact, channel: participant.channel, token, at: today() }];
    holder.participants = rebalance(holder.totalCents, holder.participants.filter((p) => p.token !== token));
    notify(s, holder.client, `${participant.name} recusou dividir`, `${holder.title} · partes recalculadas`, "users-three", splitTarget(s, holder), "contratante");
    afterSplitAnswer(s, holder);
  });
  ok("Convite recusado. As partes foram recalculadas.");
};
/** Someone outside the app pays their share with Pix from the invite link. */
A.payShareByLink = ({ token }) => {
  const found = splitInviteOf(getState(), token);
  if (!found || found.declined || !found.isContract) return warn("O pagamento ainda não está aberto.");
  if (pendingCount(found.holder.participants)) return warn("O pagamento abre quando todos os convidados responderem.");
  if (!found.participant.btg) return warn("Entre com a conta BTG para pagar.");
  update((s) => {
    const { holder: c, participant: p } = splitInviteOf(s, token);
    if (p.paid) return;
    Object.assign(p, { paid: true, origin: "Pix pela conta BTG" });
    c.paidInCents += p.shareCents;
    addLedger(s, c.id, `Pix pela conta BTG · ${p.name}`, p.shareCents);
    notify(s, c.client, `${p.name} pagou a parte`, `${c.title} · ${money(p.shareCents)}`, "qr-code", `#/coletivo/${c.id}`, "contratante");
    activateIfFunded(s, c);
  });
  ok("Pix confirmado. Sua parte está guardado.");
};
// Paying together, chosen by whoever pays at checkout: the payment becomes a group with a share for each person.
const GUESTS = ["João Souza", "Beatriz Lima", "Rafael Torres", "Paula Nunes"];
A.startSplitPayment = ({ id }) => {
  const s0 = getState();
  const c = contractById(s0, id);
  if (!c || c.kind === "collective" || c.paidInCents > 0) return warn("Este pagamento já não pode ser dividido.");
  const suggested = Object.values(peopleOf(s0)).find((p) => p.id !== s0.session.person && p.providerName !== c.provider)?.phone ?? "";
  update((s) => { s.ui.drafts.novo = { splitOn: true, total: reais(c.totalCents), provider: c.provider, splitContacts: [], splitContact: suggested }; });
  go(`#/dividir-pagamento/${id}`);
};
A.confirmSplitPayment = ({ id }) => {
  const people = novoParticipants();
  if (!people || people.length < 2) return warn("Convide pelo menos uma pessoa pelo celular ou e-mail.");
  const pctError = splitPercentError();
  if (pctError) return warn(pctError);
  update((s) => {
    const c = contractById(s, id);
    Object.assign(c, { kind: "collective", status: "funding", insurance: null, declined: [], participants: splitParticipants(s, c.totalCents, people) });
    for (const p of c.participants) {
      if (!p.me && personOfName(p.name, s)) notify(s, p.name, "Convite para dividir um pagamento", `${c.client} · sua parte ${money(p.shareCents)}`, "users-three", `#/dividir/${p.token}`, "contratante");
    }
    s.ui.drafts.novo = undefined;
  });
  ok("Convites enviados. Cada pessoa aceita e paga a sua parte.");
  go(`#/coletivo/${id}`);
};
/** Someone invited by link enters with the BTG account first; the bank sends the name (synthetic in the presentation). */
A.btgForShare = ({ token }) => {
  const found = splitInviteOf(getState(), token);
  if (!found?.participant || found.declined) return warn("Este convite não está mais disponível.");
  update((s) => {
    const { participant } = splitInviteOf(s, token);
    const used = [...s.invites, ...s.contracts].flatMap((h) => h.participants ?? []).filter((p) => p.btg).length;
    const name = GUESTS[used % GUESTS.length];
    participant.btg = { name, account: `Conta corrente PF · ag 0001 · cc ${String(5_200_301 + used * 7).replace(/(\d)(\d{3})(\d{3})$/, "$1.$2.$3")}-4`, at: today() };
  });
  ok("Conta BTG conectada. Agora responda ao convite.");
};

A.resendSplit = ({ token }) => {
  const found = splitInviteOf(getState(), token);
  if (!found?.participant) return;
  ok(found.participant.channel === "email" ? `Link reenviado para ${found.participant.contact}.` : `Mensagem reenviada no WhatsApp para ${found.participant.contact}.`);
};
