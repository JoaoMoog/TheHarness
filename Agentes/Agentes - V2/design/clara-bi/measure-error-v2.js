/* CLONE_SOURCES: editor */
/* COMMON */
const page=await figma.getNodeByIdAsync(STATE.foundations.pages.prototype);await figma.setCurrentPageAsync(page);
/* UI */
/* V2_UI */
const m=await modalV2('measureError','Corrigir fórmula',660,'editor');await field(m.box,'Nome','Custo por colaborador',m.w,null,'Pencil');await field(m.box,'Fórmula','realizado / colaboradores',m.w,null,'Pencil');await notice(m.box,'Parâmetro não encontrado','Defina colaboradores em Parâmetros ou escolha uma fórmula que utilize os campos da fonte.',m.w,'Warning');await txt(m.box,'Não há quantidade de colaboradores nesta fonte. A medida não pode ser calculada com os dados disponíveis.','Body','muted',m.w);const f=row(m.box,'Ações da fórmula',m.w,12);await button(f,'Usar fórmula Saldo','Primary','Check','measureValidated');await button(f,'Voltar','Secondary','ArrowLeft','measures');centerModal(m);return resultV2([m]);
