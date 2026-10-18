import {myCredits,withCredits,trackUsage} from '../credits';
import {platformAccess} from '../platformAccess';
import {mergeBoards,selectedBoards} from './executive';
import {widgetsFor} from '@/studio/widgets';
import {aggregateWidget,datasetOf} from './datasets';
import {isDeferredProposal} from '@/studio/availability';
import {preferences} from './preferences';
import {fileSources} from './files';
import {readBanner} from './banners';
import {randomUUID} from 'node:crypto';
import type {Actor} from '@/core/types';
import {audit,resolveWorkspace,listWorkspaces} from '../workspaces';
import {db,read,insert,update} from '../store';
import {HttpError} from '../auth';
import {repository} from './repository';
import {aiMode,dataMode,dataSnapshot,mutationSnapshot,planner} from './providers';
import {assistantInputSchema,documentSchema,filtersSchema,mutationSchema,querySchema,type StudioState,type StudioMessage,type DataSnapshot,type Filters} from '@/studio/contracts';
import {integrationStatus} from './diagnostics';
import {centers,simulate,summarize} from '@/studio/domain';

type Conversation={id:string;owner:string;messages:StudioMessage[];sourceId?:string;pendingProposal?:import('@/studio/contracts').Proposal|null};
const conversationKey=(workspace:string,actor:Actor)=>`studio-chat:${workspace}:${actor.id}`;
export function runtimeStatus(){return {storage:process.env.CLARA_STORAGE_MODE==='memory'?'memory':'sqlite',temporary:process.env.CLARA_STORAGE_MODE==='memory',dataProvider:dataMode(),aiProvider:aiMode(),sso:process.env.AUTH_MODE==='msal'?'configured':'pending',persistence:process.env.CLARA_STORAGE_MODE==='memory'?'temporary':'persistent',integrations:{data:integrationStatus('data'),ai:integrationStatus('ai')},sap:dataMode()==='sap'?'selected':'pending',ai:aiMode()==='demo'?'pending':'selected',replicas:1}}
export function bootstrapStudio(actor:Actor,workspaceId?:string){const workspace=resolveWorkspace(actor,workspaceId);const state=repository.get(workspace.id);trackUsage(actor,'platform.active',workspace.id,`active:${actor.id}:${new Date().toISOString().slice(0,10)}`);return {actor,credits:myCredits(actor),platformAccess:platformAccess(actor),preferences:preferences(actor),files:fileSources(actor,workspace.id),workspace,workspaces:listWorkspaces(actor),state,messages:read<Conversation>('studio-chat',conversationKey(workspace.id,actor),workspace.id)?.messages||[],runtime:runtimeStatus()}}
function available(actor:Actor,workspaceId?:string){const workspace=resolveWorkspace(actor,workspaceId);if(repository.get(workspace.id).sourcePaused)throw new HttpError(503,'A fonte está pausada. Peça a um administrador para reconectá-la.');return workspace;}
function validateFilters(snapshot:DataSnapshot,filters:Filters){if(filters.center!=='all'&&!snapshot.rows.some(r=>r.center===filters.center))throw new HttpError(422,'Esse centro não existe na fonte.');if(filters.company!=='all'&&!snapshot.rows.some(r=>r.company===filters.company))throw new HttpError(422,'Essa empresa não existe na fonte.');}
export async function queryStudio(actor:Actor,workspaceId:string|undefined,input:unknown,signal?:AbortSignal){const workspace=available(actor,workspaceId),query=querySchema.parse(input),snapshot=await dataSnapshot(workspace.id,signal,false,query.sourceId);if(snapshot.dataset){const rows=snapshot.dataset.rows.filter(row=>!query.search||Object.values(row).some(v=>String(v??'').toLowerCase().includes(query.search.toLowerCase())));return {...summarize(snapshot,query),count:snapshot.dataset.rows.length,matchedCount:rows.length,offset:query.offset,limit:query.limit,dataset:{...snapshot.dataset,rows:rows.slice(query.offset,query.offset+query.limit)}};}validateFilters(snapshot,query);return summarize(snapshot,filtersSchema.parse({...query.sourceId?{sourceId:query.sourceId}:{},center:query.center,period:query.period,company:query.company,dateFrom:query.dateFrom,dateTo:query.dateTo}),query.search,query.offset,query.limit)}
export async function catalogStudio(actor:Actor,workspaceId?:string,signal?:AbortSignal,sourceId='finance'){const workspace=available(actor,workspaceId),snapshot=await dataSnapshot(workspace.id,signal,false,sourceId);if(snapshot.dataset)return {sourceId,name:snapshot.dataset.name,revision:snapshot.revision,provider:snapshot.provider,updatedAt:snapshot.updatedAt,unit:'number',rowCount:snapshot.dataset.rows.length,periods:[...new Set(snapshot.dataset.columns.filter(c=>c.type==='date').flatMap(c=>snapshot.dataset!.rows.map(r=>String(r[c.key]||'').slice(0,7)).filter(Boolean)))].sort(),centers:[],companies:[],fields:snapshot.dataset.columns,generic:true};return {sourceId,name:'Despesas e orçamento',revision:snapshot.revision,provider:snapshot.provider,updatedAt:snapshot.updatedAt,unit:'BRL',rowCount:snapshot.rows.length,periods:[...new Set(snapshot.rows.map(r=>r.date.slice(0,7)))].sort(),centers:[...new Set(snapshot.rows.map(r=>r.center))],companies:[...new Set(snapshot.rows.map(r=>r.company))],fields:[{key:'date',type:'date',role:'dimension'},{key:'company',type:'string',role:'dimension'},{key:'center',type:'string',role:'dimension'},{key:'actual',type:'decimal',role:'measure',aggregation:'sum',unit:'BRL'},{key:'budget',type:'decimal',role:'measure',aggregation:'sum',unit:'BRL'}],limits:{records:20000,page:200,bytes:8388608},semantics:{balance:'budget - actual',execution:'actual / budget * 100; null quando budget = 0',period:'Data de competência; trimestre civil',missingValues:'Recusados nas medidas obrigatórias',currency:'Somente BRL; sem conversão implícita'}}}
export function commandStudio(actor:Actor,workspaceId:string|undefined,input:unknown){
 const parsed=mutationSchema.parse(input),c=parsed.command;
 const workspace=resolveWorkspace(actor,workspaceId,c.type==='source.toggle'?'admin':'write');
 const result=repository.mutate(workspace.id,actor.id,parsed,state=>{
  const now=new Date().toISOString();let targetId='';
  const board=(id:string)=>{const found=state.boards.find(b=>b.id===id);if(!found)throw new HttpError(404,'Dashboard não encontrado neste espaço.');return found};
  const capacity=(items:unknown[],max=100)=>{if(items.length>=max)throw new HttpError(422,`Limite de ${max} itens. Remova um item antes de criar outro.`)};
  const needsData=['plan.save','scenario.save','model.save'].includes(c.type);
  if(needsData&&state.sourcePaused)throw new HttpError(503,'A fonte está pausada.');
  if(c.type==='plan.save'||c.type==='scenario.save'){
   const snapshot=mutationSnapshot(workspace.id,'filters' in c?c.filters?.sourceId:undefined);
   if(!c.baseRevision&&dataMode()!=='demo')throw new HttpError(422,'Atualize a prévia antes de salvar: revisão da fonte obrigatória.');
   if(c.baseRevision&&c.baseRevision!==snapshot.revision)throw new HttpError(409,'A fonte mudou após a prévia. Atualize os dados e confira os valores antes de salvar.');
  }
  switch(c.type){
   case 'dashboard.save':{for(const widget of c.document.widgets)aggregateWidget(mutationSnapshot(workspace.id,widget.sourceId),c.document,widget);const sourceRevision=mutationSnapshot(workspace.id,c.document.sourceId).revision;if(c.id){const b=board(c.id);b.versions=[{id:randomUUID(),at:now,document:b.document},...b.versions].slice(0,20);b.document={...c.document,schemaVersion:2};b.sourceRevision=sourceRevision;b.revision++;b.updatedAt=now;targetId=b.id}else{capacity(state.boards);targetId=randomUUID();state.boards.unshift({id:targetId,document:{...c.document,schemaVersion:2},sourceRevision,favorite:false,revision:1,updatedAt:now,versions:[]})}break}
   case 'dashboard.duplicate':{capacity(state.boards);const b=board(c.id);targetId=randomUUID();state.boards.unshift({id:targetId,document:{...b.document,title:`${b.document.title.slice(0,110)} · cópia`},favorite:false,revision:1,updatedAt:now,versions:[]});break}
   case 'dashboard.delete':board(c.id);state.boards=state.boards.filter(b=>b.id!==c.id);state.comments=state.comments.filter(v=>v.boardId!==c.id);break;
   case 'dashboard.favorite':board(c.id).favorite=c.favorite;break;
   case 'dashboard.banner':{if(c.bannerId)readBanner(actor,workspace.id,c.bannerId,c.id);const b=board(c.id);b.bannerId=c.bannerId;b.revision++;b.updatedAt=now;break;}
   case 'dashboard.restore':{const b=board(c.id),version=b.versions.find(v=>v.id===c.versionId);if(!version)throw new HttpError(404,'Versão não encontrada neste dashboard.');const restored=version.document;b.versions=[{id:randomUUID(),at:now,document:b.document},...b.versions].slice(0,20);b.document=restored;b.revision++;b.updatedAt=now;targetId=b.id;break}
   case 'comment.add':board(c.boardId);capacity(state.comments,500);state.comments.push({id:randomUUID(),boardId:c.boardId,authorId:actor.id,author:actor.name,text:c.text,at:now});break;
   case 'plan.save':{capacity(state.plans);const snapshot=mutationSnapshot(workspace.id,'filters' in c?c.filters?.sourceId:undefined);const filters=filtersSchema.parse(c.filters||{});validateFilters(snapshot,filters);const base=summarize(snapshot,filters);
    const budgets=c.budgets.map((v,i)=>typeof v==='number'?{center:centers[i].name,amount:v}:v);
    if(new Set(budgets.map(b=>b.center)).size!==budgets.length||budgets.length!==base.groups.length||budgets.some(b=>!base.groups.some(g=>g.name===b.center)))throw new HttpError(422,'Informe um orçamento para cada centro do recorte, sem duplicados.');
    state.plans.unshift({id:randomUUID(),name:c.name,budgets,filters,total:budgets.reduce((n,v)=>n+Math.round(v.amount*100),0)/100,baseRevision:snapshot.revision,createdAt:now,createdBy:actor.id});break}
   case 'plan.delete':if(!state.plans.some(v=>v.id===c.id))throw new HttpError(404,'Versão de planejamento não encontrada.');state.plans=state.plans.filter(v=>v.id!==c.id);break;
   case 'scenario.save':{capacity(state.scenarios);const snapshot=mutationSnapshot(workspace.id,'filters' in c?c.filters?.sourceId:undefined);const filters=filtersSchema.parse(c.filters||{});validateFilters(snapshot,filters);const base=summarize(snapshot,filters),center=c.center||'Tecnologia';if(!base.groups.some(g=>g.name===center))throw new HttpError(422,'O centro do cenário não existe no recorte selecionado.');state.scenarios.unshift({id:randomUUID(),name:c.name,percent:c.percent,center,filters,...simulate(base,c.percent,center),baseRevision:snapshot.revision,createdAt:now,createdBy:actor.id});break}
   case 'scenario.delete':if(!state.scenarios.some(v=>v.id===c.id))throw new HttpError(404,'Cenário não encontrado.');state.scenarios=state.scenarios.filter(v=>v.id!==c.id);break;
   case 'model.save':state.measure={name:c.name,formula:c.formula};break;
   case 'source.toggle':state.sourcePaused=c.paused;break;
  }
  trackUsage(actor,c.type==='dashboard.save'&&!c.id||c.type==='dashboard.duplicate'?'dashboard.created':c.type,workspace.id,`command:${workspace.id}:${parsed.operationId}`);
  audit(actor,workspace.id,`studio.${c.type}`,targetId||('id'in c?c.id:''));
  return Object.assign(state,{targetId});
 });
 return {...bootstrapStudio(actor,workspace.id),state:result.state,targetId:result.targetId};
}
export async function scenarioPreview(actor:Actor,workspaceId:string|undefined,percent:number,signal?:AbortSignal,filters:Filters=filtersSchema.parse({}),center='Tecnologia'){
 if(!Number.isFinite(percent)||percent<0||percent>100)throw new HttpError(422,'Informe de 0 a 100%.');
 const base=await queryStudio(actor,workspaceId,filters,signal);
 if(!base.groups.some(g=>g.name===center))throw new HttpError(422,'Centro não disponível no recorte.');
 const simulation=simulate(base,percent,center);const snapshot=await dataSnapshot(resolveWorkspace(actor,workspaceId).id,signal,false,filters.sourceId);
 const filtered=snapshot.rows.filter(r=>(filters.center==='all'||r.center===filters.center)&&(filters.company==='all'||r.company===filters.company)&&(!filters.dateFrom||r.date>=filters.dateFrom)&&(!filters.dateTo||r.date<=filters.dateTo)&&(filters.period!=='q3'||r.index>=6&&r.index<=8));
 const last=filtered.map(r=>r.date.slice(0,7)).sort().at(-1)!;
 const forecast=Array.from({length:3},(_,i)=>{const date=new Date(last+'-01T12:00:00Z');date.setUTCMonth(date.getUTCMonth()+i+1);return {month:new Intl.DateTimeFormat('pt-BR',{month:'short',year:'2-digit',timeZone:'UTC'}).format(date),forecast:Math.round(simulation.actual/base.months.length*100)/100,budget:Math.round(base.budget/base.months.length*100)/100}});
 return {percent,center,filters,...simulation,baseRevision:base.lineage.revision,base,forecast};
}
const rates=new Map<string,number[]>();
const activeConversations=new Set<string>();
async function assistantStudioUnmetered(actor:Actor,workspaceId:string|undefined,input:unknown,signal?:AbortSignal){
 const workspace=available(actor,workspaceId);resolveWorkspace(actor,workspace.id,'write');const parsed=assistantInputSchema.parse(input);
 const rateKey=conversationKey(workspace.id,actor),times=(rates.get(rateKey)||[]).filter(t=>t>Date.now()-60000);if(times.length>=20)throw new HttpError(429,'Aguarde um minuto antes de pedir outra análise.');rates.set(rateKey,[...times,Date.now()]);
 const key=parsed.conversationId?`${rateKey}:${parsed.conversationId}`:rateKey;
 if(activeConversations.has(key))throw new HttpError(409,'A CLARA ainda está respondendo nesta conversa. Aguarde e tente novamente.');
 activeConversations.add(key);
 try{
 const filters=filtersSchema.parse({sourceId:parsed.document.sourceId,center:parsed.document.center,company:parsed.document.company,period:parsed.document.period,dateFrom:parsed.document.dateFrom,dateTo:parsed.document.dateTo});
 const data=await queryStudio(actor,workspace.id,filters,signal),catalog=await catalogStudio(actor,workspace.id,signal,parsed.document.sourceId);
 const previous=read<Conversation>('studio-chat',key,workspace.id);
 const sameSource=previous?.sourceId===parsed.document.sourceId;
 const history=sameSource?previous.messages:[];
 const pendingProposal=sameSource&&!parsed.proposalApplied&&!isDeferredProposal(previous.pendingProposal)?previous.pendingProposal:null;
 let answer=await planner().propose(parsed,data,signal,{centers:catalog.centers,companies:catalog.companies,periods:catalog.periods,messages:history,pendingProposal,fields:datasetOf(await dataSnapshot(workspace.id,signal,false,parsed.document.sourceId)).columns,generic:!!data.dataset,boards:repository.get(workspace.id).boards.map(b=>({id:b.id,title:b.document.title,sourceId:b.document.sourceId}))});
 if(isDeferredProposal(answer.proposal))answer={status:'clarify',proposal:null,message:'Planejamento, previsões e cenários ficam para uma próxima etapa. Quer comparar realizado e orçamento em um dashboard?'};
 if(answer.proposal?.kind==='presentation')selectedBoards(actor,workspace.id,{title:answer.proposal.title,boardIds:answer.proposal.boardIds||['current'],current:parsed.document});
 if(answer.proposal?.kind==='merge')answer.proposal.patch=mergeBoards(actor,workspace.id,{title:answer.proposal.title,boardIds:answer.proposal.boardIds||[],current:parsed.document});
 if(answer.proposal?.patch.widgetEdit){const edit=answer.proposal.patch.widgetEdit,widgets=widgetsFor(parsed.document);if(!widgets.some(w=>w.id===edit.id))throw new HttpError(422,'O gráfico solicitado não existe na análise.');answer.proposal.patch.widgets=widgets.map(w=>w.id===edit.id?{...w,...edit}:w);delete answer.proposal.patch.widgetEdit;}
 if(answer.proposal?.patch.widgets)for(const widget of answer.proposal.patch.widgets)aggregateWidget(await dataSnapshot(workspace.id,signal,false,widget.sourceId),parsed.document,widget);
 if(signal?.aborted)throw new HttpError(499,'Conversa interrompida. Envie o pedido novamente.');
 if(answer.proposal){const next=documentSchema.parse({...parsed.document,...Object.fromEntries(Object.entries(answer.proposal.patch).filter(([k])=>!['percent','screen','scenarioCenter'].includes(k)))});if(answer.proposal.kind!=='merge'&&next.sourceId!==parsed.document.sourceId)throw new HttpError(422,'A IA não pode trocar a fonte sem sua escolha.');validateFilters(await dataSnapshot(workspace.id,signal,false,next.sourceId),next);if(answer.proposal.kind==='scenario'){const center=answer.proposal.patch.scenarioCenter||'Tecnologia';const scoped=await queryStudio(actor,workspaceId,filtersSchema.parse({sourceId:next.sourceId,center:next.center,company:next.company,period:next.period,dateFrom:next.dateFrom,dateTo:next.dateTo}),signal);if(!scoped.groups.some(g=>g.name===center))throw new HttpError(422,'O centro do cenário não está no recorte.');}}
 const messages:StudioMessage[]=[...history,{role:'user' as const,text:parsed.prompt},{role:'assistant' as const,text:answer.message,status:answer.status}].slice(-40);
 const conversation={id:key,owner:workspace.id,sourceId:parsed.document.sourceId,messages,pendingProposal:answer.proposal||pendingProposal};if(previous)update('studio-chat',conversation);else insert('studio-chat',conversation);
 return {...answer,provider:aiMode(),messages};
 }finally{activeConversations.delete(key)}
}

export async function assistantStudio(actor:Actor,workspaceId:string|undefined,input:unknown,signal?:AbortSignal){
 const workspace=resolveWorkspace(actor,workspaceId,'write');assistantInputSchema.parse(input);
 return withCredits(actor,workspace.id,'assistant',aiMode(),()=>assistantStudioUnmetered(actor,workspace.id,input,signal));
}
