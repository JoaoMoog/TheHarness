// New service: description, stages, insurance and invite; then the provider's answer and the down payment.
import { FULL_BPS, equalBps, formatBps, parseContact, parsePercent, pendingCount, rebalance } from "../domain/split.js";
import { TEMPLATES, splitByTemplate } from "./business.js";
import { activateIfFunded } from "./payment.js";
import {
  addDays, addLedger, contractById, draft, getState, makeStage, myName, nextId, notify, notifyClient, notifyProvider, parseReais, person, personOfContact, personOfName, setDraft, splitInviteOf, today, update,
} from "../store.js";
import { money, reais } from "../ui.js";
import { actions as A, go, ok, warn } from "./core.js";

export const INSURANCE_RATE = 0.025;
export const ARBITRATION_RATE = 0.004;
export const insurancePremium = (totalCents) => Math.round(totalCents * INSURANCE_RATE);
export const arbitrationFee = (totalCents) => Math.round(totalCents * ARBITRATION_RATE);

A.chooseProvider = ({ name }) => setDraft("novo.provider", name, false);

// Paying together: the organizer splits the service with people in the app and people typed by name
/** Shortcut from the home strip: a new service already set to be paid together. */
A.startSplit = () => {
  setDraft("novo.splitOn", true, false);
  go("#/novo/1");
};
A.toggleSplit = () => setDraft("novo.splitOn", !draft("novo.splitOn", false), false);
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
  return [{ name: myName(s), contact: me?.phone ?? "", channel: "app", me: true }, ...invited];
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
A.chooseNovoTemplate = ({ key }) => setDraft("novo.template", key, false);
/** Step 1 to step 2: the stages come from the chosen template, split by value; the person adjusts them next. */
A.buildStages = () => {
  const title = draft("novo.title").trim();
  const description = draft("novo.description").trim();
  const totalCents = parseReais(draft("novo.total"));
  if (!title || !description) return warn("Informe o título e a descrição do serviço.");
  if (!totalCents) return warn("Informe um valor total válido.");
  if (draft("novo.provider") === myName(getState())) return warn("Escolha outro prestador: você não pode contratar a si mesmo.");
  const key = TEMPLATES[draft("novo.template", "unica")] ? draft("novo.template", "unica") : "unica";
  update((s) => {
    s.ui.drafts.novo = {
      ...s.ui.drafts.novo, title, description, total: draft("novo.total"), provider: draft("novo.provider"),
      stages: splitByTemplate(totalCents, key).map((st, i) => ({ name: st.name, value: reais(st.valueCents), due: addDays(15 * (i + 1)) })),
    };
  });
  go("#/novo/2");
};
A.addStage = () => update((s) => {
  const stages = s.ui.drafts.novo?.stages ?? [];
  s.ui.drafts.novo.stages = [...stages, { name: "", value: "0,00", due: addDays(15 * (stages.length + 1)) }];
});
A.removeStage = ({ index }) => update((s) => {
  s.ui.drafts.novo.stages = s.ui.drafts.novo.stages.filter((_, i) => i !== Number(index));
});
export function novoTotals() {
  const stages = draft("novo.stages", []);
  const sum = stages.reduce((acc, st) => acc + (parseReais(st.value) ?? 0), 0);
  return { stages, sum, total: parseReais(draft("novo.total")) ?? 0 };
}
A.goNovo3 = () => {
  const { stages, sum, total } = novoTotals();
  if (stages.length === 0 || stages.some((st) => !st.name.trim() || !parseReais(st.value))) return warn("Cada etapa precisa de nome e valor.");
  if (sum !== total) return warn(`A soma das etapas (${money(sum)}) precisa ser igual ao total (${money(total)}).`);
  go("#/novo/3");
};
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
A.sendInvite = () => {
  if (!draft("novo.terms")) return warn("Aceite as condições e a cláusula de arbitragem.");
  const { stages, total } = novoTotals();
  const people = novoParticipants();
  if (people && people.length < 2) return warn("Para dividir, convide pelo menos uma pessoa pelo celular ou e-mail.");
  const pctError = splitPercentError();
  if (pctError) return warn(pctError);
  const insured = !people && Boolean(draft("novo.insurance"));
  const client = myName(getState());
  let id = "";
  update((s) => {
    id = nextId("CV-", s.invites.map((i) => i.id));
    const provider = draft("novo.provider");
    s.invites.push({
      id, title: draft("novo.title"), description: draft("novo.description"), client, provider,
      totalCents: total, stages: stages.map((st) => ({ name: st.name.trim(), valueCents: parseReais(st.value), due: st.due })),
      insurance: insured ? { premiumCents: insurancePremium(total) } : null, arbitrationFeeCents: arbitrationFee(total),
      kind: people ? "collective" : "individual", participants: people ? splitParticipants(s, total, people) : null, declined: [],
      status: "sent", createdAt: today(),
    });
    notify(s, provider, `Convite de ${client}`, `${draft("novo.title")} · ${money(total)}`, "paper-plane-tilt", `#/convite/${id}`, "prestador");
    for (const p of s.invites.at(-1).participants ?? []) {
      if (!p.me && personOfName(p.name, s)) notify(s, p.name, "Convite para dividir um serviço", `${client} · sua parte ${money(p.shareCents)}`, "users-three", `#/dividir/${p.token}`, "contratante");
    }
    s.ui.drafts.novo = undefined;
  });
  go(`#/novo/enviado/${id}`);
};

/** Turns an accepted invite, quote or link into a contract waiting for payment. Stages carry their due dates. */
export function contractFromInvite(s, invite, { entradaCents = null, insured = false } = {}) {
  const id = nextId("AV-2026-", s.contracts.map((c) => c.id));
  const premiumCents = invite.insurance?.premiumCents ?? insurancePremium(invite.totalCents);
  const policy = insured ? nextId("SG-2026-", s.contracts.map((c) => c.insurance?.policy).filter(Boolean)) : null;
  const collective = invite.kind === "collective" && Array.isArray(invite.participants);
  const contract = {
    id, title: invite.title, client: invite.client, provider: invite.provider, kind: collective ? "collective" : "individual", description: invite.description,
    ...(collective ? { participants: invite.participants.map((p) => ({ ...p })), declined: [...(invite.declined ?? [])] } : {}),
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

// Provider accepts the invite, optionally asking for a down payment
A.acceptInvite = ({ id }) => {
  const s0 = getState();
  const invite = s0.invites.find((i) => i.id === id);
  if (!invite || invite.status !== "sent") return warn("Este convite não está mais disponível.");
  if (invite.provider !== myName(s0)) return warn("Este convite é para outro prestador.");
  if (!draft("convite.terms")) return warn("Aceite as condições e a cláusula de arbitragem.");
  const askEntrada = Boolean(draft("convite.askEntrada"));
  const entradaCents = askEntrada ? parseReais(draft("convite.entrada")) : null;
  if (askEntrada && (!entradaCents || entradaCents > invite.stages[0].valueCents)) {
    return warn(`A entrada deve ser maior que zero e até ${money(invite.stages[0].valueCents)} (valor da etapa 1).`);
  }
  let contractId = "";
  update((s) => {
    const contract = contractFromInvite(s, invite, { entradaCents, insured: Boolean(invite.insurance) });
    contractId = contract.id;
    if (entradaCents) notifyClient(s, contract, `${invite.provider} pediu uma entrada`, `${money(entradaCents)} · ${invite.title}`, "hand-coins", `#/entrada-decidir/${contractId}`);
    else notifyClient(s, contract, "Convite aceito", `Pague para começar · ${invite.title}`, "check-circle", `#/pagar/${contractId}`);
    if (contract.kind === "collective") afterSplitAnswer(s, contract);
    s.ui.drafts.convite = undefined;
  });
  ok("Convite aceito. A contratante foi avisada.");
  go(`#/servico/${contractId}`);
};
A.declineInvite = ({ id }) => {
  update((s) => {
    const inv = s.invites.find((i) => i.id === id);
    inv.status = "declined";
    notify(s, inv.client, "Convite recusado", `${inv.provider} não aceitou`, "x", "", "contratante");
  });
  go("#/inicio");
};

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
    notifyProvider(s, ct, "Entrada recusada", `${c.title} segue só com etapas`, "x", `#/servico/${id}`);
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

const splitTarget = (s, holder) => (s.contracts.includes(holder) ? `#/coletivo/${holder.id}` : `#/novo/enviado/${holder.id}`);
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
  const typed = draft("dividir.name", "").trim();
  if (outside && !typed) return warn("Digite o seu nome para o grupo.");
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
  update((s) => {
    const { holder: c, participant: p } = splitInviteOf(s, token);
    if (p.paid) return;
    Object.assign(p, { paid: true, origin: "Pix pelo link" });
    c.paidInCents += p.shareCents;
    addLedger(s, c.id, `Pix pelo link · ${p.name}`, p.shareCents);
    notify(s, c.client, `${p.name} pagou a parte`, `${c.title} · ${money(p.shareCents)}`, "qr-code", `#/coletivo/${c.id}`, "contratante");
    activateIfFunded(s, c);
  });
  ok("Pix confirmado. Sua parte está em custódia.");
};
A.resendSplit = ({ token }) => {
  const found = splitInviteOf(getState(), token);
  if (!found?.participant) return;
  ok(found.participant.channel === "email" ? `Link reenviado para ${found.participant.contact}.` : `Mensagem reenviada no WhatsApp para ${found.participant.contact}.`);
};
