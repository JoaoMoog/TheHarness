// Screens around a payment: offers in full screen with the credit note, the payment notices prompt, benefits and
// referral, the provider's seal, the piggy bank for one payment and a clean proof to share.
import { CHECKOUT_INSTALLMENTS, payableCents, reserveYield } from "../actions/index.js";
import { cardPlan } from "../domain/card.js";
import { REFERRAL_POINTS, benefitsFor, redeemFor } from "../domain/points.js";
import { creditNote } from "../domain/score.js";
import { yieldCents } from "../domain/offers.js";
import { roleOf } from "../domain/protected.js";
import {
  account, availableLimitCents, canSee, cardAvailableCents, contractById, draft, installmentCents, lateInstallments, limitOf, myInstallments, myNames,
  outstandingCents, person, role,
} from "../store.js";
import { bkCarousel } from "./btg-kit.js";
import { appbar, btn, card, circle, empty, esc, field, icon, kv, money, note, screen, sheet } from "../ui.js";

const CET_YEAR = "29,05% ao ano";
const CARD_COUNT = 6;
const NOTE_TONE = { ótima: "pos", boa: "pos", regular: "warn", baixa: "neg" };

/** The credit note of the person acting, from how they pay. */
export function noteOf(s) {
  const acc = account(s);
  const limit = limitOf(s, s.session.person) || 1;
  return creditNote({
    lateInstallments: lateInstallments(s).length,
    paidInstallments: myInstallments(s).filter((i) => i.status === "paid").length,
    utilization: outstandingCents(s) / limit,
    openFinance: acc?.openFinance?.status === "shared",
    completedPayments: s.contracts.filter((c) => c.status === "completed" && myNames(s).has(c.client)).length,
    autoPix: Boolean(acc?.pixAuto),
  });
}

function noteCard(s) {
  const n = noteOf(s);
  const tips = n.tips.map((t) => `<li>${esc(t.text)}${t.go ? ` <button type="button" class="link" data-go="${esc(t.go)}">Fazer</button>` : t.action ? ` <button type="button" class="link" data-action="${esc(t.action)}">Ativar</button>` : ""}</li>`).join("");
  return card(`<div class="row-between"><strong>Sua nota hoje: ${esc(n.band)}</strong><span class="note-score ${NOTE_TONE[n.band]}">${n.score}</span></div>
    <div class="meter" role="img" aria-label="Nota ${n.score} de 1000"><span style="width:${n.score / 10}%"></span></div>
    <small class="muted">Ela já está no preço das opções acima. Para melhorar:</small><ul class="tips">${tips}</ul>
    <button type="button" class="link" data-go="#/no-app-btg/nota">Ver a nota completa no app do BTG</button>`, "note-card");
}

/** Full screen with the ways to pay with credit, side by side: installment, total and yearly cost. */
function offersSheet(s) {
  const c = contractById(s, s.ui.sheet.id);
  const amount = payableCents(c, s);
  const loan = installmentCents(amount, CHECKOUT_INSTALLMENTS);
  const plan = cardPlan(amount, CARD_COUNT);
  const missing = Math.max(0, plan.totalCents - cardAvailableCents(s));
  const col = (title, lines, product, extra = "") => `<article class="offer-col"><strong>${esc(title)}</strong>${lines.map(([k, v]) => kv(k, v)).join("")}${extra}${btn("Escolher", { kind: "secondary small", action: "pickOffer", data: { id: c.id, product } })}</article>`;
  const canLoan = amount <= availableLimitCents(s);
  return sheet("Pagar com crédito", `<p class="muted">${esc(c.title)} · ${money(amount)}</p>
    <div class="offer-cols">
      ${canLoan ? col("Empréstimo na hora", [["Parcela", `${CHECKOUT_INSTALLMENTS}x de ${money(loan)}`], ["Total", money(loan * CHECKOUT_INSTALLMENTS)], ["Custo total", CET_YEAR], ["1ª parcela", "em 30 dias"]], "credit") : ""}
      ${col("Cartão BTG", [["Parcela", `${CARD_COUNT}x de ${money(plan.installmentCents)}`], ["Total", money(plan.totalCents)], ["Juros", "2,99% ao mês"], ["Limite", missing ? `faltam ${money(missing)}` : "cobre"]], "card", missing ? `<small class="muted">O banco aumenta o limite na hora, só para este pagamento.</small>` : "")}
    </div>
    ${noteCard(s)}`);
}

/** The notices prompt: once per person, on the first payment, with an example of a real notice. */
export function activePrompt(s, path) {
  const who = s.session.person;
  if (who === "banco" || s.ui.prompts?.[who] || s.ui.sheet) return null;
  const sent = path.match(/^combinado\/enviado\/([^/]+)/)?.[1];
  const paid = path.match(/^pago\/([^/]+)/)?.[1];
  const inv = sent && s.invites.find((i) => i.id === sent);
  if (inv) return { example: `${money(inv.totalCents)} guardados para ${inv.title}. Pode começar.`, from: inv.from === "provider" ? "Quando pagarem" : "Quando aceitarem" };
  const c = paid && contractById(s, paid);
  if (c) return { example: `${c.provider} enviou a entrega. Você tem 7 dias para aprovar.`, from: "Quando chegar a entrega" };
  return null;
}
export function promptOverlay(p) {
  return `<div class="fullsheet" role="dialog" aria-modal="true" aria-label="Avisos do pagamento">
    ${circle("bell", "info", 56)}<h2>Acompanhe este pagamento em tempo real</h2>
    
    <div class="push-example"><span class="push-app">${icon("seal-check")}Aval · agora</span><strong>${esc(p.from)}</strong><p>${esc(p.example)}</p></div>
    <ul class="bullets"><li>Só avisamos quando o dinheiro mexer.</li><li>Lembrete 2 dias antes de liberar sozinho.</li><li>Dá para desligar no Perfil.</li></ul>
    <div class="fullsheet-actions">${btn("Ativar avisos", { action: "allowNotify", iconName: "bell" })}${btn("Agora não", { kind: "text", action: "laterNotify" })}</div>
  </div>`;
}

/** The offers of the bank as leads, each one tied to paying a service; the provider also sees anticipation. */
function benefitOffers(s) {
  const provider = role(s) === "prestador";
  return [
    { kicker: "Cartão BTG", text: "Pague serviços em até 12x no cartão, 3x sem juros.", cta: "Ver cartões", art: "credit-card", go: "#/no-app-btg/cartoes" },
    { kicker: "Empréstimo na hora", text: `Você tem ${money(availableLimitCents(s))} para pagar um serviço agora.`, cta: "Ver limite", art: "hand-coins", go: "#/financeiro" },
    ...(provider ? [{ kicker: "Antecipação", text: "Receba hoje um marco já entregue, sem esperar a aprovação.", cta: "Ver agenda", art: "lightning", go: "#/agenda" }] : []),
    { kicker: "Rendimento", text: "O valor guardado rende 100% do CDI até cada marco.", cta: "Como funciona", art: "trend-up", go: "#/assistente" },
    { kicker: "Open Finance", text: "Traga dados de outros bancos e libere mais limite.", cta: "Abrir no app do BTG", art: "arrows-left-right", go: "#/no-app-btg/open-finance" },
  ];
}

function beneficios(s) {
  const me = s.session.person;
  const points = s.points?.[me] ?? 0;
  const mine = s.contracts.filter((c) => canSee(c, s) && roleOf(c, myNames(s)) !== "payee");
  const benefitIcon = (key) => (key === "cashback" ? "hand-coins" : key === "warranty" ? "shield-check" : "wrench");
  const rows = mine.flatMap((c) => benefitsFor(c).map((b) => `<li class="${b.ready ? "ready" : ""}"><span class="pk-ic">${icon(benefitIcon(b.key))}</span><span><strong>${esc(b.title)}</strong><small>${esc(c.title)} · ${esc(b.text)}${b.valueCents ? ` ${money(b.valueCents)}.` : ""}</small></span><em>${b.ready ? (b.key === "cashback" ? `Cupom ${esc(c.id.slice(-3))}OBRA` : "Ativo") : "Ao concluir"}</em></li>`)).join("");
  const log = (s.pointsLog ?? []).filter((l) => l.owner === me).slice(0, 5).map((l) => `<li><span>${esc(l.label)}<small>${esc(l.at)}</small></span><b>${l.points > 0 ? "+" : ""}${l.points}</b></li>`).join("");
  const code = `AVAL-${(person(s)?.first ?? "BTG").toUpperCase()}`;
  return screen({
    cls: "perks", header: appbar({ title: "Benefícios" }),
    body: `<section class="pk-points"><div><small>Seus pontos</small><strong>${points.toLocaleString("pt-BR")}</strong><span>Valem ${money(redeemFor(points, 10 ** 9).cents)} de desconto</span></div>
        <button type="button" class="pk-transfer" data-go="#/no-app-btg/pontos">${icon("star")}Transferir para Pontos BTG${icon("caret-right")}</button></section>
      <h3 class="bk-settings-title">Ofertas para você</h3>${bkCarousel(benefitOffers(s))}
      <h3 class="bk-settings-title">Dos seus pagamentos</h3>${rows ? `<ul class="pk-list">${rows}</ul>` : `<p class="pk-empty">${icon("star")}Os benefícios aparecem quando você paga um serviço pelo Aval.</p>`}
      <h3 class="bk-settings-title">Indique e ganhe</h3>
      <section class="pk-invite"><p>Vocês dois ganham <strong>${REFERRAL_POINTS} pontos</strong> no primeiro pagamento com Aval concluído.</p>
        <div class="pk-code"><small>Seu código</small><b>${esc(code)}</b></div>
        <div class="pk-actions"><button type="button" data-action="shareReferral" data-who="prestador">${icon("hammer")}Indicar prestador</button><button type="button" data-action="shareReferral" data-who="cliente">${icon("user")}Convidar cliente</button></div></section>
      ${log ? `<h3 class="bk-settings-title">Últimos pontos</h3><ul class="pk-log">${log}</ul>` : ""}`,
  });
}

function selo(s) {
  const p = person(s);
  return screen({
    header: appbar({ title: "Seu selo" }),
    body: `<div class="seal-card"><span class="seal-badge">${icon("seal-check")}Aceito pagamento com Aval</span><strong>${esc(p?.providerName ?? "")}</strong>
        <div class="qr">${icon("qr-code")}</div><small>Leia o QR para pagar com o dinheiro guardado até a entrega · BTG Aval</small></div>
      ${note("Quem lê o QR cai direto numa cobrança sua. Use no WhatsApp, no Instagram e no orçamento.", "info", "megaphone")}`,
    footer: `${btn("Compartilhar o selo", { action: "shareSeal", iconName: "share-network" })}${btn("Indicar o Aval a um colega", { kind: "text", action: "shareReferral", data: { who: "prestador" } })}`,
  });
}

function cofrinho(s, { id }) {
  const c = contractById(s, id);
  if (!c || !canSee(c, s)) return screen({ header: appbar({ title: "Cofrinho" }), body: empty("Pagamento não encontrado.") });
  const amount = payableCents(c, s);
  const r = s.reserves?.[id];
  const have = r?.cents ?? 0;
  const missing = Math.max(0, amount - have);
  const balance = account(s)?.balanceCents ?? 0;
  const suggest = Math.min(balance, missing);
  return screen({
    header: appbar({ title: "Cofrinho deste pagamento" }),
    body: `${card(`<small class="muted">${esc(c.provider)} · ${esc(c.title)}</small><div class="amount dark">${money(have)}</div><small class="muted">guardados de ${money(amount)}${r ? ` · rendeu ${money(reserveYield(r, s))}` : ""}</small>`)}
      ${card(`${field("Quanto guardar agora (R$)", { bind: `reserve.${id}`, value: draft(`reserve.${id}`, (suggest / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })), inputmode: "decimal" })}
        ${kv("Saldo para guardar", money(balance))}${kv("Em 30 dias rende", money(yieldCents(have + suggest, 30)))}`)}
      ${note("O dinheiro sai do seu saldo, rende 100% do CDI e paga este serviço quando você quiser. O cofrinho é do app do BTG.", "info", "piggy-bank")}
      <button type="button" class="link" data-go="#/no-app-btg/cofrinho">Gerenciar no app do BTG</button>`,
    footer: btn(`Guardar ${money(suggest)}`, { action: "guardReserve", data: { id }, iconName: "piggy-bank" }),
  });
}

/** A clean proof of a protected release, without personal data, for the provider to show. */
function proofSheet(s) {
  const c = contractById(s, s.ui.sheet.id);
  const st = c.stages[s.ui.sheet.stage];
  return sheet("Compartilhar comprovante", `<div class="proof-card">${icon("seal-check")}<strong>Marco liberado pelo Aval</strong><span>${esc(c.title)} · ${esc(st.name)}</span><small>${esc(c.provider)} · ${esc(st.releasedAt ?? "")} · pago pelo BTG Aval</small></div>
    <p class="small muted">Sem nome de quem pagou, sem valores e sem documento.</p>${btn("Compartilhar imagem", { action: "shareProof", iconName: "share-network" })}`);
}

export const perksRoutes = { beneficios, selo, "cofrinho/:id": cofrinho };
export const perksSheets = { ofertas: offersSheet, comprovante: proofSheet };
