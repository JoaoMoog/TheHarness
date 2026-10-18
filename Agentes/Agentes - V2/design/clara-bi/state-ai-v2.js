/* CLONE_SOURCES: editorUpdated,aiEdit */
/* COMMON */
const page=await figma.getNodeByIdAsync(STATE.foundations.pages.prototype);await figma.setCurrentPageAsync(page);
/* UI */
/* V2_UI */
const applied=await cloneScreen('aiApplied','editorUpdated','Editor · Alteração da IA aplicada');const caption=applied.findOne(n=>n.type==='TEXT'&&n.characters.startsWith('Alteração aplicada'));caption.characters='IA aplicada a 1 gráfico · Você pode desfazer · Salve para atualizar';mutated.push(caption.id);
const thinking=await cloneScreen('aiThinking','aiEdit','CLARA IA · Conferindo a solicitação');const response=thinking.findOne(n=>n.type==='FRAME'&&n.name==='Resposta fundamentada da IA');clear(response);await icon(response,'LoaderCircle',28,'action');await txt(response,'Conferindo dados e preparando a prévia…','BodyStrong','text',430);await txt(response,'Fonte, critérios e seleção acompanham este pedido.','Body','muted',430);target(thinking,'aiChange','AFTER_TIMEOUT');const send=thinking.findOne(n=>n.type==='INSTANCE'&&Object.values(n.componentProperties).some(p=>p.type==='TEXT'&&p.value==='Enviar'));const prop=Object.keys(send.componentProperties).find(k=>k.startsWith('Label#'));send.setProperties({[prop]:'Cancelar'});mutated.push(send.id);target(send,'aiEdit');return resultV2([applied,thinking]);
