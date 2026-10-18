import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
import {BedrockAgentCoreClient} from '@aws-sdk/client-bedrock-agentcore';
import {agentcorePlanner} from '../src/server/studio/agentcore';
import {agentcoreError,agentcoreSettings} from '../src/server/agentcore';
import {demoRows,summarize} from '../src/studio/domain';
import {initialDocument,filtersSchema} from '../src/studio/contracts';
import {planDashboard} from '../src/server/provider';
import {demoPlan} from '../src/core/planner';
import {sapSource} from '../src/server/seed';
process.env.CLARA_STORAGE_MODE='memory';process.env.AWS_REGION='us-east-1';
process.env.AGENTCORE_HARNESS_ARN='arn:aws:bedrock-agentcore:us-east-1:123456789012:harness/clara_test-1234567890';
const data=summarize({rows:demoRows,provider:'demo',revision:'test',updatedAt:''},filtersSchema.parse({}));
const input={prompt:'Barras',document:initialDocument,percent:5};
const answer={status:'ready',message:'Confira.',proposal:{kind:'chart',title:'Barras',description:'Gráfico em barras.',patch:{chart:'bar'}}};
async function* stream(text=JSON.stringify(answer),stop='end_turn'){
 yield {contentBlockDelta:{contentBlockIndex:0,delta:{text:text.slice(0,12)}}};
 yield {contentBlockDelta:{contentBlockIndex:0,delta:{text:text.slice(12)}}};
 yield {messageStop:{stopReason:stop}};
}
test('AgentCore: respostas fragmentadas, contexto autorizado e sessões isoladas',async()=>{
 const commands:any[]=[];
 const send=mock.method(BedrockAgentCoreClient.prototype,'send',async(command:any)=>{commands.push(command.input);return {stream:stream()}});
 try{
  const context={companies:['Sul'],centers:['Pesquisa'],periods:['2025-09','2026-09'],messages:Array.from({length:50},()=>({role:'user' as const,text:'x'.repeat(3000)}))};
  assert.deepEqual((await agentcorePlanner.propose(input,data,undefined,context)).proposal?.patch,{chart:'bar'});
  await agentcorePlanner.propose(input,data);
  const payload=JSON.parse(commands[0].messages[0].content[0].text);
  assert.equal(payload.history.length,40);assert.equal(payload.history[0].text.length,2000);
  assert.deepEqual(payload.coverage.years,['2025','2026']);
  assert.notEqual(commands[0].runtimeSessionId,commands[1].runtimeSessionId);
  assert.match(commands[0].runtimeSessionId,/^[a-f0-9-]{36}$/);
  assert.deepEqual(commands[0].allowedTools,[]);assert.deepEqual(commands[0].skills,[]);
  assert.equal(commands[0].maxIterations,1);assert.equal(commands[0].model,undefined);
 }finally{send.mock.restore()}
});
test('AgentCore: rejeita fluxo interrompido, inválido, ferramentas e falha após texto válido',async()=>{
 for(const events of [stream('not json'),stream(JSON.stringify(answer),'max_tokens'),(async function*(){yield {contentBlockDelta:{delta:{text:JSON.stringify(answer)}}}})(),(async function*(){yield {contentBlockStart:{start:{toolUse:{name:'shell'}}}}})(),(async function*(){yield* stream();yield {runtimeClientError:{message:'secret'}}})()]){
  const send=mock.method(BedrockAgentCoreClient.prototype,'send',async()=>({stream:events}));
  try{await assert.rejects(agentcorePlanner.propose(input,data),(error:any)=>error.status===502&&!error.message.includes('secret'));}finally{send.mock.restore()}
 }
});
test('AgentCore: erro de credenciais, acesso, limite e cancelamento seguro',async()=>{
 for(const [name,status] of [['CredentialsProviderError',503],['AccessDeniedException',403],['ThrottlingException',429],['TimeoutError',504]] as const){const error=agentcoreError({name,message:'secret'});assert.equal(error.status,status);assert.ok(!error.message.includes('secret'))}
 const send=mock.method(BedrockAgentCoreClient.prototype,'send',async()=>({stream:stream()}));
 try{await assert.rejects(agentcorePlanner.propose(input,data,AbortSignal.abort()),(error:any)=>error.status===504);}finally{send.mock.restore()}
});
test('AgentCore: recusa ARN de outra região antes de enviar dados',()=>{
 process.env.AWS_REGION='eu-west-1';try{assert.throws(agentcoreSettings,/região/)}finally{process.env.AWS_REGION='us-east-1'}
});
test('AgentCore: planejador de fontes mantém seu contrato e não envia linhas brutas',async()=>{
 process.env.AI_PROVIDER='agentcore';const source=sapSource('finance','agentcore-test'),plan=demoPlan('Compare despesas.',source);
 let command:any;
 const send=mock.method(BedrockAgentCoreClient.prototype,'send',async(c:any)=>{command=c.input;return {stream:stream(JSON.stringify(plan))}});
 try{assert.equal((await planDashboard('Compare despesas.',source)).status,'ready');assert.match(command.messages[0].content[0].text,/totals/);assert.doesNotMatch(command.messages[0].content[0].text,/"rows"/);}finally{send.mock.restore();delete process.env.AI_PROVIDER}
});
