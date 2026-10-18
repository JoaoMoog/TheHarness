import test from 'node:test';
import assert from 'node:assert/strict';
import {initialDocument,type StudioMessage} from '../src/studio/contracts';
process.env.CLARA_STORAGE_MODE='memory';
process.env.STUDIO_DATA_PROVIDER='demo';
process.env.STUDIO_AI_PROVIDER='demo';

test('conversa: pede objetivo, retém o pedido e resolve o ano sem perder empresa ou gráfico',async()=>{
 const {demoPlanner}=await import('../src/server/studio/providers');
 const context={centers:['Pesquisa'],companies:['Filial Sul'],periods:['2025-09','2026-09'],messages:[] as StudioMessage[]};
 const {queryStudio}=await import('../src/server/studio/service');
 const data=await queryStudio({id:'conversation-data',name:'Teste',demo:true},undefined,{});
 const ask=async(prompt:string)=>{const answer=await demoPlanner.propose({prompt,document:initialDocument,percent:5},data,undefined,context);context.messages.push({role:'user',text:prompt},{role:'assistant',text:answer.message,status:answer.status});return answer;};
 assert.equal((await ask('Crie um dashboard')).status,'clarify');
 const question=await ask('Compare despesas e orçamento da Filial Sul em setembro, em barras');
 assert.equal(question.status,'clarify');assert.match(question.message,/2025.*2026/);
 const ready=await ask('2025');
 assert.equal(ready.status,'ready');assert.equal(ready.proposal?.kind,'create');
 assert.equal(ready.proposal?.patch.company,'Filial Sul');assert.equal(ready.proposal?.patch.chart,'bar');
 assert.equal(ready.proposal?.patch.dateFrom,'2025-09-01');assert.equal(ready.proposal?.patch.dateTo,'2025-09-30');
});

test('conversa: cenário pede parâmetros e utiliza o catálogo da fonte',async()=>{
 const {demoPlanner}=await import('../src/server/studio/providers');
 const {queryStudio}=await import('../src/server/studio/service');
 const data=await queryStudio({id:'conversation-scenario',name:'Teste',demo:true},undefined,{});
 const context={centers:['Pesquisa'],companies:['Sul'],periods:['2026-09'],messages:[] as StudioMessage[]};
 const first=await demoPlanner.propose({prompt:'Simule uma redução',document:initialDocument,percent:5},data,undefined,context);
 assert.equal(first.status,'clarify');
 context.messages=[{role:'user',text:'Simule uma redução'},{role:'assistant',text:first.message,status:first.status}];
 const next=await demoPlanner.propose({prompt:'10% em Pesquisa',document:initialDocument,percent:5},data,undefined,context);
 assert.equal(next.proposal?.patch.scenarioCenter,'Pesquisa');assert.equal(next.proposal?.patch.percent,10);
});

test('conversa: histórico não atravessa conversas e não salva dashboard',async()=>{
 const {assistantStudio,bootstrapStudio}=await import('../src/server/studio/service');
 const actor={id:'conversation-scope',name:'Teste',demo:true};
 const revision=bootstrapStudio(actor).state.revision;
 const conversationId=crypto.randomUUID();
 const first=await assistantStudio(actor,undefined,{prompt:'Crie um dashboard',document:initialDocument,conversationId});
 assert.equal(first.status,'clarify');
 const second=await assistantStudio(actor,undefined,{prompt:'Despesas e orçamento em barras',document:initialDocument,conversationId});
 assert.equal(second.proposal?.kind,'create');assert.equal(second.messages.length,4);
 const other=await assistantStudio(actor,undefined,{prompt:'Olá',document:initialDocument,conversationId:crypto.randomUUID()});
 assert.equal(other.messages.length,2);assert.equal(other.proposal,null);
 assert.equal(bootstrapStudio(actor).state.revision,revision);
});

test('conversa: não oferece aplicar módulos adiados e permite continuar a análise',async()=>{
 const {assistantStudio,bootstrapStudio}=await import('../src/server/studio/service');
 const actor={id:'conversation-deferred',name:'Teste',demo:true};
 const before=bootstrapStudio(actor).state;
 const conversationId=crypto.randomUUID();
 const answer=await assistantStudio(actor,undefined,{prompt:'Simule redução de 5% em Tecnologia',document:initialDocument,conversationId});
 assert.equal(answer.status,'clarify');assert.equal(answer.proposal,null);assert.match(answer.message,/próxima etapa/);
 const next=await assistantStudio(actor,undefined,{prompt:'Crie um dashboard de despesas em barras',document:initialDocument,conversationId});
 assert.equal(next.proposal?.kind,'create');assert.equal(next.proposal?.patch.screen,'dashboard');
 assert.deepEqual(bootstrapStudio(actor).state,before);
});
