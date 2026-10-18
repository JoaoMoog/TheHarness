/* COMMON */
await figma.setCurrentPageAsync(await figma.getNodeByIdAsync('0:1'));
/* TOPNAV_UI */
/* TASTE_UI */
const library=await improve('library');const root=await figma.getNodeByIdAsync(STATE.screens.library);
const list=root.clone();figma.currentPage.appendChild(list);list.name='Dashboards · Visualização em lista';list.x=Math.max(...figma.currentPage.children.filter(n=>n.type==='FRAME'&&n.id!==list.id).map(n=>n.x+n.width))+240;list.y=240;ids.push(...allIds(list));tasteScreens.libraryList=list.id;
const destinations=Object.fromEntries(Object.entries(STATE.screens).map(([k,id])=>[id,k]));for(const n of [list,...list.findAll(()=>true)])if('reactions'in n)for(const r of n.reactions)for(const a of r.actions||[])if(a.type==='NODE'&&destinations[a.destinationId])target(n,destinations[a.destinationId],r.trigger?.type||'ON_CLICK');
drop(root.findOne(n=>n.name==='Todos os dashboards'&&n.type==='FRAME'));drop(list.findOne(n=>n.name==='Dashboards salvos'));
for(const [screen,active]of [[root,'Cartões'],[list,'Lista']]){const rowFilter=screen.findOne(n=>n.name==='Pesquisa e organização');const views=row(rowFilter,'Modo de visualização',180,4,0,'subtle');radius(views,'control');for(const [label,key]of [['Cartões','library'],['Lista','libraryList']]){const b=await button(views,label,label===active?'Secondary':'Ghost',label==='Cartões'?'LayoutGrid':'List',key);if(label===active){fill(b,'surface');b.strokes=[];}b.layoutSizingHorizontal='HUG';}views.primaryAxisSizingMode='AUTO';views.layoutSizingHorizontal='HUG';reflow(views);reflow(rowFilter);const content=screen.findOne(n=>n.name==='Conteúdo principal');reflow(content);reflow(screen);}
const home=await figma.getNodeByIdAsync(STATE.screens.home);const card=home.findOne(n=>n.type==='FRAME'&&n.name==='Composição das despesas');const thumb=card.findOne(n=>n.name==='Miniatura editável do dashboard');for(const c of [...thumb.children])if(c.name==='Evolução das despesas')drop(c);
return {createdNodeIds:[...new Set(ids)],mutatedNodeIds:[...touched],removedNodeIds:removed,screens:tasteScreens,links,changed:[library,{key:'libraryList',id:list.id,view:'Lista'}]};
