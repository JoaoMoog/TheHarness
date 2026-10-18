import type {Proposal,QueryResult} from '../contracts';
import {money,number,periodLabel} from '../domain';

export function decisionSummary(data:QueryResult){
 if(!data.count)return {tone:'neutral',title:'Nenhum registro neste recorte.',detail:'Ajuste os filtros para encontrar dados disponíveis.',center:null};
 if(!data.budget)return {tone:'neutral',title:'Sem orçamento para comparação.',detail:`O realizado soma ${money(data.actual)}. A execução percentual não pode ser calculada com orçamento igual a zero.`,center:null};
 const over=data.groups.filter(g=>g.actual>g.budget).sort((a,b)=>(b.actual-b.budget)-(a.actual-a.budget));
 const largest=over[0];
 const title=data.balance<0?`Despesas ${money(-data.balance)} acima do orçamento.`:data.balance===0?'Realizado igual ao orçamento.':'Total dentro do orçamento.';
 const detail=largest?`${over.length} ${over.length===1?'centro acima':'centros acima'} do previsto. ${largest.name} tem o maior desvio: ${money(largest.actual-largest.budget)}.`:`Nenhum centro acima do orçamento neste recorte. Saldo disponível de ${money(data.balance)}.`;
 return {tone:over.length?'attention':'neutral',title,detail,center:largest?.name||null};
}

const chartNames:Record<string,string>={column:'Colunas agrupadas',bar:'Barras horizontais',line:'Linhas',donut:'Rosca',waterfall:'Saldo por centro',table:'Tabela',indicator:'Indicador',text:'Texto executivo'};
type Values=Record<string,unknown>;
export function proposalChanges(current:object,proposal:Proposal,sourceName:(id:string)=>string=id=>id){
 const before=current as Values,after:Values={...before,...proposal.patch};
 const text=(key:string,value:unknown)=>{
  if(typeof value==='boolean')return value?'Sim':'Não';
  if(key==='sourceId')return sourceName(String(value));
  if(key==='chart')return chartNames[String(value)]||String(value);
  if(key==='center'&&value==='all')return 'Todos os centros';
  if(key==='company'&&value==='all')return 'Todas as empresas';
  if(key==='percent')return `${value}%`;
  if(key==='screen')return value==='scenarios'?'Cenários':value==='dashboard'?'Dashboard':String(value);
  return value==null?'Não definido':String(value);
 };
 const fields=[['sourceId','Fonte'],['title','Nome da análise'],['center','Centro de custo'],['company','Empresa'],['period','Período'],['chart','Visualização'],['chartTitle','Título do gráfico'],['highlight','Destacar desvios'],['showMetric','Exibir saldo'],['showChart','Exibir comparativo'],['duplicate','Comparativo adicional'],['reversed','Inverter gráficos'],['scenarioCenter','Centro do cenário'],['percent','Redução simulada'],['screen','Área de destino']];
 return fields.flatMap(([key,label])=>{
  if(key==='period'){
   if(!['period','dateFrom','dateTo'].some(k=>k in proposal.patch&&(before[k]??null)!==(after[k]??null)))return [];
   return [{label,before:periodLabel(before as any),after:periodLabel(after as any)}];
  }
  if(!(key in proposal.patch)||before[key]===after[key])return [];
  return [{label,before:text(key,before[key]),after:text(key,after[key])}];
 });
}

export const axisAmount=(value:number)=>Math.abs(value)>=1e6?`${number(value/1e6)} mi`:Math.abs(value)>=1e3?`${number(value/1e3)} mil`:number(value);
