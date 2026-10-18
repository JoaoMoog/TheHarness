import test from 'node:test';
import assert from 'node:assert/strict';
import {createFinancialServer,type FinancialProfile} from '../src/server/financial-test/server';
import {readSapSample} from '../src/server/sap';
import {mapSapRows,mappingSchema} from '../src/server/studio/providers';
test('Piloto: falhas HTTP e timeout não produzem dados demonstrativos',async()=>{
 for(const profile of ['unavailable','unauthorized','invalid','slow'] as FinancialProfile[]){
  const server=createFinancialServer({token:'test',profile,delayMs:200});await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));
  const url=`http://127.0.0.1:${(server.address() as {port:number}).port}/odata/FinancialFacts`;
  try{if(profile==='invalid'){const sample=await readSapSample({url,token:'test'});const rows=sample.rows.map(row=>Object.fromEntries(sample.columns.map(c=>[c.label,row[c.key]])));assert.throws(()=>mapSapRows(rows,mappingSchema.parse({id:'DocumentId',company:'Company',center:'CostCenter',date:'PostingDate',actual:'ActualAmount',budget:'BudgetAmount',currency:'Currency'})),/BRL/);}else await assert.rejects(readSapSample({url,token:'test',signal:profile==='slow'?AbortSignal.timeout(30):undefined}),error=>(error as {status:number}).status===(profile==='slow'?504:502));}
  finally{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));}
 }
});
