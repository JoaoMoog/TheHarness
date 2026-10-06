// Rich content for the solutions most used in the demo. Others fall back to generic text in the detail screen.
export const DETAILS = {
  "leitor-contratos": {
    purpose: "Reduz o tempo de leitura de contratos extensos. O agente identifica cláusulas relevantes, prazos, multas e garantias, classifica o risco de cada ponto e devolve um resumo que o jurídico revisa em minutos.",
    problems: ["Leitura manual de contratos de 40+ páginas, que levava horas por documento", "Prazos e multas perdidos por falta de controle centralizado", "Retrabalho entre áreas que analisavam o mesmo contrato"],
    applications: [["Due diligence de M&A", "Triagem de centenas de contratos em data rooms."], ["Contratos com fornecedores", "Checagem de multas, reajustes e renovação automática."], ["Crédito estruturado", "Leitura de covenants e garantias antes do comitê."]],
    howTo: ["Envie o PDF pela aplicação web ou pela API", "Escolha o modelo de análise: contrato padrão, crédito ou fornecedores", "Revise o resumo e exporte para o sistema do jurídico"],
    code: 'POST https://api.interno.btg/juridico/contratos/v2/analisar\nAuthorization: Bearer <token-sso>\n\n{ "arquivo": "contrato.pdf", "modelo": "fornecedores" }',
    links: { repo: "git.btg/juridico/leitor-contratos", app: "leitor-contratos.btg.intranet", endpoint: "/juridico/contratos/v2/analisar", docs: "Manual de uso · PDF · 2,4 MB" },
    contacts: ["u-ar", "u-cm"],
    reviews: [{ who: "Marina Costa · Compras", stars: 5, text: "Reduziu de 3 horas para 20 minutos a revisão dos contratos de fornecedores." }],
  },
  "stress-bot": {
    purpose: "Gera cenários de estresse com IA a partir das notícias do dia e calcula o impacto nas carteiras da mesa.",
    links: { repo: "git.btg/risco-quant/stress-test-bot", app: "", endpoint: "api.interno.btg/risco/stress-test/v1", docs: "manual-stress-test-bot.pdf · 1,8 MB" },
    docs: [{ name: "manual-stress-test-bot.pdf", size: "1,8 MB" }, { name: "arquitetura.png", size: "640 KB" }],
    similarityNote: "O bot gera cenários com IA a partir de notícias do dia; os outros usam só cenários históricos.",
    contacts: ["u-jb"],
  },
  "score-liquidez": {
    purpose: "Calcula, a cada 5 minutos, um score de liquidez para cada carteira da mesa, combinando volume negociado, spread e concentração.",
    howTo: ["Peça acesso e aguarde a aprovação do responsável", "Gere um token SSO no portal de APIs", "Chame o endpoint com o código da carteira"],
    code: "GET https://api.interno.btg/risco/liquidez/v1/carteiras/{codigo}/score",
    links: { repo: "git.btg/risco-quant/score-liquidez", app: "", endpoint: "/risco/liquidez/v1/carteiras/{codigo}/score", docs: "Guia da API · PDF · 900 KB" },
    contacts: ["u-jb", "u-ct"],
  },
};
