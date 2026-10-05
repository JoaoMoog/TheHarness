// Synthetic data for the Nexo Serviços marketplace: categories, provider profiles, listings, requests and reviews.
// Coordinates are made-up points in São Paulo neighborhoods; every name and document is fictitious.

export const CATEGORIES = [
  { id: "reformas", label: "Reformas", icon: "hammer", questions: [["Qual ambiente?", ["Banheiro", "Cozinha", "Sala", "Imóvel inteiro"]], ["Tamanho aproximado", ["Até 10 m²", "10 a 30 m²", "Mais de 30 m²"]]] },
  { id: "eletrica", label: "Elétrica", icon: "lightning", questions: [["Que tipo de serviço?", ["Troca de fiação", "Tomadas e interruptores", "Quadro de energia", "Chuveiro"]], ["Tipo de imóvel", ["Apartamento", "Casa", "Comercial"]]] },
  { id: "hidraulica", label: "Hidráulica", icon: "drop", questions: [["O que está acontecendo?", ["Vazamento", "Entupimento", "Instalação nova"]], ["Onde?", ["Cozinha", "Banheiro", "Área externa"]]] },
  { id: "pintura", label: "Pintura", icon: "paint-roller", questions: [["O que pintar?", ["Paredes internas", "Fachada", "Portas e janelas"]], ["Quantos cômodos?", ["1 ou 2", "3 a 5", "Mais de 5"]]] },
  { id: "marcenaria", label: "Marcenaria", icon: "armchair", questions: [["O que fazer?", ["Armário planejado", "Conserto", "Móvel sob medida"]]] },
  { id: "interiores", label: "Interiores", icon: "couch", questions: [["Quais ambientes?", ["Um ambiente", "Dois a três", "Imóvel inteiro"]]] },
  { id: "limpeza", label: "Limpeza", icon: "broom", questions: [["Tipo de limpeza", ["Faxina", "Pós-obra", "Escritório"]], ["Frequência", ["Uma vez", "Semanal", "Quinzenal"]]] },
  { id: "piscina", label: "Piscina", icon: "swimming-pool", questions: [["Serviço", ["Manutenção mensal", "Limpeza única", "Conserto de bomba"]]] },
  { id: "jardinagem", label: "Jardinagem", icon: "plant", questions: [["Serviço", ["Manutenção", "Paisagismo", "Poda"]]] },
  { id: "montagem", label: "Montagem de móveis", icon: "screwdriver", questions: [["Quantos móveis?", ["1", "2 a 4", "5 ou mais"]]] },
  { id: "ar-condicionado", label: "Ar-condicionado", icon: "snowflake", questions: [["Serviço", ["Instalação", "Higienização", "Conserto"]]] },
  { id: "assistencia", label: "Assistência técnica", icon: "wrench", questions: [["Aparelho", ["Máquina de lavar", "Geladeira", "Fogão", "Outro"]]] },
];

export const URGENCY = ["Urgente, até 48 horas", "Nesta semana", "Neste mês", "Só estou orçando"];

/** Neighborhood centers used for distances. */
export const PLACES = {
  "Vila Madalena": { lat: -23.5535, lng: -46.6915 }, Pinheiros: { lat: -23.5666, lng: -46.6913 }, Mooca: { lat: -23.5503, lng: -46.5996 },
  Lapa: { lat: -23.5223, lng: -46.7056 }, "Butantã": { lat: -23.5717, lng: -46.7083 }, Santana: { lat: -23.5017, lng: -46.625 },
  "Tatuapé": { lat: -23.5406, lng: -46.5762 }, Perdizes: { lat: -23.5367, lng: -46.6774 }, "Itaim Bibi": { lat: -23.5848, lng: -46.6788 },
  Brooklin: { lat: -23.6114, lng: -46.6926 }, "Saúde": { lat: -23.6187, lng: -46.6383 }, Moema: { lat: -23.601, lng: -46.664 },
  "Vila Mariana": { lat: -23.5893, lng: -46.6345 }, Jardins: { lat: -23.5672, lng: -46.6614 },
};

const profile = (id, name, doc, activity, categories, neighborhood, rating, jobsDone, responseHours, priceFromCents, bio, extra = {}) => ({
  id, name, doc, activity, categories, neighborhood, ...PLACES[neighborhood], rating, jobsDone, responseHours, priceFromCents, bio,
  verified: true, acceptsCredit: true, radiusKm: 15, portfolio: [], core: false, ...extra,
});

/** Public profiles. The five "core" ones are the providers that already appear in the demo contracts. */
export const MARKET_PROVIDERS = [
  profile("horizonte", "Horizonte Reformas", "CNPJ 12.345.678/0001-90", "Reformas", ["reformas", "pintura", "hidraulica", "eletrica"], "Mooca", 4.8, 37, 2, 180_000,
    "Reformas residenciais completas com equipe própria. Orçamento por etapas e obra documentada com fotos.", { core: true, portfolio: ["Banheiro na Mooca", "Cozinha no Tatuapé", "Área de serviço"] }),
  profile("marina-interiores", "Marina Costa Interiores", "MEI 45.118.903/0001-12", "Projeto de interiores", ["interiores"], "Vila Madalena", 4.9, 21, 4, 150_000,
    "Projetos de interiores para casas e clínicas, com planta humanizada, imagens 3D e acompanhamento de obra.", { core: true, portfolio: ["Clínica Sorriso", "Apartamento em Pinheiros"] }),
  profile("paulo-reis", "Paulo Reis Elétrica", "MEI 38.220.114/0001-07", "Elétrica", ["eletrica", "ar-condicionado"], "Pinheiros", 4.7, 64, 1, 18_000,
    "Eletricista com NR-10. Troca de fiação, quadros de energia e instalação de chuveiros com laudo no final.", { core: true, portfolio: ["Quadro novo em Perdizes", "Fiação de apartamento"] }),
  profile("oficina-lume", "Oficina Lume", "CNPJ 31.902.554/0001-48", "Marcenaria", ["marcenaria", "montagem"], "Lapa", 4.6, 29, 6, 250_000,
    "Marcenaria sob medida em MDF e madeira maciça. Projeto, produção e instalação.", { core: true, portfolio: ["Armário de quarto", "Painel de TV"] }),
  profile("verde-agua", "Verde Água Piscinas", "MEI 29.884.301/0001-55", "Manutenção de piscinas", ["piscina", "jardinagem"], "Butantã", 4.8, 52, 3, 45_000,
    "Manutenção mensal de piscinas com relatório de cada visita e Pix Automático.", { core: true }),
  profile("luz-viva", "Luz Viva Instalações", "MEI 41.552.019/0001-33", "Elétrica", ["eletrica"], "Santana", 4.5, 18, 8, 15_000,
    "Instalações elétricas residenciais e comerciais.", { acceptsCredit: false }),
  profile("cor-e-arte", "Cor e Arte Pinturas", "MEI 36.410.882/0001-71", "Pintura", ["pintura"], "Tatuapé", 4.7, 40, 5, 90_000,
    "Pintura interna e de fachadas, com proteção de móveis e limpeza no final."),
  profile("hidrorapido", "HidroRápido Encanamentos", "MEI 44.019.557/0001-02", "Hidráulica", ["hidraulica"], "Perdizes", 4.4, 33, 2, 12_000,
    "Vazamentos, entupimentos e instalações hidráulicas.", { verified: false }),
  profile("brilho-casa", "Brilho Casa Limpeza", "MEI 47.221.640/0001-90", "Limpeza", ["limpeza"], "Itaim Bibi", 4.9, 88, 1, 25_000,
    "Faxina residencial e limpeza pós-obra com produtos próprios."),
  profile("jardim-vivo", "Jardim Vivo Paisagismo", "MEI 39.871.204/0001-15", "Jardinagem", ["jardinagem"], "Brooklin", 4.6, 24, 12, 30_000,
    "Manutenção de jardins e projetos de paisagismo."),
  profile("monta-ja", "Monta Já Móveis", "MEI 43.118.776/0001-48", "Montagem de móveis", ["montagem"], "Saúde", 4.8, 120, 2, 9_000,
    "Montagem e desmontagem de móveis com garantia de 90 dias."),
  profile("clima-sul", "Clima Sul Ar-condicionado", "CNPJ 28.774.102/0001-63", "Ar-condicionado", ["ar-condicionado"], "Moema", 4.7, 46, 4, 35_000,
    "Instalação e higienização de ar-condicionado split."),
  profile("teclar", "TecLar Assistência Técnica", "MEI 40.662.913/0001-27", "Assistência técnica", ["assistencia"], "Vila Mariana", 4.3, 15, 24, 12_000,
    "Conserto de eletrodomésticos com peças originais.", { verified: false }),
  profile("obra-prima", "Obra Prima Construções", "CNPJ 22.581.336/0001-04", "Reformas", ["reformas"], "Jardins", 4.5, 31, 10, 400_000,
    "Reformas de alto padrão com engenheiro responsável."),
];

const listing = (id, providerId, categoryId, title, priceCents, days, stages, includes) => ({ id, providerId, categoryId, title, priceCents, days, stages, includes, status: "published" });

export const LISTINGS = [
  listing("AN-01", "paulo-reis", "eletrica", "Troca de fiação de apartamento", 280_000, 3, ["Vistoria e material", "Troca da fiação", "Teste e laudo"], ["Fios e disjuntores", "Laudo de instalação", "Limpeza no final"]),
  listing("AN-02", "paulo-reis", "eletrica", "Instalação de chuveiro", 18_000, 1, ["Instalação e teste"], ["Mão de obra", "Teste de aterramento"]),
  listing("AN-03", "paulo-reis", "ar-condicionado", "Instalação de ar split", 45_000, 1, ["Instalação e teste"], ["Suporte", "Tubulação até 3 m"]),
  listing("AN-04", "luz-viva", "eletrica", "Quadro de energia completo", 120_000, 2, ["Material", "Montagem do quadro"], ["Disjuntores", "Identificação dos circuitos"]),
  listing("AN-05", "horizonte", "reformas", "Reforma de banheiro completa", 1_200_000, 21, ["Demolição e preparo", "Instalações", "Acabamento"], ["Equipe própria", "Retirada de entulho", "Fotos de cada etapa"]),
  listing("AN-06", "horizonte", "pintura", "Pintura de apartamento", 350_000, 6, ["Preparo e massa", "Pintura"], ["Tinta acrílica", "Proteção de pisos"]),
  listing("AN-07", "marina-interiores", "interiores", "Projeto de interiores por ambiente", 240_000, 20, ["Briefing e medição", "Projeto 3D", "Detalhamento"], ["Planta humanizada", "Imagens 3D", "Lista de compras"]),
  listing("AN-08", "oficina-lume", "marcenaria", "Armário planejado sob medida", 650_000, 25, ["Projeto e medição", "Produção", "Instalação"], ["MDF 18 mm", "Ferragens com amortecedor"]),
  listing("AN-09", "verde-agua", "piscina", "Manutenção mensal de piscina", 45_000, 30, ["Visitas do mês"], ["4 visitas", "Produtos químicos", "Relatório por visita"]),
  listing("AN-10", "cor-e-arte", "pintura", "Pintura interna por cômodo", 90_000, 2, ["Preparo", "Pintura"], ["Duas demãos", "Limpeza"]),
  listing("AN-11", "hidrorapido", "hidraulica", "Conserto de vazamento", 12_000, 1, ["Conserto"], ["Diagnóstico", "Vedação"]),
  listing("AN-12", "brilho-casa", "limpeza", "Limpeza pós-obra", 60_000, 1, ["Limpeza"], ["Equipe de 2 pessoas", "Produtos"]),
  listing("AN-13", "jardim-vivo", "jardinagem", "Manutenção de jardim", 30_000, 1, ["Visita"], ["Poda", "Adubação"]),
  listing("AN-14", "monta-ja", "montagem", "Montagem de guarda-roupa", 15_000, 1, ["Montagem"], ["Garantia de 90 dias"]),
  listing("AN-15", "clima-sul", "ar-condicionado", "Higienização de ar-condicionado", 35_000, 1, ["Higienização"], ["Bactericida", "Teste de dreno"]),
  listing("AN-16", "teclar", "assistencia", "Conserto de máquina de lavar", 12_000, 2, ["Diagnóstico", "Conserto"], ["Garantia de 90 dias"]),
  listing("AN-17", "obra-prima", "reformas", "Reforma de cozinha", 2_400_000, 30, ["Demolição", "Instalações", "Acabamento"], ["Engenheiro responsável", "ART"]),
];

const quote = (id, providerId, provider, totalCents, days, stages, message, sentAt) => ({ id, providerId, provider, totalCents, days, stages, message, sentAt });
const split = (totalCents, names) => names.map((name, i) => {
  const base = Math.floor(totalCents / names.length / 100) * 100;
  return { name, valueCents: i === names.length - 1 ? totalCents - base * (names.length - 1) : base };
});
const request = (id, owner, client, categoryId, title, description, neighborhood, when, createdAt, quotes = [], incoming = []) => ({
  id, owner, client, categoryId, title, description, neighborhood, ...PLACES[neighborhood], when, createdAt, answers: {}, status: "open",
  quotes, incoming, reading: null, contractId: null,
});

/** Requests (pedidos). incoming quotes arrive when the demo clock reaches their day. */
export function marketRequests() {
  const fiacao = ["Vistoria e material", "Troca da fiação", "Teste e laudo"];
  return [
    request("PD-101", "marina", "Marina Costa", "eletrica", "Trocar a fiação do apartamento",
      "Apartamento de 2 quartos com fiação antiga de 1985. Os disjuntores desarmam quando ligo o chuveiro e o ar ao mesmo tempo.", "Vila Madalena", "Neste mês", "03/10",
      [quote("OR-501", "luz-viva", "Luz Viva Instalações", 260_000, 4, split(260_000, fiacao), "Faço a troca completa em 4 dias, com material incluso.", "03/10")],
      [{ day: 1, ...quote("OR-502", "paulo-reis", "Paulo Reis Elétrica", 280_000, 3, split(280_000, fiacao), "Troca completa com laudo de instalação e NR-10. Aceito crédito Aval.", "05/10") }]),
    request("PD-102", null, "Lúcia Andrade", "reformas", "Reforma do banheiro social",
      "Trocar revestimento, louças e o box. Banheiro de 5 m² em apartamento na Mooca.", "Mooca", "Neste mês", "02/10"),
    request("PD-103", null, "Condomínio Jardins", "pintura", "Pintura da fachada do prédio",
      "Prédio de 4 andares. Lavagem, selador e duas demãos de tinta acrílica.", "Tatuapé", "Neste mês", "01/10",
      [quote("OR-503", "cor-e-arte", "Cor e Arte Pinturas", 1_850_000, 15, split(1_850_000, ["Lavagem e preparo", "Pintura"]), "Equipe de 4 pintores com balancim.", "02/10")]),
    request("PD-104", null, "Rafael Prado", "hidraulica", "Vazamento embaixo da pia",
      "Pingando embaixo da pia da cozinha há uma semana.", "Perdizes", "Urgente, até 48 horas", "04/10"),
    request("PD-105", null, "Ana Lima", "interiores", "Projeto para sala e cozinha integradas",
      "Quero integrar a sala com a cozinha e preciso de projeto com marcenaria.", "Pinheiros", "Neste mês", "03/10"),
  ];
}

export const MARKET_REVIEWS = [
  { providerId: "paulo-reis", author: "Ana L.", stars: 5, text: "Trocou o quadro em um dia e deixou tudo identificado.", date: "12/09" },
  { providerId: "paulo-reis", author: "João S.", stars: 4, text: "Pontual e organizado. Explicou cada circuito.", date: "28/08" },
  { providerId: "horizonte", author: "Marina C.", stars: 5, text: "Primeira etapa entregue no prazo e com fotos.", date: "28/09" },
  { providerId: "horizonte", author: "Lúcia A.", stars: 5, text: "Obra limpa e equipe educada.", date: "02/08" },
  { providerId: "marina-interiores", author: "Clínica Sorriso", stars: 5, text: "Projeto lindo e detalhado.", date: "21/09" },
  { providerId: "luz-viva", author: "Rafael P.", stars: 4, text: "Bom serviço, demorou para responder.", date: "15/09" },
  { providerId: "brilho-casa", author: "Carla M.", stars: 5, text: "Limpeza pós-obra impecável.", date: "10/09" },
];

/** Bank view baseline (30 days) before the demo session adds its own numbers. */
export const MARKET_BASELINE = { gmvCents: 186_400_000, requests: 3_412, contracts: 968, verifiedProviders: 2_140, boosts: 312 };
