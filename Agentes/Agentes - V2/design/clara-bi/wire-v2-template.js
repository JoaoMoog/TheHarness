const SCREENS=/* SCREENS */;const LINKS=/* LINKS */;
const page=await figma.getNodeByIdAsync('0:1');await figma.setCurrentPageAsync(page);
const roots=Object.fromEntries(Object.entries(SCREENS).map(([k,id])=>[id,k]));const byNode=new Map(),mutated=[],removed=[],invalid=[];
function rootOf(n){let r=n;while(r.parent&&r.parent.id!==page.id)r=r.parent;return r;}
for(const l of LINKS){const n=await figma.getNodeByIdAsync(l.id);if(!n){removed.push(l.id);continue;}const root=rootOf(n),rk=roots[root.id];let key=l.key;
if(key==='dashboard'){let p=n;while(p&&p.id!==root.id){if(p.name==='Composição das despesas'||p.name.startsWith('Linha 2 · Composição')){key='composition';break;}if(p.name==='Evolução do semestre'||p.name.startsWith('Linha 3 · Evolução')){key='evolution';break;}p=p.parent;}}
if(rk==='preview'&&key==='assistant')key='assistantDraft';if(rk==='filtered'&&key==='assistant')key='assistantFiltered';if(rk==='assistantFiltered'){if(key==='dashboard')key='filtered';else if(key==='filtered')key='dashboard';}if(rk==='assistantDraft'){if(key==='dashboard')key='preview';if(key==='filtered')key='editor';}
if(key!=='$back'&&!SCREENS[key]){invalid.push({id:n.id,key});continue;}if(key!=='$back'&&SCREENS[key]===root.id)continue;
const actions=key==='$back'?[{type:'BACK'}]:[{type:'NODE',destinationId:SCREENS[key],navigation:'NAVIGATE',transition:{type:'DISSOLVE',easing:{type:'EASE_OUT'},duration:.18},resetScrollPosition:true}];const reaction={trigger:l.trigger==='AFTER_TIMEOUT'?{type:'AFTER_TIMEOUT',timeout:1.4}:{type:l.trigger||'ON_CLICK'},actions};const list=byNode.get(n.id)||[];list.push(reaction);byNode.set(n.id,list);}
if(invalid.length)throw Error('Destinos ausentes: '+JSON.stringify(invalid));
for(const [id,reactions]of byNode){const n=await figma.getNodeByIdAsync(id);const unique=new Map(reactions.map(r=>[r.trigger.type,r]));await n.setReactionsAsync([...unique.values()]);mutated.push(id);}
return {createdNodeIds:[],mutatedNodeIds:mutated,removedNodeIds:removed,wiredCount:mutated.length,invalid};
