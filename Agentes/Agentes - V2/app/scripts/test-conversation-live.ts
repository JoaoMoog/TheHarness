import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {randomBytes} from 'node:crypto';
import {pilotSettings} from './pilot-env.mjs';
import {createFinancialServer} from '../src/server/financial-test/server';
import {BedrockRuntimeClient} from '@aws-sdk/client-bedrock-runtime';
import {mock} from 'node:test';
import {assistantOutputSchema} from '../src/studio/contracts';

Object.assign(process.env,pilotSettings(resolve('.')),{CLARA_STORAGE_MODE:'memory',STUDIO_AI_PROVIDER:'bedrock'});
async function main(){
 const originalSend=BedrockRuntimeClient.prototype.send;
 const inspect=mock.method(BedrockRuntimeClient.prototype,'send',async function(this:BedrockRuntimeClient,...args:any[]){
  const result:any=await (originalSend as any).apply(this,args);
  const text=result.output?.message?.content?.map((part:any)=>part.text||'').join('')||'';
  try{const parsed=assistantOutputSchema.safeParse(JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g,'')));if(!parsed.success)console.error('Synthetic response contract issues:',JSON.stringify(parsed.error.issues));}catch{console.error('Synthetic response is not JSON');}
  return result;
 });
 const token=randomBytes(32).toString('hex'),server=createFinancialServer({token});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 process.env.SAP_READ_URL=`http://127.0.0.1:${(server.address() as {port:number}).port}/odata/FinancialFacts`;process.env.SAP_READ_TOKEN=token;
 try{
  const service=await import('../src/server/studio/service');
  const actor={id:crypto.randomUUID(),name:'Teste de conversa',demo:false,auth:'local' as const};
  const initial=service.bootstrapStudio(actor),document=initial.state.boards[0].document,conversationId=crypto.randomUUID();
  const ask=(prompt:string)=>service.assistantStudio(actor,undefined,{prompt,document,conversationId});
  const goal=await ask('Quero criar um dashboard');assert.equal(goal.status,'clarify');console.log('PASS: pede objetivo');
  const period=await ask('Compare despesas realizadas e orçamento da Filial Sul em setembro, usando barras horizontais');assert.equal(period.status,'clarify');console.log('PASS: pede ano ambíguo');
  const answer=await ask('2025');assert.equal(answer.status,'ready');assert.equal(answer.proposal?.kind,'create');
  assert.equal(answer.proposal?.patch.company,'Filial Sul');assert.equal(answer.proposal?.patch.chart,'bar');
  assert.equal(answer.proposal?.patch.dateFrom,'2025-09-01');assert.equal(answer.proposal?.patch.dateTo,'2025-09-30');
  assert.equal(service.bootstrapStudio(actor).state.revision,initial.state.revision);console.log('PASS: resposta curta completa o dashboard sem salvar');
 }finally{inspect.mock.restore();server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()))}
}
main().catch(error=>{console.error(error instanceof Error?error.message:'Falha no teste de conversa.');process.exitCode=1});
