// Nexo Serviços for providers: opportunities near you, quote for a request, public profile (vitrine) with boost and stats, listings.
import { TEMPLATES } from "../actions/index.js";
import { categoryOf, myProviderProfile } from "../actions/market.js";
import { BOOST_PRICE_CENTS, MARKETPLACE_TAKE_RATE, MAX_QUOTES, boostActive, canQuote, distanceKm, netForProvider } from "../domain/marketplace.js";
import { CATEGORIES, PLACES } from "../seed-market.js";
import { draft, fmtDate, myName, now, parseReais } from "../store.js";
import { actionAttrs, appbar, btn, busyNote, card, chip, empty, esc, field, icon, money, note, percent, screen } from "../ui.js";
import { bkFacts, bkItem, bkSection } from "./nexo-kit.js";
import { categoryLabel, kmText } from "./market-kit.js";

const RADII = [5, 10, 15, 25];
const REACH_FACTOR = 1.5;

const pills = (options, current, action, dataKey) =>
  `<div class="choice-list wrap">${options.map(([value, label]) => `<button type="button" class="pill-option ${String(current) === String(value) ? "on" : ""}" ${actionAttrs({ action, data: { [dataKey]: value } })}>${esc(label)}</button>`).join("")}</div>`;
const noProfile = (title) => screen({ header: appbar({ title }), body: empty("Sua vitrine de prestador ainda não existe.") });

/** Open requests in my categories within reach, nearest first. Not my own requests. */
export function opportunitiesFor(s) {
  const me = myProviderProfile(s);
  if (!me) return [];
  return s.requests
    .filter((r) => r.status === "open" && r.owner !== s.session.person && (me.categories.includes(r.categoryId) || r.target === me.id))
    .map((r) => ({ r, km: distanceKm(me, r) }))
    .filter(({ km }) => km <= me.radiusKm * REACH_FACTOR)
    .sort((a, b) => a.km - b.km);
}

const netText = (totalCents) => (totalCents ? `Você recebe ${money(netForProvider(totalCents))} líquido, com a taxa de ${percent(MARKETPLACE_TAKE_RATE)} só se fechar.` : `Responder é grátis. A taxa de ${percent(MARKETPLACE_TAKE_RATE)} só é cobrada se o cliente aceitar.`);

/** Keeps the net value in step with typing, without re-rendering the form. */
export function marketLiveUpdate(path) {
  if (path !== "oq.total") return;
  const el = document.getElementById("oq-net");
  if (el) el.textContent = netText(parseReais(draft("oq.total")));
}

function oportunidades(s) {
  if (!myProviderProfile(s)) return noProfile("Oportunidades");
  const me = myName(s);
  return screen({
    cls: "bk-flat", header: appbar({ title: "Oportunidades" }),
    body: `<div class="bk-pad">${note(netText(0), "info", "megaphone")}</div>
      ${bkSection("Pedidos perto de você", opportunitiesFor(s).map(({ r, km }) => {
        const quoted = r.quotes.some((q) => q.provider === me);
        return bkItem({ icon: categoryOf(r.categoryId)?.icon ?? "megaphone", label: `${categoryLabel(r.categoryId)} · ${r.neighborhood} · ${kmText(km)}`, title: r.title, value: quoted ? "Orçado" : `${r.quotes.length} de ${MAX_QUOTES}`, tone: quoted ? "" : "warn", go: `#/oportunidade/${r.id}` });
      }), { empty: "Nenhum pedido aberto na sua região agora." })}`,
  });
}

function oportunidade(s, { id }) {
  const r = s.requests.find((x) => x.id === id);
  if (!r || r.owner === s.session.person) return screen({ header: appbar({ title: "Oportunidade" }), body: empty("Pedido não encontrado.") });
  const me = myName(s);
  const mine = r.quotes.find((q) => q.provider === me);
  const answers = Object.values(r.answers ?? {});
  const head = card(`<div class="row-between">${chip(categoryLabel(r.categoryId), "info")}${chip(`${r.quotes.length} de ${MAX_QUOTES} orçamentos`)}</div><h3>${esc(r.title)}</h3><p class="small muted">${esc(r.description)}</p>${bkFacts([["Cliente", r.client], ["Onde", r.neighborhood], ["Quando", r.when], ...(answers.length ? [["Detalhes", answers.join(", ")]] : [])])}`);
  if (mine) {
    const won = r.acceptedQuote === mine.id;
    return screen({
      header: appbar({ title: "Oportunidade" }),
      body: `${head}${card(`<div class="row-between"><strong>Seu orçamento</strong>${chip(r.status === "hired" ? (won ? "Aceito" : "Não escolhido") : "Enviado", won ? "pos" : "info")}</div><div class="amount dark">${money(mine.totalCents)}</div><small class="muted">${netText(mine.totalCents)}</small>`)}`,
      footer: won ? btn("Ver serviço", { go: `#/servico/${r.contractId}` })
        : r.status === "open" ? btn(`Conversar com ${r.client}`, { kind: "secondary", go: `#/negociacao/${r.id}/${mine.providerId}`, iconName: "chat-circle-text" }) : "",
    });
  }
  const open = canQuote(r, me);
  return screen({
    header: appbar({ title: "Enviar orçamento" }),
    body: `${head}
      ${open ? `${card(`${field("Valor total (R$)", { bind: "oq.total", value: draft("oq.total", ""), inputmode: "decimal" })}${field("Prazo em dias", { bind: "oq.days", value: draft("oq.days", ""), inputmode: "numeric" })}${field("Mensagem para o cliente", { bind: "oq.message", value: draft("oq.message", ""), multiline: true, rows: 3 })}`)}
      <h3>Etapas</h3>${pills(Object.entries(TEMPLATES).map(([k, [label]]) => [k, label]), draft("oq.template", "unica"), "chooseOqTemplate", "key")}
      <p class="small muted" id="oq-net">${netText(parseReais(draft("oq.total")))}</p>` : note("Este pedido já tem 4 orçamentos ou foi encerrado.", "warn", "warning-circle")}`,
    footer: open ? btn("Enviar orçamento", { action: "sendRequestQuote", data: { id: r.id }, iconName: "paper-plane-tilt" }) : "",
  });
}

function vitrineStats(s, p) {
  const sent = s.requests.flatMap((r) => r.quotes.filter((q) => q.provider === p.name));
  const won = s.requests.filter((r) => r.acceptedQuote && r.quotes.some((q) => q.id === r.acceptedQuote && q.provider === p.name)).length;
  return `<div class="mk-stats"><div><strong>${s.market.profileViews[p.id] ?? 0}</strong><small>visitas no mês</small></div><div><strong>${sent.length}</strong><small>orçamentos enviados</small></div><div><strong>${sent.length ? percent(won / sent.length) : "0%"}</strong><small>viraram contrato</small></div></div>`;
}

function boostCard(s, p) {
  const active = s.boosts.find((b) => b.providerId === p.id && boostActive(b, now(s)));
  return active
    ? card(`<div class="row-gap">${icon("megaphone")}<div><strong>Destaque ativo</strong><small class="muted">Até ${fmtDate(new Date(active.until))}. Seu perfil aparece primeiro nas buscas.</small></div></div>`, "soft")
    : card(`<div class="row-gap">${icon("megaphone")}<div><strong>Impulsione sua vitrine</strong><small class="muted">7 dias no topo das buscas da sua categoria, com o selo Patrocinado.</small></div></div>${btn(`Impulsionar por ${money(BOOST_PRICE_CENTS)}`, { kind: "secondary small", action: "buyBoost" })}`);
}

function vitrine(s) {
  const p = myProviderProfile(s);
  if (!p) return noProfile("Minha vitrine");
  return screen({
    header: appbar({ title: "Minha vitrine", tone: "ink" }),
    body: `${vitrineStats(s, p)}${boostCard(s, p)}
      ${btn("Ver como o cliente vê", { kind: "text", go: `#/prestador/${p.id}` })}
      ${card(field("Apresentação", { bind: "vit.bio", value: draft("vit.bio", p.bio), multiline: true, rows: 4 }))}
      <h3>Categorias que você atende</h3><div class="choice-list wrap">${CATEGORIES.map((c) => `<button type="button" class="pill-option ${p.categories.includes(c.id) ? "on" : ""}" ${actionAttrs({ action: "toggleVitrineCategory", data: { id: c.id } })}>${esc(c.label)}</button>`).join("")}</div>
      <h3>Base de atendimento</h3>${pills(Object.keys(PLACES).map((x) => [x, x]), draft("vit.neighborhood", p.neighborhood), "setVitrinePlace", "value")}
      <h3>Raio</h3>${pills(RADII.map((r) => [r, `${r} km`]), draft("vit.radius", p.radiusKm), "setVitrineRadius", "value")}`,
    footer: btn("Salvar vitrine", { action: "saveVitrine" }),
  });
}

const LISTING_STATUS = { published: ["Publicado", "pos"], review: ["Em revisão no Nexo", "warn"], rejected: ["Recusado", "neg"] };

function anuncios(s) {
  const p = myProviderProfile(s);
  if (!p) return noProfile("Meus anúncios");
  const mine = s.listings.filter((l) => l.providerId === p.id);
  return screen({
    cls: "bk-flat", header: appbar({ title: "Meus anúncios" }),
    body: bkSection("Anúncios", mine.map((l) => bkItem({ icon: categoryOf(l.categoryId)?.icon ?? "storefront", label: `${LISTING_STATUS[l.status][0]} · ${categoryLabel(l.categoryId)}`, title: l.title, value: money(l.priceCents), tone: l.status === "rejected" ? "neg" : l.status === "review" ? "warn" : "", go: l.status === "published" ? `#/anuncio/${l.id}` : undefined })), { empty: "Você ainda não tem anúncios." }),
    footer: btn("Novo anúncio", { go: "#/anuncios/novo", iconName: "plus" }),
  });
}

function anuncioNovo(s) {
  const p = myProviderProfile(s);
  if (!p) return noProfile("Novo anúncio");
  return screen({
    header: appbar({ title: "Novo anúncio" }),
    body: `${draft("an.flag") === "contactLeak" ? note("A Aval IA encontrou contato ou pagamento por fora no texto. Tire telefone, WhatsApp e links: a negociação acontece no app, com proteção Aval.", "danger", "warning-circle") : ""}
      ${card(`${field("Título", { bind: "an.title", value: draft("an.title", ""), placeholder: "Ex.: Instalação de chuveiro" })}${field("Descrição e o que está incluso", { bind: "an.text", value: draft("an.text", ""), multiline: true, rows: 4 })}${field("Preço (R$)", { bind: "an.price", value: draft("an.price", ""), inputmode: "decimal" })}${field("Prazo em dias", { bind: "an.days", value: draft("an.days", ""), inputmode: "numeric" })}`)}
      <h3>Categoria</h3>${pills(p.categories.map((c) => [c, categoryLabel(c)]), draft("an.category"), "chooseListingCategory", "id")}
      <h3>Etapas</h3>${pills(Object.entries(TEMPLATES).map(([k, [label]]) => [k, label]), draft("an.template", "unica"), "chooseListingTemplate", "key")}
      ${note("A Aval IA confere o texto antes de publicar: contato por fora pede ajuste, e serviço proibido vai para revisão do Nexo.", "info", "sparkle")}`,
    footer: s.ui.busy.an ? busyNote("Aval IA conferindo o anúncio") : btn("Publicar anúncio", { action: "publishListing" }),
  });
}

export const marketProRoutes = { oportunidades, "oportunidade/:id": oportunidade, vitrine, anuncios, "anuncios/novo": anuncioNovo };
