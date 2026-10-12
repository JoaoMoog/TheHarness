// Benefits of paying with the Aval: points for each finished payment (a discount on the next one, or BTG points),
// and benefits tied to the service paid. Pure functions; partner names in the prototype are fictitious.
import { classify } from "./assistant.js";

export const REAIS_PER_POINT = 10;
export const POINT_VALUE_CENTS = 10;
export const REFERRAL_POINTS = 500;
const MAX_DISCOUNT_SHARE = 0.1;
const CASHBACK_SHARE = 0.05;
const CASHBACK_CAP_CENTS = 30_000;
const ASSIST_FROM_CENTS = 500_000;
const RENOVATIONS = new Set(["cozinha", "banheiro", "pintura", "eletrica", "telhado"]);
export const PARTNER = "Casa & Obra";

/** 1 point for each R$ 10 released to whoever did the service. */
export const pointsFor = (releasedCents) => Math.floor(releasedCents / 100 / REAIS_PER_POINT);

/** Points used as a discount on a payment, never more than 10% of it. */
export function redeemFor(points, payCents) {
  const capCents = Math.floor(payCents * MAX_DISCOUNT_SHARE);
  const usable = Math.min(points, Math.floor(capCents / POINT_VALUE_CENTS));
  return { points: usable, cents: usable * POINT_VALUE_CENTS };
}

/** Benefits of a payment: ready once the service is finished, waiting before that. */
export function benefitsFor({ description, totalCents, status }) {
  const ready = status === "completed";
  const kind = classify(description)?.key;
  return [
    RENOVATIONS.has(kind) && {
      key: "cashback", ready, valueCents: Math.min(Math.round(totalCents * CASHBACK_SHARE), CASHBACK_CAP_CENTS),
      title: "Cashback em material de construção", text: `5% de volta na ${PARTNER}, até R$ 300.`,
    },
    { key: "warranty", ready, title: "Garantia do serviço por 90 dias", text: "Se o defeito voltar, a disputa reabre e o seguro cobre o retrabalho." },
    totalCents >= ASSIST_FROM_CENTS && { key: "assist", ready, title: "Assistência residencial 24h", text: "30 dias de chaveiro, eletricista e encanador." },
  ].filter(Boolean);
}
