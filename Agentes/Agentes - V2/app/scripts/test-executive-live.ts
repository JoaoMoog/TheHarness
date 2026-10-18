import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {pilotSettings} from './pilot-env.mjs';
import {initialDocument,documentSchema} from '../src/studio/contracts';
Object.assign(process.env,pilotSettings(resolve('.')),{CLARA_STORAGE_MODE:'memory',STUDIO_DATA_PROVIDER:'demo',STUDIO_AI_PROVIDER:'agentcore'});
async function main(){
 const {bootstrapStudio,assistantStudio,commandStudio}=await import('../src/server/studio/service');
 const {previewFile,commitFile}=await import('../src/server/studio/files');
 const actor={id:randomUUID(),name:'Validação executiva sintética',demo:false,auth:'local' as const};let boot=bootstrapStudio(actor);
 commandStudio(actor,boot.workspace.id,{revision:boot.state.revision,operationId:randomUUID(),command:{type:'dashboard.save',document:{...initialDocument,title:'Visão da equipe'}}});boot=bootstrapStudio(actor);
 const ask=(prompt:string,document=initialDocument,conversationId=randomUUID())=>assistantStudio(actor,boot.workspace.id,{prompt,document,conversationId});
 const presentation=await ask('Crie uma apresentação HTML deste dashboard para a diretoria.');assert.equal(presentation.proposal?.kind,'presentation');assert.deepEqual(presentation.proposal?.boardIds,['current']);console.log('PASS: apresentação executiva com referência à análise atual');
 const merge=await ask('Unifique os dashboards Desempenho financeiro e Visão da equipe.');assert.equal(merge.proposal?.kind,'merge');assert.equal(merge.proposal?.patch.widgets?.length,4);console.log('PASS: unificação autorizada preserva os quatro gráficos');
 const unclear=await ask('Quero unificar dashboards');assert.equal(unclear.status,'clarify');console.log('PASS: pergunta quais dashboards faltam');
 const preview=await previewFile(actor,boot.workspace.id,new File(['Equipe;Entregas;Pessoas;Data\nSul;120;4;2026-01-01\nNorte;80;2;2026-02-01'],'Capacidade.csv'));const source=commitFile(actor,boot.workspace.id,{uploadId:preview.id,name:'Capacidade'});
 const document=documentSchema.parse({...initialDocument,sourceId:source.id,title:'Capacidade'});
 const generic=await ask('Crie um dashboard com a soma de Entregas agrupada por Equipe. Use barras horizontais. Os valores são quantidades, não moeda.',document);
 assert.equal(generic.proposal?.kind,'create');const widget=generic.proposal?.patch.widgets?.[0];assert.equal(widget?.metric,'field1');assert.equal(widget?.dimension,'field0');assert.equal(widget?.unit,'number');assert.equal(widget?.operation,'sum');console.log('PASS: fonte genérica usa colunas reais e unidade correta');
 assert.equal(bootstrapStudio(actor).state.revision,boot.state.revision);console.log('PASS: nenhuma análise persistida pela IA');
}
main().catch(error=>{console.error(error instanceof Error?error.message:'Falha na validação.');process.exitCode=1});
