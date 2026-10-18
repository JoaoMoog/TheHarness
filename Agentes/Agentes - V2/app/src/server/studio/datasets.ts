import type {Actor,Column,Cell} from '@/core/types';
import {documentSchema,filtersSchema,widgetSchema,type Dataset,type DataSnapshot,type DashboardDocument,type WidgetConfig} from '@/studio/contracts';
import {periodLabel} from '@/studio/domain';
import {scopeOf,type WidgetResult} from '@/studio/widgets';
import {resolveWorkspace} from '../workspaces';
import {HttpError} from '../auth';
import {dataSnapshot} from './providers';
import {repository} from './repository';

export const financialColumns:Column[]=[{key:'center',label:'Centro de custo',type:'text'},{key:'company',label:'Empresa',type:'text'},{key:'date',label:'Competência',type:'date'},{key:'actual',label:'Realizado',type:'number'},{key:'budget',label:'Orçamento',type:'number'}];
export function datasetOf(snapshot:DataSnapshot):Dataset{return snapshot.dataset||{name:'Despesas e orçamento',columns:financialColumns,rows:snapshot.rows.map(r=>({center:r.center,company:r.company,date:r.date,actual:r.actual,budget:r.budget}))};}
export function aggregateWidget(snapshot:DataSnapshot,doc:DashboardDocument,widget:WidgetConfig):WidgetResult{
 const source=datasetOf(snapshot),column=(key:string)=>{const found=source.columns.find(c=>c.key===key);if(!found)throw new HttpError(422,`A coluna “${key}” não existe nesta fonte.`);return found};
 const dimension=column(widget.dimension),metric=column(widget.metric),comparison=widget.comparison?column(widget.comparison):null;
 if(widget.operation!=='count'&&(metric.type!=='number'||comparison&&comparison.type!=='number'))throw new HttpError(422,'Soma e média exigem medidas numéricas.');
 const scope=widget.scope||scopeOf(doc),dateKey=widget.dateColumn;
 if(dateKey&&column(dateKey).type!=='date')throw new HttpError(422,'Escolha uma coluna de data para o período.');
 if(snapshot.dataset&&(scope.dateFrom||scope.dateTo||scope.period==='q3')&&!dateKey)throw new HttpError(422,'Escolha a coluna de data do gráfico antes de filtrar o período.');
 const rows=source.rows.filter(r=>{
  if(!snapshot.dataset&&(scope.center!=='all'&&r.center!==scope.center||scope.company!=='all'&&r.company!==scope.company))return false;
  const date=dateKey?String(r[dateKey]??''):'';const full=date.length===7?date+'-01':date;
  return (!scope.dateFrom||full>=scope.dateFrom)&&(!scope.dateTo||full<=scope.dateTo)&&(scope.period!=='q3'||Number(date.slice(5,7))>=7&&Number(date.slice(5,7))<=9);
 });
 const calculate=(values:Cell[])=>{if(widget.operation==='count')return values.length;const numbers=values.filter((v):v is number=>typeof v==='number'&&Number.isFinite(v));if(!numbers.length)return null;const sum=numbers.reduce((a,b)=>a+b,0);if(!Number.isFinite(sum))throw new HttpError(422,'O total excedeu o limite numérico. Reduza o recorte.');return widget.operation==='average'?sum/numbers.length:sum};
 const groups=new Map<string,Record<string,Cell>[]>();for(const row of rows){const name=String(row[dimension.key]??'Sem informação');const key=dimension.type==='date'?name.slice(0,7):name;if(!groups.has(key))groups.set(key,[]);groups.get(key)!.push(row);}
 let grouped=[...groups].map(([name,items])=>({name,value:calculate(items.map(r=>r[metric.key])),comparison:comparison?calculate(items.map(r=>r[comparison.key])):null}));
 grouped.sort(dimension.type==='date'?(a,b)=>a.name.localeCompare(b.name):(a,b)=>(b.value??-Infinity)-(a.value??-Infinity));
 return {title:widget.title,source:source.name,revision:snapshot.revision,updatedAt:snapshot.updatedAt,provider:snapshot.provider,scope:[periodLabel(scope),scope.company==='all'?null:scope.company,scope.center==='all'?null:scope.center].filter(Boolean).join(' · '),metric:metric.label,comparison:comparison?.label||null,dimension:dimension.label,unit:widget.unit,operation:widget.operation,count:rows.length,missing:rows.filter(r=>r[metric.key]==null).length,total:calculate(rows.map(r=>r[metric.key])),comparisonTotal:comparison?calculate(rows.map(r=>r[comparison.key])):null,groups:grouped.slice(0,widget.limit),truncated:grouped.length>widget.limit};
}
export async function queryWidget(actor:Actor,workspaceId:string|undefined,input:{document:unknown;widget:unknown},signal?:AbortSignal){const workspace=resolveWorkspace(actor,workspaceId),doc=documentSchema.parse(input.document),widget=widgetSchema.parse(input.widget);if(repository.get(workspace.id).sourcePaused)throw new HttpError(503,'A fonte está pausada. Peça a um administrador para reconectá-la.');return aggregateWidget(await dataSnapshot(workspace.id,signal,false,widget.sourceId),doc,widget);}
