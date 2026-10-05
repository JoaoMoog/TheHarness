import { AuthenticationError } from "@typesafe-ai/sdk";
import { AV_2026_001 } from "../fixtures/av-2026-001.js";
import { createJevClient } from "../jev.js";
import { judgeAssistantIntent } from "../judgments/assistant-intent.js";
import { judgeBlockAppeal } from "../judgments/block-appeal.js";
import { judgeConversationEscalation } from "../judgments/conversation-escalation.js";
import { judgeDeliveryCoverage } from "../judgments/delivery-coverage.js";
import { judgeDisputeReason } from "../judgments/dispute-reason.js";
import { judgeEvidenceConsistency } from "../judgments/evidence-consistency.js";
import { judgeEvidenceSufficiency } from "../judgments/evidence-sufficiency.js";
import { judgeExpertInspection } from "../judgments/expert-inspection.js";
import { judgeFraudSignals } from "../judgments/fraud-signals.js";
import {
  judgeListingModeration, judgeRequestCategory, judgeRequestCompleteness, judgeServiceMatch, type MatchCandidate,
} from "../judgments/market.js";
import { judgeQueuePriority } from "../judgments/queue-priority.js";
import { judgeReviewModeration } from "../judgments/review-moderation.js";
import { judgeScheduleOnly } from "../judgments/schedule-only.js";
import { judgeSuggestedStages } from "../judgments/suggested-stages.js";
import { judgeTacitConfirmation } from "../judgments/tacit-confirmation.js";
import type { JevClient } from "../judgments/types.js";

/** Synthetic, labeled cases in Portuguese. Run with `npm run jev:eval`. */
interface Row {
  readonly judgment: string;
  readonly caseName: string;
  readonly expected: string;
  readonly got: string;
  readonly confidence: number;
  readonly routing: string;
}

type Case = (client: JevClient) => Promise<Row>;

const stage2 = AV_2026_001.stages[1]!;
const stage3 = AV_2026_001.stages[2]!;
const SERVICES = [
  { id: "AV-2026-001", label: "Reforma do banheiro com Horizonte Reformas" },
  { id: "AV-2026-014", label: "Pintura do condomínio, contrato coletivo" },
];

const tacit = (caseName: string, clientMessage: string, expected: string): Case => async (c) => {
  const r = await judgeTacitConfirmation(c, { stageName: stage2.name, items: stage2.items, clientMessage });
  return { judgment: "tacitConfirmation", caseName, expected, got: r.value, confidence: r.confidence, routing: r.routing };
};

const coverage = (caseName: string, description: string, captions: string[], expected: string): Case => async (c) => {
  const r = await judgeDeliveryCoverage(c, {
    stageName: stage3.name,
    items: stage3.items,
    description,
    attachments: captions.map((caption) => ({ kind: "photo" as const, caption })),
  });
  const got = r.value.items.map((i) => (i.covered ? "1" : "0")).join("");
  return { judgment: "deliveryCoverage", caseName, expected, got, confidence: r.confidence, routing: r.routing };
};

const reason = (caseName: string, report: string, expected: string): Case => async (c) => {
  const r = await judgeDisputeReason(c, { stageName: stage2.name, report });
  const got = `${r.value.reason}${r.value.providerUnresponsive ? "+unresponsive" : ""}`;
  return { judgment: "disputeReason", caseName, expected, got, confidence: r.confidence, routing: r.routing };
};

const intent = (caseName: string, message: string, expected: string): Case => async (c) => {
  const r = await judgeAssistantIntent(c, { message, services: SERVICES });
  const got = `${r.value.intent}${r.value.serviceId ? `:${r.value.serviceId}` : ""}`;
  return { judgment: "assistantIntent", caseName, expected, got, confidence: r.confidence, routing: r.routing };
};

const escalation = (caseName: string, lines: [string, string][], expected: string): Case => async (c) => {
  const r = await judgeConversationEscalation(c, { messages: lines.map(([from, text]) => ({ from: from as "client" | "provider", text })) });
  return { judgment: "conversationEscalation", caseName, expected, got: String(r.value.escalating), confidence: r.confidence, routing: r.routing };
};

const schedule = (caseName: string, report: string, expected: string): Case => async (c) => {
  const r = await judgeScheduleOnly(c, { report });
  return { judgment: "scheduleOnly", caseName, expected, got: String(r.value), confidence: r.confidence, routing: r.routing };
};

const appeal = (caseName: string, blockReason: string, text: string, expected: string): Case => async (c) => {
  const r = await judgeBlockAppeal(c, { blockReason, appeal: text });
  return { judgment: "blockAppeal", caseName, expected, got: r.value, confidence: r.confidence, routing: r.routing };
};

const category = (caseName: string, text: string, expected: string): Case => async (c) => {
  const r = await judgeRequestCategory(c, { text });
  return { judgment: "requestCategory", caseName, expected, got: r.value, confidence: r.confidence, routing: r.routing };
};

const completeness = (caseName: string, text: string, expected: string): Case => async (c) => {
  const r = await judgeRequestCompleteness(c, { text, category: "Serviço residencial" });
  return { judgment: "requestCompleteness", caseName, expected, got: String(r.value), confidence: r.confidence, routing: r.routing };
};

/** Expected is the id the code would rank first by match alone. */
const match = (caseName: string, request: string, candidates: MatchCandidate[], expected: string): Case => async (c) => {
  const r = await judgeServiceMatch(c, { request, candidates });
  const top = Object.entries(r.value).sort(([, a], [, b]) => b - a)[0]?.[0] ?? "";
  return { judgment: "serviceMatch", caseName, expected, got: top, confidence: r.confidence, routing: r.routing };
};

const listing = (caseName: string, title: string, text: string, expected: string): Case => async (c) => {
  const r = await judgeListingModeration(c, { title, text });
  return { judgment: "listingModeration", caseName, expected, got: r.value, confidence: r.confidence, routing: r.routing };
};

const FIACAO = "Apartamento de 2 quartos com fiação antiga. Os disjuntores desarmam quando ligo o chuveiro e o ar ao mesmo tempo.";
const PAULO: MatchCandidate = { id: "paulo-reis", text: "Eletricista com NR-10. Troca de fiação, quadros de energia e instalação de chuveiros." };
const BRILHO: MatchCandidate = { id: "brilho-casa", text: "Faxina residencial e limpeza pós-obra com produtos próprios." };
const COR: MatchCandidate = { id: "cor-e-arte", text: "Pintura interna e de fachadas, com proteção de móveis." };
const VERDE: MatchCandidate = { id: "verde-agua", text: "Manutenção mensal de piscinas com relatório de cada visita." };
const JARDIM: MatchCandidate = { id: "jardim-vivo", text: "Manutenção de jardins e projetos de paisagismo." };

const MARKET_CASES: readonly Case[] = [
  category("fiação antiga", FIACAO, "eletrica"),
  category("vazamento na pia", "Está pingando embaixo da pia da cozinha há uma semana.", "hidraulica"),
  category("ar que pinga", "O ar-condicionado do quarto pinga água e não gela mais.", "ar-condicionado"),
  category("guarda-roupa", "Preciso montar um guarda-roupa de 6 portas que comprei pela internet.", "montagem"),
  completeness("só o ofício", "Preciso de um eletricista.", "false"),
  completeness("fiação detalhada", FIACAO, "true"),
  completeness("pintura com metragem", "Pintar 3 quartos e a sala de um apartamento de 70 m², paredes brancas.", "true"),
  match("fiação", FIACAO, [BRILHO, PAULO, COR], "paulo-reis"),
  match("piscina verde", "A piscina está verde e precisa de limpeza e tratamento.", [JARDIM, VERDE, BRILHO], "verde-agua"),
  match("pintura da sala", "Pintar a sala e o corredor com tinta acrílica.", [PAULO, COR, VERDE], "cor-e-arte"),
  listing("anúncio limpo", "Pintura de apartamento", "Pintura interna com duas demãos, proteção de pisos e limpeza no final.", "ok"),
  listing("telefone no texto", "Elétrica residencial", "Chama no zap 11 98888-7777 que faço mais barato sem taxa.", "contactLeak"),
  listing("gato de luz", "Ligação de energia", "Faço gato de luz e religação sem passar pela distribuidora.", "prohibited"),
];

const CASES: readonly Case[] = [
  ...MARKET_CASES,
  escalation("briga", [["client", "Você sumiu há uma semana e o chuveiro não liga. Não vou pagar mais nada."], ["provider", "Fiz tudo certo. Se não pagar, entro na justiça."]], "true"),
  escalation("combinando", [["client", "Pode vir na quinta às 9h? O porteiro libera."], ["provider", "Combinado, levo o rejunte cinza."]], "false"),
  schedule("só prazo", "A etapa terminou 10 dias depois do combinado, mas o serviço ficou bem feito.", "true"),
  schedule("prazo e defeito", "Atrasou uma semana e o rejunte do box ficou torto e manchado.", "false"),
  appeal("certidão", "Nome informado diferente do documento", "Troquei de sobrenome no casamento. Envio a certidão de casamento e o RG novo.", "newDocument"),
  appeal("sem novidade", "Pagamento combinado fora do Aval", "Isso é um absurdo, sou trabalhador honesto, liberem minha conta agora.", "noNewInfo"),
  async (c) => {
    const r = await judgeEvidenceConsistency(c, {
      stageName: "Acabamento: revestimento, piso e louças",
      attachments: [{ kind: "photo", caption: "Piso do box assentado e rejuntado" }, { kind: "photo", caption: "Carro no elevador da oficina mecânica" }],
    });
    const got = r.value.items.map((i) => (i.consistent ? "1" : "0")).join("");
    return { judgment: "evidenceConsistency", caseName: "foto estranha", expected: "10", got, confidence: r.confidence, routing: r.routing };
  },
  tacit("aprova", "Ficou ótimo, pode liberar o pagamento.", "approve"),
  tacit("ressalva", "Aprovo, só falta trocar um espelho de tomada torto depois.", "approveWithReservation"),
  tacit("rejeita", "Não aprovo. O chuveiro não liga, precisa refazer antes.", "reject"),
  tacit("ambígua", "Vou dar uma olhada no fim de semana.", "ambiguous"),
  coverage(
    "completa",
    "Revestimento das paredes aplicado, piso assentado e rejuntado, vaso, pia e metais instalados. Nota fiscal anexada.",
    ["Parede com revestimento novo", "Piso rejuntado", "Louças instaladas", "Nota fiscal dos materiais"],
    "1111",
  ),
  coverage(
    "sem nota",
    "Revestimento e piso concluídos, louças instaladas e testadas. A nota fiscal envio semana que vem.",
    ["Parede com revestimento novo", "Piso rejuntado", "Louças instaladas"],
    "1110",
  ),
  reason("qualidade + sumiu", "O chuveiro elétrico não liga e o quadro foi instalado diferente do combinado. O prestador não responde há 4 dias.", "deliveryQuality+unresponsive"),
  reason("atraso", "A etapa deveria ter terminado dia 10 e até agora não começaram as instalações.", "delay"),
  reason("abandono", "Os pedreiros tiraram o piso, deixaram o entulho e não voltaram mais. Ninguém atende o telefone.", "abandonment+unresponsive"),
  intent("aprovar", "quero liberar a segunda etapa da reforma", "approveStage:AV-2026-001"),
  intent("extrato", "quanto ainda tenho de limite?", "viewStatement"),
  intent("pagar pintor", "e pagar o pintor também", "pay:AV-2026-014"),
  intent("financiar", "quero financiar a reforma da cozinha em 12 vezes", "requestCredit"),
  async (c) => {
    const r = await judgeEvidenceSufficiency(c, {
      reason: "deliveryQuality",
      parties: [
        { party: "client", statement: "O quadro foi instalado diferente do projeto e o chuveiro não liga.", evidence: ["Foto do quadro elétrico ao lado do projeto aprovado", "Vídeo do chuveiro sem ligar"] },
        { party: "provider", statement: "Instalei tudo conforme o projeto e testei.", evidence: ["Foto da parede fechada"] },
      ],
    });
    const got = r.value.map((p) => (p.sufficient ? "1" : "0")).join("");
    return { judgment: "evidenceSufficiency", caseName: "provas desiguais", expected: "10", got, confidence: r.confidence, routing: r.routing };
  },
  async (c) => {
    const r = await judgeExpertInspection(c, { summary: "Contratante diz que a fiação do quadro está subdimensionada; prestador diz que segue a norma." });
    return { judgment: "expertInspection", caseName: "elétrica técnica", expected: "true", got: String(r.value), confidence: r.confidence, routing: r.routing };
  },
  async (c) => {
    const r = await judgeExpertInspection(c, { summary: "Contratante diz que a etapa foi entregue 5 dias depois do prazo combinado no contrato." });
    return { judgment: "expertInspection", caseName: "só prazo", expected: "false", got: String(r.value), confidence: r.confidence, routing: r.routing };
  },
  async (c) => {
    const r = await judgeSuggestedStages(c, { description: AV_2026_001.description, totalCents: AV_2026_001.totalCents });
    const got = String(r.value.stages.length);
    return { judgment: "suggestedStages", caseName: "banheiro (3 etapas)", expected: "3", got, confidence: r.confidence, routing: r.routing };
  },
  async (c) => {
    const r = await judgeFraudSignals(c, { accountName: "Paulo Reis", documentName: "Paulo Reis", serviceText: "Reformas em geral. Pague por fora no meu Pix pessoal hoje para garantir o desconto." });
    return { judgment: "fraudSignals", caseName: "Pix por fora + urgência", expected: "offPlatformPayment,urgencyPressure", got: r.value.present.join(","), confidence: r.confidence, routing: r.routing };
  },
  async (c) => {
    const r = await judgeReviewModeration(c, { comment: "Obra limpa e no prazo. Teve um problema no quadro, resolvido na mediação." });
    return { judgment: "reviewModeration", caseName: "comentário limpo", expected: "true", got: String(r.value.publishable), confidence: r.confidence, routing: r.routing };
  },
  async (c) => {
    const r = await judgeReviewModeration(c, { comment: "Bando de incompetentes, liguem para 11 98888-7777 e reclamem." });
    return { judgment: "reviewModeration", caseName: "ofensa + telefone", expected: "false", got: String(r.value.publishable), confidence: r.confidence, routing: r.routing };
  },
  async (c) => {
    const r = await judgeQueuePriority(c, { summary: "Obra abandonada com fiação exposta no banheiro.", hoursToDeadline: 24 });
    return { judgment: "queuePriority", caseName: "crítico", expected: ">=2.5", got: r.value.severity.toFixed(2), confidence: r.confidence, routing: r.routing };
  },
];

async function main(): Promise<void> {
  const client = createJevClient();
  const rows = await Promise.all(CASES.map((run) => run(client)));
  const correct = (r: Row) => (r.expected.startsWith(">=") ? Number(r.got) >= Number(r.expected.slice(2)) : r.got === r.expected);
  console.table(
    rows.map((r) => ({ ...r, confidence: Number(r.confidence.toFixed(2)), ok: correct(r) ? "sim" : "NÃO" })),
  );
  const hits = rows.filter(correct).length;
  console.log(`Acertos: ${hits}/${rows.length}`);
  const wrongButAutomatic = rows.filter((r) => !correct(r) && r.routing === "automatic");
  console.log(`Erros que passariam sem revisão humana: ${wrongButAutomatic.length}`);
}

main().catch((error: unknown) => {
  if (error instanceof AuthenticationError) {
    console.error("Jev rejected the API key. Check TYPESAFE_API_KEY in .env.");
  } else {
    console.error("Evaluation failed:", error);
  }
  process.exitCode = 1;
});
