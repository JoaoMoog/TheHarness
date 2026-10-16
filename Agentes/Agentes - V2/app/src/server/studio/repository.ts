import {createHash,randomUUID} from 'node:crypto';
import {z} from 'zod';
import {db,insert,read,update,transaction} from '../store';
import {HttpError} from '../auth';
import {initialDocument,mutationSchema,type StudioRepository,type StudioState} from '@/studio/contracts';
export function seedState(workspaceId:string):StudioState {
 const now=new Date().toISOString();
 return {id:`studio:${workspaceId}`,owner:workspaceId,schemaVersion:1,revision:1,boards:[{id:randomUUID(),document:{...initialDocument},favorite:true,revision:1,updatedAt:now,versions:[]}],plans:[],scenarios:[],comments:[],measure:{name:'Saldo disponível',formula:'budget-actual'},sourcePaused:false,updatedAt:now};
}
type Receipt={id:string;owner:string;hash:string;response:{state:StudioState;targetId?:string}};
export const repository:StudioRepository={
 get(workspaceId){const id=`studio:${workspaceId}`;return read<StudioState>('studio',id,workspaceId)||insert('studio',seedState(workspaceId))},
 mutate(workspaceId,actorId,request,change){return transaction(()=>{
  const key=`studio-op:${actorId}:${request.operationId}`,hash=createHash('sha256').update(JSON.stringify(request)).digest('hex');
  const previous=read<Receipt>('studio-receipt',key,workspaceId);
  if(previous){if(previous.hash!==hash)throw new HttpError(409,'O identificador de repetição já foi usado para outro pedido.');return previous.response}
  const current=repository.get(workspaceId);
  if(current.revision!==request.revision)throw new HttpError(409,'O espaço mudou em outra aba. Atualize antes de salvar; sua edição foi preservada.');
  const next=change(structuredClone(current));next.revision=current.revision+1;next.updatedAt=new Date().toISOString();
  const targetId=(next as StudioState&{targetId?:string}).targetId;delete (next as StudioState&{targetId?:string}).targetId;
  update('studio',next);const response={state:next,targetId};
  insert('studio-receipt',{id:key,owner:workspaceId,hash,response});
  // Bound retained responses. Durable adapters must implement an equivalent documented retry window.
  db().prepare("DELETE FROM resources WHERE kind='studio-receipt' AND owner=? AND id NOT IN (SELECT id FROM resources WHERE kind='studio-receipt' AND owner=? ORDER BY rowid DESC LIMIT 50)").run(workspaceId,workspaceId);
  return response;
 })}
};
