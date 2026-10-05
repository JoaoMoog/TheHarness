// Bank console page for Nexo Serviços: volume, conversion, revenue from fee and boost, top categories and listing moderation.
import { BOOST_PRICE_CENTS, MARKETPLACE_TAKE_RATE, MAX_QUOTES } from "../domain/marketplace.js";
import { CATEGORIES, MARKET_BASELINE } from "../seed-market.js";
import { btn, esc, money, percent, signal } from "../ui.js";
import { categoryLabel } from "./market-kit.js";
import { kpi, layout, panel, table, two } from "./web.js";

/** Share of baseline requests per category (synthetic), before the session adds its own requests. */
const BASE_MIX = { reformas: 0.22, eletrica: 0.16, hidraulica: 0.14, pintura: 0.12, limpeza: 0.1, "ar-condicionado": 0.07, montagem: 0.06, marcenaria: 0.05, interiores: 0.03, assistencia: 0.03, piscina: 0.01, jardinagem: 0.01 };
const VERDICT_LABEL = { ok: "Sem problema", contactLeak: "Contato por fora", prohibited: "Serviço proibido", misleading: "Enganoso" };
const STATUS = { open: "Aberto", hired: "Contratado", closed: "Encerrado" };
const TOP_CATEGORIES = 6;
const count = (n) => n.toLocaleString("pt-BR");

function numbers(s) {
  const hired = s.requests.filter((r) => r.status === "hired");
  const sessionGmv = hired.reduce((a, r) => a + (r.quotes.find((q) => q.id === r.acceptedQuote)?.totalCents ?? 0), 0);
  const requests = MARKET_BASELINE.requests + s.requests.length;
  const contracts = MARKET_BASELINE.contracts + hired.length;
  return {
    gmv: MARKET_BASELINE.gmvCents + sessionGmv, requests, contracts, conversion: contracts / requests,
    take: Math.round(MARKET_BASELINE.gmvCents * MARKETPLACE_TAKE_RATE) + s.market.takeRevenueCents,
    boost: MARKET_BASELINE.boosts * BOOST_PRICE_CENTS + s.market.boostRevenueCents,
  };
}

function topCategories(s) {
  const counts = Object.fromEntries(CATEGORIES.map((c) => [c.id, Math.round(MARKET_BASELINE.requests * (BASE_MIX[c.id] ?? 0))]));
  for (const r of s.requests) counts[r.categoryId] = (counts[r.categoryId] ?? 0) + 1;
  return Object.entries(counts).sort(([, a], [, b]) => b - a).slice(0, TOP_CATEGORIES);
}

function moderation(s) {
  const pending = s.listings.filter((l) => l.status === "review");
  if (!pending.length) return panel("Anúncios para revisar", `<p class="muted">Nenhum anúncio esperando revisão. A Aval IA publicou os demais automaticamente.</p>`);
  const providerName = (id) => s.marketProviders.find((p) => p.id === id)?.name ?? id;
  return panel("Anúncios para revisar", pending.map((l) => `<div class="line"><div class="row-between">${two(l.title, `${providerName(l.providerId)} · ${money(l.priceCents)}`)}${l.moderation ? signal(`${VERDICT_LABEL[l.moderation.verdict] ?? l.moderation.verdict} · ${percent(l.moderation.confidence)}`, "review") : ""}</div>
    <div class="btn-row">${btn("Recusar", { kind: "secondary small", action: "bankListingDecision", data: { id: l.id, decision: "reject" } })}${btn("Aprovar", { kind: "primary small", action: "bankListingDecision", data: { id: l.id, decision: "approve" } })}</div></div>`).join(""));
}

function servicos(s) {
  const n = numbers(s);
  const top = topCategories(s);
  const max = Math.max(1, ...top.map(([, c]) => c));
  return layout("servicos", "Nexo Serviços", `
    <div class="kpis">${kpi("GMV em 30 dias", money(n.gmv), "Contratos fechados com custódia")}${kpi("Pedidos publicados", count(n.requests), `${count(n.contracts)} viraram contrato`)}${kpi("Conversão", percent(n.conversion), "Pedido que vira contrato", "pos-text")}${kpi("Prestadores verificados", count(MARKET_BASELINE.verifiedProviders), "KYC Nexo, MEI ou CNPJ")}</div>
    <div class="split"><div class="grow mk-stack">
      ${panel("Receita do marketplace", table(["Fonte", "Regra", "30 dias"], [
        [two("Taxa de intermediação", "Só sobre contrato fechado"), `${percent(MARKETPLACE_TAKE_RATE)} do valor`, money(n.take)],
        [two("Destaque", "Vitrine no topo por 7 dias"), money(BOOST_PRICE_CENTS), money(n.boost)],
      ]))}
      ${panel("Categorias mais pedidas", `<div class="hbars">${top.map(([id, c]) => `<div class="hbar"><span class="hbar-label">${esc(categoryLabel(id))}</span><span class="hbar-track"><span class="hbar-fill" style="width:${(c / max) * 100}%"></span></span><strong>${count(c)}</strong></div>`).join("")}</div>`)}
      ${panel("Pedidos desta sessão", table(["Pedido", "Cliente", "Orçamentos", "Situação"], s.requests.map((r) => [two(r.title, `${r.id} · ${categoryLabel(r.categoryId)}`), esc(r.client), `${r.quotes.length} de ${MAX_QUOTES}`, STATUS[r.status]])))}
    </div><div class="col">${moderation(s)}</div></div>`);
}

export const bankMarketRoutes = { "banco/servicos": servicos };
