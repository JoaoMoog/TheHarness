// Disputes: the person picks the reason and lists evidence; mediation follows the resolution matrix in code.
import { addDays, addLedger, audit, contractById, draft, nextId, notifyBank, notifyClient, notifyProvider, setDraft, today, update } from "../store.js";
import { byEnv, money } from "../ui.js";
import { actions as A, go, ok, warn } from "./core.js";

const EVIDENCE_DAYS = 3;
const SLA_DAYS = 7;
const INSPECTION_FEE = "R$ 380,00";
/** Above this value at stake a dispute goes to the top of the bank queue. */
const HIGH_PRIORITY_CENTS = 500_000;

A.startDispute = ({ id, stage }) => {
  update((s) => { s.ui.drafts.disputa = { key: `${id}:${stage}`, reason: null }; s.ui.sheet = null; });
  go(`#/disputa/nova/${id}/${stage}`);
};
A.setDisputeReason = ({ reason }) => setDraft("disputa.reason", reason, false);
/** Evidence is a list of attachments, like a delivery: photo, video or document, each with a caption. */
const EVIDENCE_LABEL = { photo: "Foto", video: "Vídeo", document: "Documento" };
const captionsOf = (key) => (draft(`${key}.files`) ?? []).map((f) => f.caption);
A.addDisputeFile = ({ key, kind }) => {
  const files = draft(`${key}.files`) ?? [];
  setDraft(`${key}.files`, [...files, { kind, caption: `${EVIDENCE_LABEL[kind]} ${files.filter((f) => f.kind === kind).length + 1}${byEnv("", " (simulado)")}` }], false);
};
A.removeDisputeFile = ({ key, index }) => setDraft(`${key}.files`, (draft(`${key}.files`) ?? []).filter((_, i) => i !== Number(index)), false);

/** Queue priority by rule: more money blocked, higher priority; an overdue mediation is always high. */
export const disputePriority = (d) => (d.slaBreached ? 0.9 : d.amountCents >= HIGH_PRIORITY_CENTS ? 0.75 : 0.5);

A.submitDispute = ({ id, stage }) => {
  const idx = Number(stage);
  const report = draft("disputa.report").trim();
  const reason = draft("disputa.reason");
  if (!report) return warn("Conte o que aconteceu.");
  if (!reason) return warn("Escolha o motivo da disputa.");
  let disputeId = "";
  update((s) => {
    const c = contractById(s, id);
    disputeId = nextId("DP-", s.disputes.map((d) => d.id));
    s.disputes.unshift({
      id: disputeId, contractId: id, stage: idx, report, reason, amountCents: c.stages[idx].valueCents, status: "mediation",
      openedAt: today(), deadline: addDays(SLA_DAYS), evidenceDeadline: addDays(EVIDENCE_DAYS), slaDeadline: addDays(SLA_DAYS),
      chatCount: s.messages[id]?.length ?? 0, clientEvidence: captionsOf("disputa"), providerStatement: null, providerEvidence: [], proposal: null,
      history: [["Disputa aberta", `${today()} · ${money(c.stages[idx].valueCents)} bloqueados`, "ok"]],
    });
    c.stages[idx].status = "disputed";
    notifyProvider(s, c, "Disputa aberta", `${c.title} · marco ${idx + 1}`, "scales", `#/disputa/${disputeId}`);
    notifyBank(s, "Nova disputa", `${disputeId} · ${c.title}`, "scales", `#/banco/fila/${disputeId}`);
    s.ui.drafts.disputa = undefined;
  });
  go(`#/disputa/${disputeId}`);
};
A.respondDispute = ({ id }) => {
  const statement = draft("resposta.statement").trim();
  if (!statement) return warn("Escreva sua versão.");
  update((s) => {
    const d = s.disputes.find((x) => x.id === id);
    Object.assign(d, { providerStatement: statement, providerEvidence: captionsOf("resposta") });
    d.history.push(["Prestador respondeu", `${today()} · ${d.providerEvidence.length} prova(s)`, "ok"]);
    notifyClient(s, contractById(s, d.contractId), "O prestador respondeu", id, "chat-circle-text", `#/disputa/${id}`);
  });
  ok("Resposta enviada. O mediador vai analisar.");
};

/**
 * Resolution matrix (section 06), in code. A side "has evidence" when it listed at least one proof.
 * Returns the provider's share and the rule shown to both parties.
 */
export function ruleFor(d) {
  const clientOk = d.clientEvidence.length > 0;
  const providerOk = d.providerEvidence.length > 0;
  if (!clientOk) return { share: 1, rule: "Reclamação sem prova: o valor segue para o prestador" };
  if (!d.providerStatement) return { share: 0, rule: "Prestador sem nenhuma evidência: reembolso do valor do marco à contratante" };
  if (providerOk) return { share: 0.85, rule: "Os dois lados têm provas: divisão proporcional, com perícia se preciso" };
  return { share: 0.65, rule: "Só a contratante tem provas: 65% ao prestador" };
}
export function proposalFor(d) {
  const { share, rule } = ruleFor(d);
  const providerCents = Math.round(d.amountCents * share);
  return { share, rule, providerCents, clientCents: d.amountCents - providerCents };
}
function setDisputeStatus(id, status, label, detail) {
  update((s) => {
    const d = s.disputes.find((x) => x.id === id);
    const c = contractById(s, d.contractId);
    d.status = status;
    d.history.push([label, detail, "ok"]);
    if (status === "proposal") d.proposal = proposalFor(d);
    audit(s, "Luiza Prado · mediadora", label, `${id}${d.proposal && status === "proposal" ? ` · ${d.proposal.rule}` : ""}`, id);
    notifyClient(s, c, label, id, "scales", `#/disputa/${id}`);
    notifyProvider(s, c, label, id, "scales", `#/disputa/${id}`);
  });
}
A.bankPropose = ({ id }) => {
  setDisputeStatus(id, "proposal", "Proposta de acordo enviada", `${today()} · mediação BTG`);
  ok("Proposta enviada às partes.");
};
A.bankInspection = ({ id }) => {
  setDisputeStatus(id, "inspection", "Perícia técnica agendada", `${addDays(5)} · ${INSPECTION_FEE} pagos por quem perder`);
  ok("Perícia agendada.");
};
A.bankArbitration = ({ id }) => {
  setDisputeStatus(id, "arbitration", "Encaminhada à arbitragem", `${today()} · câmara indicada pelo BTG, custeada pelo seguro de arbitragem`);
  ok("Caso encaminhado à arbitragem.");
};
A.clientInspection = ({ id }) => A.bankInspection({ id });
A.askArbitration = ({ id }) => update((s) => { s.ui.sheet = { name: "arbitragem", id, route: location.hash }; });
A.confirmArbitration = ({ id }) => { A.closeSheet(); A.bankArbitration({ id }); };
A.acceptProposal = ({ id }) => {
  update((s) => {
    const d = s.disputes.find((x) => x.id === id);
    const c = contractById(s, d.contractId);
    const st = c.stages[d.stage];
    Object.assign(st, { status: "split", split: { providerCents: d.proposal.providerCents, clientCents: d.proposal.clientCents }, releasedAt: today(), releaseMode: "Acordo na mediação" });
    c.refundedCents += d.proposal.clientCents;
    addLedger(s, c.id, `Acordo ${id}: liberação ao prestador`, -d.proposal.providerCents);
    addLedger(s, c.id, `Acordo ${id}: devolução à contratante`, -d.proposal.clientCents);
    d.status = "closed";
    d.closedAt = today();
    audit(s, "Partes em acordo", "Acordo na mediação", `${id} · ${money(d.proposal.providerCents)} ao prestador, ${money(d.proposal.clientCents)} devolvidos`, id);
    d.history.push(["Acordo aceito", `${today()} · valores liberados`, "ok"]);
    const next = c.stages[d.stage + 1];
    if (next?.status === "pending") next.status = "inProgress";
    notifyProvider(s, c, "Acordo aceito", `${money(d.proposal.providerCents)} liberados`, "check-circle", `#/disputa/${id}`);
  });
  ok("Acordo aceito. Os valores foram liberados.");
};
