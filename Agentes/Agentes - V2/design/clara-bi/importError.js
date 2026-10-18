/* COMMON */
const page=await figma.getNodeByIdAsync(STATE.foundations.pages.prototype);await figma.setCurrentPageAsync(page);
/* UI */
/* MODAL_UI */
const error=await modal('importError','Confira o arquivo antes de importar');await icon(error.box,'CircleAlert',32,'warning');await txt(error.box,'Não foi possível identificar os valores','Section','text',error.w);await txt(error.box,'O arquivo de exemplo não contém uma coluna de valores reconhecida. Inclua um campo numérico para a análise e tente novamente.','Body','muted',error.w);await txt(error.box,'Exemplo de colunas: competência, centro de custo e valor realizado.','Small','muted',error.w);const ar=row(error.box,'Recuperar importação',error.w,12);await button(ar,'Escolher outro arquivo','Secondary','Upload','import');space(ar);await button(ar,'Usar a demonstração','Primary','ArrowRight','create');return {createdNodeIds:[...new Set(ids)],screens,links,evidence:[evidence(error.root)]};
