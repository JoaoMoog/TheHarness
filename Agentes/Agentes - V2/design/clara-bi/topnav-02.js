/* COMMON */
await figma.setCurrentPageAsync(await figma.getNodeByIdAsync('0:1'));
/* TOPNAV_UI */
const changed=[];for(const key of ['editor','editorAppearance'])changed.push(await transform(key));
for(const key of ['dashboard','home','library']){const root=await figma.getNodeByIdAsync(STATE.screens[key]);await loadCurrentFonts(root);capture(root);for(const table of root.findAll(n=>n.type==='FRAME'&&n.layoutMode==='VERTICAL'&&n.children.some(c=>c.name==='Cabeçalho'))){const w=table.width-table.paddingLeft-table.paddingRight-2;for(const c of table.children)if(c.name==='Cabeçalho'||c.name.startsWith('Linha ')||c.name==='Divisor'||c.type==='TEXT')width(c,w);reflow(table);}}
return {createdNodeIds:[...new Set(ids)],mutatedNodeIds:[...touched],removedNodeIds:removed,links,changed};
