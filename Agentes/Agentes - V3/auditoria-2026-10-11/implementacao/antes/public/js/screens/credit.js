// Credit screens: request with simulator, instant decision with CCB signature, my credits. The credit policy decides.
import { prepayValue } from "../actions/index.js";
import { person } from "../store.js";
import { appbar, btn, card, chip, empty, esc, kv, listCard, money, note, row, screen } from "../ui.js";

const REQUEST_LABEL = { analysis: ["Em análise", "info"], approved: ["Aprovado", "pos"], approvedLower: ["Aprovado com valor menor", "warn"], denied: ["Não aprovado", "neg"] };

function creditos(s) {
  const mine = s.credits.filter((c) => c.owner === s.session.person);
  const requests = s.creditRequests.filter((r) => r.owner === s.session.person && REQUEST_LABEL[r.status]);
  return screen({
    header: appbar({ title: "Meus créditos", tone: "ink" }),
    body: `${requests.length ? listCard("Pedidos", requests.map((r) => row({ icon: "hourglass-medium", title: `${r.id} · ${money(r.amountCents)}`, detail: r.purposeLabel, go: `#/credito/analise/${r.id}`, extra: chip(...REQUEST_LABEL[r.status]) })).join("")) : ""}
      ${listCard("Contratados", mine.length ? mine.map((c) => row({ icon: "hand-coins", title: `${c.id} · ${c.purpose}`, detail: `${c.count}x de ${money(c.installmentCents)} · custo total ${c.cet}`, go: `#/ccb/${c.id}`, extra: c.status === "paid" ? chip("Quitado", "pos") : "" })).join("") : empty("Nenhum crédito contratado."))}`,
  });
}

const INSTALLMENT_TONE = { paid: ["Paga", "pos"], late: ["Atrasada", "neg"], open: ["Em aberto", "neutral"] };

function ccb(s, { id }) {
  const c = s.credits.find((x) => x.id === id && x.owner === s.session.person);
  if (!c) return screen({ header: appbar({ title: "Crédito" }), body: empty("Crédito não encontrado.") });
  const inst = s.installments.filter((i) => i.creditId === id);
  const open = inst.filter((i) => i.status !== "paid");
  const balance = prepayValue(c, open);
  return screen({
    header: appbar({ title: c.id }),
    body: `${card(`<small class="muted">${esc(c.purpose)} · assinado em ${esc(c.signedAt)}</small><small>Saldo devedor hoje</small><div class="amount dark">${money(balance)}</div>${kv("Contratado", money(c.principalCents))}${kv("Parcelas", `${inst.length - open.length} de ${c.count} pagas`)}${kv("CET", c.cet)}`)}
      ${listCard("Parcelas", inst.map((i) => row({ icon: "credit-card", title: `Parcela ${i.n} de ${i.of}`, detail: `Vence ${i.due}`, value: money(i.valueCents), extra: chip(...INSTALLMENT_TONE[i.status]) })).join(""))}
      ${open.length ? note("Antecipar ou quitar desconta os juros que ainda não correram.", "info", "percent") : ""}`,
    footer: open.length ? `<div class="btn-row">${btn("Antecipar 2 parcelas", { kind: "secondary", action: "prepayCredit", data: { id } })}${btn("Quitar", { action: "payoffCredit", data: { id } })}</div>${btn("Portabilidade", { kind: "text", action: "portability" })}` : btn("Voltar", { kind: "secondary", go: "#/creditos" }),
  });
}

export const creditRoutes = { creditos, "ccb/:id": ccb };
