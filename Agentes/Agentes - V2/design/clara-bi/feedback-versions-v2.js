/* CLONE_SOURCES: dashboard */
/* COMMON */
const page=await figma.getNodeByIdAsync(STATE.foundations.pages.prototype);await figma.setCurrentPageAsync(page);
/* UI */
/* V2_UI */
/* FEEDBACK_UI */
const v=await feedback('versionSaved','Versão salva','Revisão executiva','O marco preserva estrutura, medidas, filtros e parâmetros desta análise. Você pode restaurá-lo no editor.','versions');
const t=await feedback('templateSaved','Modelo disponível para a equipe','Despesas e orçamento · 3 páginas','O modelo guarda a estrutura e as medidas. Ao reutilizar, escolha uma fonte e confira os critérios. Os dados de origem não são copiados.','create');return resultV2([v,t]);
