import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
import {BedrockRuntimeClient} from '@aws-sdk/client-bedrock-runtime';
import {bedrockPlanner,bedrockError} from '../src/server/studio/bedrock';
import {demoRows,summarize} from '../src/studio/domain';
import {initialDocument,filtersSchema} from '../src/studio/contracts';
process.env.CLARA_STORAGE_MODE='memory';process.env.AWS_REGION='us-east-1';process.env.BEDROCK_MODEL_ID='test';
const data=summarize({rows:demoRows,provider:'demo',revision:'test',updatedAt:''},filtersSchema.parse({}));
test('Bedrock: rejeita JSON inválido e nunca aplica resposta fora do contrato',async()=>{
 const send=mock.method(BedrockRuntimeClient.prototype,'send',async()=>({output:{message:{content:[{text:'{"status":"ready","proposal":{"sql":"DROP TABLE"}}'}]}},$metadata:{}}));
 try{await assert.rejects(bedrockPlanner.propose({prompt:'Teste',document:initialDocument,percent:5},data),/incompatível/);}finally{send.mock.restore();}
});
test('Bedrock: envia catálogo e histórico limitado e preserva patch esparso',async()=>{
 let payload:any;const send=mock.method(BedrockRuntimeClient.prototype,'send',async(command:any)=>{payload=JSON.parse(command.input.messages[0].content[0].text);return {output:{message:{content:[{text:JSON.stringify({status:'ready',message:'Confira.',proposal:{kind:'chart',title:'Barras',description:'Ajustar gráfico.',patch:{chart:'bar'}}})}]}},usage:{inputTokens:10,outputTokens:20},$metadata:{requestId:'test'}}});
 try{const answer=await bedrockPlanner.propose({prompt:'Barras',document:initialDocument,percent:5},data,undefined,{companies:['Sul'],centers:['Pesquisa'],periods:['2025-09','2026-09'],messages:Array.from({length:20},()=>({role:'user' as const,text:'x'.repeat(4000)}))});assert.deepEqual(answer.proposal?.patch,{chart:'bar'});assert.deepEqual(payload.catalog.companies,['Sul']);assert.deepEqual(payload.coverage,{firstMonth:'2025-09',lastMonth:'2026-09',years:['2025','2026']});assert.equal(payload.history.length,20);assert.equal(payload.history[0].text.length,2000);}finally{send.mock.restore();}
});
test('Bedrock: distingue acesso, credencial, timeout e cota sem expor detalhes do provedor',()=>{
 for(const [name,status] of [['CredentialsProviderError',503],['AccessDeniedException',403],['ThrottlingException',429],['TimeoutError',504]] as const){const error=bedrockError({name,message:'secret'});assert.equal(error.status,status);assert.ok(!error.message.includes('secret'));}
 const billing=bedrockError({name:'AccessDeniedException',message:'INVALID_PAYMENT_INSTRUMENT: sensitive details'});assert.equal(billing.status,403);assert.match(billing.message,/meio de pagamento/);assert.ok(!billing.message.includes('sensitive details'));
});
