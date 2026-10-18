import test from 'node:test';
import assert from 'node:assert/strict';
import {createFinancialServer} from '../src/server/financial-test/server';
process.env.CLARA_STORAGE_MODE='memory';process.env.AUTH_MODE='local';process.env.STUDIO_DATA_PROVIDER='financial-test';
process.env.STUDIO_AI_PROVIDER='demo';process.env.SAP_READ_TOKEN='integration';
process.env.SAP_STUDIO_MAPPING=JSON.stringify({id:'DocumentId',center:'CostCenter',company:'Company',date:'PostingDate',actual:'ActualAmount',budget:'BudgetAmount',currency:'Currency'});
test('Piloto: integração HTTP, planejamento dinâmico, revisão e cenário por recorte',async()=>{
 const server=createFinancialServer({token:'integration'});await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));
 process.env.SAP_READ_URL=`http://127.0.0.1:${(server.address() as {port:number}).port}/odata/FinancialFacts`;
 const s=await import('../src/server/studio/service');const actor={id:'pilot-integration',name:'Analista',demo:false,auth:'local' as const};
 try{
  const all=await s.queryStudio(actor,undefined,{});assert.equal(all.lineage.provider,'financial-test');assert.equal(all.count,432);assert.equal(all.actual,675328.77);
  const filters={company:'Filial Sul',center:'all',period:'range',dateFrom:'2025-09-01',dateTo:'2025-09-30'};
  const query=await s.queryStudio(actor,undefined,filters);assert.equal(query.groups.length,6);assert.equal(query.count,6);
  const command=(command:any)=>s.commandStudio(actor,undefined,{revision:s.bootstrapStudio(actor).state.revision,operationId:crypto.randomUUID(),command:{...command,...(['plan.save','scenario.save'].includes(command.type)?{baseRevision:query.lineage.revision}:{})}});
  const saved=command({type:'plan.save',name:'Revisão setembro',filters,budgets:query.groups.map(g=>({center:g.name,amount:g.budget+10}))});
  assert.equal(saved.state.plans[0].budgets.length,6);assert.equal(saved.state.plans[0].filters?.dateFrom,'2025-09-01');
  const scenario=command({type:'scenario.save',name:'Pesquisa setembro',percent:5,center:'Pesquisa',filters}).state.scenarios[0];
  assert.equal(scenario.saving,Math.round(query.groups.find(g=>g.name==='Pesquisa')!.actual*5)/100);assert.equal(scenario.filters?.company,'Filial Sul');
  assert.throws(()=>command({type:'plan.save',name:'Duplicados',filters,budgets:[{center:'Pesquisa',amount:1},{center:'Pesquisa',amount:2}]}));
  assert.throws(()=>command({type:'scenario.save',name:'Centro ausente',percent:5,center:'Não existe',filters}));
  const board=command({type:'dashboard.save',document:{...s.bootstrapStudio(actor).state.boards[0].document,...filters,title:'Piloto'}});assert.equal(board.state.boards[0].sourceRevision,query.lineage.revision);
 }finally{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));}
});
