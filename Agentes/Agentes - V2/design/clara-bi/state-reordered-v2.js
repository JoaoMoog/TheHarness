/* CLONE_SOURCES: editor */
/* COMMON */
const page=await figma.getNodeByIdAsync(STATE.foundations.pages.prototype);await figma.setCurrentPageAsync(page);
/* UI */
/* V2_UI */
const r=await cloneScreen('editorReordered','editor','Editor · Ordem dos blocos ajustada');const cr=r.findOne(n=>n.name==='Gráficos do dashboard');const selected=cr.children[1];cr.insertChild(0,selected);mutated.push(cr.id,selected.id);const caption=r.findOne(n=>n.type==='TEXT'&&n.characters==='Workspace Financeiro · Editor · 3 páginas');caption.characters='Ordem ajustada · Centro de custo antes da evolução';mutated.push(caption.id);return resultV2([r]);
