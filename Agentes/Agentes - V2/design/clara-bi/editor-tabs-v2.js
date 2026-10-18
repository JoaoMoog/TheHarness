/* COMMON */
const page=await figma.getNodeByIdAsync(STATE.foundations.pages.prototype);await figma.setCurrentPageAsync(page);
/* UI */
/* V2_UI */
/* EDITOR_UI */
const a=await buildEditorV2('editorAppearance',{tab:'Aparência'});const i=await buildEditorV2('editorInteractions',{tab:'Interações'});return resultV2([a,i]);
