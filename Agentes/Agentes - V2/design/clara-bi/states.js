/* COMMON */
const page=await figma.getNodeByIdAsync(STATE.foundations.pages.prototype);await figma.setCurrentPageAsync(page);
/* UI */
/* MODAL_UI */
const filtered=await screen('filtered','17 · Dashboard filtrado — Tecnologia','library');await dashboardContent(filtered.content,filtered.w,{filtered:true});
const savedSource=await figma.getNodeByIdAsync(STATE.screens.dashboard);const saved=savedSource.clone();page.appendChild(saved);ids.push(...allIds(saved));saved.name='18 · Dashboard salvo — Confirmação';pos(saved,240+(screenIndex%3)*1640,240+Math.floor(screenIndex/3)*1200);screenIndex++;screens.saved=saved.id;const toast=row(saved,'Dashboard salvo',400,12,16,'surface');toast.layoutPositioning='ABSOLUTE';pos(toast,760,920);stroke(toast,'success');radius(toast);await icon(toast,'CircleCheck',24,'success');await txt(toast,'Dashboard salvo na sua biblioteca','BodyStrong','text',324);target(toast,'library');
const ready=await modal('exportReady','Exportação preparada');await icon(ready.box,'CircleCheck',32,'success');await txt(ready.box,'despesas-e-orcamento.csv','Section');await txt(ready.box,'Valores por centro de custo · 4 linhas\nFonte: Financeiro demonstrativo\nPeríodo: janeiro a junho de 2026','Body','muted',ready.w);await button(ready.box,'Concluir','Primary','Check','dashboard');
return {createdNodeIds:[...new Set(ids)],screens,links,evidence:[evidence(filtered.root),evidence(saved),evidence(ready.root)]};
