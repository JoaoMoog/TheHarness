/* COMMON */
const page=await figma.getNodeByIdAsync(STATE.foundations.pages.prototype);await figma.setCurrentPageAsync(page);
/* UI */
/* V2_UI */
/* EDITOR_UI */
const a=await buildEditorV2('editorUpdated',{reused:true,tab:'Aparência',updated:true,chart:'Chart/CostCentersHighlight',title:'Despesas · desvios destacados'});
return resultV2([a]);
