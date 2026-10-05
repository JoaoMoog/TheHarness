// Seguro Aval (policy and claim) and the arbitration explainer: the protection layers of every contract.
import { COVERAGES, claimEligibility } from "../actions/index.js";
import { canSee, contractById, draft, isClientOf } from "../store.js";
import { appbar, btn, card, chip, circle, empty, esc, field, icon, kv, money, note, option, screen, timeline } from "../ui.js";

const CLAIM_STATUS = { analysis: ["Em análise", "info"], paid: ["Indenização paga", "pos"], denied: ["Não aprovado", "neg"] };

function claimView(claim) {
  const [label, tone] = CLAIM_STATUS[claim.status];
  const steps = [["Sinistro aberto", claim.createdAt, "ok"], ["Análise da seguradora", claim.status === "analysis" ? "Em até 5 dias úteis" : "Concluída", claim.status === "analysis" ? "now" : "ok"]];
  if (claim.status === "paid") steps.push(["Indenização paga", `${claim.paidAt} · conta Nexo`, "ok"]);
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
    body: `${card(`<div class="row-between"><small class="muted">${esc(c.insurance.policy)} · Nexo Seguros</small>${chip(c.insurance.paid ? "Ativo" : "Prêmio pendente", c.insurance.paid ? "pos" : "warn")}</div><h3>${esc(c.title)}</h3>${kv("Cobertura", money(c.insurance.coverageCents))}${kv("Prêmio pago", money(c.insurance.premiumCents))}${kv("Franquia", "10% do valor coberto")}`)}
      ${card(`<strong>O que cobre</strong><ul class="bullets"><li>Valor já liberado numa etapa mal executada.</li><li>Outro prestador para concluir o serviço.</li><li>Vale depois de uma disputa decidida a favor de quem contratou.</li></ul>`)}
      ${claim ? claimView(claim) : ""}
      ${form}
      ${!claim && !canClaim ? note(check.reason, "info", "info") : ""}`,
    footer: canClaim ? btn(`Acionar seguro · ${money(check.payoutCents)}`, { action: "submitClaim", data: { id }, iconName: "shield-check" }) : btn("Voltar ao serviço", { kind: "secondary", go: `#/servico/${id}` }),
  });
}

function arbitragem() {
  const layer = (n, ic, title, text) => `<div class="layer"><span class="layer-n">${n}</span>${circle(ic, "info", 40)}<div><strong>${title}</strong><small>${text}</small></div></div>`;
  return screen({
    header: appbar({ title: "Como resolvemos disputas", tone: "ink" }),
    body: `<div class="center-block">${circle("gavel", "info", 64)}<h2>Três camadas, prazos curtos</h2><p class="muted">O dinheiro fica bloqueado até a decisão. Ninguém fica só com a palavra do outro.</p></div>
      ${card(`${layer(1, "chat-circle-text", "Mediação Nexo", "Provas em até 72 horas. Proposta pela matriz de regras em até 5 dias úteis.")}${layer(2, "map-pin", "Perícia técnica", "Quando o caso depende de avaliação no local. Paga por quem perder.")}${layer(3, "gavel", "Arbitragem profissional", "Câmara independente, decisão final. Custeada pelo seguro de arbitragem que já está em toda operação.")}`)}
      ${card(`<div class="row-gap">${icon("file-text")}<strong>Cláusula compromissória</strong></div><p class="small">Ao aceitar os termos do Aval, contratante e prestador concordam, antes de qualquer problema, em levar à arbitragem o que a mediação não resolver. Não é uma decisão tomada no calor da disputa.</p>`)}
      ${note("Quem documenta rápido tende a vencer: envie fotos e vídeos na própria entrega.", "info", "camera")}`,
  });
}

export const insuranceRoutes = { "seguro/:id": seguro, arbitragem };
