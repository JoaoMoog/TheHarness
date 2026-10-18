/* COMMON */
await figma.setCurrentPageAsync(await figma.getNodeByIdAsync('2:2'));
const foundationValues={'palette/canvas':'#F5F7FA','color/canvas':'#F5F7FA','palette/line':'#E1E7EF','color/line':'#E1E7EF'};
const updatedVariables=[];
for(const k of ['palette/canvas','palette/line']){const v=V[k];for(const mode of Object.keys(v.valuesByMode))v.setValueForMode(mode,rgb(foundationValues[k]));updatedVariables.push(v.id);}
for(const key of ['Button/Ghost/Default','Button/Ghost/Hover']){const c=await figma.getNodeByIdAsync(STATE.components[key]);for(const t of c.children.filter(n=>n.type==='TEXT')){for(const s of t.getStyledTextSegments(['fontName']))await figma.loadFontAsync(s.fontName);t.fills=[paint(key.endsWith('/Hover')?'action':'muted')];mutated.push(t.id);}c.description='Ação complementar: contraste moderado em repouso, destaque azul no hover; mantenha a ação principal no botão Primary.';mutated.push(c.id);}
return {createdNodeIds:[],mutatedNodeIds:mutated,removedNodeIds:[],updatedVariables,foundationValues,changes:['Neutros mais uniformes','Ações complementares com peso visual menor']};
