// Aval Labs: product bets to decide with the Nexo. Calculations are illustrative, with a synthetic reference rate.
import { priceInstallment } from "../domain/credit.js";
import { custodyCents, draft, isClientOf } from "../store.js";
import { appbar, card, chip, circle, kv, money, note, screen } from "../ui.js";

const CDI_YEAR = 0.1115;
const CARD_MONTHLY_RATE = 0.0299;
const CARD_COUNT = 12;
const MAX_MONTHS = 240;
const GOALS = [500_000, 1_000_000, 2_000_000];
const MONTHLY = [50_000, 100_000, 200_000];
const pills = (values, current, key) =>
  `<div class="choice-list wrap">${values.map((v) => `<button type="button" class="pill-option ${current === v ? "on" : ""}" data-action="setLabs" data-key="${key}" data-value="${v}">${money(v)}</button>`).join("")}</div>`;

/** Months until the goal, with the savings earning the reference rate. */
function monthsToGoal(goal, monthly) {
  const r = Math.pow(1 + CDI_YEAR, 1 / 12) - 1;
  let total = 0;
  let months = 0;
  while (total < goal && months < MAX_MONTHS) {
    total = total * (1 + r) + monthly;
    months += 1;
  }
  return months;
}

function labs(s) {
  const custody = s.contracts.filter((c) => isClientOf(c, s) && c.kind !== "collective").reduce((a, c) => a + custodyCents(c), 0);
  const yieldMonth = Math.round(custody * (Math.pow(1 + CDI_YEAR, 1 / 12) - 1));
  const goal = Number(draft("labs.goal", GOALS[1]));
  const monthly = Number(draft("labs.monthly", MONTHLY[1]));
  const cardInst = priceInstallment(800_000, CARD_MONTHLY_RATE, CARD_COUNT);
  const bet = (ic, title, body) => card(`<div class="row-between"><div class="row-gap">${circle(ic, "info")}<strong>${title}</strong></div>${chip("A decidir com o Nexo", "warn")}</div>${body}`);
  return screen({
    header: appbar({ title: "Aval Labs", tone: "ink" }),
    body: `${note("Propostas de produto para avaliar com o Nexo. Os números usam um CDI de referência sintético de 11,15% a.a.", "info", "sparkle")}
      ${bet("chart-line-up", "Custódia que rende", `<p class="small">O dinheiro parado em custódia rende 100% do CDI para quem contratou, até a etapa ser liberada.</p>${kv("Seu dinheiro em custódia", money(custody))}${kv("Renderia por mês", money(yieldMonth), "pos-text")}<p class="small muted">Conflito a decidir: hoje o float da custódia é receita do Aval (seção 12).</p>`)}
      ${bet("piggy-bank", "Cofrinho da obra", `<p class="small">Junte todo mês para um serviço futuro. Quando completar, vira custódia com um toque, sem juros de crédito.</p><small class="muted">Meta</small>${pills(GOALS, goal, "goal")}<small class="muted">Guardar por mês</small>${pills(MONTHLY, monthly, "monthly")}${kv("Você chega lá em", `${monthsToGoal(goal, monthly)} meses`, "pos-text")}`)}
      ${bet("credit-card", "Cartão Nexo em até 12x", `<p class="small">Pagar o serviço no cartão Nexo, ao lado do crédito Aval e do Pix. A custódia continua igual.</p>${kv("Serviço de R$ 8.000 em 12x", money(cardInst))}${kv("Taxa do cartão", "2,99% a.m.")}<p class="small muted">Gera pontos no cartão e receita de intercâmbio; o crédito Aval costuma sair mais barato.</p>`)}`,
  });
}

export const labsRoutes = { labs };
