import {sacSelection} from '../sac';
import {createHash,randomUUID} from 'node:crypto';
import {z} from 'zod';
import type {Actor,ImportSample} from '@/core/types';
import type {DataSnapshot,Dataset} from '@/studio/contracts';
import {parseFile,MAX_BYTES} from '@/core/import';
import {insert,list,read,transaction,db,update} from '../store';
import {readSapSample} from '../sap';
import {resolveWorkspace} from '../workspaces';
import {HttpError} from '../auth';
import {mapSapRows} from './providers';
type FileSource=DataSnapshot&{id:string;owner:string;name:string};
type PendingFile=ImportSample&{id:string;owner:string;expires:number};
export async function importSapDataset(actor:Actor,workspaceId:string|undefined,input:unknown,signal?:AbortSignal){
 const w=resolveWorkspace(actor,workspaceId,'write'),p=z.object({name:z.string().trim().min(1).max(120),sourceId:z.string().optional(),sac:sacSelection.optional()}).strict().parse(input);
 if(process.env.STUDIO_DATA_PROVIDER!=='sap')throw new HttpError(503,'Configure a coleção SAP da organização antes de importar.');
 const previous=p.sourceId?read<GenericSource>('studio-dataset',p.sourceId,w.id):null;
 if(p.sourceId&&(!previous||previous.provider!=='sap'))throw new HttpError(404,'Fonte SAP não encontrada neste espaço.');
 const selection=p.sac||previous?.sac;
 const sample=await readSapSample({signal,workspaceId:w.id,selection});
 const sac=process.env.SAP_CONNECTION_MODE==='sac'?(selection||sacSelection.parse({namespace:process.env.SAP_SAC_NAMESPACE,provider:process.env.SAP_SAC_PROVIDER})):undefined;
 const source:GenericSource={id:previous?.id||randomUUID(),owner:w.id,name:p.name,dataset:{...sample,name:p.name},revision:createHash('sha256').update(JSON.stringify(sample)).digest('hex').slice(0,24),updatedAt:new Date().toISOString(),provider:'sap',...(sac?{sac}:{})};
 if(previous)update('studio-dataset',source);else{if(list<GenericSource>('studio-dataset',w.id).length>=30)throw new HttpError(422,'Limite de 30 fontes neste espaço.');insert('studio-dataset',source);}
 return {id:source.id,name:source.name,count:sample.rows.length};
}
export type GenericSource={id:string;owner:string;name:string;dataset:Dataset;revision:string;updatedAt:string;provider:'file'|'sap';sac?:z.infer<typeof sacSelection>};
export const fileMappingSchema=z.object({uploadId:z.string().uuid(),name:z.string().trim().min(1).max(120),mapping:z.object({company:z.string(),center:z.string(),date:z.string(),actual:z.string(),budget:z.string()}).strict().optional(),columns:z.array(z.object({key:z.string(),type:z.enum(['text','number','date'])}).strict()).max(257).optional()}).strict();
export function fileSources(actor:Actor,workspaceId?:string){const w=resolveWorkspace(actor,workspaceId);return [...list<FileSource>('studio-file',w.id).map(({id,name,rows,updatedAt})=>({id,name,count:rows.length,updatedAt,generic:false,columns:[] as ImportSample['columns'],provider:'file'})),...list<GenericSource>('studio-dataset',w.id).map(source=>({id:source.id,name:source.name,count:source.dataset.rows.length,columns:source.dataset.columns,updatedAt:source.updatedAt,generic:true,provider:source.provider}))];}
export function fileSnapshot(workspaceId:string,id:string):FileSource{const source=read<FileSource>('studio-file',id,workspaceId);if(!source)throw new HttpError(404,'Esta fonte não está disponível no espaço.');return source;}
export async function previewFile(actor:Actor,workspaceId:string|undefined,file:File){const w=resolveWorkspace(actor,workspaceId,'write');if(file.size>MAX_BYTES)throw new HttpError(413,'Use uma planilha de até 8 MB.');let sample:ImportSample;try{sample=parseFile(new Uint8Array(await file.arrayBuffer()),file.name)}catch(e){throw new HttpError(422,e instanceof Error?e.message:'Planilha inválida.');}
 db().prepare("DELETE FROM resources WHERE kind='studio-upload' AND json_extract(data,'$.expires')<?").run(Date.now());
 if(list<PendingFile>('studio-upload',w.id).length>=10)throw new HttpError(429,'Conclua uma importação antes de enviar mais arquivos.');
 const upload=insert('studio-upload',{...sample,id:randomUUID(),owner:w.id,expires:Date.now()+1800000});return {id:upload.id,name:sample.name,columns:sample.columns,rows:sample.rows.slice(0,5),count:sample.rows.length};
}
export function commitFile(actor:Actor,workspaceId:string|undefined,input:unknown){const w=resolveWorkspace(actor,workspaceId,'write'),p=fileMappingSchema.parse(input);return transaction(()=>{
 const upload=read<PendingFile>('studio-upload',p.uploadId,w.id);if(!upload||upload.expires<Date.now())throw new HttpError(410,'A prévia expirou. Envie a planilha novamente.');
 if(list<FileSource>('studio-file',w.id).length>=30)throw new HttpError(422,'Este espaço atingiu o limite de 30 planilhas.');
 if(!p.mapping){
  if(list<GenericSource>('studio-dataset',w.id).length>=30)throw new HttpError(422,'Este espaço atingiu o limite de 30 fontes.');
  if(p.columns?.some(c=>!upload.columns.some(field=>field.key===c.key)))throw new HttpError(422,'A coluna informada não existe no arquivo.');
  const columns=upload.columns.map(c=>({...c,type:p.columns?.find(field=>field.key===c.key)?.type||c.type}));
  const rows=upload.rows.map((r,i)=>Object.fromEntries(columns.map(c=>{const v=r[c.key];if(v==null)return [c.key,null];if(c.type==='text')return [c.key,String(v)];if(c.type==='number'){const number=typeof v==='number'?v:Number(String(v).replace(/\.(?=\d{3}(?:\D|$))/g,'').replace(',','.'));if(!Number.isFinite(number))throw new HttpError(422,`Linha ${i+2}: “${c.label}” contém um valor não numérico.`);return [c.key,number];}if(typeof v!=='string'||!/^\d{4}-\d{2}(?:-\d{2})?$/.test(v))throw new HttpError(422,`Linha ${i+2}: confira a data em “${c.label}”.`);return [c.key,v];})));
  const source=insert<GenericSource>('studio-dataset',{id:randomUUID(),owner:w.id,name:p.name,dataset:{name:p.name,columns,rows},revision:createHash('sha256').update(JSON.stringify({columns,rows})).digest('hex').slice(0,24),updatedAt:new Date().toISOString(),provider:'file'});
  db().prepare('DELETE FROM resources WHERE id=? AND owner=?').run(upload.id,w.id);return {id:source.id,name:source.name,count:rows.length};
 }
 const mapping=p.mapping;
 const keys=Object.values(mapping);if(new Set(keys).size!==5||keys.some(key=>!upload.columns.some(c=>c.key===key)))throw new HttpError(422,'Escolha cinco colunas diferentes para os campos financeiros.');
 const records=upload.rows.map((r,i)=>({...r,__row:String(i+1),[mapping.date]:String(r[mapping.date]||'').length===7?`${r[mapping.date]}-01`:r[mapping.date]}));
 let rows:DataSnapshot['rows'];try{rows=mapSapRows(records,{...mapping,id:'__row',fixedCurrency:'BRL'})}catch(e){throw new HttpError(422,(e instanceof Error?e.message:'Confira os dados.').replaceAll('SAP','da planilha'));}
 const source=insert<FileSource>('studio-file',{id:randomUUID(),owner:w.id,name:p.name,rows,provider:'file',revision:createHash('sha256').update(JSON.stringify(rows)).digest('hex').slice(0,24),updatedAt:new Date().toISOString()});
 db().prepare('DELETE FROM resources WHERE id=? AND owner=?').run(upload.id,w.id);return {id:source.id,name:source.name,count:rows.length};
 });}
