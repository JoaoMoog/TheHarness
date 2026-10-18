const STATE=/* STATE */;
const LINKS=/* LINKS */;
const CLONES=/* CLONES */;
const page=await figma.getNodeByIdAsync(STATE.foundations.pages.prototype);await figma.setCurrentPageAsync(page);
const fontMap=new Map();for(const t of page.findAllWithCriteria({types:['TEXT']}))for(const s of t.getStyledTextSegments(['fontName']))fontMap.set(s.fontName.family+'|'+s.fontName.style,s.fontName);await Promise.all([...fontMap.values()].map(f=>figma.loadFontAsync(f)));
const roots=Object.fromEntries(Object.entries(STATE.screens).map(([k,id])=>[id,k]));const links=[...LINKS];const mutated=[],missing=[],byNode=new Map();
function rootOf(n){let r=n;while(r.parent&&r.parent.id!==page.id)r=r.parent;return r;}
for(const c of CLONES){for(const l of LINKS){const original=await figma.getNodeByIdAsync(l.id);if(!original||rootOf(original).id!==c.source)continue;let node=original,path=[];while(node.parent&&node.parent.id!==page.id){path.unshift(node.parent.children.findIndex(x=>x.id===node.id));node=node.parent;}let dest=await figma.getNodeByIdAsync(c.destination);for(const i of path){if(!dest||!('children'in dest)){dest=null;break;}dest=dest.children[i];}if(dest)links.push({...l,id:dest.id});}}
for(const l of links){const n=await figma.getNodeByIdAsync(l.id);if(!n){missing.push({id:l.id,key:l.key});continue;}const root=rootOf(n),rk=roots[root.id];let key=l.key;
if(key==='dashboard'){let p=n;while(p&&p.id!==root.id){if(p.name==='Composição das despesas'||p.name.startsWith('Linha 2 · Composição')){key='composition';break;}if(p.name==='Evolução do semestre'||p.name.startsWith('Linha 3 · Evolução')){key='evolution';break;}p=p.parent;}}
if(rk==='preview'&&key==='assistant')key='assistantDraft';if(rk==='filtered'&&key==='assistant')key='assistantFiltered';
if(rk==='assistantFiltered'){if(key==='dashboard')key='filtered';else if(key==='filtered')key='dashboard';}
if(rk==='assistantDraft'){if(key==='dashboard')key='preview';if(key==='filtered'){key=n.name.startsWith('Button')?'editor':'assistantDraft';if(n.name.startsWith('Button'))for(const t of n.findAllWithCriteria({types:['TEXT']})){if(t.characters==='Filtrar Tecnologia'){t.characters='Ajustar no editor';mutated.push(t.id);}}}}
const actions=key==='$back'?[{type:'BACK'}]:[{type:'NODE',destinationId:STATE.screens[key]||null,navigation:'NAVIGATE',transition:{type:'DISSOLVE',easing:{type:'EASE_OUT'},duration:.18},resetScrollPosition:true}];if(key!=='$back'&&!STATE.screens[key]){missing.push({id:n.id,key});continue;}if(key!=='$back'&&STATE.screens[key]===root.id)continue;const trigger=l.trigger==='AFTER_TIMEOUT'?{type:'AFTER_TIMEOUT',timeout:1.4}:{type:l.trigger||'ON_CLICK'};const reactions=byNode.get(n.id)||[];reactions.push({trigger,actions});byNode.set(n.id,reactions);
}
if(missing.length)throw Error('Destinos ausentes: '+JSON.stringify(missing));
for(const[id,reactions]of byNode){const n=await figma.getNodeByIdAsync(id);const unique=new Map(reactions.map(r=>[r.trigger.type,r]));await n.setReactionsAsync([...unique.values()]);mutated.push(id);}
page.flowStartingPoints=[{nodeId:STATE.screens.home,name:'CLARA · Visão geral'},{nodeId:STATE.screens.dashboard,name:'CLARA · Explorar dashboard'},{nodeId:STATE.screens.create,name:'CLARA · Criar com IA'},{nodeId:STATE.screens.editor,name:'CLARA · Editor visual'},{nodeId:STATE.screens.mobileDashboard,name:'CLARA · No celular'}];mutated.push(page.id);figma.viewport.scrollAndZoomIntoView([await figma.getNodeByIdAsync(STATE.screens.dashboard)]);
return {createdNodeIds:[],mutatedNodeIds:[...new Set(mutated)],screenCount:Object.keys(STATE.screens).length,interactiveNodes:byNode.size,flowStartingPoints:page.flowStartingPoints,missing,cloneCount:CLONES.length};
