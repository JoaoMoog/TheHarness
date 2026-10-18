/* COMMON */
const page=await figma.getNodeByIdAsync(STATE.foundations.pages.prototype);await figma.setCurrentPageAsync(page);
/* UI */
/* V2_UI */
/* EDITOR_UI */
const e=await buildEditorV2('editor',{reused:true});
return resultV2([e]);
