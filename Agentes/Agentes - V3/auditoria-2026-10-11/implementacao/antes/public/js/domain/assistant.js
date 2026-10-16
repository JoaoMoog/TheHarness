// The app's assistant, simulated by rules for the presentation: no key, no network, always the same answer.
// Pure functions: it classifies the service, suggests stages, reads a chat, answers questions, checks a delivery
// and summarizes a dispute. Money decisions stay with the bank's rules and the people.
import { normText } from "./search.js";
import { SINGLE_STAGE } from "./protected.js";

/** Below this value one release is simpler than stages. */
export const SINGLE_LIMIT_CENTS = 300_000;
const ROUND_CENTS = 100;

const norm = normText;
const brl = (cents) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (x) => `${Math.round(x * 100)}%`;

export const CATEGORIES = [
  { key: "interiores", words: ["interiores", "decoracao", "projeto 3d", "marcenaria"], title: "Projeto de interiores", description: "Projeto de interiores: medição, projeto 3D e acompanhamento.",
    stages: [["Medição e briefing", 0.25], ["Projeto 3D e memorial", 0.5], ["Acompanhamento da obra", 0.25]] },
  { key: "cozinha", words: ["cozinha"], title: "Reforma da cozinha", description: "Reforma da cozinha: retirada do antigo, elétrica e hidráulica, piso e revestimento, armários.",
    stages: [["Demolição e retirada", 0.2], ["Elétrica e hidráulica", 0.3], ["Piso e revestimento", 0.3], ["Armários e acabamento", 0.2]] },
  { key: "banheiro", words: ["banheiro", "box", "lavabo"], title: "Reforma do banheiro", description: "Reforma do banheiro: demolição, instalações e acabamento.",
    stages: [["Demolição e preparo", 0.3], ["Instalações", 0.4], ["Acabamento", 0.3]] },
  { key: "eletrica", words: ["eletric", "fiacao", "tomada", "disjuntor", "quadro de luz"], title: "Instalação elétrica", description: "Instalação elétrica: diagnóstico, troca da fiação e testes.",
    stages: [["Diagnóstico e material", 0.3], ["Troca da fiação", 0.5], ["Testes e entrega", 0.2]] },
  { key: "pintura", words: ["pintura", "pintar", "massa corrida", "parede"], title: "Pintura", description: "Pintura: preparo e massa corrida, selador e duas demãos.",
    stages: [["Preparo e massa", 0.5], ["Pintura e acabamento", 0.5]] },
  { key: "telhado", words: ["telhado", "telha", "calha", "infiltracao"], title: "Reparo do telhado", description: "Reparo do telhado: inspeção, troca das telhas e vedação.",
    stages: [["Inspeção e material", 0.3], ["Troca das telhas", 0.5], ["Vedação e teste de água", 0.2]] },
];
const GENERIC = { 2: ["Início", "Entrega final"], 3: ["Início", "Execução", "Entrega final"], 4: ["Início", "Execução", "Acabamento", "Entrega final"], 5: ["Início", "Preparo", "Execução", "Acabamento", "Entrega final"] };

/** The kind of service the text talks about, or null. The most specific kinds come first (a design project mentions rooms). */
export function classify(text) {
  const t = norm(text);
  return CATEGORIES.find((c) => c.words.some((w) => t.includes(w))) ?? null;
}

/** Splits a total by shares in whole reais; the last stage takes the rounding. */
function bySharesOf(totalCents, parts) {
  let used = 0;
  return parts.map(([name, share], i) => {
    const valueCents = i === parts.length - 1 ? totalCents - used : Math.round((totalCents * share) / ROUND_CENTS) * ROUND_CENTS;
    used += valueCents;
    return { name, valueCents };
  });
}

/** Stages for the payer to start from: by the kind of service, generic when unknown, one value when small. */
export function suggestStages({ description, totalCents, count }) {
  const cat = classify(description);
  const title = cat?.title ?? (String(description ?? "").split(":")[0].trim() || "Serviço");
  if (totalCents < SINGLE_LIMIT_CENTS && !count) {
    return { release: "single", title, description: cat?.description ?? description, stages: [{ name: SINGLE_STAGE, valueCents: totalCents }], reason: `Para ${brl(totalCents)}, um valor único é mais simples: sai de uma vez quando o serviço terminar.` };
  }
  const wanted = count ?? cat?.stages.length ?? 3;
  const own = cat && wanted === cat.stages.length;
  const parts = own ? cat.stages : (GENERIC[wanted] ?? GENERIC[3]).map((n, _, all) => [n, 1 / all.length]);
  const reason = own
    ? `É assim que uma ${cat.title.toLowerCase()} costuma andar. Cada marco só é pago a quem faz quando você aprovar.`
    : `Dividi em ${parts.length} partes. Cada uma só é paga quando você aprovar.`;
  return { release: "stages", title, description: cat?.description ?? description, stages: bySharesOf(totalCents, parts), reason };
}

/** Share of the first stage when whoever does the service buys the material up front. */
export const FIRST_SHARE = 0.6;

/** The same stages with the material up front: the first takes FIRST_SHARE, the rest keep their proportions. */
export function frontLoad(stages, totalCents, firstShare = FIRST_SHARE) {
  if (stages.length < 2) return stages;
  const first = Math.round((totalCents * firstShare) / ROUND_CENTS) * ROUND_CENTS;
  const restWeights = stages.slice(1).map((st) => Math.max(1, st.valueCents));
  const weightSum = restWeights.reduce((a, w) => a + w, 0);
  const rest = bySharesOf(totalCents - first, stages.slice(1).map((st, i) => [st.name, restWeights[i] / weightSum]));
  return [{ name: stages[0].name, valueCents: first }, ...rest];
}

const VALUE = /R\$\s*([\d.]+(?:,\d{1,2})?)|(\d+(?:[.,]\d+)?)\s*mil\b/gi;
const DATE = /\b(\d{1,2})\/(\d{1,2})\b/g;
const ADDRESS = /\b(?:Rua|Avenida|Av\.|Alameda|Travessa|Praça)\s+[^,\n.]+(?:,\s*\d+)?/i;

function toCents([, reais, thousands]) {
  if (thousands) return Math.round(Number(thousands.replace(",", ".")) * 1000 * 100);
  return Math.round(Number(reais.replace(/\./g, "").replace(",", ".")) * 100);
}

/** What a WhatsApp chat says was agreed: the last value and date mentioned, the address and the kind of service. */
export function parseConversation(text) {
  const chat = String(text ?? "");
  const values = [...chat.matchAll(VALUE)];
  const date = [...chat.matchAll(DATE)].at(-1);
  const cat = classify(chat);
  return {
    totalCents: values.length ? toCents(values.at(-1)) : null,
    dueDate: date ? `${date[1].padStart(2, "0")}/${date[2].padStart(2, "0")}` : null,
    address: chat.match(ADDRESS)?.[0].trim() ?? null,
    description: cat?.description ?? "",
    title: cat?.title ?? "",
  };
}

const TOPICS = [
  ["insurance", ["seguro"], "O seguro é opcional e custa 2,5% do valor. Se uma disputa terminar a seu favor, ele cobre o que já foi liberado ou outro prestador para terminar o serviço."],
  ["installments", ["parcel", "credito", "cartao", "juros", "pre-aprovado"], "Dá para parcelar no cartão do banco em até 12x (3x sem juros) ou sem cartão, com o empréstimo na hora em 6x. Em todos os casos o valor fica guardado inteiro até você aprovar."],
  ["autoRelease", ["nao aprov", "sem resposta", "7 dias", "sete dias", "esquecer", "prazo"], "Depois que a entrega chega, você tem 7 dias para aprovar ou abrir uma disputa. Sem resposta nesse prazo, o valor é liberado sozinho para quem fez o serviço."],
  ["stages", ["etapa", "marco"], "Você divide o valor em marcos. Cada marco fica guardado e só vai para quem faz o serviço quando você aprovar a entrega dele."],
  ["dispute", ["ruim", "disputa", "problema", "errado", "reclam", "nao gostei", "mal feito"], "Se algo não ficou como combinado, abra uma disputa antes de aprovar. O valor do marco fica bloqueado, as duas partes contam a sua versão e o banco propõe um acordo pelas provas."],
  ["anticipation", ["antecip", "receber antes", "adiant"], "Quem faz o serviço pode receber hoje um marco já entregue, com uma taxa pequena. Para quem paga, nada muda: a aprovação continua valendo."],
  ["yield", ["rend", "cdi"], "Enquanto está guardado, o dinheiro rende 100% do CDI. O rendimento volta para quem pagou quando o serviço termina."],
  ["protection", ["protec", "guardad", "garant", "como funciona", "seguranca"], "Quando você paga, o dinheiro fica guardado no banco. Ele só sai quando você aprova a entrega, e quem faz o serviço vê que o valor está garantido."],
  ["fees", ["taxa", "tarifa", "custa"], "Pagar com Aval não tem tarifa para quem paga. Só há custo se você escolher o seguro, o cartão acima de 3x ou o crédito."],
];
export const SUGGESTED_QUESTIONS = ["Como funcionam os marcos?", "E se eu não aprovar a tempo?", "Quanto custa o seguro?", "E se o serviço ficar ruim?"];

const FAQ_QUESTIONS = [
  ["protection", "Como funciona pagar com Aval?"],
  ["stages", "Como funcionam os marcos?"],
  ["autoRelease", "E se eu não aprovar a tempo?"],
  ["dispute", "E se o serviço ficar ruim?"],
  ["fees", "Quem paga tem alguma tarifa?"],
  ["insurance", "Quanto custa o seguro?"],
  ["installments", "Posso parcelar no cartão?"],
  ["yield", "O dinheiro rende enquanto está guardado?"],
  ["anticipation", "Quem presta pode receber antes?"],
];

/** The help center's frequent questions, answered with the same text the assistant gives. */
export const FAQ = FAQ_QUESTIONS.map(([topic, question]) => ({ topic, question, text: TOPICS.find(([t]) => t === topic)[2] }));

/** An answer about the protected payment, by topic; says what it can help with when the question is outside it. */
export function answer(question) {
  const q = norm(question);
  const hit = TOPICS.find(([, words]) => words.some((w) => q.includes(w)));
  if (hit) return { topic: hit[0], text: hit[2] };
  return { topic: "unknown", text: "Ainda não sei responder isso. Posso ajudar com marcos, prazos, seguro, parcelas, disputas e rendimento de quem paga com Aval." };
}

/** Compares a delivery with its stage before the payer approves: photos and whether the description talks about the stage. */
export function reviewDelivery({ stageName, delivery }) {
  const visual = (delivery?.attachments ?? []).filter((a) => a.kind === "photo" || a.kind === "video").length;
  const words = norm(stageName).split(/\W+/).filter((w) => w.length > 3);
  const mentions = words.some((w) => norm(delivery?.description).includes(w));
  const notes = [
    visual ? { tone: "pos", text: `${visual} foto(s) ou vídeo(s) do serviço pronto.` } : { tone: "warn", text: "Não há foto nem vídeo do serviço pronto. Peça antes de aprovar." },
    mentions ? { tone: "pos", text: `A descrição fala de "${stageName}".` } : { tone: "warn", text: `A descrição não cita "${stageName}". Confira se é este marco.` },
  ];
  return { ok: notes.every((n) => n.tone === "pos"), notes };
}

/** A short brief of a dispute for the bank's mediator, with the proposal of the mediation rule. */
export function disputeBrief({ report, reasonLabel, clientEvidence, providerStatement, providerEvidence, amountCents, share }) {
  const lines = [
    `Contratante: ${reasonLabel}. "${report}" ${clientEvidence.length ? `Provas: ${clientEvidence.join(", ")}.` : "Sem provas."}`,
    providerStatement ? `Prestador: "${providerStatement}" ${providerEvidence.length ? `Provas: ${providerEvidence.join(", ")}.` : "Sem provas."}` : "Prestador: ainda não respondeu.",
    `Em jogo: ${brl(amountCents)}, bloqueados no marco.`,
  ];
  const providerCents = Math.round(amountCents * share);
  return { lines, suggestion: `Pela regra de mediação: ${pct(share)} ao prestador (${brl(providerCents)}) e ${pct(1 - share)} de volta à contratante (${brl(amountCents - providerCents)}).` };
}

const tidy = (text) => {
  const t = String(text ?? "").trim().replace(/\s+/g, " ").replace(/[.\s]+$/, "");
  return t ? `${t[0].toUpperCase()}${t.slice(1)}.` : "";
};
/** Rewrites what the person typed into a clear description: the kind of service first, then what it includes. */
export function improveDescription(text) {
  const clean = tidy(text);
  if (!clean) return { text: "", title: "" };
  const cat = classify(clean);
  if (!cat || clean.includes(":")) return { text: clean, title: cat?.title ?? clean.split(":")[0] };
  const scope = cat.description.split(":")[1].trim().replace(/\.$/, "");
  const said = clean.replace(/\.$/, "");
  const body = `${cat.title}: ${said[0].toLowerCase()}${said.slice(1)}.`;
  const already = scope.split(/,| e /).map((part) => norm(part).trim()).filter((part) => part.length > 4).some((part) => norm(said).includes(part));
  return { text: already ? body : `${body} Inclui ${scope}.`, title: cat.title };
}
