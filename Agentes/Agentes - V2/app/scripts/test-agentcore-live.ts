import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {randomBytes,randomUUID} from 'node:crypto';
import {pilotSettings} from './pilot-env.mjs';
import {createFinancialServer} from '../src/server/financial-test/server';

Object.assign(process.env,pilotSettings(resolve('.')),{CLARA_STORAGE_MODE:'memory',STUDIO_AI_PROVIDER:'agentcore'});
async function main(){
 const token=randomBytes(32).toString('hex'),server=createFinancialServer({token});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 process.env.SAP_READ_URL=`http://127.0.0.1:${(server.address() as {port:number}).port}/odata/FinancialFacts`;process.env.SAP_READ_TOKEN=token;
 try{
  const service=await import('../src/server/studio/service');
  const actor={id:randomUUID(),name:'Teste AgentCore',demo:false,auth:'local' as const};
  const initial=service.bootstrapStudio(actor),document=initial.state.boards[0].document,conversationId=randomUUID();
  const ask=(prompt:string)=>service.assistantStudio(actor,undefined,{prompt,document,conversationId});
  const goal=await ask('Quero criar um dashboard');assert.equal(goal.status,'clarify');console.log('PASS: pede objetivo');
  const year=await ask('Compare despesas realizadas e orçamento da Filial Sul em setembro, usando barras horizontais');assert.equal(year.status,'clarify',JSON.stringify(year.proposal));console.log('PASS: esclarece o ano');
  const answer=await ask('2025');assert.equal(answer.status,'ready');assert.equal(answer.proposal?.kind,'create');
  assert.equal(answer.proposal?.patch.company,'Filial Sul');assert.equal(answer.proposal?.patch.chart,'bar');
  assert.equal(answer.proposal?.patch.dateFrom,'2025-09-01');assert.equal(answer.proposal?.patch.dateTo,'2025-09-30');
  console.log('PASS: resposta curta completa o pedido');
  const refine=await ask('Mude para colunas');assert.equal(refine.status,'ready');assert.equal(refine.proposal?.patch.chart,'column');assert.equal(refine.proposal?.patch.company,'Filial Sul');assert.equal(refine.proposal?.patch.dateFrom,'2025-09-01');console.log('PASS: refina sem perder filtros');
  assert.equal(service.bootstrapStudio(actor).state.revision,initial.state.revision);console.log('PASS: nenhum dashboard salvo sem aplicação');
  const another=await service.assistantStudio(actor,undefined,{prompt:'2025',document,conversationId:randomUUID()});
  assert.notEqual(another.proposal?.patch.company,'Filial Sul');assert.notEqual(another.proposal?.patch.dateFrom,'2025-09-01');
  assert.equal(another.messages.length,2);console.log('PASS: outra conversa não herda empresa, mês ou histórico');
 }finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()))}
}
main().catch(error=>{console.error(error instanceof Error?error.message:'Falha na conversa AgentCore.');process.exitCode=1});
