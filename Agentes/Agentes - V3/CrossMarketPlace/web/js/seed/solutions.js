// Synthetic catalog. Compact rows are expanded by buildSolutions() with ratings, versions and history.
import { DETAILS } from "./details.js";

// [id, name, category, team, owner, access, approval, lifecycle, version, updatedAt, [views, interests, confirmed, hours], [avg, n], tags, summary, archived?]
const ROWS = [
  ["leitor-contratos", "Leitor de Contratos", "agentes", "juridico", "u-ar", "direto", "aprovada", "producao", "v2.3.0", "2026-10-04", [9870, 2310, 1204, 640], [4.8, 32], ["ocr", "genai", "jurídico"], "Extrai cláusulas, prazos e riscos de contratos em PDF e devolve um resumo estruturado."],
  ["revisor-minutas", "Revisor de Minutas", "agentes", "juridico", "u-cm", "autorizacao", "aprovada", "producao", "v1.6.0", "2026-09-28", [3100, 820, 540, 260], [4.6, 18], ["genai", "jurídico", "llm"], "Compara minutas com o padrão do banco e sugere ajustes de cláusulas com justificativa."],
  ["score-liquidez", "Score de Liquidez Intradiário", "apis", "risco", "u-jb", "autorizacao", "aprovada", "piloto", "v1.4.0", "2026-09-22", [2400, 700, 310, 410], [4.5, 11], ["risco", "tempo-real", "rest"], "Endpoint REST que calcula a liquidez de carteiras em tempo real, com histórico de 90 dias."],
  ["conciliacao-d0", "Conciliação D+0", "automacoes", "ops", "u-fr", "direto", "aprovada", "producao", "v3.1.0", "2026-10-06", [12400, 3300, 2100, 1820], [4.9, 54], ["rpa", "backoffice", "contábil"], "Robô que concilia extratos com o razão contábil e aponta divergências antes do fechamento."],
  ["var-engine", "VaR Engine", "bibliotecas", "risco", "u-jb", "autorizacao", "aprovada", "producao", "v3.2.1", "2026-10-03", [4100, 1300, 920, 1500], [4.8, 26], ["risco", "var", "python"], "Biblioteca Python para cálculo de VaR histórico, paramétrico e Monte Carlo por carteira."],
  ["simulador-cenarios", "Simulador de Cenários de Estresse", "modelos", "risco", "u-ct", "direto", "aprovada", "producao", "v2.1.0", "2026-09-05", [2200, 610, 280, 560], [4.6, 14], ["risco", "estresse", "cenários"], "Gera cenários de estresse históricos e hipotéticos para as carteiras da mesa."],
  ["monitor-limites", "Monitor de Limites de Risco", "dashboards", "risco", "u-rd", "direto", "aprovada", "producao", "v1.8.0", "2026-09-02", [1900, 400, 190, 380], [4.4, 9], ["risco", "limites", "bi"], "Painel que acompanha o consumo de limites de risco por mesa, com alertas de estouro."],
  ["greeks", "Calculadora de Greeks", "bibliotecas", "risco", "u-ct", "direto", "aprovada", "producao", "v4.0.2", "2026-08-10", [1300, 300, 140, 270], [4.7, 8], ["derivativos", "opções", "python"], "Calcula delta, gama, vega e theta de opções listadas e de balcão."],
  ["curvas-juros", "Construtor de Curvas de Juros", "bibliotecas", "risco", "u-lf", "direto", "aprovada", "producao", "v2.5.0", "2026-09-14", [1500, 420, 240, 330], [4.6, 11], ["juros", "curvas", "python"], "Monta curvas de juros pré, DI e cupom cambial a partir dos dados de mercado do dia."],
  ["alertas-mercado", "Alertas de Mercado", "automacoes", "risco", "u-mg", "direto", "aprovada", "piloto", "v1.1.0", "2026-09-08", [1200, 380, 160, 140], [4.3, 7], ["mercado", "alertas", "risco"], "Avisa a mesa no Teams quando preços e volatilidades saem das faixas definidas."],
  ["stress-bot", "Stress Test Bot", "agentes", "risco", "u-jb", "autorizacao", "em_analise", "piloto", "v0.9.0", "2026-10-06", [0, 0, 0, 0], [0, 0], ["risco", "stress-test", "genai", "mercado"], "Gera cenários de estresse com IA a partir das notícias do dia e calcula o impacto nas carteiras."],
  ["painel-liquidez-v2", "Painel de Liquidez v2", "dashboards", "risco", "u-rd", "direto", "correcao", "piloto", "v2.0.0", "2026-10-05", [0, 0, 0, 0], [0, 0], ["liquidez", "bi", "tesouraria"], "Nova versão do painel de liquidez com visão por moeda e projeção de 30 dias."],
  ["backtest", "Backtest Automático", "automacoes", "risco", "u-bs", "direto", "rascunho", "experimental", "v0.3.0", "2026-10-02", [0, 0, 0, 0], [0, 0], ["backtest", "python", "risco"], "Executa o backtest diário dos modelos de VaR e gera o relatório regulatório."],
  ["stress-engine", "Stress Test Engine", "bibliotecas", "risco", "u-ct", "direto", "aprovada", "descontinuada", "v1.2.0", "2026-03-15", [900, 120, 60, 40], [4.1, 6], ["risco", "estresse", "legado"], "Motor antigo de testes de estresse, substituído pelo Simulador de Cenários.", true],
  ["extrator-garantias", "Extrator de Garantias", "automacoes", "credito", "u-rn", "direto", "aprovada", "producao", "v2.0.1", "2026-09-21", [3500, 1100, 860, 900], [4.7, 21], ["rpa", "crédito", "ocr"], "Lê contratos de crédito e cadastra as garantias no sistema de colaterais automaticamente."],
  ["monitor-vencimentos", "Monitor de Vencimentos", "automacoes", "ops", "u-fr", "direto", "aprovada", "producao", "v1.9.0", "2026-10-01", [5200, 1900, 1600, 1100], [4.8, 40], ["rpa", "alertas", "compras"], "Avisa os responsáveis 30, 15 e 5 dias antes do vencimento de contratos com fornecedores."],
  ["classificador-cambio", "Classificador de Câmbio", "agentes", "cambio", "u-gs", "autorizacao", "aprovada", "producao", "v1.2.0", "2026-09-12", [1100, 300, 220, 180], [4.4, 9], ["câmbio", "compliance", "genai"], "Classifica contratos de câmbio por natureza e aponta inconsistências regulatórias."],
  ["clausulas-esg", "Assistente de Cláusulas ESG", "agentes", "sustentabilidade", "u-hm", "direto", "aprovada", "producao", "v1.0.3", "2026-09-18", [800, 260, 140, 120], [4.5, 7], ["esg", "genai", "crédito"], "Identifica cláusulas socioambientais em contratos de financiamento e gera um checklist."],
  ["copiloto-credito", "Copiloto de Crédito PJ", "agentes", "credito", "u-rn", "autorizacao", "aprovada", "producao", "v2.2.0", "2026-10-03", [6100, 2200, 1500, 1300], [4.7, 38], ["crédito", "genai", "pj"], "Prepara o dossiê de crédito de empresas com dados internos, balanços e notícias."],
  ["painel-inadimplencia", "Painel de Inadimplência", "dashboards", "bi", "u-jp", "autorizacao", "aprovada", "producao", "v3.0.0", "2026-09-29", [4800, 1500, 1100, 600], [4.4, 22], ["bi", "inadimplência", "varejo"], "Acompanha a inadimplência por produto, safra e região, com abertura por cliente."],
  ["motor-precificacao", "Motor de Precificação PJ", "apis", "credito", "u-rn", "autorizacao", "aprovada", "producao", "v5.1.0", "2026-09-10", [2900, 900, 700, 450], [4.6, 15], ["precificação", "crédito", "rest"], "API que calcula taxa e spread de operações PJ a partir do risco e do custo de captação."],
  ["painel-churn", "Painel de Churn PJ", "dashboards", "bi", "u-jp", "direto", "em_analise", "piloto", "v1.0.0", "2026-10-05", [0, 0, 0, 0], [0, 0], ["churn", "bi", "pj"], "Mostra a probabilidade de saída de clientes PJ e os principais motivos por segmento."],
  ["api-cotacoes-fx", "API de Cotações FX", "apis", "cambio", "u-gs", "direto", "em_analise", "piloto", "v0.8.0", "2026-10-03", [0, 0, 0, 0], [0, 0], ["câmbio", "cotações", "rest"], "Cotações de câmbio intradiárias consolidadas de três provedores, com latência abaixo de 1 s."],
  ["ocr-documentos", "OCR de Documentos Pessoais", "apis", "ops", "u-fr", "direto", "aprovada", "producao", "v4.2.0", "2026-09-25", [7200, 2600, 2300, 1400], [4.6, 47], ["ocr", "kyc", "rest"], "Lê RG, CNH e comprovantes de endereço e devolve os campos validados para o cadastro."],
  ["detector-fraude-pix", "Detector de Fraude em Pix", "modelos", "fraudes", "u-vs", "autorizacao", "aprovada", "producao", "v3.4.0", "2026-09-30", [3900, 1400, 980, 760], [4.7, 24], ["fraude", "pix", "ml"], "Modelo que pontua o risco de fraude de cada Pix em menos de 100 ms."],
  ["classificador-emails", "Classificador de E-mails de Clientes", "agentes", "ops", "u-fr", "direto", "aprovada", "piloto", "v0.9.5", "2026-09-27", [2100, 900, 430, 390], [4.3, 12], ["genai", "atendimento", "nlp"], "Classifica e prioriza e-mails de clientes e sugere a resposta para o atendente."],
  ["previsao-caixa", "Previsão de Caixa Diária", "modelos", "tesouraria", "u-pl", "autorizacao", "aprovada", "producao", "v2.0.0", "2026-08-30", [1600, 500, 310, 300], [4.5, 10], ["tesouraria", "previsão", "ml"], "Prevê entradas e saídas de caixa dos próximos 10 dias úteis por moeda."],
  ["leitor-balancos", "Leitor de Balanços", "agentes", "credito", "u-ms", "direto", "aprovada", "experimental", "v0.4.0", "2026-10-02", [900, 380, 90, 70], [4.2, 5], ["genai", "crédito", "ocr"], "Extrai DRE e balanço patrimonial de PDFs e calcula os principais índices."],
];

/** Deterministic ratings whose average matches the target. */
function makeRatings(avg, n, id) {
  const [top, low, floor] = avg >= 4 ? [5, 4, 4] : [4, 3, 3];
  const highCount = Math.round(n * (avg - floor));
  return Array.from({ length: n }, (_, i) => ({ userId: `r-${id}-${i}`, stars: i < highCount ? top : low, comment: "", at: "2026-09-01" }));
}

function makeVersions(version, updatedAt, ownerId) {
  const [major, minor] = version.replace("v", "").split(".").map(Number);
  const list = [{ version, note: "Versão atual", date: updatedAt, by: ownerId }];
  if (minor > 0) list.push({ version: `v${major}.${minor - 1}.0`, note: "Melhorias de desempenho e correções", date: "2026-06-15", by: ownerId });
  if (major > 1) list.push({ version: `v${major - 1}.0.0`, note: "Primeira publicação aprovada", date: "2026-02-10", by: ownerId });
  return list;
}

const FIRST_REVIEW = (ownerId, approval) => [
  { at: "2026-01-15", by: ownerId, from: "rascunho", to: "em_analise", note: "" },
  ...(approval === "aprovada" ? [{ at: "2026-01-20", by: "u-al", from: "em_analise", to: "aprovada", note: "" }] : []),
  ...(approval === "correcao" ? [{ at: "2026-10-05", by: "u-al", from: "em_analise", to: "correcao", note: "Anexe o manual de uso atualizado com a visão por moeda." }] : []),
];

export function buildSolutions() {
  return ROWS.map(([id, name, category, teamId, ownerId, access, approval, lifecycle, version, updatedAt, [views, interests, confirmed, hrs], [avg, n], tags, summary, archived = false]) => ({
    id, name, summary, category, tags, teamId, ownerId, access, approval, lifecycle, version, updatedAt, archived,
    submittedAt: ["em_analise", "correcao"].includes(approval) ? updatedAt : null,
    usage: { views, interests, confirmed, hours: hrs },
    ratings: makeRatings(avg, n, id),
    uses: [],
    versions: makeVersions(version, updatedAt, ownerId),
    history: approval === "rascunho" ? [] : FIRST_REVIEW(ownerId, approval),
    ...(DETAILS[id] ?? {}),
  }));
}
