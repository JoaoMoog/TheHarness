// Home screens for both sides of the account, in the Nexo Banking style: blue balance header, strip, banner and activity.
import { anticipationValues, payableCents } from "../actions/index.js";
import {
  account, availableLimitCents, custodyCents, draft, isNexoConnected, lateInstallments, myContracts, myName, myParticipant, releasedCents,
} from "../store.js";
import { judgmentSignal, money, screen } from "../ui.js";
import { rankFor } from "../actions/market.js";
import { MAX_QUOTES } from "../domain/marketplace.js";
import { bkBanner, bkHeader, bkItem, bkLink, bkMenuButton, bkSeal, bkSection, bkStrip, todayLabel } from "./nexo-kit.js";
import { shown } from "./chrome.js";
import { contractSummary } from "./client.js";
import { categoryGrid, categoryLabel, kmText, providerCard, searchField } from "./market-kit.js";
import { opportunitiesFor } from "./market-pro.js";

const HOME_CATEGORIES = 6;
const NEAR_CARDS = 6;
const HOME_OPPORTUNITIES = 2;

/** Nexo Serviços entry on the hiring home: search, categories and providers near you. */
function findSection(s) {
  const near = rankFor(s, { sort: "relevance" }).slice(0, NEAR_CARDS);
  return `<section class="bk-section"><div class="bk-section-head"><h3>Nexo Serviços</h3>${bkLink("Ver tudo", "#/buscar")}</div>
    ${searchField(draft("busca.q", ""))}<div class="mk-home-cats">${categoryGrid(HOME_CATEGORIES)}</div></section>
    <section class="bk-section"><div class="bk-section-head"><h3>Perto de você</h3></div><div class="mk-near">${near.map(providerCard).join("")}</div></section>`;
}

const requestItems = (s) => s.requests
  .filter((r) => r.owner === s.session.person && r.status === "open" && r.quotes.length)
  .map((r) => bkItem({ icon: "file-text", label: `Pedido ${r.id} · ${r.quotes.length} de ${MAX_QUOTES} orçamentos`, title: `Compare os orçamentos: ${r.title}`, tone: "warn", go: `#/pedido/${r.id}` }));

const BASE_REVIEWS = { "Horizonte Reformas": { count: 37, avg: 4.8 }, "Marina Costa Interiores": { count: 21, avg: 4.9 } };
const MAX_PENDING = 4;
const MAX_SERVICES = 3;

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const nexoLine = (s) => ["Saldo conta Nexo", isNexoConnected(s) ? shown(s, account(s).balanceCents) : "Conectar", isNexoConnected(s) ? "#/contas" : "#/conectar"];
const homeScreen = (body) => screen({ cls: "bk", dark: true, body, overlay: bkMenuButton() });

function creditBanner(s) {
  const acc = account(s);
  if (!isNexoConnected(s)) {
    return bkBanner({ text: "Conecte sua conta Nexo para pagar com saldo, crédito e antecipação.", cta: "Conectar conta", art: "bank", go: "#/conectar" });
  }
  if (acc.reservedCredit) {
    return bkBanner({ text: `Você tem ${shown(s, acc.reservedCredit.remainingCents)} de crédito aprovado. Ele vai direto para a custódia quando você pagar um serviço.`, cta: "Ver meu crédito", go: "#/creditos" });
  }
  if (!acc.preApprovedCents) return "";
  return bkBanner({ text: `Tem uma obra pela frente? Conte com ${shown(s, acc.preApprovedCents)} pré-aprovados em até 24x.`, cta: "Simular crédito", go: "#/credito" });
}

function stageItems(c) {
  return c.stages.flatMap((st, i) => (st.status !== "awaitingApproval" ? [] : [bkItem({
    icon: "check-circle", label: `Aprovar até ${st.delivery.deadline} · ${c.provider}`, title: `Etapa ${i + 1} · ${st.name}`, value: money(st.valueCents), tone: "warn",
    extra: judgmentSignal(st.coverage, "Entrega conferida"), action: "reviewStage", data: { id: c.id, stage: i },
  })]));
}

function contractItems(s, c) {
  const items = stageItems(c);
  if (c.entrada?.status === "requested") items.push(bkItem({ icon: "hand-coins", label: "Decidir entrada", title: `${c.provider} pediu entrada`, value: money(c.entrada.requestedCents), tone: "warn", go: `#/entrada-decidir/${c.id}` }));
  else if (c.status === "awaitingPayment" && c.entrada?.status !== "countered") items.push(bkItem({ icon: "qr-code", label: "Convite aceito", title: `Pagar ${c.title}`, value: money(payableCents(c, s)), go: `#/pagar/${c.id}` }));
  const share = myParticipant(c, s);
  if (c.kind === "collective" && share && !share.paid) items.push(bkItem({ icon: "users-three", label: "Sua parte no coletivo", title: c.title, value: money(share.shareCents), tone: "warn", go: `#/pagar/${c.id}` }));
  if (c.status === "completed" && !c.reviewed) items.push(bkItem({ icon: "star", label: "Serviço concluído", title: `Avaliar ${c.provider}`, go: `#/avaliar/${c.id}` }));
  return items;
}

function clientPending(s, mine) {
  const late = lateInstallments(s).slice(0, 1).map((p) => bkItem({ icon: "warning-circle", label: "Parcela atrasada", title: `Parcela ${p.n} de ${p.of}`, value: money(p.valueCents + (p.lateFeeCents ?? 0)), tone: "neg", action: "payInstallment", data: { id: p.id } }));
  const proposals = s.disputes.filter((d) => d.status === "proposal" && mine.some((c) => c.id === d.contractId))
    .map((d) => bkItem({ icon: "scales", label: "Proposta de acordo", title: `Disputa ${d.id}`, tone: "warn", go: `#/disputa/${d.id}/resultado` }));
  return [...late, ...proposals, ...requestItems(s), ...mine.flatMap((c) => contractItems(s, c))];
}

const serviceItem = (c, isProvider) => {
  const { go, detail, icon } = contractSummary(c, isProvider);
  return bkItem({ icon, label: detail, title: c.title, value: money(c.totalCents), go });
};

export function clientHome(s) {
  const mine = myContracts(s);
  const custody = mine.reduce((acc, c) => {
    if (c.kind !== "collective") return acc + custodyCents(c);
    const share = myParticipant(c, s);
    return acc + (share?.paid ? share.shareCents : 0);
  }, 0);
  const released = mine.filter((c) => c.kind !== "collective").reduce((acc, c) => acc + releasedCents(c), 0);
  const active = mine.filter((c) => c.status !== "completed").length;
  const limit = isNexoConnected(s) ? (lateInstallments(s).length ? "Pausado" : shown(s, availableLimitCents(s))) : "Só à vista";
  const pending = clientPending(s, mine);
  return homeScreen(`
    ${bkHeader(s, {
      title: "Custódia Aval", label: "Protegido em custódia", cents: custody,
      sub: `${plural(active, "serviço em andamento", "serviços em andamento")} · ${shown(s, released)} já liberados`,
      lines: [nexoLine(s), ["Limite para serviços", limit, "#/credito"]],
      cta: { label: "Ir para extrato", go: "#/extrato" },
    })}
    ${bkStrip([["Buscar serviços", "magnifying-glass", "#/buscar"], ["Fazer pedido", "megaphone", "#/pedido/novo/1"], ["Pagar", "qr-code", "#/financeiro"], ["Pedir crédito", "hand-coins", "#/credito"], ["Assistente Aval", "sparkle", "#/ia"], ["Disputas", "scales", "#/disputas"]])}
    ${findSection(s)}
    ${creditBanner(s)}
    ${bkSection("Pendências", pending.slice(0, MAX_PENDING), { aside: `<span class="bk-day">${todayLabel()}</span>`, empty: "Nenhuma pendência. Tudo em dia." })}
    ${bkSection("Serviços contratados", mine.slice(0, MAX_SERVICES).map((c) => serviceItem(c, false)), { aside: bkLink("Ver todos", "#/servicos"), empty: "Nenhum serviço ainda." })}
    ${bkSeal()}`);
}

function providerTodo(s, mine) {
  const me = myName(s);
  const disputes = s.disputes.filter((d) => d.status !== "closed" && !d.providerStatement && mine.some((c) => c.id === d.contractId))
    .map((d) => bkItem({ icon: "scales", label: `Disputa ${d.id}`, title: "Responder com sua versão e provas", tone: "neg", go: `#/disputa/${d.id}` }));
  const invites = s.invites.filter((i) => i.status === "sent" && i.provider === me)
    .map((i) => bkItem({ icon: "paper-plane-tilt", label: `Convite de ${i.client}`, title: i.title, value: money(i.totalCents), tone: "warn", go: `#/convite/${i.id}` }));
  const work = mine.flatMap((c) => [
    ...c.stages.flatMap((st, i) => (st.status === "inProgress" || st.status === "adjustRequested"
      ? [bkItem({ icon: "upload-simple", label: `Até ${st.due} · ${c.title}`, title: `${st.status === "adjustRequested" ? "Refazer" : "Enviar"} entrega da etapa ${i + 1}`, action: "startDelivery", data: { id: c.id, stage: i } })]
      : [])),
    ...(c.entrada?.status === "countered" ? [bkItem({ icon: "hand-coins", label: "Contraproposta de entrada", title: c.title, value: money(c.entrada.counterCents), tone: "warn", go: `#/servico/${c.id}` })] : []),
    ...(c.kind === "collective" && c.participants.some((p) => !p.paid)
      ? [bkItem({ icon: "device-mobile", label: "Cobrar na maquininha", title: plural(c.participants.filter((p) => !p.paid).length, "participante sem pagar", "participantes sem pagar"), go: `#/maquininha/${c.id}` })]
      : []),
  ]);
  const opportunities = opportunitiesFor(s).filter(({ r }) => !r.quotes.some((q) => q.provider === me)).slice(0, HOME_OPPORTUNITIES)
    .map(({ r, km }) => bkItem({ icon: "megaphone", label: `Oportunidade · ${categoryLabel(r.categoryId)} · ${kmText(km)}`, title: r.title, value: `${r.quotes.length} de ${MAX_QUOTES}`, tone: "warn", go: `#/oportunidade/${r.id}` }));
  return [...disputes, ...invites, ...opportunities, ...work];
}

function reputationOf(s, me) {
  const base = BASE_REVIEWS[me] ?? { count: 0, avg: 0 };
  const published = s.reviews.filter((r) => r.provider === me && r.status === "published");
  const count = base.count + published.length;
  const avg = count ? (base.count * base.avg + published.reduce((a, r) => a + r.stars, 0)) / count : 0;
  return { count, avg };
}

function providerBanner(s, anticipable, anticipateGo) {
  if (!isNexoConnected(s)) return creditBanner(s);
  if (!anticipable) return bkBanner({ text: "Cobre por etapa com o Aval Link. Seu cliente paga e o dinheiro fica protegido no Nexo até a aprovação.", cta: "Criar link", art: "link", go: "#/link/novo" });
  const { grossCents } = anticipationValues(anticipable.st);
  return bkBanner({ text: `Receba hoje ${shown(s, grossCents)} da etapa ${anticipable.i + 1} de ${anticipable.c.title}, sem esperar a aprovação.`, cta: "Antecipar agora", art: "lightning", go: anticipateGo });
}

export function providerHome(s) {
  const mine = myContracts(s);
  const me = myName(s);
  const custody = mine.reduce((a, c) => a + custodyCents(c), 0);
  const anticipable = mine.flatMap((c) => c.stages.map((st, i) => ({ c, st, i }))).find(({ st }) => st.status === "awaitingApproval" && !st.anticipation);
  const anticipateGo = anticipable ? `#/antecipar/${anticipable.c.id}/${anticipable.i}` : "#/servicos";
  const active = mine.filter((c) => c.status !== "completed").length;
  const { count, avg } = reputationOf(s, me);
  const reputation = count ? [bkItem({ icon: "star", label: "Sua reputação", title: `${avg.toFixed(1).replace(".", ",")} de 5 · ${count} avaliações`, go: "#/servicos" })] : [];
  return homeScreen(`
    ${bkHeader(s, {
      title: "Recebimentos Aval", label: "A receber em custódia", cents: custody,
      sub: `${me} · ${plural(active, "serviço em andamento", "serviços em andamento")}`,
      lines: [["Limite de antecipação", isNexoConnected(s) ? shown(s, account(s).anticipationLimitCents) : "Indisponível", anticipateGo], nexoLine(s)],
      cta: { label: "Ir para extrato", go: "#/extrato" },
    })}
    ${bkStrip([["Oportunidades", "megaphone", "#/oportunidades"], ["Minha vitrine", "storefront", "#/vitrine"], ["Orçamento", "file-text", "#/orcamento/novo"], ["Aval Link", "link", "#/link/novo"], ["Maquininha", "device-mobile", "#/pos"], ["Antecipar", "lightning", anticipateGo], ["Agenda", "calendar-blank", "#/agenda"], ["Notas fiscais", "receipt", "#/notas"], ["Assistente Aval", "sparkle", "#/ia"]])}
    ${providerBanner(s, anticipable, anticipateGo)}
    ${bkSection("Para fazer agora", providerTodo(s, mine), { aside: `<span class="bk-day">${todayLabel()}</span>`, empty: "Tudo em dia." })}
    ${bkSection("Serviços prestados", [...mine.slice(0, MAX_SERVICES).map((c) => serviceItem(c, true)), ...reputation], { aside: bkLink("Ver todos", "#/servicos"), empty: "Nenhum serviço ainda." })}
    ${bkSeal()}`);
}
