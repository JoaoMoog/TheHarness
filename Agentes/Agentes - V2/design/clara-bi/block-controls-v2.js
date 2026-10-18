/* CLONE_SOURCES: editor */
/* COMMON */
const page=await figma.getNodeByIdAsync(STATE.foundations.pages.prototype);await figma.setCurrentPageAsync(page);
/* UI */
/* V2_UI */
const d=await modalV2('duplicateBlock','Duplicar componente',600,'editor');await txt(d.box,'Despesas por centro de custo','Section');await field(d.box,'Nome da cópia','Despesas por centro · cópia',d.w,null,'Pencil');await txt(d.box,'A cópia mantém a fonte, os critérios e a aparência e é adicionada ao fim desta página.','Body','muted',d.w);await button(d.box,'Criar cópia','Primary','Copy','editorDuplicated',d.w);await button(d.box,'Cancelar','Ghost',null,'editor',d.w);centerModal(d);
const r=await modalV2('removeBlock','Remover este componente?',600,'editor');await txt(r.box,'Despesas por centro de custo','Section');await txt(r.box,'Os outros blocos e a fonte permanecem disponíveis. Você pode desfazer a remoção no editor.','Body','muted',r.w);const f=row(r.box,'Confirmar remoção',r.w,12);space(f);await button(f,'Cancelar','Secondary',null,'editor');await button(f,'Remover componente','Primary','Trash2','editorRemoved');centerModal(r);return resultV2([d,r]);
