import {fileSnapshot} from './files';
import {read} from '../store';
import type {GenericSource} from './files';
import {createHash} from 'node:crypto';
import {bedrockPlanner} from './bedrock';
import {agentcorePlanner} from './agentcore';
export {bedrockPlanner} from './bedrock';
import {recordCheck} from './diagnostics';
import {z} from 'zod';
import {readSapSample} from '../sap';
import {HttpError} from '../auth';
import {type AnalysisPlanner,type DataProvider,type DataSnapshot,type FinancialRow} from '@/studio/contracts';
import {demoRows,monthNames} from '@/studio/domain';

const demoSnapshot:DataSnapshot={rows:demoRows,revision:'finance-demo-v1',provider:'demo',updatedAt:'2026-10-01T12:00:00.000Z'};
const cache=new Map<string,{snapshot:DataSnapshot;at:number}>();
export function dataMode(){return process.env.STUDIO_DATA_PROVIDER||'demo'}
export function aiMode(){return process.env.STUDIO_AI_PROVIDER||'demo'}
export const mappingSchema=z.object({id:z.string().min(1),center:z.string().min(1),company:z.string().min(1),date:z.string().min(1),actual:z.string().min(1),budget:z.string().min(1),currency:z.string().optional(),fixedCurrency:z.literal('BRL').optional()}).strict().refine(x=>!!x.currency!==!!x.fixedCurrency,'Defina currency ou fixedCurrency, exclusivamente');
export function mapSapRows(rows:Record<string,unknown>[],mapping:z.infer<typeof mappingSchema>):FinancialRow[]{
 const seen=new Set<string>();
 return rows.map(row=>{
  const id=String(row[mapping.id]??'');const center=String(row[mapping.center]??''),company=String(row[mapping.company]??'');
  const date=String(row[mapping.date]??'').slice(0,10);
  if(!id||seen.has(id)||!center||!company||center.length>100||company.length>100)throw new HttpError(422,'Confira identificadores únicos, empresa e centro no mapeamento SAP.');
  seen.add(id);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)throw new HttpError(422,'A competência SAP deve ser uma data ISO válida (AAAA-MM-DD).');
  const currency=mapping.currency?row[mapping.currency]:mapping.fixedCurrency;
  if(currency!=='BRL')throw new HttpError(422,'Este modelo financeiro exige BRL. Converta ou separe moedas na origem.');
  const number=(key:string)=>{const raw=row[key];if(raw==null||raw===''||typeof raw==='boolean'||!['string','number'].includes(typeof raw))throw new HttpError(422,`Valor ausente ou inválido em ${key}.`);const value=Number(raw);if(!Number.isFinite(value)||Math.abs(value)>1e12)throw new HttpError(422,`Valor inválido em ${key}.`);return Math.round(value*100)/100};
  const index=Number(date.slice(5,7))-1;
  return {id,center,company,date,index,month:monthNames[index],actual:number(mapping.actual),budget:number(mapping.budget)};
 });
}
export const demoDataProvider:DataProvider={async read(){return structuredClone(demoSnapshot)}};
async function readSapFinancial(signal?:AbortSignal,workspaceId?:string):Promise<DataSnapshot>{
 if((!process.env.SAP_READ_URL&&process.env.SAP_CONNECTION_MODE!=='sac')||!process.env.SAP_STUDIO_MAPPING)throw new HttpError(503,'SAP pendente: configure o serviço e SAP_STUDIO_MAPPING no servidor.');
 let mapping:z.infer<typeof mappingSchema>;
 try{mapping=mappingSchema.parse(JSON.parse(process.env.SAP_STUDIO_MAPPING))}catch{throw new HttpError(503,'O mapeamento SAP não atende ao contrato financeiro.');}
 const sample=await readSapSample({signal,workspaceId});
 const sourceRows=sample.rows.map(row=>Object.fromEntries(sample.columns.map(column=>[column.label,row[column.key]])));
 const rows=mapSapRows(sourceRows,mapping);
 return {rows,revision:createHash('sha256').update(JSON.stringify(rows)).digest('hex').slice(0,24),provider:dataMode()==='financial-test'?'financial-test':'sap',updatedAt:new Date().toISOString()};
}
export const sapDataProvider:DataProvider={read:signal=>readSapFinancial(signal)};
export async function dataSnapshot(workspaceId:string,signal?:AbortSignal,refresh=false,sourceId='finance'){
 if(sourceId!=='finance'){const source=read<GenericSource>('studio-dataset',sourceId,workspaceId);if(source)return {rows:[],dataset:source.dataset,revision:source.revision,provider:source.provider,updatedAt:source.updatedAt};return fileSnapshot(workspaceId,sourceId);}
 if(dataMode()==='demo')return demoDataProvider.read(signal);
 if(!['sap','financial-test'].includes(dataMode()))throw new HttpError(503,'Provedor de dados desconhecido.');
 const item=cache.get(workspaceId);if(!refresh&&item&&Date.now()-item.at<30000)return item.snapshot;
 try{const snapshot=await readSapFinancial(signal,workspaceId);cache.set(workspaceId,{snapshot,at:Date.now()});recordCheck('data',true,'Coleção consultada e contrato financeiro validado.');return snapshot;}catch(error){recordCheck('data',false,error instanceof HttpError?error.message:'Falha na fonte de dados.');throw error;}
}
export function mutationSnapshot(workspaceId:string,sourceId='finance'){
 if(sourceId!=='finance'){const source=read<GenericSource>('studio-dataset',sourceId,workspaceId);if(source)return {rows:[],dataset:source.dataset,revision:source.revision,provider:source.provider,updatedAt:source.updatedAt};return fileSnapshot(workspaceId,sourceId);}
 if(dataMode()==='demo')return demoSnapshot;
 const item=cache.get(workspaceId);if(!['sap','financial-test'].includes(dataMode())||!item||Date.now()-item.at>300000)throw new HttpError(503,'Atualize os dados antes de salvar planejamento ou cenário.');return item.snapshot;
}
export {conversationalDemoPlanner as demoPlanner} from './demoConversation';
import {conversationalDemoPlanner as demoPlanner} from './demoConversation';
export function planner():AnalysisPlanner{if(aiMode()==='demo')return demoPlanner;if(aiMode()==='agentcore')return agentcorePlanner;if(aiMode()==='bedrock')return bedrockPlanner;throw new HttpError(503,'Provedor de IA desconhecido.');}
