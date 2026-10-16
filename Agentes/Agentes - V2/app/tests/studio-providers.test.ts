import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
import {mapSapRows,mappingSchema,sapDataProvider,bedrockPlanner,planner,demoPlanner} from '../src/server/studio/providers';
import {initialDocument} from '../src/studio/contracts';
import {demoRows,summarize} from '../src/studio/domain';
const mapping=mappingSchema.parse({id:'id',center:'center',company:'company',date:'date',actual:'actual',budget:'budget',currency:'currency'});
const row={id:'doc-1',center:'Tecnologia',company:'Matriz',date:'2026-09-01',actual:'123.45',budget:200,currency:'BRL'};

test('Provider SAP: mapeamento usa nomes originais após leitura OData',async()=>{
 const original={url:process.env.SAP_READ_URL,mapping:process.env.SAP_STUDIO_MAPPING};
 process.env.SAP_READ_URL='https://sap.example/finance';process.env.SAP_STUDIO_MAPPING=JSON.stringify(mapping);
 const fetcher=mock.method(globalThis,'fetch',async()=>Response.json({value:[row]}));
 try{const snapshot=await sapDataProvider.read();assert.equal(snapshot.rows[0].id,'doc-1');assert.equal(snapshot.rows[0].actual,123.45);assert.equal(snapshot.provider,'sap');}
 finally{fetcher.mock.restore();for(const [key,value] of Object.entries({SAP_READ_URL:original.url,SAP_STUDIO_MAPPING:original.mapping})){if(value===undefined)delete process.env[key];else process.env[key]=value}}
});
test('Provider SAP: normaliza valores decimais e exige moeda e datas válidas',()=>{
 assert.equal(mapSapRows([row],mapping)[0].actual,123.45);
 for(const invalid of [{...row,actual:null},{...row,actual:''},{...row,actual:true},{...row,currency:'USD'},{...row,date:'2026-02-30'}])assert.throws(()=>mapSapRows([invalid],mapping));
 assert.throws(()=>mapSapRows([row,row],mapping),/únicos/);
});
test('Provider: seleção real incompleta retorna erro, nunca demonstração silenciosa',async()=>{
 const original={url:process.env.SAP_READ_URL,mapping:process.env.SAP_STUDIO_MAPPING,region:process.env.AWS_REGION,model:process.env.BEDROCK_MODEL_ID,mode:process.env.STUDIO_AI_PROVIDER};
 process.env.SAP_READ_URL='';process.env.SAP_STUDIO_MAPPING='';process.env.AWS_REGION='';process.env.BEDROCK_MODEL_ID='';
 try{await assert.rejects(sapDataProvider.read(),/pendente/i);await assert.rejects(bedrockPlanner.propose({prompt:'Criar',document:initialDocument,percent:5},summarize({rows:demoRows,provider:'demo',revision:'test',updatedAt:''},{center:'all',period:'all',company:'all'})),/pendente/i);process.env.STUDIO_AI_PROVIDER='unknown';assert.throws(()=>planner(),/desconhecido/)}finally{for(const [key,value] of Object.entries({SAP_READ_URL:original.url,SAP_STUDIO_MAPPING:original.mapping,AWS_REGION:original.region,BEDROCK_MODEL_ID:original.model,STUDIO_AI_PROVIDER:original.mode})){if(value===undefined)delete process.env[key];else process.env[key]=value}}
});
test('Domínio: divisão por zero é indefinida, não zero inventado',()=>{
 const result=summarize({rows:mapSapRows([{...row,budget:0}],mapping),provider:'sap',revision:'test',updatedAt:''},{center:'all',period:'all',company:'all'});
 assert.equal(result.execution,null);assert.equal(result.actual,123.45);
});

test('Assistente: ajuste de gráfico é esparso e preserva filtros e composição',async()=>{
 const document={...initialDocument,center:'Tecnologia',company:'Filial',period:'q3' as const,highlight:true,chartTitle:'Minha comparação'};
 const answer=await demoPlanner.propose({prompt:'Troque por barras',document,percent:5},summarize({rows:demoRows,provider:'demo',revision:'test',updatedAt:''},{center:'all',period:'all',company:'all'}));
 assert.deepEqual(answer.proposal?.patch,{chart:'bar',showChart:true});
 const next={...document,...answer.proposal?.patch};assert.equal(next.center,'Tecnologia');assert.equal(next.company,'Filial');assert.equal(next.highlight,true);assert.equal(next.chartTitle,'Minha comparação');
});
