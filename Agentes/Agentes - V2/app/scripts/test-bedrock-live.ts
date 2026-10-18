import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pilotSettings} from './pilot-env.mjs';
import {createFinancialServer} from '../src/server/financial-test/server';
import {randomBytes} from 'node:crypto';
Object.assign(process.env,pilotSettings(resolve('.')),{CLARA_STORAGE_MODE:'memory',STUDIO_AI_PROVIDER:'bedrock'});
async function main(){
 const token=randomBytes(32).toString('hex'),server=createFinancialServer({token});await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));
 process.env.SAP_READ_URL=`http://127.0.0.1:${(server.address() as {port:number}).port}/odata/FinancialFacts`;process.env.SAP_READ_TOKEN=token;
 try{
  const service=await import('../src/server/studio/service');const actor={id:crypto.randomUUID(),name:'Teste Bedrock',demo:false,auth:'local' as const};const document=service.bootstrapStudio(actor).state.boards[0].document;
  const cases:[string,(answer:any)=>boolean][]=[
   ['Crie um dashboard financeiro.',a=>a.status==='ready'&&a.proposal?.kind==='create'],
   ['Mostre apenas Filial Sul em setembro de 2025.',a=>a.proposal?.patch.company==='Filial Sul'&&a.proposal?.patch.dateFrom==='2025-09-01'&&a.proposal?.patch.dateTo==='2025-09-30'],
   ['Troque o gráfico por barras horizontais.',a=>a.proposal?.patch.chart==='bar'],
   ['Simule redução de 5% em Pesquisa.',a=>a.proposal?.patch.scenarioCenter==='Pesquisa'&&a.proposal?.patch.percent===5],
   ['Mostre setembro.',a=>a.status==='clarify'&&a.proposal===null],
  ];
  for(const [prompt,accept] of cases){const answer=await service.assistantStudio({...actor,id:crypto.randomUUID()},undefined,{prompt,document,percent:5});assert.ok(accept(answer),`Intenção não atendida: ${prompt}; resposta do ensaio sintético: ${JSON.stringify(answer)}`);console.log(`PASS: ${prompt}`);}
 }finally{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));}
}
main().catch(error=>{console.error(error instanceof Error?error.message:'Falha no teste real.');process.exitCode=1;});
