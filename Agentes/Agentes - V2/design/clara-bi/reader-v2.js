/* COMMON */
const page=await figma.getNodeByIdAsync(STATE.foundations.pages.prototype);await figma.setCurrentPageAsync(page);
/* UI */
/* V2_UI */
const reader=await dashboardV2(await screen('reader','Dashboard compartilhado · Leitor','library'),{reader:true});for(const l of links)if(l.root===reader.root.id){if(l.key==='editor'||l.key==='aiWorkbench')l.key='assistant';if(l.key==='share')l.key='shareReader';if(l.key==='versions')l.key='history';}const name=reader.root.findOne(n=>n.type==='FRAME'&&n.name==='Perfil João Bahia');name.name='Perfil Gabriel Costa · Leitor';const initials=name.findOne(n=>n.type==='TEXT');initials.characters='GC';mutated.push(name.id,initials.id);
const n=await screen('noAccess','Acesso · Análise não encontrada','home');await txt(n.content,'Não encontramos esta análise','Page','text',n.w);await notice(n.content,'Verifique o endereço e sua conta','Entre com a conta vinculada ao workspace. Se o link estiver correto, consulte o administrador da sua área.',n.w,'Warning');await button(n.content,'Ir para o início','Primary','House','home');return resultV2([reader,n]);
