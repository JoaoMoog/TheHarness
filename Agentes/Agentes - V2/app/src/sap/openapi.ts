const selection={type:'string',pattern:'^[A-Za-z0-9_-]{1,128}$'};
const scope={name:'x-clara-workspace',in:'header',required:true,schema:{type:'string'},description:'ID do espaço CLARA ao qual a sessão deve pertencer.'};
const query=[
 {name:'$select',in:'query',schema:{type:'string',maxLength:2048},description:'Projeção OData; preserve as dimensões exigidas pelo modelo SAC.'},
 {name:'$filter',in:'query',schema:{type:'string',maxLength:2048},description:'Expressão OData interpretada pelo SAP.'},
 {name:'$top',in:'query',schema:{type:'integer',minimum:1,maximum:1000}},
 {name:'$skip',in:'query',schema:{type:'integer',minimum:0,maximum:20000}},
 ...['$skiptoken','nextEntity'].map(name=>({name,in:'query',schema:{type:'string',maxLength:2048},description:'Cursor devolvido pelo SAP; não invente valores.'})),
 {name:'$format',in:'query',schema:{type:'string',enum:['json']}},
];
function read(summary:string,parameters:unknown[]=[],xml=false){return {get:{summary,security:[{session:[]}],parameters:[scope,...parameters,...query],responses:{'200':{description:'Resposta SAC; catálogo limitado aos modelos autorizados e nextLink reescrito para a CLARA.',content:xml?{'application/xml':{schema:{type:'string'}}}:{'application/json':{schema:{$ref:'#/components/schemas/OData'}}}},...Object.fromEntries([401,403,404,413,422,502,503,504].map(code=>[code,{description:({401:'Sem sessão',403:'Sem acesso ao espaço/modelo',404:'Endpoint não disponível',413:'Resposta excessiva',422:'Parâmetro inválido',502:'Falha SAP/contrato',503:'Configuração pendente',504:'Tempo excedido'} as Record<number,string>)[code],content:{'application/json':{schema:{$ref:'#/components/schemas/Error'}}}}]))}}};}
const namespace={name:'NamespaceID',in:'path',required:true,schema:selection},provider={name:'ProviderID',in:'path',required:true,schema:selection};
export const sapOpenApi={openapi:'3.1.0',info:{title:'CLARA — SAP Analytics Cloud Data Export',version:'1.0.0',description:'Contrato do adaptador de leitura. Espelha o subconjunto documentado do Data Export Service; não é um serviço SAP oficial. OAuth técnico permanece no servidor. Sem escrita, $batch ou sincronização delta.'},servers:[{url:'/api/v1/sap/dataexport'}],paths:{
 '/administration/$metadata':read('Metadados do catálogo',[],true),
 '/administration/Namespaces':read('Namespaces autorizados'),
 "/administration/Namespaces(NamespaceID='{NamespaceID}')":read('Namespace autorizado',[namespace]),
 "/administration/Namespaces(NamespaceID='{NamespaceID}')/Providers":read('Modelos autorizados no namespace',[namespace]),
 '/providers/{NamespaceID}/{ProviderID}':read('Service document e coleções',[namespace,provider]),
 '/providers/{NamespaceID}/{ProviderID}/$metadata':read('Metadados EDMX do modelo',[namespace,provider],true),
 '/providers/{NamespaceID}/{ProviderID}/{EntitySet}':read('FactData ou coleção simples de dados mestres',[namespace,provider,{name:'EntitySet',in:'path',required:true,schema:{type:'string',pattern:'^[A-Za-z_][A-Za-z0-9_]{0,127}$'},description:'Nome do service document. FactDataDifference e Subscriptions não são aceitos.'}]),
 },components:{securitySchemes:{session:{type:'apiKey',in:'cookie',name:'prometeu-session'}},schemas:{OData:{type:'object',properties:{'@odata.context':{type:'string'},'@odata.nextLink':{type:'string',description:'URL relativa da CLARA; envie o mesmo x-clara-workspace ao continuar.'},value:{type:'array',items:{type:'object',additionalProperties:true}}},additionalProperties:true},Error:{type:'object',required:['error'],properties:{error:{type:'object',required:['code','message'],properties:{code:{type:'string'},message:{type:'string'}}}}}}}};
