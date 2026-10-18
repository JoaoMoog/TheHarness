import {filtersSchema,widgetSchema,type DashboardDocument,type WidgetConfig} from './contracts';
export const scopeOf=(doc:DashboardDocument)=>filtersSchema.parse({sourceId:doc.sourceId,center:doc.center,company:doc.company,period:doc.period,dateFrom:doc.dateFrom,dateTo:doc.dateTo});
export function widgetsFor(doc:DashboardDocument):WidgetConfig[]{
 if(doc.widgets?.length)return doc.widgets;
 const comparison=widgetSchema.parse({id:'comparison',title:doc.chartTitle,kind:doc.chart,dimension:'center',metric:'actual',comparison:'budget',sourceId:doc.sourceId,unit:'BRL',dateColumn:'date'});
 const trend=widgetSchema.parse({...comparison,id:'trend',title:'Evolução das despesas',kind:'line',dimension:'date',limit:200});
 const widgets=[...(doc.showChart?[comparison]:[]),trend,...(doc.duplicate?[{...comparison,id:'copy',title:doc.chartTitle+' · cópia'}]:[])];
 return doc.reversed?widgets.reverse():widgets;
}
export const formatValue=(value:number|null,unit:WidgetConfig['unit'])=>value==null?'—':new Intl.NumberFormat('pt-BR',{...(unit==='BRL'?{style:'currency',currency:'BRL'}:{}),maximumFractionDigits:2}).format(value)+(unit==='percent'?'%':'');
export type WidgetResult={title:string;source:string;revision:string;updatedAt:string;provider:string;scope:string;metric:string;comparison:string|null;dimension:string;unit:WidgetConfig['unit'];operation:WidgetConfig['operation'];count:number;missing:number;total:number|null;comparisonTotal:number|null;groups:{name:string;value:number|null;comparison:number|null}[];truncated:boolean};
