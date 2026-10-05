// Nexo Serviços, the providing side and the bank: quotes for requests, public profile, listings with moderation,
// paid boost and the bank's decision on flagged listings. Fees and money stay in code.
import { judge } from "../api.js";
import { BOOST_DAYS, BOOST_PRICE_CENTS, boostActive, canQuote } from "../domain/marketplace.js";
import { PLACES } from "../seed-market.js";
import { account, draft, getState, myName, nextId, notify, notifyBank, now, parseReais, person, setDraft, today, update } from "../store.js";
import { money } from "../ui.js";
import { splitByTemplate } from "./business.js";
import { actions as A, go, ok, resolveOnServer, warn } from "./core.js";
import { myProviderProfile, providerById } from "./market.js";

const DAY_MS = 86_400_000;
const MIN_DAYS = 1;
const MAX_DAYS = 120;

const parseDays = (text) => {
  const n = Number(String(text ?? "").trim());
  return Number.isInteger(n) && n >= MIN_DAYS && n <= MAX_DAYS ? n : null;
};

// Quote for an open request (free to send; the take rate is charged only if the client accepts)
A.chooseOqTemplate = ({ key }) => setDraft("oq.template", key, false);
A.sendRequestQuote = ({ id }) => {
  const s0 = getState();
  const request = s0.requests.find((r) => r.id === id);
  const me = myName(s0);
  if (!request || !canQuote(request, me)) return warn("Este pedido não aceita mais orçamentos seus.");
  if (request.owner === s0.session.person) return warn("Você não pode orçar o próprio pedido.");
  const totalCents = parseReais(draft("oq.total"));
  const days = parseDays(draft("oq.days"));
  const message = draft("oq.message", "").trim();
  if (!totalCents) return warn("Informe o valor do orçamento.");
  if (!days) return warn(`Informe o prazo em dias, de ${MIN_DAYS} a ${MAX_DAYS}.`);
  if (!message) return warn("Escreva uma mensagem para o cliente.");
  update((s) => {
    const r = s.requests.find((x) => x.id === id);
    const qid = nextId("OR-", s.requests.flatMap((x) => x.quotes.map((q) => q.id)));
    r.quotes.push({ id: qid, providerId: person(s).providerId, provider: me, totalCents, days, stages: splitByTemplate(totalCents, draft("oq.template", "unica")), message, sentAt: today() });
    notify(s, r.client, "Novo orçamento no seu pedido", `${me} · ${money(totalCents)}`, "file-text", `#/pedido/${r.id}`, "contratante");
    s.ui.drafts.oq = undefined;
  });
  ok("Orçamento enviado. Você é avisado se o cliente aceitar.");
  go(`#/oportunidade/${id}`);
};

// Public profile (vitrine)
A.toggleVitrineCategory = ({ id }) => update((s) => {
  const p = providerById(s, person(s).providerId);
  const next = p.categories.includes(id) ? p.categories.filter((c) => c !== id) : [...p.categories, id];
  if (next.length) p.categories = next;
});
A.setVitrinePlace = ({ value }) => setDraft("vit.neighborhood", value, false);
A.setVitrineRadius = ({ value }) => setDraft("vit.radius", Number(value), false);
A.saveVitrine = () => {
  const bio = draft("vit.bio", myProviderProfile(getState())?.bio ?? "").trim();
  if (bio.length < 20) return warn("Escreva uma apresentação com pelo menos 20 caracteres.");
  update((s) => {
    const p = providerById(s, person(s).providerId);
    const neighborhood = draft("vit.neighborhood", p.neighborhood);
    Object.assign(p, { bio, neighborhood, ...PLACES[neighborhood], radiusKm: draft("vit.radius", p.radiusKm) });
    s.ui.drafts.vit = undefined;
  });
  ok("Vitrine atualizada.");
};

// Listings: the Jev reads the text; contact outside the platform asks for an edit, risky ones go to the bank
A.chooseListingCategory = ({ id }) => setDraft("an.category", id, false);
A.chooseListingTemplate = ({ key }) => setDraft("an.template", key, false);
A.publishListing = async () => {
  const title = draft("an.title", "").trim();
  const text = draft("an.text", "").trim();
  const categoryId = draft("an.category");
  const priceCents = parseReais(draft("an.price"));
  const days = parseDays(draft("an.days"));
  if (!title || text.length < 20) return warn("Preencha o título e uma descrição com pelo menos 20 caracteres.");
  if (!categoryId) return warn("Escolha a categoria.");
  if (!priceCents || !days) return warn("Informe o preço e o prazo em dias.");
  const reading = await judge("listingModeration", { title, text }, "an");
  if (reading?.value === "contactLeak" && reading.routing === "automatic") {
    setDraft("an.flag", "contactLeak", false);
    return warn("Tire telefone, WhatsApp e pagamento por fora: a negociação e o pagamento acontecem no app.");
  }
  const toBank = Boolean(reading) && (reading.routing !== "automatic" || reading.value !== "ok");
  update((s) => {
    const id = nextId("AN-", s.listings.map((l) => l.id));
    const stages = splitByTemplate(priceCents, draft("an.template", "unica")).map((st) => st.name);
    s.listings.unshift({
      id, providerId: person(s).providerId, categoryId, title, priceCents, days, stages,
      includes: text.split(/[.;\n]/).map((x) => x.trim()).filter(Boolean).slice(0, 4),
      status: toBank ? "review" : "published", createdAt: today(),
      moderation: reading ? { verdict: reading.value, confidence: reading.confidence, routing: reading.routing, queueId: reading.queueId ?? null } : null,
    });
    if (toBank) notifyBank(s, "Anúncio para revisar", `${title} · ${myName(s)}`, "storefront", "#/banco/servicos");
    s.ui.drafts.an = undefined;
  });
  ok(toBank ? "Anúncio enviado para revisão do Nexo." : "Anúncio publicado no Nexo Serviços.");
  go("#/anuncios");
};

A.buyBoost = () => {
  const s0 = getState();
  const profile = myProviderProfile(s0);
  if (!profile) return warn("Sua vitrine ainda não existe.");
  if (s0.boosts.some((b) => b.providerId === profile.id && boostActive(b, now(s0)))) return warn("Seu destaque já está ativo.");
  if ((account(s0)?.balanceCents ?? 0) < BOOST_PRICE_CENTS) return warn("Saldo insuficiente na conta Nexo.");
  update((s) => {
    s.accounts[s.session.person].balanceCents -= BOOST_PRICE_CENTS;
    s.boosts.push({ providerId: profile.id, until: now(s).getTime() + BOOST_DAYS * DAY_MS, boughtAt: today() });
    s.market.boostRevenueCents += BOOST_PRICE_CENTS;
  });
  ok(`Destaque ativo por ${BOOST_DAYS} dias. Seu perfil aparece primeiro nas buscas da sua categoria.`);
};

A.bankListingDecision = async ({ id, decision }) => {
  const listing = getState().listings.find((l) => l.id === id);
  if (!listing || listing.status !== "review") return;
  const approved = decision === "approve";
  update((s) => {
    const l = s.listings.find((x) => x.id === id);
    l.status = approved ? "published" : "rejected";
    const owner = providerById(s, l.providerId);
    if (owner) notify(s, owner.name, approved ? "Anúncio aprovado" : "Anúncio recusado", l.title, approved ? "check-circle" : "x", "#/anuncios", "prestador");
  });
  await resolveOnServer(listing.moderation?.queueId, approved ? "Anúncio aprovado" : "Anúncio recusado");
};
