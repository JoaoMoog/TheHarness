// Protected payment of what the two sides already agreed. Pure functions: the bank's rules, never the AI.
import { cardPlan } from "./card.js";
import { daysBetween, parseDdMm, shiftDate } from "./dates.js";

/** Days the payer has to approve a delivery; without an answer the money is released by itself. */
export const AUTO_RELEASE_DAYS = 7;
export const INSURANCE_RATE = 0.025;
export const RELEASES = Object.freeze(["single", "stages"]);
export const SINGLE_STAGE = "Serviço completo";

export const TEMPLATES = {
  banheiro: ["Reforma de banheiro", [["Demolição e preparo", 0.3], ["Instalações", 0.4], ["Acabamento", 0.3]]],
  pintura: ["Pintura", [["Preparo e massa", 0.5], ["Pintura e acabamento", 0.5]]],
  interiores: ["Projeto de interiores", [["Medição e briefing", 0.25], ["Projeto 3D e memorial", 0.5], ["Acompanhamento da obra", 0.25]]],
  unica: ["Marco único", [[SINGLE_STAGE, 1]]],
};

export const insurancePremium = (totalCents) => Math.round(totalCents * INSURANCE_RATE);

/** Four digits tied to a payment link: shown in the message and in the BTG app, so a fake link is easy to spot. */
export function securityCode(token) {
  let h = 7;
  for (const ch of String(token)) h = (h * 31 + ch.charCodeAt(0)) % 9_973;
  return String(1_000 + (h % 9_000));
}

/** Whole percentage of the total for each milestone, adding up to 100 (largest remainders take the rounding). */
export function stageShares(stages) {
  const total = stages.reduce((a, st) => a + st.valueCents, 0);
  if (total <= 0) return stages.map(() => 0);
  const raw = stages.map((st) => (st.valueCents * 100) / total);
  const shares = raw.map(Math.floor);
  const order = raw.map((r, i) => [r - Math.floor(r), i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  const missing = 100 - shares.reduce((a, b) => a + b, 0);
  return shares.map((v, i) => v + (order.findIndex(([, j]) => j === i) < missing ? 1 : 0));
}

/** Splits a total by a template in whole reais; the last stage takes the rounding. */
export function splitByTemplate(totalCents, key) {
  if (!TEMPLATES[key]) throw new RangeError(`unknown stage template: ${key}`);
  const parts = TEMPLATES[key][1];
  let used = 0;
  return parts.map(([name, share], i) => {
    const valueCents = i === parts.length - 1 ? totalCents - used : Math.round((totalCents * share) / 100) * 100;
    used += valueCents;
    return { name, valueCents };
  });
}

/** The stages of a new agreement: one with the whole value, or the template's stages. */
export const stagesFor = (totalCents, release, templateKey) =>
  (release === "single" ? [{ name: SINGLE_STAGE, valueCents: totalCents }] : splitByTemplate(totalCents, templateKey));

const DATE_PATTERN = /^\d{2}\/\d{2}(\/\d{2,4})?$/;
const isPositiveCents = (v) => Number.isInteger(v) && v > 0;

function stageErrors(stages, totalCents) {
  if (!Array.isArray(stages) || stages.length < 2) return ["Divida em pelo menos dois marcos."];
  if (stages.some((st) => !String(st.name ?? "").trim() || !isPositiveCents(st.valueCents))) return ["Cada marco precisa de nome e valor."];
  if (isPositiveCents(totalCents) && stages.reduce((sum, st) => sum + st.valueCents, 0) !== totalCents) return ["Os marcos devem somar o valor combinado."];
  return [];
}

/** Everything wrong with an agreement, in the order of the form; empty when it can be sent. */
export function validateAgreement({ description, totalCents, dueDate, address, release, stages }, today) {
  const errors = [];
  if (!String(description ?? "").trim()) errors.push("Descreva o que foi combinado.");
  if (!isPositiveCents(totalCents)) errors.push("Informe o valor combinado.");
  if (!DATE_PATTERN.test(String(dueDate ?? ""))) errors.push("Informe o prazo de entrega.");
  else if (today && parseDdMm(dueDate).getTime() < today.getTime()) errors.push("O prazo não pode ser antes de hoje.");
  if (!String(address ?? "").trim()) errors.push("Informe o endereço do serviço.");
  if (!RELEASES.includes(release)) errors.push("Escolha valor único ou marcos.");
  if (release === "stages") errors.push(...stageErrors(stages, totalCents));
  return errors;
}

/** How a person takes part in a payment: receives it, pays it, or pays a share of it. */
export function roleOf(contract, names) {
  const mine = new Set(names);
  if (mine.has(contract.provider)) return "payee";
  if (mine.has(contract.client)) return "payer";
  if ((contract.participants ?? []).some((p) => mine.has(p.name))) return "splitPayer";
  return null;
}

export const autoReleaseDate = (deliveredAt) => shiftDate(deliveredAt, AUTO_RELEASE_DAYS);

const PAID = new Set(["active", "completed"]);
const plural = (n) => (n === 1 ? "1 dia" : `${n} dias`);

function stageStep(st, i, single, today) {
  const label = single ? "Entrega do serviço" : `Marco ${i + 1}: ${st.name}`;
  const step = (state, detail) => ({ key: `stage-${i}`, label, state, detail });
  if (st.status === "released") return step("done", /tácita|sozinho/i.test(st.releaseMode ?? "") ? `Liberado sozinho em ${st.releasedAt}` : `Liberado em ${st.releasedAt}`);
  if (st.status === "split") return step("done", "Resolvido na disputa");
  if (st.status === "disputed") return step("alert", "Em disputa");
  if (st.status === "adjustRequested") return step("current", "Ajuste pedido");
  if (st.status === "inProgress") return step("current", "Em execução");
  if (st.status === "awaitingApproval") {
    const left = Math.max(0, daysBetween(today, parseDdMm(st.delivery?.deadline)));
    return step("current", left ? `Entregue. Liberação automática em ${plural(left)}` : "Entregue. Liberação automática hoje");
  }
  return step("next", "Liberado quando aprovado");
}

/** The payment's timeline: agreed, paid and guarded, each stage, and the end. */
export function timelineOf(contract, today) {
  const paid = PAID.has(contract.status);
  const single = contract.stages.length === 1;
  return [
    { key: "agreed", label: "Combinado", state: "done", detail: `Aceito em ${contract.signedAt}` },
    {
      key: "paid", label: "Pago e guardado", state: paid ? "done" : "current",
      detail: paid ? "O dinheiro está guardado no banco" : contract.status === "funding" ? "Aguardando as partes do grupo" : "Aguardando o pagamento",
    },
    ...contract.stages.map((st, i) => (paid ? stageStep(st, i, single, today) : { ...stageStep(st, i, single, today), state: "next" })),
    { key: "done", label: "Concluído", state: contract.status === "completed" ? "done" : "next", detail: "Todo o valor liberado" },
  ];
}

/** What the payer pays now: the value, plus the optional insurance, priced by the card plan when paying by card. */
export function checkoutTotal({ totalCents, insured, method, cardCount }) {
  const premiumCents = insured ? insurancePremium(totalCents) : 0;
  const base = totalCents + premiumCents;
  if (method !== "card") return { premiumCents, payCents: base, plan: null };
  const plan = cardPlan(base, cardCount);
  return { premiumCents, payCents: plan.totalCents, plan };
}

/** Releases part of a delivered stage and keeps the rest guarded until the adjustment. */
export function partialRelease(stageCents, releaseCents) {
  if (!Number.isInteger(releaseCents) || releaseCents <= 0 || releaseCents >= stageCents) {
    throw new RangeError("releaseCents must be a whole amount greater than zero and smaller than the stage");
  }
  return { releaseCents, holdCents: stageCents - releaseCents };
}

const REMINDER_DAYS = new Set([2, 1]);
/** The payer is reminded two days and one day before a delivered stage is released by itself. */
export function reminderFor(deadline, today) {
  const daysLeft = daysBetween(today, parseDdMm(deadline));
  return REMINDER_DAYS.has(daysLeft) ? { daysLeft } : null;
}

/** One sentence with what happens now in a payment, for whoever pays or receives. */
export function nextStepLine(contract, role, today) {
  const paying = role !== "payee";
  if (contract.status === "completed") return "Concluído. Tudo liberado.";
  if (contract.status === "awaitingPayment") return paying ? "Agora: pagar para guardar o dinheiro." : `Agora: esperando ${contract.client} pagar.`;
  if (contract.status === "funding") return "Agora: o grupo está pagando as partes.";
  const i = contract.stages.findIndex((st) => !["released", "split"].includes(st.status));
  const st = contract.stages[i];
  if (!st) return "Concluído. Tudo liberado.";
  const single = contract.stages.length === 1;
  const label = single ? "o serviço" : `o marco ${i + 1}`;
  if (st.status === "disputed") return `Agora: disputa em andamento. O valor ${single ? "do serviço" : `do marco ${i + 1}`} está bloqueado.`;
  if (st.status === "awaitingApproval") {
    if (!paying) return `Agora: ${contract.client} confere ${label}. Libera até ${st.delivery?.deadline}.`;
    const left = Math.max(0, daysBetween(today, parseDdMm(st.delivery?.deadline)));
    return `Agora: aprovar ${label}. Libera sozinho ${left ? `em ${plural(left)}` : "hoje"}.`;
  }
  if (st.status === "adjustRequested") return paying ? `Agora: ${contract.provider} ajusta ${label}.` : `Agora: ajustar e reenviar ${label}.`;
  return paying ? `Agora: ${contract.provider} faz ${label}. Prazo ${st.due}.` : `Agora: fazer e entregar ${label}. Prazo ${st.due}.`;
}
