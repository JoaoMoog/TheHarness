import {randomUUID} from 'node:crypto';
import type {Actor} from '@/core/types';
import {audit,resolveWorkspace,listWorkspaces} from '../workspaces';
import {db,read,insert,update} from '../store';
import {HttpError} from '../auth';
import {repository} from './repository';
import {aiMode,dataMode,dataSnapshot,mutationSnapshot,planner} from './providers';
import {assistantInputSchema,documentSchema,filtersSchema,mutationSchema,querySchema,type StudioState,type StudioMessage,type DataSnapshot,type Filters} from '@/studio/contracts';
import {centers,simulate,summarize} from '@/studio/domain';

type Conversation={id:string;owner:string;messages:StudioMessage[]};
const conversationKey=(workspace:string,actor:Actor)=>`studio-chat:${workspace}:${actor.id}`;
export function runtimeStatus(){return {storage:process.env.CLARA_STORAGE_MODE==='memory'?'memory':'sqlite',temporary:process.env.CLARA_STORAGE_MODE==='memory',dataProvider:dataMode(),aiProvider:aiMode(),sso:process.env.AUTH_MODE==='msal'?'configured':'pending',persistence:'pending',sap:dataMode()==='sap'?'selected':'pending',ai:aiMode()==='demo'?'pending':'selected',replicas:1}}
export function bootstrapStudio(actor:Actor,workspaceId?:string){const workspace=resolveWorkspace(actor,workspaceId);const state=repository.get(workspace.id);return {actor,workspace,workspaces:listWorkspaces(actor),state,messages:read<Conversation>('studio-chat',conversationKey(workspace.id,actor),workspace.id)?.messages||[],runtime:runtimeStatus()}}
function available(actor:Actor,workspaceId?:string){const workspace=resolveWorkspace(actor,workspaceId);if(repository.get(workspace.id).sourcePaused)throw new HttpError(503,'A fonte está pausada. Peça a um administrador para reconectá-la.');return workspace;}
function validateFilters(snapshot:DataSnapshot,filters:Filters){if(filters.center!=='all'&&!snapshot.rows.some(r=>r.center===filters.center))throw new HttpError(422,'Esse centro não existe na fonte.');if(filters.company!=='all'&&!snapshot.rows.some(r=>r.company===filters.company))throw new HttpError(422,'Essa empresa não existe na fonte.');}
export async function queryStudio(actor:Actor,workspaceId:string|undefined,input:unknown,signal?:AbortSignal){const workspace=available(actor,workspaceId),query=querySchema.parse(input),snapshot=await dataSnapshot(workspace.id,signal);validateFilters(snapshot,query);return summarize(snapshot,filtersSchema.parse({center:query.center,period:query.period,company:query.company}),query.search,query.offset,query.limit)}
export async function catalogStudio(actor:Actor,workspaceId?:string,signal?:AbortSignal){const workspace=available(actor,workspaceId),snapshot=await dataSnapshot(workspace.id,signal);return {sourceId:'finance',name:'Despesas e orçamento',revision:snapshot.revision,provider:snapshot.provider,updatedAt:snapshot.updatedAt,unit:'BRL',rowCount:snapshot.rows.length,periods:[...new Set(snapshot.rows.map(r=>r.date.slice(0,7)))].sort(),centers:[...new Set(snapshot.rows.map(r=>r.center))],companies:[...new Set(snapshot.rows.map(r=>r.company))],fields:[{key:'date',type:'date',role:'dimension'},{key:'company',type:'string',role:'dimension'},{key:'center',type:'string',role:'dimension'},{key:'actual',type:'decimal',role:'measure',aggregation:'sum',unit:'BRL'},{key:'budget',type:'decimal',role:'measure',aggregation:'sum',unit:'BRL'}],limits:{records:20000,page:200,bytes:8388608},semantics:{balance:'budget - actual',execution:'actual / budget * 100; null quando budget = 0',period:'Data de competência; trimestre civil',missingValues:'Recusados nas medidas obrigatórias',currency:'Somente BRL; sem conversão implícita'}}}
export function commandStudio(actor:Actor,workspaceId:string|undefined,input:unknown){
 const parsed=mutationSchema.parse(input),c=parsed.command;
 const workspace=resolveWorkspace(actor,workspaceId,c.type==='source.toggle'?'admin':'write');
 const result=repository.mutate(workspace.id,actor.id,parsed,state=>{
  const now=new Date().toISOString();let targetId='';
  const board=(id:string)=>{const found=state.boards.find(b=>b.id===id);if(!found)throw new HttpError(404,'Dashboard não encontrado neste espaço.');return found};
  const capacity=(items:unknown[],max=100)=>{if(items.length>=max)throw new HttpError(422,`Limite de ${max} itens. Remova um item antes de criar outro.`)};
  const needsData=['plan.save','scenario.save','model.save'].includes(c.type);
  if(needsData&&state.sourcePaused)throw new HttpError(503,'A fonte está pausada.');
  switch(c.type){
   case 'dashboard.save':{if(c.id){const b=board(c.id);b.versions=[{id:randomUUID(),at:now,document:b.document},...b.versions].slice(0,20);b.document=c.document;b.revision++;b.updatedAt=now;targetId=b.id}else{capacity(state.boards);targetId=randomUUID();state.boards.unshift({id:targetId,document:c.document,favorite:false,revision:1,updatedAt:now,versions:[]})}break}
   case 'dashboard.duplicate':{capacity(state.boards);const b=board(c.id);targetId=randomUUID();state.boards.unshift({id:targetId,document:{...b.document,title:`${b.document.title.slice(0,110)} · cópia`},favorite:false,revision:1,updatedAt:now,versions:[]});break}
   case 'dashboard.delete':board(c.id);state.boards=state.boards.filter(b=>b.id!==c.id);state.comments=state.comments.filter(v=>v.boardId!==c.id);break;
   case 'dashboard.favorite':board(c.id).favorite=c.favorite;break;
   case 'dashboard.restore':{const b=board(c.id),version=b.versions.find(v=>v.id===c.versionId);if(!version)throw new HttpError(404,'Versão não encontrada neste dashboard.');const restored=version.document;b.versions=[{id:randomUUID(),at:now,document:b.document},...b.versions].slice(0,20);b.document=restored;b.revision++;b.updatedAt=now;targetId=b.id;break}
   case 'comment.add':board(c.boardId);capacity(state.comments,500);state.comments.push({id:randomUUID(),boardId:c.boardId,authorId:actor.id,author:actor.name,text:c.text,at:now});break;
   case 'plan.save':{capacity(state.plans);const snapshot=mutationSnapshot(workspace.id);if(centers.some(v=>!snapshot.rows.some(r=>r.center===v.name))||snapshot.rows.some(r=>!centers.some(v=>v.name===r.center)))throw new HttpError(422,'Planejamento exige os quatro centros do modelo financeiro. Configure o mapeamento da fonte.');state.plans.unshift({id:randomUUID(),name:c.name,budgets:c.budgets,total:Math.round(c.budgets.reduce((n,v)=>n+v,0)*100)/100,baseRevision:snapshot.revision,createdAt:now,createdBy:actor.id});break}
   case 'plan.delete':if(!state.plans.some(v=>v.id===c.id))throw new HttpError(404,'Versão de planejamento não encontrada.');state.plans=state.plans.filter(v=>v.id!==c.id);break;
   case 'scenario.save':{capacity(state.scenarios);const snapshot=mutationSnapshot(workspace.id);if(!snapshot.rows.some(r=>r.center==='Tecnologia'))throw new HttpError(422,'A fonte não contém o centro Tecnologia para esta simulação.');const base=summarize(snapshot,filtersSchema.parse({}));state.scenarios.unshift({id:randomUUID(),name:c.name,percent:c.percent,...simulate(base,c.percent),baseRevision:snapshot.revision,createdAt:now,createdBy:actor.id});break}
   case 'scenario.delete':if(!state.scenarios.some(v=>v.id===c.id))throw new HttpError(404,'Cenário não encontrado.');state.scenarios=state.scenarios.filter(v=>v.id!==c.id);break;
   case 'model.save':state.measure={name:c.name,formula:c.formula};break;
   case 'source.toggle':state.sourcePaused=c.paused;break;
  }
  audit(actor,workspace.id,`studio.${c.type}`,targetId||('id'in c?c.id:''));
  return Object.assign(state,{targetId});
 });
 return {...bootstrapStudio(actor,workspace.id),state:result.state,targetId:result.targetId};
}
export async function scenarioPreview(actor:Actor,workspaceId:string|undefined,percent:number,signal?:AbortSignal){if(!Number.isFinite(percent)||percent<0||percent>100)throw new HttpError(422,'Informe de 0 a 100%.');const base=await queryStudio(actor,workspaceId,{},signal);if(!base.groups.some(g=>g.name==='Tecnologia'))throw new HttpError(422,'Centro Tecnologia não disponível.');const simulation=simulate(base,percent);const metadata=await catalogStudio(actor,workspaceId,signal);const last=metadata.periods.at(-1)!;const forecast=Array.from({length:3},(_,i)=>{const date=new Date(`${last}-01T12:00:00Z`);date.setUTCMonth(date.getUTCMonth()+i+1);return {month:new Intl.DateTimeFormat('pt-BR',{month:'short',year:'2-digit',timeZone:'UTC'}).format(date),forecast:Math.round(simulation.actual/base.months.length*100)/100,budget:Math.round(base.budget/base.months.length*100)/100}});return {percent,...simulation,baseRevision:base.lineage.revision,base,forecast}}
const rates=new Map<string,number[]>();
export async function assistantStudio(actor:Actor,workspaceId:string|undefined,input:unknown,signal?:AbortSignal){
 const workspace=available(actor,workspaceId);resolveWorkspace(actor,workspace.id,'write');const parsed=assistantInputSchema.parse(input);
 const key=conversationKey(workspace.id,actor),times=(rates.get(key)||[]).filter(t=>t>Date.now()-60000);if(times.length>=20)throw new HttpError(429,'Aguarde um minuto antes de pedir outra análise.');rates.set(key,[...times,Date.now()]);
 const data=await queryStudio(actor,workspace.id,{},signal);const answer=await planner().propose(parsed,data,signal);
 if(answer.proposal){const next=documentSchema.parse({...parsed.document,...Object.fromEntries(Object.entries(answer.proposal.patch).filter(([k])=>!['percent','screen'].includes(k)))});validateFilters(await dataSnapshot(workspace.id,signal),next);}
 const previous=read<Conversation>('studio-chat',key,workspace.id);const messages:StudioMessage[]=[...(previous?.messages||[]),{role:'user' as const,text:parsed.prompt},{role:'assistant' as const,text:answer.message}].slice(-40);
 const conversation={id:key,owner:workspace.id,messages};if(previous)update('studio-chat',conversation);else insert('studio-chat',conversation);
 return {...answer,provider:aiMode(),messages};
}
