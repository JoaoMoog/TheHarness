import {z} from 'zod';
import {assistantInputSchema,assistantOutputSchema,documentSchema,mutationSchema,querySchema,formulaSchema} from './contracts';
const str={type:'string'},num={type:'number'};
const ref=(name:string)=>({'$ref':`#/components/schemas/${name}`});
const json=(schema:object)=>({content:{'application/json':{schema}}});
const object=(properties:Record<string,unknown>,required=Object.keys(properties))=>({type:'object',properties,required,additionalProperties:false});
const list=(items:object)=>({type:'array',items});
const actor=object({id:str,name:str,demo:{type:'boolean'},auth:{type:'string',enum:['demo','local','msal']},email:str},['id','name','demo']);
const workspace=object({id:str,owner:str,name:str,personal:{type:'boolean'},role:{type:'string',enum:['reader','editor','admin']}});
const version=object({id:str,at:str,document:ref('DashboardDocument')});
const board=object({id:str,document:ref('DashboardDocument'),favorite:{type:'boolean'},revision:{type:'integer'},updatedAt:str,versions:list(version)});
const plan=object({id:str,name:str,budgets:list(num),total:num,baseRevision:str,createdAt:str,createdBy:str});
const scenario=object({id:str,name:str,percent:num,saving:num,actual:num,balance:num,baseRevision:str,createdAt:str,createdBy:str});
const state=object({id:str,owner:str,schemaVersion:{const:1},revision:{type:'integer'},boards:list(board),plans:list(plan),scenarios:list(scenario),measure:object({name:str,formula:{type:'string',enum:formulaSchema.options}}),comments:list(object({id:str,boardId:str,authorId:str,author:str,text:str,at:str})),sourcePaused:{type:'boolean'},updatedAt:str});
const runtime=object({storage:{enum:['memory','sqlite']},temporary:{type:'boolean'},dataProvider:str,aiProvider:str,sso:str,persistence:str,sap:str,ai:str,replicas:{const:1}});
const group=object({name:str,code:str,owner:str,actual:num,budget:num});
const row=object({id:str,center:str,company:str,date:str,month:str,index:{type:'integer'},actual:num,budget:num});
const lineage=object({sourceId:str,revision:str,provider:str,updatedAt:str,unit:{const:'BRL'},filters:object({center:str,period:{enum:['all','q3']},company:str})});
const messages=list(object({role:{enum:['user','assistant']},text:str}));
const schemas={
 DashboardDocument:z.toJSONSchema(documentSchema),Mutation:z.toJSONSchema(mutationSchema,{io:'input'}),Query:z.toJSONSchema(querySchema,{io:'input'}),AssistantInput:z.toJSONSchema(assistantInputSchema,{io:'input'}),AssistantOutput:{...z.toJSONSchema(assistantOutputSchema),properties:{...z.toJSONSchema(assistantOutputSchema).properties,provider:str,messages},required:['status','message','proposal','provider','messages']},
 Error:object({error:object({code:str,message:str,requestId:{type:'string',format:'uuid'}})}),
 Bootstrap:object({actor,workspace,workspaces:list(workspace),state,runtime,messages,targetId:str},['actor','workspace','workspaces','state','runtime','messages']),
 QueryResult:object({actual:num,budget:num,balance:num,execution:{type:['number','null']},groups:list(group),months:list(object({month:str,index:{type:'integer'},actual:num,budget:num})),rows:list(row),count:{type:'integer'},matchedCount:{type:'integer'},offset:{type:'integer'},limit:{type:'integer'},lineage}),
 Catalog:object({sourceId:str,name:str,revision:str,provider:str,updatedAt:str,unit:str,rowCount:{type:'integer'},periods:list(str),centers:list(str),companies:list(str),fields:list({type:'object',properties:{key:str,type:str,role:str,aggregation:str,unit:str},required:['key','type','role']}),limits:object({records:{type:'integer'},page:{type:'integer'},bytes:{type:'integer'}}),semantics:{type:'object',additionalProperties:{type:'string'}}}),
 ScenarioPreview:object({percent:num,saving:num,actual:num,balance:num,baseRevision:str,base:ref('QueryResult'),forecast:list(object({month:str,forecast:num,budget:num}))}),
 Config:object({runtime,demo:{type:'boolean'},sso:object({clientId:str,tenantId:str,scope:str})}),
};
function operation(summary:string,response:object,body?:object,publicAccess=false){return {summary,security:publicAccess?[]:[{session:[]}],...(!publicAccess?{parameters:[{in:'header',name:'x-clara-workspace',required:false,schema:str,description:'Espaço autorizado da sessão; omitido usa o pessoal.'}]}:{}),...(body?{requestBody:{required:true,...json(body)}}:{}),responses:{'200':{description:'Sucesso',...json(response)},...Object.fromEntries([400,401,403,404,409,413,422,429,502,503,504].map(code=>[code,{description:'Falha validada; nenhuma alteração parcial',...json(ref('Error'))}]))}}}
export function studioOpenApi(){return {openapi:'3.1.0',info:{title:'CLARA Studio API',version:'1.0.0',description:'API de análise financeira. Cookie HttpOnly e Origin nas mutações. Armazenamento temporário na avaliação; uma réplica. Comandos exigem revisão global e operationId (últimos 50 recibos por espaço). Demo e SAP compartilham o contrato canônico BRL. SAP somente leitura.'},servers:[{url:'/api/v1/studio'}],components:{schemas,securitySchemes:{session:{type:'apiKey',in:'cookie',name:'prometeu-session'}}},paths:{
 '/config':{get:operation('Configuração pública sem segredos',ref('Config'),undefined,true)},
 '/session':{post:operation('Criar sessão demonstrativa isolada',ref('Bootstrap'),object({name:{type:'string',maxLength:80}},[]),true)},
 '/bootstrap':{get:operation('Estado do espaço e conversa privada',ref('Bootstrap'))},
 '/catalog':{get:operation('Metadados e semântica da fonte financeira',ref('Catalog'))},
 '/query':{post:operation('Consultar dados com filtros e paginação de registros',ref('QueryResult'),ref('Query'))},
 '/commands':{post:operation('Executar comando autorizado e idempotente',ref('Bootstrap'),ref('Mutation'))},
 '/assistant':{post:operation('Obter proposta de análise; não salva dashboard',ref('AssistantOutput'),ref('AssistantInput'))},
 '/scenario':{post:operation('Calcular redução em Tecnologia sobre base completa',ref('ScenarioPreview'),object({percent:{type:'number',minimum:0,maximum:100}}))},
 '/openapi':{get:operation('Obter este contrato OpenAPI',{type:'object'},undefined,true)},
 }}}
