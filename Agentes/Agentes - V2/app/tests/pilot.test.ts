import test from 'node:test';
import assert from 'node:assert/strict';
import {filtersSchema, documentSchema} from '../src/studio/contracts';
import {summarize, simulate} from '../src/studio/domain';

test('Piloto: datas inclusivas não misturam anos e trimestre legado continua legível',()=>{
 const rows=[{id:'1',company:'Sul',center:'Pesquisa',date:'2025-09-01',actual:10.11,budget:20,index:8,month:'Set'},{id:'2',company:'Sul',center:'Pesquisa',date:'2026-09-01',actual:30,budget:40,index:8,month:'Set'}];
 const filters=filtersSchema.parse({dateFrom:'2025-09-01',dateTo:'2025-09-30'});
 const snapshot={rows,revision:'x',provider:'demo' as const,updatedAt:''};
 assert.equal(summarize(snapshot,filters).actual,10.11);
 assert.equal(summarize(snapshot,filtersSchema.parse({period:'q3'})).count,2);
 assert.equal(documentSchema.parse({schemaVersion:1,title:'Antigo',period:'q3'}).period,'q3');
 assert.throws(()=>filtersSchema.parse({dateFrom:'2026-02-30',dateTo:'2026-03-01'}));
 assert.throws(()=>filtersSchema.parse({dateFrom:'2026-10-01',dateTo:'2026-09-01'}));
});
test('Piloto: cenário calcula centavos para centro escolhido',()=>{
 const result=simulate({actual:120.11,balance:10,groups:[{name:'Pesquisa',code:'P',owner:'',actual:100.11,budget:110},{name:'Tecnologia',code:'T',owner:'',actual:20,budget:20}]},5,'Pesquisa');
 assert.equal(result.saving,5.01);assert.equal(result.actual,115.10);assert.equal(result.balance,15.01);
});
test('Piloto: serviço HTTP pagina, autentica e conserva totais independentes',async()=>{
 const mod=await import('../src/server/financial-test/server').catch(()=>null);
 assert.ok(mod,'Serviço financeiro deve existir');
 const server=mod.createFinancialServer({token:'test-token'});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 const addr=server.address() as {port:number};const base=`http://127.0.0.1:${addr.port}`;
 try{
  assert.equal((await fetch(base+'/health')).status,200);
  assert.equal((await fetch(base+'/odata/FinancialFacts')).status,401);
  const rows:any[]=[];let url=base+'/odata/FinancialFacts';let pages=0;
  while(url){const res=await fetch(url,{headers:{Authorization:'Bearer test-token'}});assert.equal(res.status,200);const body=await res.json();rows.push(...body.value);url=body['@odata.nextLink']?new URL(body['@odata.nextLink'],url).href:'';pages++;}
  assert.equal(rows.length,432);assert.ok(pages>1);assert.equal(new Set(rows.map(r=>r.DocumentId)).size,432);
  assert.equal(rows.reduce((n,r)=>n+Math.round(Number(r.ActualAmount)*100),0),67532877);
  assert.equal(rows.reduce((n,r)=>n+Math.round(Number(r.BudgetAmount)*100),0),66427000);
 }finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
