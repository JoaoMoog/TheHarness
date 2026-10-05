// Nexo Serviços, the hiring side: search, favorites, hiring a listing, publishing a request and accepting a quote.
// The Jev reads the request text (category, completeness, match); ranking, fees and contracts are code.
import { judge } from "../api.js";
import { MAX_QUOTES, maskContacts, rankProviders, takeRateCents } from "../domain/marketplace.js";
import { CATEGORIES } from "../seed-market.js";
import { PEOPLE, addDays, draft, getState, myName, nextId, notify, now, person, setDraft, today, update } from "../store.js";
import { money } from "../ui.js";
import { contractFromInvite } from "./contract.js";
import { actions as A, go, ok, warn } from "./core.js";

const MAX_MATCH_CANDIDATES = 12;
const MIN_WORD = 4;
const STAGE_SPACING_DAYS = 10;
const SYNTHETIC_QUOTES = 2;
const MAX_TITLE = 60;
const MAX_PROFILE_TEXT = 900;

export const categoryOf = (id) => CATEGORIES.find((c) => c.id === id) ?? null;
export const providerById = (s, id) => s.marketProviders.find((p) => p.id === id) ?? null;
export const myProviderProfile = (s) => providerById(s, person(s)?.providerId ?? "");
export const homeOf = (s) => person(s)?.home ?? null;

const CONNECTORS = new Set(["em", "de", "do", "da", "dos", "das", "e", "a", "o", "com", "para", "no", "na", "um", "uma"]);

/** First sentence of the request, cut on a whole word and without a dangling connector. */
export function requestTitle(text) {
  const sentence = text.split(/[.!?\n]/)[0].trim();
  if (sentence.length <= MAX_TITLE) return sentence;
  const words = sentence.slice(0, MAX_TITLE).split(" ").slice(0, -1);
  while (words.length > 1 && CONNECTORS.has(words.at(-1).toLowerCase())) words.pop();
  return words.join(" ");
}

const fold = (text) => String(text).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const profileText = (s, p) => [p.activity, p.bio, ...p.categories.map((c) => categoryOf(c)?.label ?? ""), ...s.listings.filter((l) => l.providerId === p.id).map((l) => l.title)].join(" ");

/** Code-only relevance by shared words; used to pick candidates and as the fallback when Aval IA is off. */
export function keywordScores(s, query) {
  const words = fold(query).split(/[^a-z0-9]+/).filter((w) => w.length >= MIN_WORD);
  return Object.fromEntries(s.marketProviders.map((p) => {
    const hay = fold(profileText(s, p));
    const hits = words.filter((w) => hay.includes(w.slice(0, -1))).length;
    return [p.id, words.length ? Math.min(1, hits / Math.min(words.length, 3)) : 0];
  }));
}

/** Providers a person can hire: everyone except their own public profile. */
export const hireableProviders = (s) => s.marketProviders.filter((p) => p.id !== person(s)?.providerId);

export function rankFor(s, { scores, categoryId, sort = "relevance" }) {
  const list = hireableProviders(s).filter((p) => !categoryId || p.categories.includes(categoryId));
  return rankProviders(list, { matchScores: scores ?? {}, origin: homeOf(s), sort, boosts: s.boosts, now: now(s) });
}

A.search = async () => {
  const q = draft("busca.q", "").trim();
  if (!q) return warn("Diga o que você precisa, por exemplo: trocar a fiação do apartamento.");
  const s0 = getState();
  const keywords = keywordScores(s0, q);
  const candidates = [...hireableProviders(s0)].sort((a, b) => keywords[b.id] - keywords[a.id]).slice(0, MAX_MATCH_CANDIDATES)
    .map((p) => ({ id: p.id, text: profileText(s0, p).slice(0, MAX_PROFILE_TEXT) }));
  const [category, match] = await Promise.all([
    judge("requestCategory", { text: q }, "busca"),
    judge("serviceMatch", { request: q, candidates }, "busca"),
  ]);
  update((s) => {
    s.ui.search = {
      q, scores: match?.value ?? keywords, byAi: Boolean(match),
      categoryId: category?.routing === "automatic" ? category.value : null,
      suggestedCategory: category && category.routing !== "automatic" ? category.value : null,
      confidence: category?.confidence ?? null,
    };
  });
  go("#/buscar");
};
A.clearSearchCategory = () => update((s) => { if (s.ui.search) s.ui.search = { ...s.ui.search, categoryId: null, suggestedCategory: null }; });
A.useSearchCategory = ({ id }) => update((s) => { if (s.ui.search) s.ui.search = { ...s.ui.search, categoryId: id, suggestedCategory: null }; });
A.setSearchSort = ({ sort }) => setDraft("busca.sort", sort, false);
A.toggleSearchFilter = ({ key }) => setDraft(`busca.${key}`, !draft(`busca.${key}`, false), false);

A.toggleFavorite = ({ id }) => update((s) => {
  const who = s.session.person;
  const list = s.favorites[who] ?? [];
  s.favorites[who] = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
});

const spread = (totalCents, names) => {
  const base = Math.floor(totalCents / names.length / 100) * 100;
  return names.map((name, i) => ({ name, valueCents: i === names.length - 1 ? totalCents - base * (names.length - 1) : base, due: addDays(STAGE_SPACING_DAYS * (i + 1)) }));
};

/** A listing is a standing offer with price and stages, so hiring it creates the contract right away. */
A.hireListing = ({ id }) => {
  const s0 = getState();
  const listing = s0.listings.find((l) => l.id === id && l.status === "published");
  const provider = listing && providerById(s0, listing.providerId);
  if (!listing || !provider) return warn("Este anúncio não está disponível.");
  if (provider.id === person(s0)?.providerId) return warn("Este anúncio é seu.");
  if (!draft("anuncio.terms")) return warn("Aceite as condições e a cláusula compromissória.");
  let contractId = "";
  update((s) => {
    s.session.mode = "contratante";
    const c = contractFromInvite(s, {
      title: listing.title, description: `${listing.title}. Inclui: ${listing.includes.join(", ")}.`, client: myName(s), provider: provider.name,
      totalCents: listing.priceCents, stages: spread(listing.priceCents, listing.stages),
    }, { insured: Boolean(draft("anuncio.insurance")) });
    contractId = c.id;
    s.market.takeRevenueCents += takeRateCents(c.totalCents);
    notify(s, provider.name, "Novo contrato pelo Nexo Serviços", `${listing.title} · ${money(c.totalCents)}`, "storefront", `#/servico/${c.id}`, "prestador");
    s.ui.drafts.anuncio = undefined;
  });
  go(`#/pagar/${contractId}`);
};

// Request (pedido): describe, answer the category questions, say where and when, publish and receive quotes
A.analyzeRequest = async () => {
  const text = draft("pedido.text", "").trim();
  if (text.length < 10) return warn("Conte um pouco mais sobre o serviço.");
  const [category, completeness] = await Promise.all([
    judge("requestCategory", { text }, "pedido"),
    judge("requestCompleteness", { text, category: "Serviço residencial" }, "pedido"),
  ]);
  update((s) => {
    const prev = s.ui.drafts.pedido ?? {};
    s.ui.drafts.pedido = {
      ...prev, text, neighborhood: prev.neighborhood ?? homeOf(s)?.neighborhood,
      categoryId: category?.routing === "automatic" ? category.value : prev.categoryId ?? null,
      reading: {
        category: category ? { value: category.value, confidence: category.confidence, routing: category.routing } : null,
        complete: completeness ? { value: completeness.value, confidence: completeness.confidence, routing: completeness.routing } : null,
      },
    };
  });
  go("#/pedido/novo/2");
};
A.setRequestCategory = ({ id }) => setDraft("pedido.categoryId", id, false);
A.setRequestAnswer = ({ q, value }) => setDraft(`pedido.answers.${q}`, value, false);
A.setRequestWhen = ({ value }) => setDraft("pedido.when", value, false);
A.setRequestPlace = ({ value }) => setDraft("pedido.neighborhood", value, false);
A.requestStep = ({ step }) => {
  if (Number(step) === 3 && !draft("pedido.categoryId")) return warn("Escolha a categoria do serviço.");
  if (Number(step) === 4 && (!draft("pedido.neighborhood") || !draft("pedido.when"))) return warn("Diga o bairro e quando precisa.");
  go(`#/pedido/novo/${step}`);
};

/** Quotes from synthetic providers arrive over the next days of the demo clock, priced from their listings. */
function syntheticQuotes(s, request) {
  const demoProviders = new Set(Object.values(PEOPLE).map((x) => x.providerId));
  const ranked = rankFor(s, { categoryId: request.categoryId }).filter((p) => !demoProviders.has(p.id));
  const target = ranked.find((p) => p.id === request.target);
  const ordered = target ? [target, ...ranked.filter((p) => p !== target)] : ranked;
  return ordered.slice(0, SYNTHETIC_QUOTES).map((p, i) => {
    const listing = s.listings.find((l) => l.providerId === p.id && l.categoryId === request.categoryId);
    const totalCents = listing?.priceCents ?? p.priceFromCents;
    return {
      day: s.clock.offsetDays + i + 1, id: `OR-${request.id.slice(3)}${i + 1}`, providerId: p.id, provider: p.name, totalCents,
      days: listing?.days ?? 3, stages: spread(totalCents, listing?.stages ?? ["Serviço completo"]).map(({ name, valueCents }) => ({ name, valueCents })),
      message: `Orçamento para ${request.title.toLowerCase()}, com proteção Aval.`, sentAt: "",
    };
  });
}

A.publishRequest = () => {
  const d = draft("pedido", {});
  if (!d.text || !d.categoryId || !d.neighborhood || !d.when) return warn("Complete os passos do pedido.");
  let id = "";
  update((s) => {
    const home = homeOf(s);
    id = nextId("PD-", s.requests.map((r) => r.id));
    const request = {
      id, owner: s.session.person, client: person(s).clientName, categoryId: d.categoryId, title: requestTitle(d.text),
      description: d.text, neighborhood: d.neighborhood, lat: home.lat, lng: home.lng, when: d.when, createdAt: today(), answers: d.answers ?? {},
      status: "open", quotes: [], incoming: [], reading: d.reading ?? null, contractId: null, target: d.target ?? null,
    };
    request.incoming = syntheticQuotes(s, request);
    s.requests.unshift(request);
    for (const p of Object.values(PEOPLE).filter((x) => x.id !== s.session.person)) {
      const profile = providerById(s, p.providerId);
      if (profile?.categories.includes(d.categoryId) || profile?.id === d.target) notify(s, p.providerName, "Nova oportunidade perto de você", `${request.title} · ${d.neighborhood}`, "megaphone", `#/oportunidade/${id}`, "prestador");
    }
    s.ui.drafts.pedido = undefined;
  });
  ok("Pedido publicado. Os orçamentos chegam aqui e nas notificações.");
  go(`#/pedido/${id}`);
};

/** Clock hook: moves due synthetic quotes into the request while there is room. */
export function deliverIncomingQuotes(s, events) {
  for (const r of s.requests.filter((x) => x.status === "open" && x.incoming.length)) {
    const due = r.incoming.filter((q) => q.day <= s.clock.offsetDays);
    if (!due.length) continue;
    r.incoming = r.incoming.filter((q) => q.day > s.clock.offsetDays);
    for (const { day: _day, ...q } of due) {
      if (r.quotes.length >= MAX_QUOTES || r.quotes.some((x) => x.provider === q.provider)) continue;
      r.quotes.push({ ...q, sentAt: today() });
      notify(s, r.client, "Novo orçamento no seu pedido", `${q.provider} · ${money(q.totalCents)}`, "file-text", `#/pedido/${r.id}`, "contratante");
      events.push(`Orçamento de ${q.provider} chegou para ${r.id}`);
    }
  }
}

A.acceptRequestQuote = ({ id, quote }) => {
  const s0 = getState();
  const request = s0.requests.find((r) => r.id === id);
  const q = request?.quotes.find((x) => x.id === quote);
  if (!request || !q || request.status !== "open" || request.owner !== s0.session.person) return warn("Este orçamento não está mais disponível.");
  if (!draft("pedido.terms")) return warn("Aceite as condições e a cláusula compromissória.");
  let contractId = "";
  update((s) => {
    s.session.mode = "contratante";
    const r = s.requests.find((x) => x.id === id);
    const c = contractFromInvite(s, {
      title: r.title, description: r.description, client: r.client, provider: q.provider, totalCents: q.totalCents,
      stages: q.stages.map((st, i) => ({ ...st, due: addDays(Math.max(1, Math.round((q.days / q.stages.length) * (i + 1)))) })),
    }, { insured: Boolean(draft("pedido.insurance")) });
    Object.assign(r, { status: "hired", contractId: c.id, acceptedQuote: q.id });
    contractId = c.id;
    s.market.takeRevenueCents += takeRateCents(q.totalCents);
    notify(s, q.provider, "Seu orçamento foi aceito", `${r.title} · ${money(q.totalCents)}`, "check-circle", `#/servico/${c.id}`, "prestador");
    s.ui.drafts.pedido = undefined;
  });
  go(`#/pagar/${contractId}`);
};
A.chooseQuote = ({ quote, back }) => {
  setDraft("pedido.choice", quote, false);
  if (back) go(back);
};
A.closeRequest = ({ id }) => {
  update((s) => {
    const r = s.requests.find((x) => x.id === id && x.owner === s.session.person);
    if (r) r.status = "closed";
  });
  ok("Pedido encerrado.");
  go("#/pedidos");
};

// Talk before hiring: one thread per request and provider; contacts are masked by code until a contract exists
export const threadKey = (requestId, providerId) => `${requestId}:${providerId}`;
const isDemoProvider = (providerId) => Object.values(PEOPLE).some((x) => x.providerId === providerId);

/** Which side the current person is on in a pre-hire thread, or null when they are not part of it. */
export function negotiationSide(s, request, providerId) {
  if (request?.owner === s.session.person) return "client";
  if (person(s)?.providerId === providerId) return "provider";
  return null;
}

const autoReply = (q) =>
  `Oi! Obrigado pelo contato. Posso passar para uma visita rápida e confirmar o orçamento de ${money(q.totalCents)}, que já inclui ${q.stages.map((st) => st.name.toLowerCase()).join(", ")}. Pelo app fica tudo protegido.`;

A.sendNegotiation = ({ request: requestId, provider: providerId }) => {
  const key = `neg.${requestId}.${providerId}`;
  const raw = draft(key, "").trim();
  if (!raw) return;
  const s0 = getState();
  const request = s0.requests.find((r) => r.id === requestId);
  const side = negotiationSide(s0, request, providerId);
  const q = request?.quotes.find((x) => x.providerId === providerId);
  if (!side || !q) return warn("Esta conversa não está disponível.");
  const { text, masked } = maskContacts(raw);
  update((s) => {
    const k = threadKey(requestId, providerId);
    const thread = [...((s.negotiations ?? {})[k] ?? []), { from: side, text, at: today() }];
    const replied = thread.some((m) => m.from === "provider");
    const withReply = side === "client" && !replied && !isDemoProvider(providerId) ? [...thread, { from: "provider", text: autoReply(q), at: today(), auto: true }] : thread;
    s.negotiations = { ...(s.negotiations ?? {}), [k]: withReply };
    s.ui.drafts.neg = { ...s.ui.drafts.neg, [requestId]: { ...(s.ui.drafts.neg?.[requestId] ?? {}), [providerId]: "" } };
    const go = `#/negociacao/${requestId}/${providerId}`;
    if (side === "client") notify(s, q.provider, `Mensagem de ${request.client}`, text.slice(0, 60), "chat-circle-text", go, "prestador");
    else notify(s, request.client, `Mensagem de ${q.provider}`, text.slice(0, 60), "chat-circle-text", go, "contratante");
  });
  if (masked) warn("Ocultamos o contato. Negociando e pagando pelo app, o dinheiro fica protegido pelo Aval.");
};

/** "Contratar de novo": a request aimed at the same provider, prefilled from the finished contract. */
A.rehire = ({ id }) => {
  const s0 = getState();
  const c = s0.contracts.find((x) => x.id === id);
  const p = c && s0.marketProviders.find((x) => x.name === c.provider);
  if (!c || c.status !== "completed" || !p) return warn("Não deu para repetir este serviço.");
  update((s) => {
    s.session.mode = "contratante";
    s.ui.drafts.pedido = { text: `${c.title}. ${c.description ?? ""}`.trim(), categoryId: p.categories[0], target: p.id };
  });
  go("#/pedido/novo/1");
};

/** "Pedir orçamento" from a profile starts a request already in that provider's category. */
A.askQuoteFrom = ({ id }) => {
  const p = providerById(getState(), id);
  if (!p) return;
  update((s) => { s.ui.drafts.pedido = { ...(s.ui.drafts.pedido ?? {}), categoryId: p.categories[0], target: p.id }; });
  go("#/pedido/novo/1");
};
