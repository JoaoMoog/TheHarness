import {z} from 'zod';
import {MAX_BYTES,MAX_ROWS,parseFile} from '@/core/import';
import {HttpError} from './auth';

export const sacSelection=z.object({namespace:z.string().regex(/^[\w-]{1,128}$/),provider:z.string().regex(/^[\w-]{1,128}$/)}).strict();
export type SacSelection=z.infer<typeof sacSelection>;
type Selection=SacSelection;
const grantsSchema=z.record(z.string().min(1),z.array(sacSelection).min(1).max(100));
const rootPath='/api/v1/dataexport/';
export const sacProxyPath='/api/v1/sap/dataexport/';
let cachedToken:{key:string;value:string;until:number}|undefined;
let tokenFlight:{key:string;promise:Promise<string>}|undefined;

export function sacModels(workspace:string):Selection[]{
 let grants:z.infer<typeof grantsSchema>;
 try{grants=grantsSchema.parse(JSON.parse(process.env.SAP_SAC_WORKSPACE_MODELS||'{}'));}
 catch{throw new HttpError(503,'Confira SAP_SAC_WORKSPACE_MODELS no servidor.');}
 const models=grants[workspace];
 if(!models?.length)throw new HttpError(403,'Este espaço não tem modelos SAP Analytics Cloud autorizados.');
 return models;
}
function secureUrl(raw:string|undefined){
 try{const url=new URL(raw||'');if(url.protocol!=='https:'||url.username||url.password||url.hash)throw new Error();return url;}
 catch{throw new HttpError(503,'Configure os endereços HTTPS do SAP Analytics Cloud no servidor.');}
}
function tenant(){const url=secureUrl(process.env.SAP_SAC_TENANT_URL);if(url.pathname!=='/'||url.search)throw new HttpError(503,'SAP_SAC_TENANT_URL deve conter apenas a origem HTTPS do tenant.');return url;}
async function bounded(response:Response,limit=MAX_BYTES){
 if(!response.body)throw new HttpError(502,'O SAP retornou uma resposta vazia.');
 const reader=response.body.getReader(),parts:Uint8Array[]=[];let bytes=0;
 try{while(true){const {value,done}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>limit){await reader.cancel();throw new HttpError(413,'A resposta SAP excedeu o limite. Reduza o recorte.');}parts.push(value);}}
 finally{reader.releaseLock();}
 return Buffer.concat(parts).toString('utf8');
}
async function token(fetcher:typeof fetch){
 const url=secureUrl(process.env.SAP_SAC_TOKEN_URL),id=process.env.SAP_SAC_CLIENT_ID,secret=process.env.SAP_SAC_CLIENT_SECRET;
 if(!id||!secret)throw new HttpError(503,'Configure o cliente OAuth do SAP e seu segredo no AWS Secrets Manager.');
 const key=[url.href,id,secret,process.env.SAP_SAC_SCOPE||''].join('|');
 if(cachedToken?.key===key&&cachedToken.until>Date.now())return cachedToken.value;
 if(tokenFlight?.key===key)return tokenFlight.promise;
 const promise=(async()=>{
  const form=new URLSearchParams({grant_type:'client_credentials'});if(process.env.SAP_SAC_SCOPE)form.set('scope',process.env.SAP_SAC_SCOPE);
  const response=await fetcher(url,{method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),headers:{Authorization:'Basic '+Buffer.from(`${id}:${secret}`).toString('base64'),'Content-Type':'application/x-www-form-urlencoded',Accept:'application/json'},body:form});
  if(!response.ok)throw new HttpError(502,'O SAP recusou a autenticação OAuth. Confira o cliente e as permissões de exportação.');
  const payload=z.object({access_token:z.string().min(1).max(32000),expires_in:z.coerce.number().positive(),token_type:z.string().refine(v=>v.toLowerCase()==='bearer')}).parse(JSON.parse(await bounded(response,65536)));
  cachedToken={key,value:payload.access_token,until:Date.now()+Math.max(0,Math.min(payload.expires_in,86400)-60)*1000};return payload.access_token;
 })();
 tokenFlight={key,promise};try{return await promise;}finally{if(tokenFlight?.promise===promise)tokenFlight=undefined;}
}
export function sacQuery(params:URLSearchParams){
 const output=new URLSearchParams();
 for(const [key,value] of params){
  if(output.has(key)||!['$select','$filter','$top','$skip','$skiptoken','nextEntity','$format'].includes(key))throw new HttpError(422,'Parâmetro de consulta SAP não permitido.');
  if(!value||value.length>2048||/[\r\n\0]/.test(value))throw new HttpError(422,'Parâmetro SAP vazio ou acima de 2.048 caracteres.');
  if(key==='$format'&&value!=='json')throw new HttpError(422,'Use $format=json.');
  if(['$top','$skip'].includes(key)&&(!/^\d+$/.test(value)||Number(value)>(key==='$top'?1000:MAX_ROWS)||key==='$top'&&Number(value)<1))throw new HttpError(422,'Use $top de 1 a 1.000 e $skip de 0 a 20.000.');
  output.set(key,value);
 }
 return output;
}
/** The path mirrors SAC; access is narrowed to model IDs granted to this CLARA workspace. */
export function authorizeSacPath(path:string,workspace:string){
 const models=sacModels(workspace);
 if(['administration/$metadata','administration/Namespaces'].includes(path))return {models,kind:'namespaces'};
 const ns=path.match(/^administration\/Namespaces\(NamespaceID='([\w-]{1,128})'\)(\/Providers)?$/);
 if(ns){if(!models.some(m=>m.namespace===ns[1]))throw new HttpError(403,'Namespace SAP não autorizado para este espaço.');return {models:models.filter(m=>m.namespace===ns[1]),kind:ns[2]?'providers':'namespace'};}
 const p=path.match(/^providers\/([\w-]{1,128})\/([\w-]{1,128})(?:\/(\$metadata|[A-Za-z_][\w]{0,127}))?\/?$/);
 if(!p)throw new HttpError(404,'Endpoint de leitura SAP não disponível.');
 if(!models.some(m=>m.namespace===p[1]&&m.provider===p[2]))throw new HttpError(403,'Modelo SAP não autorizado para este espaço.');
 if(p[3]&&['FactDataDifference','Subscriptions'].includes(p[3]))throw new HttpError(422,'Use uma consulta completa de leitura; sincronização delta não está habilitada.');
 return {models,kind:'data'};
}
export async function querySac(workspace:string,path:string,query=new URLSearchParams(),signal?:AbortSignal,fetcher:typeof fetch=fetch):Promise<{body:unknown;type:string}>{
 const access=authorizeSacPath(path,workspace),base=tenant(),params=sacQuery(query),url=new URL(rootPath+path,base);
 url.search=params.toString();const requestSignal=AbortSignal.any([AbortSignal.timeout(30000),...(signal?[signal]:[])]);
 try{
  const credential=await token(fetcher);
  const response=await fetcher(url,{method:'GET',redirect:'error',signal:requestSignal,headers:{Authorization:`Bearer ${credential}`,Accept:path.endsWith('$metadata')?'application/xml':'application/json','x-sap-sac-custom-auth':'true'}});
  if(!response.ok){if(response.status===401)cachedToken=undefined;throw new HttpError(502,'O SAP recusou a consulta. Confira o modelo e a permissão de leitura do cliente técnico.');}
  const text=await bounded(response);
  if(path.endsWith('$metadata')){if(!/<(?:\w+:)?Edmx[\s>]/.test(text))throw new HttpError(502,'O SAP não retornou metadados EDMX válidos.');return {body:text,type:'application/xml; charset=utf-8'};}
  const payload=JSON.parse(text);
  if(!payload||typeof payload!=='object'||Array.isArray(payload)||(!Array.isArray(payload.value)&&access.kind!=='namespace'))throw new HttpError(502,'O SAP não retornou uma coleção OData válida.');
  if(access.kind==='namespaces')payload.value=payload.value.filter((r:{NamespaceID?:string})=>access.models.some(m=>m.namespace===r.NamespaceID));
  if(access.kind==='providers')payload.value=payload.value.filter((r:{ProviderID?:string})=>access.models.some(m=>m.provider===r.ProviderID));
  if(payload['@odata.nextLink']){
   const next=new URL(payload['@odata.nextLink'],url);
   if(next.origin!==base.origin||next.pathname!==url.pathname||next.username||next.password||next.hash)throw new HttpError(502,'O SAP retornou uma paginação fora da coleção autorizada.');
   sacQuery(next.searchParams);payload['@odata.nextLink']=sacProxyPath+path+next.search;
  }
  delete payload['@odata.deltaLink'];delete payload['@odata.deltalink'];
  return {body:payload,type:'application/json'};
 }catch(error){if(error instanceof HttpError)throw error;if(requestSignal.aborted)throw new HttpError(504,'A consulta SAP excedeu o prazo.');throw new HttpError(502,'Não foi possível consultar o SAP Analytics Cloud. Confira a conexão e o contrato.');}
}
export async function readSacSample(workspace:string,selection?:Selection,signal?:AbortSignal){
 const model=selection||sacSelection.parse({namespace:process.env.SAP_SAC_NAMESPACE,provider:process.env.SAP_SAC_PROVIDER});
 const path=`providers/${model.namespace}/${model.provider}/FactData`,rows:Record<string,unknown>[]=[],seen=new Set<string>();let query=new URLSearchParams(process.env.SAP_SAC_DEFAULT_QUERY||''),bytes=0;
 while(true){
  const fingerprint=query.toString();if(seen.has(fingerprint)||seen.size>=25)throw new HttpError(413,'A consulta SAP excedeu 25 páginas ou repetiu a paginação.');seen.add(fingerprint);
  const {body}=await querySac(workspace,path,query,signal);const data=body as {value:Record<string,unknown>[];'@odata.nextLink'?:string};
  bytes+=Buffer.byteLength(JSON.stringify(data));rows.push(...data.value);
  if(bytes>MAX_BYTES||rows.length>MAX_ROWS)throw new HttpError(413,'Reduza a consulta SAP para até 20 mil registros e 8 MB.');
  if(!data['@odata.nextLink'])break;query=new URL(data['@odata.nextLink'],'https://clara.invalid').searchParams;
 }
 if(!rows.length)throw new HttpError(422,'A consulta SAP não retornou registros.');
 const clean=rows.map(row=>Object.fromEntries(Object.entries(row).filter(([key])=>!key.startsWith('@'))));
 if(clean.some(row=>Object.values(row).some(value=>value!==null&&typeof value==='object')))throw new HttpError(502,'Selecione colunas simples para importar os dados SAP.');
 return parseFile(Buffer.from(JSON.stringify(clean)),'SAP.json');
}
