// The provider as a business: quotes, stage templates, Aval Link and card machine, auto anticipation,
// subcontracting, invoices and Pix Automático. Money rules stay in code.
import {
  addDays, addLedger, clientList, contractById, draft, getState, makeStage, myName, myNames, nextId, notify, notifyProvider, parseReais, setDraft, today, update,
} from "../store.js";
import { money } from "../ui.js";
import { contractFromInvite } from "./contract.js";
import { actions as A, go, ok, warn } from "./core.js";
import { fund } from "./payment.js";
import { anticipationCheck, anticipationValues } from "./provider.js";

const STAGE_SPACING_DAYS = 15;
const ARBITRATION_RATE = 0.004;
export const TEMPLATES = {
  banheiro: ["Reforma de banheiro", [["Demolição e preparo", 0.3], ["Instalações", 0.4], ["Acabamento", 0.3]]],
  pintura: ["Pintura", [["Preparo e massa", 0.5], ["Pintura e acabamento", 0.5]]],
  interiores: ["Projeto de interiores", [["Medição e briefing", 0.25], ["Projeto 3D e memorial", 0.5], ["Acompanhamento da obra", 0.25]]],
  unica: ["Etapa única", [["Serviço completo", 1]]],
};
/** Who can receive a quote: everyone in the presentation on their hiring side, except me. */
export const quoteClients = (s) => clientList(s).filter((name) => !myNames(s).has(name));

/** Splits a total by a template in whole reais; the last stage takes the rounding. */
export function splitByTemplate(totalCents, key) {
  const parts = TEMPLATES[key][1];
  let used = 0;
  return parts.map(([name, share], i) => {
    const valueCents = i === parts.length - 1 ? totalCents - used : Math.round((totalCents * share) / 100) * 100;
    used += valueCents;
    return { name, valueCents };
  });
}
const withDues = (stages) => stages.map((st, i) => ({ ...st, due: addDays(STAGE_SPACING_DAYS * (i + 1)) }));

// Quote: the provider proposes, the client accepts and the contract is born
A.chooseQuoteClient = ({ name }) => setDraft("orc.client", name, false);
A.chooseQuoteTemplate = ({ key }) => {
  const total = parseReais(draft("orc.total"));
  if (!total) return warn("Informe o valor total.");
  update((s) => { s.ui.drafts.orc = { ...s.ui.drafts.orc, template: key, stages: withDues(splitByTemplate(total, key)) }; });
};
A.sendQuote = () => {
  const title = draft("orc.title").trim();
  const description = draft("orc.description").trim();
  const totalCents = parseReais(draft("orc.total"));
  const stages = draft("orc.stages", []);
  const client = draft("orc.client", quoteClients(getState())[0]);
  if (!title || !totalCents || stages.length === 0) return warn("Preencha título, valor e etapas.");
  if (client === myName(getState())) return warn("Escolha outro cliente.");
  let id = "";
  update((s) => {
    id = nextId("CV-", s.invites.map((i) => i.id));
    const provider = myName(s);
    s.invites.push({ id, from: "provider", title, description, client, provider, totalCents, stages, insurance: null, status: "sent", createdAt: today() });
    notify(s, client, `Orçamento de ${provider}`, `${title} · ${money(totalCents)}`, "file-text", `#/orcamento/${id}`, "contratante");
    s.ui.drafts.orc = undefined;
  });
  go(`#/orcamento/enviado/${id}`);
};
A.toggleQuoteInsurance = () => setDraft("orcamento.insurance", !draft("orcamento.insurance"), false);
A.acceptQuote = ({ id }) => {
  const s0 = getState();
  const quote = s0.invites.find((i) => i.id === id);
  if (!quote || quote.status !== "sent" || quote.client !== myName(s0)) return warn("Este orçamento não está disponível.");
  if (!draft("orcamento.terms")) return warn("Aceite as condições e a cláusula compromissória.");
  let contractId = "";
  update((s) => {
    const inv = s.invites.find((i) => i.id === id);
    const c = contractFromInvite(s, inv, { insured: Boolean(draft("orcamento.insurance")) });
    contractId = c.id;
    notifyProvider(s, c, "Orçamento aceito", `${inv.title} · aguardando pagamento`, "check-circle", `#/servico/${contractId}`);
    s.ui.drafts.orcamento = undefined;
  });
  go(`#/pagar/${contractId}`);
};
A.declineQuote = ({ id }) => {
  update((s) => {
    const inv = s.invites.find((i) => i.id === id);
    inv.status = "declined";
    notify(s, inv.provider, "Orçamento recusado", inv.title, "x", "", "prestador");
  });
  go("#/servicos");
};

// Aval Link and the card machine: the client without the app pays into custody from a link
function createLink(s, via) {
  const prefix = via === "pos" ? "pos" : "link";
  const id = nextId("LK-", s.links.map((l) => l.id));
  s.links.unshift({
    id, via, provider: myName(s), title: draft(`${prefix}.title`), totalCents: parseReais(draft(`${prefix}.total`)),
    phone: draft(`${prefix}.phone`), status: "sent", createdAt: today(), contractId: null,
  });
  return id;
}
A.createLink = () => {
  if (!parseReais(draft("link.total")) || !draft("link.title").trim()) return warn("Informe o serviço e o valor.");
  let id = "";
  update((s) => { id = createLink(s, "app"); });
  go(`#/link/enviado/${id}`);
};
A.posStep = ({ step }) => {
  if (step === "offer" && !parseReais(draft("pos.total"))) return warn("Informe o valor do serviço.");
  setDraft("pos.step", step, false);
};
A.posAccept = () => {
  update((s) => {
    const id = createLink(s, "pos");
    s.ui.drafts.pos = { ...s.ui.drafts.pos, step: "sent", linkId: id };
  });
};
A.posReset = () => update((s) => { s.ui.drafts.pos = undefined; });
A.chooseLinkTemplate = ({ key }) => setDraft("lk.template", key, false);
A.payLink = ({ id }) => {
  const link = getState().links.find((l) => l.id === id);
  const client = draft("lk.name").trim();
  if (!link || link.status !== "sent") return warn("Este link não está mais ativo.");
  if (!client) return warn("Informe seu nome completo.");
  if (!draft("lk.terms")) return warn("Aceite os termos e a cláusula compromissória.");
  update((s) => {
    const l = s.links.find((x) => x.id === id);
    const stages = withDues(splitByTemplate(l.totalCents, draft("lk.template", "unica")));
    const c = contractFromInvite(s, { title: l.title, description: l.title, client, provider: l.provider, totalCents: l.totalCents, stages, insurance: null }, { insured: false });
    c.origin = l.via === "pos" ? "Maquininha Nexo" : "Aval Link";
    fund(s, c, l.totalCents, `Pix · ${c.origin}`);
    Object.assign(l, { status: "paid", contractId: c.id, client });
    notifyProvider(s, c, `${client} pagou pelo ${c.origin}`, `${money(l.totalCents)} em custódia`, "link", `#/servico/${c.id}`);
  });
  ok("Pagamento confirmado. O dinheiro está protegido em custódia.");
};

// Agenda: partial and automatic anticipation
A.setAnticipationShare = ({ share }) => setDraft("antecipar.share", Number(share), false);
A.toggleAutoAnticipation = ({ id }) => update((s) => {
  const c = contractById(s, id);
  c.autoAnticipate = !c.autoAnticipate;
});
/** Called when a delivery is sent: contracts with auto anticipation get the money the same day. */
export function maybeAutoAnticipate(s, c, idx) {
  if (!c.autoAnticipate || anticipationCheck(s, c, idx).some(([, okItem]) => !okItem)) return;
  const values = anticipationValues(c.stages[idx]);
  c.stages[idx].anticipation = { ...values, at: today(), auto: true };
  addLedger(s, c.id, `Antecipação automática etapa ${idx + 1} · ${c.provider}`, -values.netCents, "Pendente");
  notifyProvider(s, c, "Antecipação automática feita", `${money(values.netCents)} · ${c.title}`, "lightning", "#/agenda");
}

// Subcontracting: a stage of the main job is passed on, paid from the provider's balance, released in cascade
A.chooseSubProvider = ({ name }) => setDraft("sub.provider", name, false);
A.createSubcontract = ({ id, stage }) => {
  const idx = Number(stage);
  const s0 = getState();
  const st = contractById(s0, id)?.stages[idx];
  const valueCents = parseReais(draft("sub.value"));
  const provider = draft("sub.provider");
  if (!st || !provider) return warn("Escolha quem vai executar.");
  if (!valueCents || valueCents >= st.valueCents) return warn(`O subcontrato precisa ser menor que a etapa (${money(st.valueCents)}).`);
  if (s0.accounts[s0.session.person].balanceCents < valueCents) return warn("Saldo Nexo insuficiente para colocar o subcontrato em custódia.");
  let subId = "";
  update((s) => {
    subId = nextId("AV-2026-", s.contracts.map((c) => c.id));
    const client = myName(s);
    s.contracts.unshift({
      id: subId, title: `${st.name} (subcontrato)`, client, provider, kind: "individual", description: draft("sub.description"),
      totalCents: valueCents, status: "active", signedAt: today(), arbitration: true, paidInCents: valueCents, refundedCents: 0,
      payment: { method: "pix" }, entrada: null, insurance: null, arbitrationFeeCents: Math.round(valueCents * ARBITRATION_RATE), parent: { contractId: id, stage: idx },
      stages: [makeStage(st.name, valueCents, st.due, "inProgress", st.items, { linkedTo: { contractId: id, stage: idx } })],
    });
    s.accounts[s.session.person].balanceCents -= valueCents;
    addLedger(s, subId, `Saldo Nexo · ${client}`, valueCents);
    s.ui.drafts.sub = undefined;
  });
  ok("Subcontrato criado. Ele é liberado junto com a etapa da obra principal.");
  go(`#/servico/${subId}`);
};
A.simulateSubDelivery = ({ id }) => update((s) => {
  const c = contractById(s, id);
  Object.assign(c.stages[0], {
    status: "awaitingApproval",
    delivery: { description: "Serviço executado conforme a etapa da obra principal.", sentAt: today(), deadline: addDays(7), attachments: [{ kind: "photo", caption: "Serviço concluído" }] },
  });
  notify(s, c.client, `${c.provider} enviou a entrega`, `${c.title} · liberação em cascata`, "upload-simple", `#/servico/${id}`, "contratante");
});

// Invoices: an NFS-e is issued for the provider every time a stage leaves custody
export function issueInvoice(s, c, idx, amountCents) {
  const id = nextId("NFS-2026-", s.invoices.map((n) => n.id));
  s.invoices.unshift({ id, contractId: c.id, stage: idx, provider: c.provider, client: c.client, amountCents, issuedAt: today() });
  return id;
}

// Pix Automático for installments: on the due date the installment is paid from the Nexo balance
A.togglePixAuto = () => {
  update((s) => {
    const acc = s.accounts[s.session.person];
    acc.pixAuto = !acc.pixAuto;
  });
  ok(getState().accounts[getState().session.person].pixAuto ? "Pix Automático ativado para as parcelas." : "Pix Automático desligado.");
};
