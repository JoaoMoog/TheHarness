import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
import {BedrockRuntimeClient} from '@aws-sdk/client-bedrock-runtime';
process.env.CLARA_STORAGE_MODE='memory';process.env.STUDIO_DATA_PROVIDER='demo';process.env.STUDIO_AI_PROVIDER='bedrock';process.env.AWS_REGION='us-east-1';process.env.BEDROCK_MODEL_ID='test';
test('Revisão: serviço envia catálogo e histórico reais ao planejador',async()=>{
 const {assistantStudio,bootstrapStudio}=await import('../src/server/studio/service');
 const actor={id:'review-context',name:'Ana',demo:true};const document={...bootstrapStudio(actor).state.boards[0].document,center:'Tecnologia',company:'Filial'};
 const requests:any[]=[];const send=mock.method(BedrockRuntimeClient.prototype,'send',async(command:any)=>{requests.push(JSON.parse(command.input.messages[0].content[0].text));return {output:{message:{content:[{text:JSON.stringify({status:'ready',message:'Confira',proposal:{kind:'chart',title:'Barras',description:'Gráfico',patch:{chart:'bar'}}})}]}},$metadata:{}}});
 try{await assistantStudio(actor,undefined,{prompt:'Troque por barras',document});await assistantStudio(actor,undefined,{prompt:'Mantenha barras',document});assert.deepEqual(requests[0].catalog.companies,['Matriz','Filial']);assert.equal(requests[0].catalog.periods.length,9);assert.equal(requests[1].history.length,2);assert.equal(requests[0].filters.company,'Filial');assert.ok(requests[0].aggregates.actual<3210000);}finally{send.mock.restore();}
});
test('Revisão: restauração legada limpa datas do intervalo anterior',async()=>{
 const {bootstrapStudio,commandStudio}=await import('../src/server/studio/service');const {update}=await import('../src/server/store');
 const actor={id:'review-legacy',name:'Ana',demo:true};const boot=bootstrapStudio(actor),board=boot.state.boards[0];
 board.document={...board.document,period:'range',dateFrom:'2026-09-01',dateTo:'2026-09-30'};
 const {dateFrom,dateTo,...legacy}=board.document;
 board.versions=[{id:'old',at:'2025-01-01',document:{...legacy,schemaVersion:1,period:'q3'}}];update('studio',boot.state);
 const loaded=bootstrapStudio(actor);assert.equal(loaded.state.boards[0].versions[0].document.dateFrom,null);
 const restored=commandStudio(actor,undefined,{revision:boot.state.revision,operationId:crypto.randomUUID(),command:{type:'dashboard.restore',id:board.id,versionId:'old'}});
 assert.equal(restored.state.boards[0].document.dateFrom,null);assert.equal(restored.state.boards[0].document.dateTo,null);assert.equal(restored.state.boards[0].document.period,'q3');
});
test('Revisão: cenário rejeita revisão da fonte diferente da prévia',async()=>{
 const s=await import('../src/server/studio/service');const actor={id:'review-snapshot',name:'Ana',demo:true};await s.queryStudio(actor,undefined,{});
 assert.throws(()=>s.commandStudio(actor,undefined,{revision:s.bootstrapStudio(actor).state.revision,operationId:crypto.randomUUID(),command:{type:'scenario.save',name:'Prévia antiga',center:'Tecnologia',percent:5,baseRevision:'stale-source'}}),error=>(error as {status:number}).status===409);
});
