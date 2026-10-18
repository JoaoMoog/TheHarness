/* CLONE_SOURCES: dashboard */
/* COMMON */
const page=await figma.getNodeByIdAsync(STATE.foundations.pages.prototype);await figma.setCurrentPageAsync(page);
/* UI */
/* V2_UI */
/* FEEDBACK_UI */
const v=await feedback('scenarioSaved','Cenário salvo','Redução em Tecnologia · −5%','Economia simulada de R$ 160.500. O cenário preserva a hipótese para uma nova comparação com o original.','scenarioPreview');
const a=await modalV2('aiError','A IA não conseguiu concluir',624);await notice(a.box,'Seu trabalho foi preservado','Não foi possível concluir a solicitação. Tente novamente com o mesmo contexto.',a.w,'Warning');await txt(a.box,'Nenhuma alteração foi aplicada ao dashboard.','Body','muted',a.w);const f=row(a.box,'Recuperar solicitação',a.w,12);await button(f,'Voltar ao editor','Secondary','ArrowLeft','editor');await button(f,'Tentar novamente','Primary','Sparkles','aiThinking');centerModal(a);return resultV2([v,a]);
