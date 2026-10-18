import {htmlEscape,executiveChart,observation,dataTable,tablePageSize,renderExecutiveDeck} from './executiveTemplate';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {z} from 'zod';
import type {Actor} from '@/core/types';
import {documentSchema,type DashboardDocument} from '@/studio/contracts';
import {widgetsFor,formatValue,scopeOf,type WidgetResult} from '@/studio/widgets';
import {resolveWorkspace} from '../workspaces';
import {HttpError} from '../auth';
import {repository} from './repository';
import {aggregateWidget} from './datasets';
import {dataSnapshot} from './providers';

export const executiveSchema=z.object({title:z.string().trim().min(1).max(120),boardIds:z.array(z.string().min(1).max(150)).min(1).max(12),current:documentSchema.optional()}).strict();
export function selectedBoards(actor:Actor,workspaceId:string|undefined,input:z.infer<typeof executiveSchema>){
 const workspace=resolveWorkspace(actor,workspaceId),state=repository.get(workspace.id);
 if(new Set(input.boardIds).size!==input.boardIds.length)throw new HttpError(422,'Escolha cada dashboard apenas uma vez.');
 const boards=input.boardIds.map(id=>{if(id==='current'&&input.current)return {id,title:input.current.title,document:input.current,revision:1};const board=state.boards.find(b=>b.id===id);if(!board)throw new HttpError(404,'Um dashboard não está disponível neste espaço.');return {...board,title:board.document.title};});
 return {workspace,boards};
}
export function mergeBoards(actor:Actor,workspaceId:string|undefined,input:unknown){
 const p=executiveSchema.parse(input);resolveWorkspace(actor,workspaceId,'write');const {boards}=selectedBoards(actor,workspaceId,p);
 if(boards.length<2)throw new HttpError(422,'Escolha pelo menos dois dashboards para unificar.');
 const widgets=boards.flatMap(b=>widgetsFor(b.document).map(w=>({...w,id:randomUUID(),title:`${b.title} · ${w.title}`.slice(0,120),scope:w.scope||scopeOf(b.document)})));
 if(widgets.length>24)throw new HttpError(422,'O resultado ultrapassa 24 gráficos. Selecione menos dashboards.');
 return documentSchema.parse({...boards[0].document,title:p.title,widgets,mergedFrom:boards.map(({id,title,revision})=>({id,title,revision})),center:'all',company:'all',period:'all',dateFrom:null,dateTo:null});
}
export function presentationResult(result:WidgetResult,kind:string):WidgetResult{
 if(kind!=='waterfall')return result;
 const difference=(actual:number|null,comparison:number|null)=>actual==null||comparison==null?null:comparison-actual;
 return {...result,metric:`Diferença: ${result.comparison||'comparação'} − ${result.metric}`,comparison:null,total:difference(result.total,result.comparisonTotal),comparisonTotal:null,groups:result.groups.map(g=>({...g,value:difference(g.value,g.comparison),comparison:null}))};
}
export async function createPresentation(actor:Actor,workspaceId:string|undefined,input:unknown,signal?:AbortSignal){
 const p=executiveSchema.parse(input),{workspace,boards}=selectedBoards(actor,workspaceId,p);
 if(repository.get(workspace.id).sourcePaused)throw new HttpError(503,'A fonte está pausada. Peça a um administrador para reconectá-la.');
 const snapshots=new Map<string,Awaited<ReturnType<typeof dataSnapshot>>>(),slides:string[]=[],appendix:string[]=[],sources=new Set<string>();
 const created=new Intl.DateTimeFormat('pt-BR',{dateStyle:'long',timeStyle:'short',timeZone:process.env.CLARA_TIME_ZONE||'America/Sao_Paulo'}).format(new Date());
 const e=htmlEscape;
 const logo=`<img alt="BTG Pactual" src="data:image/svg+xml;base64,${readFileSync(resolve(process.cwd(),'public/brand/btg-pactual.svg')).toString('base64')}"/>`;
 const header=(label:string)=>`<header>${logo}<span>${e(label)}</span></header>`;
 const footer=(label:string)=>`<footer><span>${e(label)}</span><!--page--></footer>`;
 slides.push(`<section class="slide cover">${header('CLARA · Inteligência para decidir')}<div class="cover-layout"><div><p class="eyebrow">Apresentação executiva</p><h1>${e(p.title)}</h1><p class="cover-deck">Uma visão dos resultados, dos movimentos relevantes e dos números que sustentam a decisão.</p></div><aside class="cover-index"><b>${String(boards.length).padStart(2,'0')}</b><span>${boards.length===1?'Dashboard selecionado':'Dashboards selecionados'}</span><ul>${boards.slice(0,4).map(b=>`<li>${e(b.title)}</li>`).join('')}${boards.length>4?`<li>+ ${boards.length-4} análises nesta apresentação</li>`:''}</ul></aside></div>${footer(`${workspace.name} · ${created}`)}</section>`);
 for(const [boardIndex,board] of boards.entries()){
  const results:{config:ReturnType<typeof widgetsFor>[number];data:WidgetResult}[]=[];
  for(const config of widgetsFor(board.document)){
   if(!snapshots.has(config.sourceId))snapshots.set(config.sourceId,await dataSnapshot(workspace.id,signal,false,config.sourceId));
   const data=presentationResult(aggregateWidget(snapshots.get(config.sourceId)!,board.document,config),config.kind);results.push({config,data});sources.add(`${data.source} · revisão ${data.revision} · ${data.scope}`);
  }
  for(let offset=0;offset<results.length;offset+=4)slides.push(`<section class="slide">${header(board.title)}<p class="eyebrow">${String(boardIndex+1).padStart(2,'0')} · Visão executiva</p><h2>${offset?'Outros indicadores da análise':'Os números em perspectiva'}</h2><div class="summary-grid">${results.slice(offset,offset+4).map(({config,data})=>`<article><h3>${e(config.title)}</h3><strong>${e(formatValue(data.total,data.unit))}</strong><p>${e(data.metric)} · ${data.operation==='average'?'Média':data.operation==='count'?'Contagem':'Soma'}</p><small>${e(data.scope)}</small></article>`).join('')}</div><p class="note">Cada indicador preserva sua fonte e seu recorte. Indicadores podem representar os mesmos registros; não some os cartões.</p>${footer(`${board.title} · Dashboard v${board.revision}`)}</section>`);
  for(const {config,data} of results){
   const synthetic=['demo','financial-test'].includes(data.provider)?' · Dados sintéticos':'';
   const provenance=`${data.source} · ${data.count.toLocaleString('pt-BR')} registros · revisão ${data.revision}${synthetic}`;
   if(config.kind==='table'){
    for(let offset=0;offset<Math.max(1,data.groups.length);offset+=tablePageSize)slides.push(`<section class="slide">${header(board.title)}<p class="eyebrow">Resultados em detalhe</p><h2>${e(config.title)}</h2><p class="subtitle">${e(data.scope)} · Registros ${offset+1}–${Math.min(offset+tablePageSize,data.groups.length)}</p><div class="table-content">${dataTable(data,offset)}</div>${footer(provenance)}</section>`);
    continue;
   }
   slides.push(`<section class="slide">${header(board.title)}<p class="eyebrow">${e(data.operation==='average'?'Média por registro':data.operation==='count'?'Contagem de registros':'Análise de resultados')}</p><h2>${e(config.title)}</h2><p class="subtitle">${e(data.scope)}</p><div class="chart-layout"><div class="chart-main">${executiveChart(data,config.kind)}<div class="legend"><span><i></i>${e(data.metric)}</span>${data.comparison?`<span><i class="comparison"></i>${e(data.comparison)}</span>`:''}</div><p class="note">${data.groups.length>10?`10 de ${data.groups.length} grupos exibidos. `:''}${data.truncated?'Grupos limitados pela configuração do gráfico. O total considera o recorte completo. ':''}${data.missing?`${data.missing} registros sem valor; ausências não foram convertidas em zero. `:''}${data.groups.length?'Valores completos no apêndice.':''}</p></div><aside class="chart-aside"><span class="eyebrow">${data.operation==='average'?'Média do recorte':'Resultado do recorte'}</span><strong>${e(formatValue(data.total,data.unit))}</strong><p>${e(observation(data))}</p><small>Leitura descritiva dos dados disponíveis. Não representa previsão.</small></aside></div>${footer(provenance)}</section>`);
   if(!['indicator','text'].includes(config.kind))for(let offset=0;offset<data.groups.length;offset+=tablePageSize)appendix.push(`<section class="slide">${header(board.title)}<p class="eyebrow">Apêndice · Valores de referência</p><h2>${e(config.title)}</h2><p class="subtitle">${e(data.scope)} · Grupos ${offset+1}–${Math.min(offset+tablePageSize,data.groups.length)} de ${data.groups.length}</p><div class="table-content">${dataTable(data,offset)}</div>${footer(provenance)}</section>`);
  }
 }
 const sourceList=[...sources];
 for(let offset=0;offset<Math.max(1,sourceList.length);offset+=5)slides.push(`<section class="slide">${header('Fontes e critérios')}<p class="eyebrow">Transparência da análise</p><h2>De onde vêm os resultados</h2><ul class="source-list">${sourceList.slice(offset,offset+5).map(s=>`<li>${e(s)}</li>`).join('')}</ul><p class="note">Retrato dos dados consultados em ${e(created)}. Gere uma nova apresentação após atualizar as fontes. As comparações preservam unidades, filtros e agregações; fontes diferentes não são somadas automaticamente.</p>${footer(workspace.name)}</section>`);
 slides.push(...appendix);
 return {title:p.title,slideCount:slides.length,html:renderExecutiveDeck(p.title,slides)};
}
