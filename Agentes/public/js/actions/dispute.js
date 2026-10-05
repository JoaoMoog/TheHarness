// Disputes: Jev suggests the reason and reads evidence; people decide.
import { judge } from "../api.js";
import { addDays, addLedger, audit, contractById, draft, getState, nextId, notifyBank, notifyClient, notifyProvider, setDraft, today, update } from "../store.js";
import { money } from "../ui.js";
import { actions as A, go, ok, resolveOnServer, warn } from "./core.js";

const MEDIATION_DAYS = 14;
const EVIDENCE_DAYS = 3;
const SLA_DAYS = 7;
const INSPECTION_FEE = "R$ 380,00";

A.startDispute = ({ id, stage }) => {
  update((s) => { s.ui.drafts.disputa = { key: `${id}:${stage}`, reason: null, analysis: null }; s.ui.sheet = null; });
  go(`#/disputa/nova/${id}/${stage}`);
};
A.analyzeDispute = async ({ id, stage }) => {
  const c = contractById(getState(), id);
  const report = draft("disputa.report").trim();
  if (!report) return warn("Conte o que aconteceu.");
  const [result, schedule] = await Promise.all([
    judge("disputeReason", { stageName: c.stages[Number(stage)].name, report }, "disputa"),
    judge("scheduleOnly", { report }, "disputa-prazo"),
  ]);
  update((s) => {
    s.ui.drafts.disputa = {
      ...s.ui.drafts.disputa, analysis: result ?? { failed: true }, schedule,
      reason: result?.value.reason ?? s.ui.drafts.disputa?.reason ?? "deliveryQuality",
    };
  });
};
A.setDisputeReason = ({ reason }) => setDraft("disputa.reason", reason, false);
const splitList = (text) => text.split(/[,;\n]/).map((t) => t.trim()).filter(Boolean);
A.submitDispute = async ({ id, stage }) => {
  const idx = Number(stage);
  const report = draft("disputa.report").trim();
  const reason = draft("disputa.reason");
  if (!report || !reason) return warn("Analise o relato e confirme o motivo antes de abrir.");
  let disputeId = "";
  update((s) => {
    const c = contractById(s, id);
    disputeId = nextId("DP-", [...s.disputes.map((d) => d.id), "DP-412"]);
    s.disputes.unshift({
      id: disputeId, contractId: id, stage: idx, report, reason, unresponsive: Boolean(s.ui.drafts.disputa?.analysis?.value?.providerUnresponsive),
      amountCents: c.stages[idx].valueCents, status: "mediation", openedAt: today(), deadline: addDays(MEDIATION_DAYS),
      evidenceDeadline: addDays(EVIDENCE_DAYS), slaDeadline: addDays(SLA_DAYS), chatCount: s.messages[id]?.length ?? 0,
      clientEvidence: splitList(draft("disputa.evidence")), providerStatement: null, providerEvidence: [], judgments: {}, proposal: null,
      history: [["Disputa aberta", `${today()} · ${money(c.stages[idx].valueCents)} bloqueados`, "ok"]],
    });
    c.stages[idx].status = "disputed";
    notifyProvider(s, c, "Disputa aberta", `${c.title} · etapa ${idx + 1}`, "scales", `#/disputa/${disputeId}`);
    notifyBank(s, "Nova disputa", `${disputeId} · ${c.title}`, "scales", `#/banco/fila/${disputeId}`);
    s.ui.drafts.disputa = undefined;
  });
  go(`#/disputa/${disputeId}`);
  await analyzeDisputeCase(disputeId);
};

export const disputeQueueIds = (d) => Object.values(d?.judgments ?? {}).map((j) => j?.queueId).filter(Boolean);
async function analyzeDisputeCase(disputeId) {
  const d = getState().disputes.find((x) => x.id === disputeId);
  const previous = disputeQueueIds(d);
  if (previous.length) await Promise.all(previous.map((q) => resolveOnServer(q, "Substituída por nova leitura")));
  const parties = [{ party: "client", statement: d.report, evidence: d.clientEvidence }];
  if (d.providerStatement) parties.push({ party: "provider", statement: d.providerStatement, evidence: d.providerEvidence });
  const [evidence, inspection, priority] = await Promise.all([
    judge("evidenceSufficiency", { reason: d.reason, parties }, `ev-${disputeId}`),
    judge("expertInspection", { summary: [d.report, d.providerStatement].filter(Boolean).join(" Resposta do prestador: ") }, `insp-${disputeId}`),
    judge("queuePriority", { summary: d.report, hoursToDeadline: 48 }, `prio-${disputeId}`),
  ]);
  update((s) => {
    Object.assign(s.disputes.find((y) => y.id === disputeId), { judgments: { evidence, inspection, priority }, readingsClosed: false });
  });
}
A.respondDispute = async ({ id }) => {
  const statement = draft("resposta.statement").trim();
  if (!statement) return warn("Escreva sua versão.");
  update((s) => {
    const d = s.disputes.find((x) => x.id === id);
    Object.assign(d, { providerStatement: statement, providerEvidence: splitList(draft("resposta.evidence")) });
    d.history.push(["Prestador respondeu", `${today()} · ${d.providerEvidence.length} prova(s)`, "ok"]);
    notifyClient(s, contractById(s, d.contractId), "O prestador respondeu", id, "chat-circle-text", `#/disputa/${id}`);
  });
  ok("Resposta enviada. O mediador vai analisar.");
  await analyzeDisputeCase(id);
};

/**
 * Resolution matrix (section 06), in code. Jev's evidence reading only tells which row applies.
 * Returns the provider's share and the rule shown to both parties.
 */
export function ruleFor(d) {
  const ev = d.judgments.evidence?.value ?? [];
  const clientOk = ev.find((p) => p.party === "client")?.sufficient ?? false;
  const providerOk = ev.find((p) => p.party === "provider")?.sufficient ?? false;
  if (!clientOk) return { share: 1, rule: "Reclamação sem prova suficiente: o valor segue para o prestador" };
  if (!d.providerStatement) return { share: 0, rule: "Prestador sem nenhuma evidência: reembolso do valor da etapa à contratante" };
  if (providerOk) return { share: 0.85, rule: "Provas dos dois lados se contradizem: divisão proporcional, com perícia se preciso" };
  return { share: 0.65, rule: "Provas da contratante mais fortes que as do prestador: 65% ao prestador" };
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
/** Closes the low-confidence readings of a dispute once; a new reading reopens the need. */
export async function closeDisputeReadings(id, decision) {
  const d = getState().disputes.find((x) => x.id === id);
  if (!d.readingsClosed) {
    update((s) => { s.disputes.find((x) => x.id === id).readingsClosed = true; }, { silent: true });
    await Promise.all(disputeQueueIds(d).map((q) => resolveOnServer(q, decision)));
  }
  await A.loadServerQueue();
}
A.bankPropose = async ({ id }) => {
  setDisputeStatus(id, "proposal", "Proposta de acordo enviada", `${today()} · mediação Nexo`);
  ok("Proposta enviada às partes.");
  await closeDisputeReadings(id, "Proposta de acordo enviada");
};
A.bankInspection = async ({ id }) => {
  setDisputeStatus(id, "inspection", "Perícia técnica agendada", `${addDays(5)} · ${INSPECTION_FEE} pagos por quem perder`);
  ok("Perícia agendada.");
  await closeDisputeReadings(id, "Perícia agendada");
};
A.bankArbitration = async ({ id }) => {
  setDisputeStatus(id, "arbitration", "Encaminhada à arbitragem", `${today()} · câmara indicada pelo Nexo, custeada pelo seguro de arbitragem`);
  ok("Caso encaminhado à arbitragem.");
  await closeDisputeReadings(id, "Encaminhada à arbitragem");
};
A.clientInspection = ({ id }) => A.bankInspection({ id });
A.askArbitration = ({ id }) => update((s) => { s.ui.sheet = { name: "arbitragem", id, route: location.hash }; });
A.confirmArbitration = ({ id }) => { A.closeSheet(); A.bankArbitration({ id }); };
A.acceptProposal = async ({ id }) => {
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
  await closeDisputeReadings(id, "Acordo aceito pelas partes");
};
