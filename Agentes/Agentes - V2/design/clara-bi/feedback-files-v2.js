/* CLONE_SOURCES: dashboard */
/* COMMON */
const page=await figma.getNodeByIdAsync(STATE.foundations.pages.prototype);await figma.setCurrentPageAsync(page);
/* UI */
/* V2_UI */
/* FEEDBACK_UI */
const h=await feedback('exportHTML','Apresentação preparada','3 páginas para apresentar sem internet.','CLARA-apresentacao.html · Snapshot dos dados e configurações. Este estado ilustra a conclusão da exportação no protótipo.','presentation');
const p=await modalV2('exportPDF','Imprimir ou salvar como PDF',624);await txt(p.box,'Página ativa · Visão executiva','Section');await txt(p.box,'Na aplicação, esta ação abre a impressão do navegador. Escolha “Salvar como PDF” para guardar o dashboard.','Body','muted',p.w);await notice(p.box,'Configuração de impressão','A4 · Paisagem · Margens de 10 mm · Apenas a análise e sua fonte.',p.w);await button(p.box,'Concluir prévia de impressão','Primary','Check','dashboard',p.w);centerModal(p);return resultV2([h,p]);
