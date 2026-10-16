// One home for whoever pays and receives, in the BTG Banking style: blue header, Cobrar and Pagar, an offer in context,
// what needs attention today, and the protected payments split into to pay, to receive and done.
import { anticipationCheck, anticipationValues } from "../actions/index.js";
import { roleOf } from "../domain/protected.js";
import { account, availableLimitCents, canSee, custodyCents, isBtgConnected, lateInstallments, myNames } from "../store.js";
import { money, screen } from "../ui.js";
import { bkBanner, bkHeader, bkItem, bkMenuButton, bkSeal, bkSection, bkStrip, todayLabel } from "./btg-kit.js";
import { shown } from "./chrome.js";
import { paymentsSection } from "./protected.js";

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
/** Below this, the pre-approved credit is a leftover of the limit, not an offer worth the home. */
const MIN_CREDIT_BANNER_CENTS = 100_000;
/** Whoever receives, or is on the provider side, sees the tools for receiving. */
export const receives = (s, mine) => s.session.mode === "prestador" || mine.some((c) => roleOf(c, myNames(s)) === "payee");
const btgLine = (s) => ["Saldo em conta", isBtgConnected(s) ? shown(s, account(s).balanceCents) : "Abrir conta", "#/no-app-btg/conta"];

/** The first delivered stage the person can receive today, if any. */
function anticipable(s, mine) {
  for (const c of mine.filter((x) => roleOf(x, myNames(s)) === "payee")) {
    const i = c.stages.findIndex((st, idx) => st.status === "awaitingApproval" && anticipationCheck(s, c, idx).every(([, okItem]) => okItem));
    if (i >= 0) return { c, i, st: c.stages[i] };
  }
  return null;
}

/** One bank offer that fits the moment: anticipation for who receives, the pre-approved credit for who pays. */
function offerBanner(s, ready) {
  if (!isBtgConnected(s)) return bkBanner({ text: "Conecte sua conta BTG para pagar com saldo, cartão e crédito.", cta: "Abrir o app do BTG", art: "bank", go: "#/btg" });
  if (ready) {
    return bkBanner({ text: `Receba hoje ${shown(s, anticipationValues(ready.st).netCents)} de ${ready.c.title}, sem esperar a aprovação.`, cta: "Receber agora", art: "lightning", go: `#/antecipar/${ready.c.id}/${ready.i}` });
  }
  const limit = availableLimitCents(s);
  if (limit < MIN_CREDIT_BANNER_CENTS || lateInstallments(s).length) return "";
  return bkBanner({ text: `Vai pagar um serviço? Você tem ${shown(s, limit)} de empréstimo na hora.`, cta: "Pagar", art: "hand-coins", action: "startPayment" });
}

/** What needs the person today besides the payments: a late installment, a dispute, a down payment, a review. */
function attention(s, mine) {
  const names = myNames(s);
  const late = lateInstallments(s).slice(0, 1).map((p) => bkItem({ icon: "warning-circle", label: "Parcela atrasada", title: `Parcela ${p.n} de ${p.of}`, value: money(p.valueCents + (p.lateFeeCents ?? 0)), tone: "neg", action: "payInstallment", data: { id: p.id } }));
  const disputes = s.disputes.filter((d) => d.status !== "closed" && mine.some((c) => c.id === d.contractId)).flatMap((d) => {
    const c = mine.find((x) => x.id === d.contractId);
    if (d.status === "proposal" && names.has(c.client)) return [bkItem({ icon: "scales", label: "Proposta de acordo", title: `Disputa ${d.id}`, tone: "warn", go: `#/disputa/${d.id}/resultado` })];
    if (!d.providerStatement && names.has(c.provider)) return [bkItem({ icon: "scales", label: `Disputa ${d.id}`, title: "Responder com sua versão e provas", tone: "neg", go: `#/disputa/${d.id}` })];
    return [];
  });
  // The next move on each payment: approving a delivery for who pays, sending one for who receives.
  const moves = mine.filter((c) => c.kind !== "collective").flatMap((c) => {
    const waiting = c.stages.findIndex((st) => st.status === "awaitingApproval");
    if (waiting >= 0 && names.has(c.client)) return [bkItem({ icon: "check-circle", label: "Aprovar entrega", title: `${c.provider} · marco ${waiting + 1}`, value: money(c.stages[waiting].valueCents), tone: "warn", go: `#/servico/${c.id}` })];
    const doing = c.stages.findIndex((st) => st.status === "inProgress");
    if (doing >= 0 && names.has(c.provider)) return [bkItem({ icon: "camera", label: "Enviar entrega", title: `${c.title} · marco ${doing + 1}`, value: money(c.stages[doing].valueCents), action: "startDelivery", data: { id: c.id, stage: doing } })];
    return [];
  });
  const others = mine.flatMap((c) => [
    ...(c.entrada?.status === "requested" && names.has(c.client) ? [bkItem({ icon: "hand-coins", label: "Decidir entrada", title: `${c.provider} pediu entrada`, value: money(c.entrada.requestedCents), tone: "warn", go: `#/entrada-decidir/${c.id}` })] : []),
    ...(c.status === "completed" && !c.completionReason && !c.reviewed && names.has(c.client) ? [bkItem({ icon: "star", label: "Serviço concluído", title: `Avaliar ${c.provider}`, go: `#/avaliar/${c.id}` })] : []),
  ]);
  return [...late, ...disputes, ...moves, ...others];
}

/** Shortcuts under the header; the ones for receiving only for whoever receives. */
const shortcuts = (receiving, ready) => [
  ["Cobrar", "hand-coins", { action: "startCharge" }], ["Pagar", "wallet", { action: "startPayment" }], ["Assistente", "sparkle", "#/assistente"],
  ...(receiving ? [["Antecipar", "lightning", ready ? `#/antecipar/${ready.c.id}/${ready.i}` : "#/agenda"], ["Selo", "seal-check", "#/selo"]] : []),
  ["Disputas", "scales", "#/disputas"], ["Benefícios", "star", "#/beneficios"],
];

export function home(s) {
  const mine = s.contracts.filter((c) => canSee(c, s));
  const open = mine.filter((c) => c.status !== "completed");
  const guarded = open.reduce((acc, c) => acc + (c.kind === "collective" ? c.paidInCents : custodyCents(c)), 0);
  const payee = open.filter((c) => roleOf(c, myNames(s)) === "payee").length;
  const ready = anticipable(s, mine);
  const todo = attention(s, mine);
  const limit = isBtgConnected(s) ? (lateInstallments(s).length ? "Pausado" : shown(s, availableLimitCents(s))) : "Só à vista";
  return screen({
    cls: "bk", dark: true, overlay: bkMenuButton(),
    body: `${bkHeader(s, {
      title: "BTG Aval", label: "Valor guardado", cents: guarded,
      sub: `${plural(open.length - payee, "a pagar", "a pagar")} · ${plural(payee, "a receber", "a receber")}`,
      lines: mine.length ? [btgLine(s)] : [],
      cta: { label: "Extrato", go: "#/extrato" },
    })}
    ${bkStrip(shortcuts(receives(s, mine), ready))}
    ${todo.length ? bkSection("Para hoje", todo, { aside: `<span class="bk-day">${todayLabel()}</span>` }) : ""}
    ${bkBanner({ text: "Vai contratar um serviço? Pague com Aval: o dinheiro fica guardado no BTG até você aprovar cada entrega.", cta: "Pagar com Aval", art: "wallet", action: "startPayment" })}
    ${paymentsSection(s)}
    ${bkSeal()}`,
  });
}
