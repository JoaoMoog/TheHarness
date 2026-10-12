// The provider as a business: stage templates, auto anticipation, subcontracting, invoices and Pix Automático.
// Money rules stay in code.
import { addDays, addLedger, contractById, draft, getState, makeStage, myName, nextId, notify, notifyProvider, parseReais, setDraft, today, update } from "../store.js";
import { splitByTemplate } from "../domain/protected.js";
import { money } from "../ui.js";
import { actions as A, go, ok, warn } from "./core.js";
import { anticipationCheck, anticipationValues } from "./provider.js";

const STAGE_SPACING_DAYS = 15;
const ARBITRATION_RATE = 0.004;
export { TEMPLATES, splitByTemplate } from "../domain/protected.js";

const withDues = (stages) => stages.map((st, i) => ({ ...st, due: addDays(STAGE_SPACING_DAYS * (i + 1)) }));

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
  addLedger(s, c.id, `Antecipação automática do marco ${idx + 1} · ${c.provider}`, -values.netCents, "Pendente");
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
  if (!valueCents || valueCents >= st.valueCents) return warn(`O subcontrato precisa ser menor que o marco (${money(st.valueCents)}).`);
  if (s0.accounts[s0.session.person].balanceCents < valueCents) return warn("Saldo BTG insuficiente para colocar o subcontrato guardado.");
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
    addLedger(s, subId, `Saldo BTG · ${client}`, valueCents);
    s.ui.drafts.sub = undefined;
  });
  ok("Subcontrato criado. Ele é liberado junto com o marco da obra principal.");
  go(`#/servico/${subId}`);
};
A.simulateSubDelivery = ({ id }) => update((s) => {
  const c = contractById(s, id);
  Object.assign(c.stages[0], {
    status: "awaitingApproval",
    delivery: { description: "Serviço executado conforme o marco da obra principal.", sentAt: today(), deadline: addDays(7), attachments: [{ kind: "photo", caption: "Serviço concluído" }] },
  });
  notify(s, c.client, `${c.provider} enviou a entrega`, `${c.title} · liberação em cascata`, "upload-simple", `#/servico/${id}`, "contratante");
});

// Invoices: an NFS-e is issued for the provider every time a stage leaves custody
export function issueInvoice(s, c, idx, amountCents) {
  const id = nextId("NFS-2026-", s.invoices.map((n) => n.id));
  s.invoices.unshift({ id, contractId: c.id, stage: idx, provider: c.provider, client: c.client, amountCents, issuedAt: today() });
  return id;
}

// Pix Automático for installments: on the due date the installment is paid from the BTG balance
A.togglePixAuto = () => {
  update((s) => {
    const acc = s.accounts[s.session.person];
    acc.pixAuto = !acc.pixAuto;
  });
  ok(getState().accounts[getState().session.person].pixAuto ? "Pix Automático ativado para as parcelas." : "Pix Automático desligado.");
};
