// Bank site: funnel of the contextual offers shown inside the protected payment, only what the presentation created.
import { funnelOf, soldOffers } from "../domain/offers.js";
import { peopleOf } from "../store.js";
import { chip, empty, esc, money, percent } from "../ui.js";
import { kpi, layout, table, two } from "./web.js";

const PRODUCT = {
  credit: ["Empréstimo na hora", "Parcelar sem cartão no pagamento"],
  limit: ["Aumento de limite", "Cartão BTG, só o que o pagamento precisa"],
  anticipation: ["Antecipação", "Quem recebe, sobre a entrega enviada"],
  yield: ["Rendimento do guardado", "Automático em todo pagamento · fora da conversão"],
  insurance: ["Seguro do serviço", "Opcional, escolhido por quem paga"],
};

function ofertas(s) {
  const events = s.offerEvents ?? [];
  const funnel = funnelOf(events);
  const sold = soldOffers(events);
  const shown = sold.length;
  const accepted = sold.filter((e) => e.accepted).length;
  const revenue = funnel.reduce((a, f) => a + f.revenueCents, 0);
  const funding = funnel.find((f) => f.product === "yield").valueCents;
  const rows = funnel.map((f) => [two(...PRODUCT[f.product]), String(f.shown), String(f.accepted), f.product === "yield" ? chip("Automático") : f.shown ? chip(percent(f.conversion), f.conversion >= 0.5 ? "pos" : "warn") : chip("—"), `<strong>${money(f.product === "yield" ? f.valueCents : f.revenueCents)}</strong><small>${f.product === "yield" ? "captado" : "receita"}</small>`]);
  const people = peopleOf(s);
  const log = events.slice(0, 12).map((e) => [esc(e.at), two(PRODUCT[e.product][0], e.contractId ?? ""), esc(people[e.person]?.name ?? e.person), e.accepted ? chip("Aceita", "pos") : chip("Mostrada"), money(e.valueCents)]);
  return layout("ofertas", "Ofertas no pagamento", `<div class="kpis">${kpi("Ofertas mostradas", String(shown), "Crédito, limite, seguro e antecipação")}${kpi("Aceitas", String(accepted), shown ? `Conversão de ${percent(accepted / shown)}` : "Nenhuma ainda")}${kpi("Receita das ofertas", money(revenue), "Juros, tarifas e comissões", "pos-text")}${kpi("Captação do guardado", money(funding), "Rende 100% do CDI a quem paga")}</div>
    <section class="panel grow"><h2>Funil por produto</h2>${table(["Produto", "Mostradas", "Aceitas", "Conversão", "Resultado"], rows)}</section>
    <section class="panel grow"><h2>Últimas ofertas</h2>${log.length ? table(["Dia", "Oferta", "Pessoa", "Situação", "Valor"], log) : empty("As ofertas aparecem aqui conforme a apresentação avança.")}</section>`);
}

export const bankOfferRoutes = { "banco/ofertas": ofertas };
