// Seguro Aval (optional, client) and claims. Eligibility is a rule in code; a bank analyst approves every payout.
import { addLedger, audit, clientParty, contractById, draft, getState, nextId, notify, notifyBank, notifyClient, personOfName, today, update } from "../store.js";
import { money } from "../ui.js";
import { actions as A, go, ok, warn } from "./core.js";

const DEDUCTIBLE = 0.1;
export const COVERAGES = {
  refazer: ["Contratar outro prestador para concluir", "Cobre o custo de refazer a marco contestado"],
  liberado: ["Valor já liberado ao prestador", "Cobre o que saiu do valor guardado numa marco mal executado"],
};

/** A claim needs a paid policy and a closed dispute where the client got at least part of the money back. */
export function claimEligibility(s, c) {
  if (!c?.insurance) return { eligible: false, reason: "Este serviço não tem o Seguro Aval." };
  if (!c.insurance.paid) return { eligible: false, reason: "O prêmio do seguro ainda não foi pago." };
  if (s.claims.some((x) => x.contractId === c.id && x.status !== "denied")) return { eligible: false, reason: "O seguro deste serviço já foi acionado." };
  const dispute = s.disputes.find((d) => d.contractId === c.id && d.status === "closed" && (d.proposal?.clientCents ?? 0) > 0);
  if (!dispute) return { eligible: false, reason: "O seguro pode ser acionado depois de uma disputa decidida a seu favor." };
  const capCents = Math.min(dispute.proposal.providerCents, c.insurance.coverageCents);
  const deductibleCents = Math.round(capCents * DEDUCTIBLE);
  return { eligible: true, dispute, capCents, deductibleCents, payoutCents: capCents - deductibleCents };
}

A.chooseCoverage = ({ coverage }) => update((s) => { s.ui.drafts.sinistro = { ...s.ui.drafts.sinistro, coverage }; });
A.submitClaim = ({ id }) => {
  const s0 = getState();
  const c = contractById(s0, id);
  const check = claimEligibility(s0, c);
  if (!check.eligible) return warn(check.reason);
  const reason = draft("sinistro.reason").trim();
  if (!reason) return warn("Conte o que aconteceu.");
  let claimId = "";
  update((s) => {
    claimId = nextId("SN-", s.claims.map((x) => x.id));
    s.claims.unshift({
      id: claimId, contractId: id, policy: c.insurance.policy, disputeId: check.dispute.id, coverage: draft("sinistro.coverage", "refazer"),
      reason, capCents: check.capCents, deductibleCents: check.deductibleCents, payoutCents: check.payoutCents, status: "analysis", createdAt: today(),
    });
    notifyBank(s, "Sinistro do Seguro Aval", `${claimId} · ${c.title} · ${money(check.payoutCents)}`, "shield-check", "#/banco/seguros");
    s.ui.drafts.sinistro = undefined;
  });
  ok("Sinistro aberto. A seguradora responde em até 5 dias úteis.");
  go(`#/seguro/${id}`);
};
A.bankApproveClaim = ({ id }) => {
  update((s) => {
    const claim = s.claims.find((x) => x.id === id);
    const c = contractById(s, claim.contractId);
    Object.assign(claim, { status: "paid", paidAt: today() });
    audit(s, "Luiza Prado · analista", "Sinistro pago", `${claim.id} · ${money(claim.payoutCents)} · regra de elegibilidade atendida`, c.id);
    addLedger(s, c.id, `Indenização Seguro Aval ${claim.policy} · ${clientParty(c)}`, claim.payoutCents, "Seguradora");
    const owner = personOfName(clientParty(c));
    const acc = owner ? s.accounts[owner.id] : null;
    if (acc) acc.balanceCents += claim.payoutCents;
    notifyClient(s, c, "Indenização paga", `${money(claim.payoutCents)} na sua conta BTG`, "shield-check", `#/seguro/${c.id}`);
  });
  ok(`${id}: indenização paga.`);
};
A.bankDenyClaim = ({ id }) => {
  update((s) => {
    const claim = s.claims.find((x) => x.id === id);
    const c = contractById(s, claim.contractId);
    claim.status = "denied";
    notify(s, clientParty(c), "Sinistro não aprovado", `${claim.id} · fale com a central`, "shield-check", `#/seguro/${c.id}`, "contratante");
  });
  ok(`${id}: sinistro recusado.`);
};
