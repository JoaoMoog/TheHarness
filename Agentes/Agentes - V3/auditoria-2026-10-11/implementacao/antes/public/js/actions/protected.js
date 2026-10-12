// Protected payment of what the two sides already agreed outside the app. Either side opens it ("Cobrar" or "Pagar"),
// sends it in the app, by a WhatsApp link or a QR code, and the other side checks and accepts.
import { composeAddress, demoCep, formatCep, normalizeCep } from "../domain/address.js";
import { daysBetween, fmtDate, isoToBr, parseDdMm, shiftDate } from "../domain/dates.js";
import { securityCode, stagesFor, validateAgreement } from "../domain/protected.js";
import { parseContact } from "../domain/split.js";
import { SELF, draft, getState, nextId, notify, now, parseReais, peopleOf, person, personOfContact, setDraft, today, update } from "../store.js";
import { money } from "../ui.js";
import { arbitrationFee, contractFromInvite } from "./contract.js";
import { actions as A, go, ok, warn } from "./core.js";
import { importedCustomer } from "./session.js";
import { UNDO_MS } from "./perks.js";
import { waOnAccepted } from "./wa-notify.js";

const TITLE_MAX = 48;
/**
 * What a person would type in the demo, before asking the AI to improve it. The charge is above the card limit
 * (limit offer) and the payment above the balance (credit offer).
 */
const DEFAULTS = {
  provider: { description: "pintar o apartamento todo, massa corrida e duas demãos", total: "16.000,00", dueDate: "03/11", cep: "05435-000", street: "Rua Harmonia", number: "410", district: "Vila Madalena", city: "São Paulo", uf: "SP", release: null, template: "unica", channel: "whatsapp" },
  client: { description: "projeto de interiores da sala e da cozinha", total: "18.000,00", dueDate: "10/11", cep: "05435-000", street: "Rua Harmonia", number: "410", district: "Vila Madalena", city: "São Paulo", uf: "SP", release: "single", template: "unica", channel: "app" },
};

const titleOf = (description) => {
  const head = description.split(":")[0].trim();
  return head.length > TITLE_MAX ? `${head.slice(0, TITLE_MAX - 1)}…` : head;
};
/** The other people in the presentation, as candidates to receive the payment in the app. */
export const otherPeople = (s = getState()) => Object.values(peopleOf(s)).filter((p) => p.id !== s.session.person);
/** The name a person uses on the side they take: who pays uses the client name, who receives the provider name. */
const nameOn = (p, from) => (from === "provider" ? p.clientName : p.providerName);

function openDraft(from) {
  const s = getState();
  const others = otherPeople(s);
  const contact = s.session.person === SELF ? others[0]?.phone ?? "" : importedCustomer().phone;
  update((x) => {
    x.ui.drafts.ag = { from, ...DEFAULTS[from], person: others.find((p) => p.id === "marina")?.id ?? others[0]?.id, contact };
    // A new payment starts a new stages chat: never the one of the payment written before.
    if (x.ui.drafts.stg?.novo) x.ui.drafts.stg = { ...x.ui.drafts.stg, novo: undefined };
  });
  go("#/combinado/1");
}

/** Stages of my services that I can charge now: the ones in progress, waiting for my delivery. */
export function chargeableStages(s = getState()) {
  const mine = person(s)?.providerName;
  return s.contracts.filter((c) => c.provider === mine && c.status === "active")
    .flatMap((c) => c.stages.map((st, i) => ({ c, st, i })).filter(({ st }) => st.status === "inProgress" || st.status === "adjustRequested"));
}
/** Cobrar: a new charge to anyone, or a stage of a service in progress (asking for its release). */
A.startCharge = () => (chargeableStages().length ? go("#/cobrar") : openDraft("provider"));
A.newCharge = () => openDraft("provider");
A.chargeStage = ({ id, stage }) => A.startDelivery({ id, stage });
A.startPayment = () => openDraft("client");

/** Stages the payer chose with the assistant, while they still add up to the total. */
const customStages = (totalCents) => {
  const custom = draft("ag.custom");
  return custom && custom.stages.reduce((a, st) => a + st.valueCents, 0) === totalCents ? custom : null;
};

/** The due date: the date picker (with the year) or, before it is touched, the date written in the draft. */
const agreementDue = () => (draft("ag.dueIso") ? isoToBr(draft("ag.dueIso")) : String(draft("ag.dueDate", "")).trim());
const ADDRESS_PARTS = ["street", "number", "complement", "district", "city", "uf"];
/** The address in one line, from the parts found by CEP (or typed); a free-text address read from a chat otherwise. */
const agreementAddress = () =>
  composeAddress(Object.fromEntries(ADDRESS_PARTS.map((k) => [k, String(draft(`ag.${k}`, ""))]))) || String(draft("ag.address", "")).trim();

const VIACEP_TIMEOUT_MS = 4000;
/** ViaCEP, for a CEP outside the demo list; null when it is not found or the network does not answer in time. */
async function viaCep(digits) {
  try {
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`, { signal: AbortSignal.timeout(VIACEP_TIMEOUT_MS) });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.erro ? null : { street: String(data.logradouro ?? ""), district: String(data.bairro ?? ""), city: String(data.localidade ?? ""), uf: String(data.uf ?? "") };
  } catch (error) {
    console.warn("ViaCEP sem resposta", error);
    return null;
  }
}

/** Fills street, district, city and state from the CEP; the person only types the number. */
A.lookupCep = async () => {
  const digits = normalizeCep(draft("ag.cep", ""));
  if (!digits) return warn("Digite um CEP com 8 números.");
  const found = demoCep(digits) ?? (await viaCep(digits));
  if (!found) {
    update((s) => { s.ui.drafts.ag = { ...s.ui.drafts.ag, cep: formatCep(digits), addressOpen: true }; });
    return warn("Não achamos esse CEP. Preencha o endereço.");
  }
  update((s) => { s.ui.drafts.ag = { ...s.ui.drafts.ag, cep: formatCep(digits), ...found, number: "", complement: "", addressOpen: true }; });
  ok("Endereço encontrado. Falta só o número.");
};
A.openAddress = () => setDraft("ag.addressOpen", true, false);

/** The agreement as typed, with its stages. A charge has none: the payer defines them when accepting. */
export function agreementDraft() {
  const totalCents = parseReais(draft("ag.total"));
  const from = draft("ag.from", "provider");
  const custom = from === "client" && totalCents ? customStages(totalCents) : null;
  // Whoever charges may suggest the stages (material up front); the payer still decides.
  const proposal = from === "provider" && totalCents ? customStages(totalCents) : null;
  const release = custom?.release ?? draft("ag.release", "single");
  const stages = from === "provider" || !totalCents ? [] : custom?.stages ?? stagesFor(totalCents, release, release === "stages" ? draft("ag.template", "pintura") : undefined);
  return {
    from, description: String(draft("ag.description", "")).trim(), totalCents, dueDate: agreementDue(),
    address: agreementAddress(), release: from === "provider" ? null : release, template: draft("ag.template", "unica"), stages, custom: Boolean(custom), proposal,
  };
}
/** Only the fields of the agreement, without the release (a charge leaves it to the payer). */
const fieldErrors = (ag) => validateAgreement({ ...ag, release: "single" }, now());

A.agreementNext = ({ step }) => {
  if (Number(step) === 1 && String(draft("ag.street", "")).trim() && !String(draft("ag.number", "")).trim()) return warn("Informe o número do endereço.");
  const ag = agreementDraft();
  const errors = Number(step) === 1 ? fieldErrors(ag) : validateAgreement(ag, now());
  if (errors.length) return warn(errors[0]);
  go(`#/combinado/${Number(step) === 1 && ag.from === "provider" ? 3 : Number(step) + 1}`);
};
A.chooseRelease = ({ release }) => update((s) => {
  s.ui.drafts.ag = { ...s.ui.drafts.ag, custom: undefined, release, template: release === "single" ? "unica" : s.ui.drafts.ag?.template === "unica" ? "pintura" : s.ui.drafts.ag?.template };
});
A.chooseAgTemplate = ({ key }) => update((s) => { s.ui.drafts.ag = { ...s.ui.drafts.ag, custom: undefined, template: key }; });
A.chooseChannel = ({ channel }) => setDraft("ag.channel", channel, false);
A.chooseAgPerson = ({ id }) => setDraft("ag.person", id, false);

/** Stage due dates spread evenly until the agreed deadline. */
function withDues(stages, dueDate) {
  const days = Math.max(stages.length, daysBetween(now(), parseDdMm(dueDate)));
  return stages.map((st, i) => ({ ...st, due: i === stages.length - 1 ? dueDate : fmtDate(shiftDate(now(), Math.round((days * (i + 1)) / stages.length))) }));
}

/** Who is on the other side, by the channel: a person in the app, a WhatsApp number, or whoever scans the QR. */
function counterpartOf(s, channel, from) {
  if (channel === "qr") return { name: null, contact: "" };
  if (channel === "app") {
    const p = peopleOf(s)[draft("ag.person")];
    if (!p || p.id === s.session.person) return { error: "Escolha quem vai receber no app." };
    return { name: nameOn(p, from), contact: p.phone };
  }
  const parsed = parseContact(draft("ag.contact", ""));
  if (parsed?.channel !== "whatsapp") return { error: "Digite um celular com DDD para mandar pelo WhatsApp." };
  const who = personOfContact(parsed.contact, s);
  if (who?.id === s.session.person) return { error: "Este celular é o seu." };
  return { name: who ? nameOn(who, from) : null, contact: parsed.contact };
}

/** A payment sent to the other side: the same object from the app, the link, the QR or the WhatsApp of the BTG Aval. */
export function buildInvite(s, { from, createdBy, channel, contact, description, address, dueDate, release, client, provider, totalCents, stages, proposal = null, origin = "app", repeat = false }) {
  const id = nextId("PG-", s.invites.map((i) => i.id));
  return {
    id, token: id, protected: true, kind: "individual", from, createdBy, channel, contact, title: titleOf(description), description, address, dueDate, release,
    client, provider, totalCents, stages: withDues(stages, dueDate), insurance: null, arbitrationFeeCents: arbitrationFee(totalCents),
    participants: null, declined: [], status: "sent", createdAt: today(), sentAtMs: Date.now(), repeat, origin,
    proposal: proposal ? { release: proposal.release, stages: proposal.stages } : null,
  };
}

/** The other side gets a notice in the BTG app with the link's code, whatever the channel: a fake link has no notice. */
export function announceInvite(s, invite, otherName) {
  if (!otherName) return;
  const mine = invite.from === "provider" ? invite.provider : invite.client;
  const what = invite.from === "provider" ? `${mine} cobrou você` : `${mine} quer pagar você pelo Aval`;
  const code = invite.channel === "app" ? "" : ` · código ${securityCode(invite.token)}`;
  notify(s, otherName, what, `${invite.title} · ${money(invite.totalCents)}${code}`, "seal-check", `#/p/${invite.id}`, invite.from === "provider" ? "contratante" : "prestador");
}

A.sendAgreement = () => {
  const s0 = getState();
  const ag = agreementDraft();
  const errors = ag.from === "provider" ? fieldErrors(ag) : validateAgreement(ag, now());
  if (errors.length) return warn(errors[0]);
  const channel = draft("ag.channel", "app");
  const other = counterpartOf(s0, channel, ag.from);
  if (other.error) return warn(other.error);
  const me = person(s0);
  let id = "";
  update((s) => {
    const mine = ag.from === "provider" ? me.providerName : me.clientName;
    const invite = buildInvite(s, {
      from: ag.from, createdBy: s.session.person, channel, contact: other.contact, description: ag.description, address: ag.address, dueDate: ag.dueDate,
      release: ag.release, client: ag.from === "provider" ? other.name : mine, provider: ag.from === "provider" ? mine : other.name,
      totalCents: ag.totalCents, stages: ag.stages, proposal: ag.proposal, repeat: Boolean(draft("ag.repeat")),
    });
    id = invite.id;
    s.invites.push(invite);
    announceInvite(s, invite, other.name);
    s.ui.drafts.ag = undefined;
  });
  go(`#/combinado/enviado/${id}`);
  setTimeout(() => update(() => {}), UNDO_MS + 100);
};
A.toggleRepeat = () => setDraft("ag.repeat", !draft("ag.repeat", false), false);

/** Who opens the link in the presentation: the owner of the number, the demo customer, or the other person for a QR. */
function receiverOf(s, inv) {
  const owner = personOfContact(inv.contact, s);
  if (owner) return owner.id;
  const demo = importedCustomer();
  if (inv.contact === demo.phone || inv.contact === demo.email) return SELF;
  return inv.createdBy === SELF ? "marina" : SELF;
}

/** Presentation shortcut: become the person who got the WhatsApp link (or is in front of the QR) and open it. */
A.openAgreementLink = ({ token }) => {
  const inv = getState().invites.find((i) => i.token === token);
  if (!inv) return warn("Este link não existe mais.");
  update((s) => {
    const target = receiverOf(s, inv);
    s.session = { person: target, mode: inv.from === "provider" ? "contratante" : "prestador", loggedIn: target !== SELF || Boolean(s.people[SELF]) };
    s.ui.sheet = null;
  });
  go(`#/p/${token}`);
};

/** Without a BTG account the person enters (or opens) it first, then comes back to the same payment. */
A.enterBtgForLink = ({ token }) => {
  update((s) => {
    s.session = { ...s.session, person: SELF, loggedIn: false };
    s.ui.returnTo = `#/p/${token}`;
  });
  go("#/cadastro");
};

/** The QR on the other person's phone: the latest one still open. */
A.scanQr = () => {
  const s = getState();
  const qr = s.invites.filter((i) => i.protected && i.channel === "qr" && i.status === "sent" && i.createdBy !== s.session.person).at(-1);
  if (!qr) return warn("Nenhum QR na frente da câmera. Peça para a outra pessoa mostrar o QR do pagamento.");
  go(`#/p/${qr.token}`);
};

A.acceptAgreement = ({ token }) => {
  const s0 = getState();
  const inv = s0.invites.find((i) => i.token === token);
  if (!inv || inv.status !== "sent") return warn("Este pagamento não está mais aberto.");
  if (inv.createdBy === s0.session.person) return warn("Quem aceita é a outra pessoa.");
  if (!draft("ag.accept")) return warn("Confira o combinado e marque a caixa.");
  if (!draft("ag.arbitration")) return warn("Leia e aceite a cláusula de arbitragem.");
  const me = person(s0);
  const paying = inv.from === "provider";
  if ((paying ? inv.provider : inv.client) === (paying ? me.clientName : me.providerName)) return warn("Você não pode pagar a si mesmo.");
  const chosen = paying ? s0.ui.drafts.stg?.[token]?.chosen : null;
  if (paying && !chosen) return warn("Defina como o dinheiro é liberado: valor único ou marcos.");
  let contractId = "";
  update((s) => {
    const invite = s.invites.find((i) => i.token === token);
    Object.assign(invite, paying ? { client: me.clientName, release: chosen.release, stages: withDues(chosen.stages, invite.dueDate) } : { provider: me.providerName });
    const c = contractFromInvite(s, invite);
    contractId = c.id;
    waOnAccepted(s, invite, c.id);
    s.session.mode = paying ? "contratante" : "prestador";
    if (paying) notify(s, invite.provider, `${invite.client} aceitou a cobrança`, `${invite.title} · aguardando o pagamento`, "check-circle", `#/servico/${c.id}`, "prestador");
    else notify(s, invite.client, `${invite.provider} aceitou`, `Pague com Aval · ${invite.title}`, "seal-check", `#/pagar/${c.id}`, "contratante");
    s.ui.drafts.ag = undefined;
  });
  ok(paying ? "Combinado aceito. Agora é só pagar." : "Combinado aceito. Quem paga foi avisado.");
  go(paying ? `#/pagar/${contractId}` : `#/servico/${contractId}`);
};

A.declineAgreement = ({ token }) => {
  update((s) => {
    const inv = s.invites.find((i) => i.token === token);
    inv.status = "declined";
    const creator = peopleOf(s)[inv.createdBy];
    if (creator) notify(s, inv.from === "provider" ? creator.providerName : creator.clientName, "Pagamento recusado", inv.title, "x", "", inv.from === "provider" ? "prestador" : "contratante");
  });
  ok("Pagamento recusado. Quem enviou foi avisado.");
  go("#/inicio");
};
A.setPaymentsTab = ({ tab }) => setDraft(`home.tab.${getState().session.person}`, tab, false);
/** A suggestion of the search screen fills the box and shows the results. */
A.searchFor = ({ text }) => setDraft("busca.q", text, false);
