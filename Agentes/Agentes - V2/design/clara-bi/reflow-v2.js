/* COMMON */
const page=await figma.getNodeByIdAsync(STATE.foundations.pages.prototype);await figma.setCurrentPageAsync(page);
/* UI */
/* V2_UI */
for(const n of page.findAllWithCriteria({types:['FRAME']}))if(['Navegação principal','Gráficos do dashboard','Canvas do dashboard','Membros do Workspace Financeiro','Conteúdo principal'].includes(n.name)&&n.layoutMode!=='NONE'){const gap=n.itemSpacing;n.itemSpacing=gap+1;n.itemSpacing=gap;bind(n,'itemSpacing','space/'+gap);mutated.push(n.id);}
return resultV2([],{fixed:['Refluxo dos itens inseridos na navegação','Ordem visual dos gráficos','Canvas com conteúdo inserido']});
