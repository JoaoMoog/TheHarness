// Seguro Aval (policy and claim) and the arbitration explainer: the protection layers of every contract.
import { COVERAGES, claimEligibility } from "../actions/index.js";
import { canSee, contractById, draft, isClientOf } from "../store.js";
import { appbar, btn, card, chip, circle, empty, esc, field, icon, kv, money, note, option, screen, timeline } from "../ui.js";

const CLAIM_STATUS = { analysis: ["Em análise", "info"], paid: ["Indenização paga", "pos"], denied: ["Não aprovado", "neg"] };

function claimView(claim) {
  const [label, tone] = CLAIM_STATUS[claim.status];
  const steps = [["Sinistro aberto", claim.createdAt, "ok"], ["Análise da seguradora", claim.status === "analysis" ? "Em até 5 dias úteis" : "Concluída", claim.status === "analysis" ? "now" : "ok"]];
  if (claim.status === "paid") steps.push(["Indenização paga", `${claim.paidAt} · conta BTG`, "ok"]);
  return card(`<div class="row-between"><strong>Sinistro ${esc(claim.id)}</strong>${chip(label, tone)}</div>${kv("Cobertura", COVERAGES[claim.coverage][0])}${kv("Valor coberto", money(claim.capCents))}${kv("Franquia (10%)", `− ${money(claim.deductibleCents)}`)}${kv("Indenização", money(claim.payoutCents), "pos-text")}${timeline(steps)}`);
}

function seguro(s, { id }) {
  const c = contractById(s, id);
  if (!canSee(c, s) || !c.insurance) {
    return screen({ header: appbar({ title: "Seguro Aval", tone: "ink" }), body: `${empty("Este serviço não tem o Seguro Aval.")}${note("O seguro é contratado junto com o serviço, no último passo do Novo serviço.", "info", "shield-check")}` });
  }
  const claim = s.claims.find((x) => x.contractId === id);
  const check = claimEligibility(s, c);
  const canClaim = isClientOf(c, s) && check.eligible;
  const coverage = draft("sinistro.coverage", "refazer");
  const form = canClaim
    ? `<h3>Acionar o seguro</h3>${Object.entries(COVERAGES).map(([k, [title, sub]]) => option({ title, sub, selected: coverage === k, action: "chooseCoverage", data: { coverage: k } })).join("")}
      ${card(`${field("O que aconteceu?", { bind: "sinistro.reason", value: draft("sinistro.reason"), multiline: true })}${kv("Valor coberto", money(check.capCents))}${kv("Franquia (10%)", `− ${money(check.deductibleCents)}`)}${kv("Você recebe", money(check.payoutCents), "pos-text")}<small class="muted">Base: disputa ${esc(check.dispute.id)}, decidida a seu favor. As provas da disputa seguem junto.</small>`)}`
    : "";
  return screen({
    header: appbar({ title: "Seguro Aval da obra", tone: "ink" }),
    body: `${card(`<div class="row-between"><small class="muted">${esc(c.insurance.policy)} · BTG Seguros</small>${chip(c.insurance.paid ? "Ativo" : "Prêmio pendente", c.insurance.paid ? "pos" : "warn")}</div><h3>${esc(c.title)}</h3>${kv("Cobertura", money(c.insurance.coverageCents))}${kv("Prêmio pago", money(c.insurance.premiumCents))}${kv("Franquia", "10% do valor coberto")}`)}
      ${card(`<strong>O que cobre</strong><ul class="bullets"><li>Valor já liberado numa marco mal executado.</li><li>Outro prestador para concluir o serviço.</li><li>Vale depois de uma disputa decidida a favor de quem contratou.</li></ul>`)}
      ${claim ? claimView(claim) : ""}
      ${form}
      ${!claim && !canClaim ? note(check.reason, "info", "info") : ""}`,
    footer: canClaim ? btn(`Acionar seguro · ${money(check.payoutCents)}`, { action: "submitClaim", data: { id }, iconName: "shield-check" }) : btn("Voltar ao serviço", { kind: "secondary", go: `#/servico/${id}` }),
  });
}

/** The three levels of a dispute, each with its deadline; the money of the milestone waits, guarded, for the decision. */
const DISPUTE_LEVELS = [
  ["chat-circle-text", "Mediação BTG", "Até 5 dias úteis", "As duas partes mandam provas em até 72 horas. O BTG propõe um acordo pela matriz de regras."],
  ["map-pin", "Perícia técnica", "Quando precisa", "Um perito avalia no local quando o caso depende disso. Quem perder paga a perícia."],
  ["gavel", "Arbitragem profissional", "Decisão final", "Uma câmara independente decide. Custeada pelo seguro de arbitragem que já está em toda operação."],
];

function arbitragem() {
  const level = ([ic, title, when, text], i) => `<li><span class="dp-n">${i + 1}</span><div><div class="dp-head"><span class="cs-ic">${icon(ic)}</span><strong>${title}</strong><em>${when}</em></div><p>${text}</p></div></li>`;
  return screen({
    cls: "cs", header: appbar({ title: "Disputas" }),
    body: `<section class="cs-hero"><span class="cs-done dp-mark">${icon("scales")}</span><h2>Como resolvemos disputas</h2><p>Três níveis, prazos curtos. Ninguém fica só com a palavra do outro.</p></section>
      <p class="dp-held">${icon("lock-simple")}O valor do marco fica guardado no BTG até a decisão.</p>
      <ol class="dp-levels">${DISPUTE_LEVELS.map(level).join("")}</ol>
      <h3 class="bk-settings-title">Cláusula compromissória</h3>
      <section class="cs-terms"><div class="cs-terms-head"><span class="cs-ic">${icon("file-text")}</span><span><small>Ao aceitar os termos do Aval, contratante e prestador combinam, antes de qualquer problema, levar à arbitragem o que a mediação não resolver. Não é uma decisão tomada no calor da disputa.</small></span></div></section>
      <p class="cs-safe">${icon("camera")}Quem documenta rápido tende a vencer: envie fotos e vídeos na própria entrega.</p>`,
  });
}

export const insuranceRoutes = { "seguro/:id": seguro, arbitragem };
