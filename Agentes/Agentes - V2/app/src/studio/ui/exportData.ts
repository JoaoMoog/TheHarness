import type {DashboardDocument,QueryResult} from '../contracts';
import {widgetsFor,type WidgetResult} from '../widgets';
import {request} from './api';
import {periodLabel,sourceLabel} from '../domain';
export async function exportData(document:DashboardDocument,data:QueryResult,workspaceId:string){
 let rows:unknown[][]=[];
 if(document.mergedFrom.length){
  rows=[['CLARA',document.title],['Gráfico','Fonte','Recorte','Dimensão','Medida','Valor','Comparação','Valor comparado','Unidade']];
  for(const widget of widgetsFor(document)){const result=await request<WidgetResult>('widgets/query',{document,widget},workspaceId);rows.push(...result.groups.map(g=>[widget.title,result.source,result.scope,g.name,result.metric,g.value,result.comparison,g.comparison,result.unit]));}
 }else if(data.dataset){
  rows=[data.dataset.columns.map(c=>c.label)];let offset=0;
  do{const page=await request<QueryResult>('query',{sourceId:document.sourceId,offset,limit:200},workspaceId);if(!page.dataset)throw new Error('A fonte mudou durante a exportação.');rows.push(...page.dataset.rows.map(row=>page.dataset!.columns.map(c=>row[c.key])));offset+=page.dataset.rows.length;if(!page.dataset.rows.length||offset>=page.matchedCount)break;}while(offset<20000);
 }else rows=[['CLARA',document.title],['Fonte',sourceLabel(data.lineage.provider)],['Revisão',data.lineage.revision],['Período',periodLabel(document)],['Empresa',document.company],['Centro',document.center],[],['Centro de custo','Realizado (BRL)','Orçamento (BRL)','Desvio (BRL)'],...data.groups.map(g=>[g.name,g.actual,g.budget,g.actual-g.budget])];
 const safe=(value:unknown)=>`"${(typeof value==='string'?value.replace(/^[=+\-@\t\r]/,"'$&"):String(value??'')).replaceAll('"','""')}"`;
 const url=URL.createObjectURL(new Blob(['\ufeff'+rows.map(row=>row.map(safe).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'}));
 const link=window.document.createElement('a');link.href=url;link.download=data.dataset||document.mergedFrom.length?'clara-dados.csv':'clara-financeiro.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
