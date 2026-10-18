import test from 'node:test';
import assert from 'node:assert/strict';
import {initialDocument,type QueryResult} from '../src/studio/contracts';
import {decisionSummary,proposalChanges,axisAmount} from '../src/studio/ui/evidenceModel';

const data={count:4,actual:110,budget:100,balance:-10,execution:110,groups:[{name:'Pesquisa',actual:70,budget:50},{name:'Vendas',actual:40,budget:50}]} as QueryResult;
test('conclusion distinguishes empty data, missing budget and offsetting deviations',()=>{
 assert.equal(decisionSummary({...data,count:0}).tone,'neutral');
 assert.match(decisionSummary({...data,count:0}).title,/Nenhum registro/);
 assert.match(decisionSummary({...data,budget:0}).title,/Sem orçamento/);
 assert.equal(decisionSummary(data).center,'Pesquisa');
 const offset=decisionSummary({...data,balance:5,actual:95});
 assert.match(offset.title,/dentro do orçamento/);
 assert.match(offset.detail,/Pesquisa/);
});
test('proposal comparison omits unchanged fields and preserves false, zero and cleared dates',()=>{
 const current={...initialDocument,highlight:true,percent:5,period:'range',dateFrom:'2025-01-01',dateTo:'2025-12-31'};
 const changes=proposalChanges(current,{kind:'filter',title:'Ajuste',description:'Confira',patch:{highlight:false,percent:0,period:'all',dateFrom:null,dateTo:null,chart:'column'}});
 assert.deepEqual(changes.map(c=>c.label),['Período','Destacar desvios','Redução simulada']);
 assert.equal(changes[0].after,'Todo o período');
 assert.equal(changes[1].after,'Não');assert.equal(changes[2].after,'0%');
 assert.deepEqual(proposalChanges(initialDocument,{kind:'chart',title:'Sem mudança',description:'Confira',patch:{chart:'column'}}),[]);
});
test('small chart values remain legible instead of rounding to zero millions',()=>{
 assert.equal(axisAmount(5000),'5 mil');assert.equal(axisAmount(1500000),'1,5 mi');assert.equal(axisAmount(42),'42');assert.equal(axisAmount(-2500),'-2,5 mil');
});
