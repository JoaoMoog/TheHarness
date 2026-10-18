import test from 'node:test';
import assert from 'node:assert/strict';
import {initialDocument,documentSchema,widgetSchema} from '../src/studio/contracts';
process.env.CLARA_STORAGE_MODE='memory';process.env.STUDIO_DATA_PROVIDER='demo';process.env.STUDIO_AI_PROVIDER='demo';

test('fontes livres preservam 90 colunas, identificadores, nulos e tipos sem mapeamento financeiro',async()=>{
 const {previewFile,commitFile,fileSnapshot,fileSources}=await import('../src/server/studio/files');
 const {bootstrapStudio,queryStudio}=await import('../src/server/studio/service');
 const actor={id:'dynamic-columns',name:'Importação',demo:true},workspace=bootstrapStudio(actor).workspace.id;
 const names=['Código','Área','Volume','Data',...Array.from({length:86},(_,i)=>`Campo ${i}`)];
 const csv=[names.join(';'),['001','Sul','20','2026-01-01',...Array(86).fill('x')].join(';'),['002','Norte','','2026-02-01',...Array(86).fill('y')].join(';')].join('\n');
 const preview=await previewFile(actor,workspace,new File([csv],'Fonte.csv'));
 assert.equal(preview.columns.length,90);assert.equal(preview.rows[0].field0,'001');
 const source=commitFile(actor,workspace,{uploadId:preview.id,name:'Volumes'});
 const result=await queryStudio(actor,workspace,{sourceId:source.id});
 assert.equal(result.dataset?.columns.length,90);assert.equal(result.dataset?.rows[1].field2,null);assert.equal(result.count,2);
 assert.equal(fileSources(actor,workspace).find(s=>s.id===source.id)?.generic,true);
 await assert.rejects(()=>queryStudio({id:'different-user',name:'Outra pessoa',demo:true},undefined,{sourceId:source.id}),/disponível/);
 assert.throws(()=>commitFile(actor,workspace,{uploadId:preview.id,name:'Duplicada'}),/expirou/);
});

test('gráficos genéricos calculam média por registro, contagem e nulos sem inventar zeros',async()=>{
 const {aggregateWidget}=await import('../src/server/studio/datasets');
 const snapshot={rows:[],revision:'v1',provider:'file' as const,updatedAt:new Date().toISOString(),dataset:{name:'Capacidade',columns:[{key:'area',label:'Área',type:'text' as const},{key:'volume',label:'Volume',type:'number' as const}],rows:[{area:'Sul',volume:10},{area:'Sul',volume:20},{area:'Norte',volume:null}]}};
 const widget=widgetSchema.parse({id:'one',title:'Volume',kind:'bar',dimension:'area',metric:'volume',operation:'average'});
 const result=aggregateWidget(snapshot,initialDocument,widget);assert.equal(result.total,15);assert.equal(result.missing,1);assert.equal(result.groups.find(g=>g.name==='Norte')?.value,null);
 assert.equal(aggregateWidget(snapshot,initialDocument,{...widget,operation:'count'}).total,3);
 assert.throws(()=>aggregateWidget(snapshot,initialDocument,{...widget,metric:'inexistente'}),/não existe/);
});

test('unificação preserva fontes e filtros; HTML usa números autorizados, é independente e escapa textos',async()=>{
 const {bootstrapStudio,commandStudio}=await import('../src/server/studio/service');
 const {previewFile,commitFile}=await import('../src/server/studio/files');
 const {mergeBoards,createPresentation}=await import('../src/server/studio/executive');
 const actor={id:'executive-test',name:'Executivo',demo:true},boot=bootstrapStudio(actor),workspace=boot.workspace.id;
 const preview=await previewFile(actor,workspace,new File(['Área;Quantidade\nSul;120\nNorte;80'],'Operações.csv'));
 const source=commitFile(actor,workspace,{uploadId:preview.id,name:'Operações'});
 const doc=documentSchema.parse({...initialDocument,title:'Operações <img onerror=alert(1)>',sourceId:source.id,widgets:[widgetSchema.parse({id:'volume',title:'Volume',sourceId:source.id,kind:'column',dimension:'field0',metric:'field1'})]});
 const saved=commandStudio(actor,workspace,{revision:boot.state.revision,operationId:crypto.randomUUID(),command:{type:'dashboard.save',document:doc}});
 const boardIds=[boot.state.boards[0].id,saved.targetId!];
 const merged=mergeBoards(actor,workspace,{title:'Consolidado',boardIds});
 assert.equal(merged.widgets.length,3);assert.equal(new Set(merged.widgets.map(w=>w.sourceId)).size,2);assert(merged.widgets.every(w=>w.scope));
 const artifact=await createPresentation(actor,workspace,{title:'Reunião executiva',boardIds});
 assert(artifact.slideCount>=7);assert(artifact.html.includes('200'));assert(artifact.html.includes('&lt;img onerror=alert(1)&gt;'));assert(!artifact.html.includes('<img onerror='));assert(!artifact.html.includes('src="http'));assert(artifact.html.includes('Dados sintéticos'));
 await assert.rejects(()=>createPresentation({id:'executive-outsider',name:'Outro',demo:true},undefined,{title:'Outro',boardIds}),/disponível/);
 assert.throws(()=>mergeBoards(actor,workspace,{title:'Duplicados',boardIds:[boardIds[0],boardIds[0]]}),/apenas uma vez/);
});

test('assistente propõe apresentação e unificação sem persistir antes da confirmação',async()=>{
 const {assistantStudio,bootstrapStudio,commandStudio}=await import('../src/server/studio/service');
 const actor={id:'executive-assistant',name:'Executivo',demo:true};let boot=bootstrapStudio(actor);
 commandStudio(actor,boot.workspace.id,{revision:boot.state.revision,operationId:crypto.randomUUID(),command:{type:'dashboard.save',document:{...initialDocument,title:'Visão da equipe'}}});
 boot=bootstrapStudio(actor);const conversationId=crypto.randomUUID();
 const deck=await assistantStudio(actor,boot.workspace.id,{prompt:'Crie uma apresentação deste dashboard para a diretoria',document:initialDocument,conversationId});assert.equal(deck.proposal?.kind,'presentation');
 const merge=await assistantStudio(actor,boot.workspace.id,{prompt:'Unifique Desempenho financeiro e Visão da equipe',document:initialDocument,conversationId:crypto.randomUUID()});
 assert.equal(merge.proposal?.kind,'merge');assert.equal(merge.proposal?.patch.widgets?.length,4);assert.equal(bootstrapStudio(actor).state.revision,boot.state.revision);
});

test('coleção SAP genérica aceita colunas de domínio próprio sem contrato financeiro',async()=>{
 const {importSapDataset}=await import('../src/server/studio/files');const {queryStudio}=await import('../src/server/studio/service');
 const originalFetch=globalThis.fetch,oldMode=process.env.STUDIO_DATA_PROVIDER,oldUrl=process.env.SAP_READ_URL;
 process.env.STUDIO_DATA_PROVIDER='sap';process.env.SAP_READ_URL='https://sap.example.test/collection';
 globalThis.fetch=async()=>new Response(JSON.stringify({value:[{Produto:'A',Estoque:42,Status:'Disponível'}]}),{status:200,headers:{'content-type':'application/json'}});
 try{const actor={id:'generic-sap',name:'SAP',demo:true};const source=await importSapDataset(actor,undefined,{name:'Estoque SAP'});const result=await queryStudio(actor,undefined,{sourceId:source.id});assert.equal(result.dataset?.columns.length,3);assert.equal(result.dataset?.rows[0].field1,42);assert.equal(result.lineage.provider,'sap');}
 finally{globalThis.fetch=originalFetch;if(oldMode===undefined)delete process.env.STUDIO_DATA_PROVIDER;else process.env.STUDIO_DATA_PROVIDER=oldMode;if(oldUrl===undefined)delete process.env.SAP_READ_URL;else process.env.SAP_READ_URL=oldUrl;}
});

test('apresentação de diferença preserva sinais, totais e valores ausentes',async()=>{
 const {aggregateWidget}=await import('../src/server/studio/datasets');const {presentationResult}=await import('../src/server/studio/executive');
 const snapshot={rows:[],revision:'v1',provider:'file' as const,updatedAt:new Date().toISOString(),dataset:{name:'Metas',columns:[{key:'area',label:'Área',type:'text' as const},{key:'actual',label:'Realizado',type:'number' as const},{key:'budget',label:'Meta',type:'number' as const}],rows:[{area:'Sul',actual:120,budget:100},{area:'Norte',actual:80,budget:110},{area:'Leste',actual:null,budget:null}]}};
 const widget=widgetSchema.parse({id:'difference',title:'Saldo',kind:'waterfall',dimension:'area',metric:'actual',comparison:'budget'});
 const result=presentationResult(aggregateWidget(snapshot,initialDocument,widget),'waterfall');
 assert.equal(result.total,10);assert.equal(result.groups[0].value,-20);assert.equal(result.groups[1].value,30);assert.equal(result.groups[2].value,null);assert.equal(result.comparison,null);
});

test('consulta de gráfico e apresentação respeitam fonte pausada',async()=>{
 const {bootstrapStudio,commandStudio}=await import('../src/server/studio/service');const {queryWidget}=await import('../src/server/studio/datasets');const {createPresentation}=await import('../src/server/studio/executive');const {widgetsFor}=await import('../src/studio/widgets');
 const actor={id:'paused-widgets',name:'Pausa',demo:true},boot=bootstrapStudio(actor);
 commandStudio(actor,boot.workspace.id,{revision:boot.state.revision,operationId:crypto.randomUUID(),command:{type:'source.toggle',paused:true}});
 await assert.rejects(()=>queryWidget(actor,boot.workspace.id,{document:initialDocument,widget:widgetsFor(initialDocument)[0]}),/pausada/);
 await assert.rejects(()=>createPresentation(actor,boot.workspace.id,{title:'Reunião',boardIds:['current'],current:initialDocument}),/pausada/);
});

test('variante de resposta executiva é normalizada sem aceitar campos ou IDs inválidos',async()=>{
 const {parsePlannerAnswer}=await import('../src/server/studio/plannerContext');
 const answer={status:'ready',message:'Confira a seleção.',proposal:{kind:'presentation',title:'Reunião',description:'Visão executiva.',patch:{boardIds:['current']}}};
 assert.deepEqual(parsePlannerAnswer(JSON.stringify(answer)).proposal?.boardIds,['current']);
 assert.throws(()=>parsePlannerAnswer(JSON.stringify({...answer,proposal:{...answer.proposal,patch:{boardIds:[{}]}}})),/incompatível/);
 assert.throws(()=>parsePlannerAnswer(JSON.stringify({...answer,html:'<script></script>'})),/incompatível/);
});
