// New service: description, stages, insurance and invite; then the provider's answer and the down payment.
import { judge } from "../api.js";
import {
  addDays, contractById, draft, getState, makeStage, myName, nextId, notify, notifyClient, notifyProvider, parseReais, setDraft, today, update,
} from "../store.js";
import { money, reais } from "../ui.js";
import { actions as A, go, ok, warn } from "./core.js";

export const INSURANCE_RATE = 0.025;
export const ARBITRATION_RATE = 0.004;
export const insurancePremium = (totalCents) => Math.round(totalCents * INSURANCE_RATE);
export const arbitrationFee = (totalCents) => Math.round(totalCents * ARBITRATION_RATE);

A.chooseProvider = ({ name }) => setDraft("novo.provider", name, false);
A.suggestStages = async () => {
  const title = draft("novo.title").trim();
  const description = draft("novo.description").trim();
  const totalCents = parseReais(draft("novo.total"));
  if (!title || !description) return warn("Informe o título e a descrição do serviço.");
  if (!totalCents) return warn("Informe um valor total válido.");
  if (draft("novo.provider") === myName(getState())) return warn("Escolha outro prestador: você não pode contratar a si mesmo.");
  const result = await judge("suggestedStages", { description, totalCents }, "novo");
  const suggested = result?.value.stages.length ? result.value.stages : [{ name: "Etapa única", valueCents: totalCents }];
  update((s) => {
    s.ui.drafts.novo = {
      ...s.ui.drafts.novo, title, description, total: draft("novo.total"), provider: draft("novo.provider"),
      stages: suggested.map((st, i) => ({ name: st.name, value: reais(st.valueCents), due: addDays(15 * (i + 1)) })),
      suggestion: result ? { routing: result.routing, confidence: result.confidence } : null,
    };
  });
  go("#/novo/2");
};
A.manualStages = () => {
  const total = parseReais(draft("novo.total"));
  if (!total) return warn("Informe um valor total válido.");
  update((s) => {
    s.ui.drafts.novo = {
      ...s.ui.drafts.novo, title: draft("novo.title"), description: draft("novo.description"), total: draft("novo.total"),
      provider: draft("novo.provider"), stages: [{ name: "Etapa 1", value: reais(total), due: addDays(15) }], suggestion: null,
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
A.sendInvite = () => {
  if (!draft("novo.terms")) return warn("Aceite as condições e a cláusula de arbitragem.");
  const { stages, total } = novoTotals();
  const insured = Boolean(draft("novo.insurance"));
  const client = myName(getState());
  let id = "";
  update((s) => {
    id = nextId("CV-", s.invites.map((i) => i.id));
    const provider = draft("novo.provider");
    s.invites.push({
      id, title: draft("novo.title"), description: draft("novo.description"), client, provider,
      totalCents: total, stages: stages.map((st) => ({ name: st.name.trim(), valueCents: parseReais(st.value), due: st.due })),
      insurance: insured ? { premiumCents: insurancePremium(total) } : null, arbitrationFeeCents: arbitrationFee(total),
      status: "sent", createdAt: today(),
    });
    notify(s, provider, `Convite de ${client}`, `${draft("novo.title")} · ${money(total)}`, "paper-plane-tilt", `#/convite/${id}`, "prestador");
    s.ui.drafts.novo = undefined;
  });
  go(`#/novo/enviado/${id}`);
};

/** Turns an accepted invite, quote or link into a contract waiting for payment. Stages carry their due dates. */
export function contractFromInvite(s, invite, { entradaCents = null, insured = false } = {}) {
  const id = nextId("AV-2026-", s.contracts.map((c) => c.id));
  const premiumCents = invite.insurance?.premiumCents ?? insurancePremium(invite.totalCents);
  const policy = insured ? nextId("SG-2026-", s.contracts.map((c) => c.insurance?.policy).filter(Boolean)) : null;
  const contract = {
    id, title: invite.title, client: invite.client, provider: invite.provider, kind: "individual", description: invite.description,
    totalCents: invite.totalCents, status: "awaitingPayment", signedAt: today(), arbitration: true, paidInCents: 0, refundedCents: 0, payment: null,
    entrada: entradaCents ? { requestedCents: entradaCents, status: "requested" } : null,
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
