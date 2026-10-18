import {assistantOutputSchema,type AnalysisPlanner,type Proposal} from '@/studio/contracts';

const normalize=(text:string)=>text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const months=['janeiro','fevereiro','marco','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];

/** Deliberately bounded demo interpreter. Bedrock handles free-form language. */
export const conversationalDemoPlanner:AnalysisPlanner={async propose(input,data,_signal,context){
 const messages=context?.messages||[];
 const latest=normalize(input.prompt);
 const lastReady=messages.findLastIndex(m=>m.role==='assistant'&&m.status==='ready');
 const newDashboard=/(?:crie|monte|novo) (?:um )?(?:dashboard|painel)/.test(latest);
 const pending=!newDashboard&&messages.at(-1)?.status==='clarify'?messages.slice(lastReady+1).filter(m=>m.role==='user').map(m=>m.text):[];
 const q=normalize([...pending,input.prompt].join('\n'));
 const clarify=(message:string)=>assistantOutputSchema.parse({status:'clarify',message,proposal:null});
 const ready=(kind:Proposal['kind'],title:string,patch:Proposal['patch'],description='Indicadores, gráfico e tabela usam o mesmo recorte.')=>assistantOutputSchema.parse({status:'ready',message:`${title}. Preparei a proposta abaixo; você pode pedir mais um ajuste ou aplicá-la.`,proposal:{kind,title,description,patch:{...context?.pendingProposal?.patch,...patch}}});
 if(/apresenta|slides|unifi|consolid|junt.*dashboard/.test(q)){
  const merge=/unifi|consolid|junt/.test(q),matched=context?.boards?.filter(b=>q.includes(normalize(b.title)))||[];
  const ids=/todos os dashboards/.test(q)?context?.boards?.map(b=>b.id)||[]:matched.map(b=>b.id);
  if(!ids.length&&/est[ea]|atual/.test(q)&&!merge)ids.push('current');
  if(ids.length<(merge?2:1))return clarify(merge?'Quais dashboards você quer unificar? Informe pelo menos dois nomes.':'De qual dashboard você quer criar a apresentação? Pode escolher a análise atual ou informar os nomes.');
  return assistantOutputSchema.parse({status:'ready',message:merge?'Vou reunir os gráficos mantendo os recortes. Confira antes de salvar.':'Vamos preparar os slides com os números e fontes dos dashboards escolhidos.',proposal:{kind:merge?'merge':'presentation',title:merge?'Dashboard consolidado':'Apresentação executiva',description:'Cada gráfico preserva sua fonte e seus filtros.',patch:{},boardIds:ids}});
 }
 if(context?.generic){
  const fields=context.fields||[],named=fields.filter(f=>q.includes(normalize(f.label))),metric=named.find(f=>f.type==='number'),dimension=named.find(f=>f.type!=='number');
  if(!dimension||!metric&&!/conte|contagem|quantidade de registros/.test(q))return clarify(`Qual medida e agrupamento você quer usar? Colunas disponíveis: ${fields.slice(0,8).map(f=>f.label).join(', ')}.`);
  const date=fields.find(f=>f.type==='date');
  return ready('create','Análise da fonte',{widgets:[{id:'analysis',sourceId:input.document.sourceId,title:`${metric?.label||'Registros'} por ${dimension.label}`,kind:/linha/.test(q)?'line':/barra/.test(q)?'bar':'column',dimension:dimension.key,metric:metric?.key||dimension.key,operation:metric?/m[eé]dia/.test(q)?'average':'sum':'count',unit:'number',comparison:null,color:'blue',legend:true,limit:30,dateColumn:date?.key||null}],screen:'dashboard'});
 }
 if(/lucro|receita|vendas|estoque|margem/.test(latest))return clarify('Esta fonte tem despesas e orçamento. Quer comparar essas medidas ou escolher outra fonte de dados?');
 const center=(context?.centers||data.groups.map(g=>g.name)).find(name=>q.includes(normalize(name)));
 const company=context?.companies.find(name=>q.includes(normalize(name)));
 const create=/dashboard|painel|monte|crie/.test(q);
 const scenario=/simul|reduc|econom/.test(q);
 if(scenario){
  const raw=q.match(/(\d+(?:[.,]\d+)?)\s*%/g)?.at(-1);
  if(!raw||!center)return clarify(!raw&&!center?'Qual percentual de redução você quer simular e em qual centro de custo?':!raw?'Qual percentual de redução você quer simular?':`Em qual centro de custo? Estão disponíveis: ${(context?.centers||data.groups.map(g=>g.name)).join(', ')}.`);
  const percent=Number(raw.replace('%','').replace(',','.'));
  if(percent>100)return clarify('Qual percentual entre 0 e 100% você quer simular?');
  return ready('scenario',`Simular redução de ${percent}% em ${center}`,{percent,scenarioCenter:center,screen:'scenarios'});
 }
 const patch:Proposal['patch']={};
 if(center)patch.center=center;
 if(company)patch.company=company;
 if(/todos os centros|limp.*filtro/.test(q))patch.center='all';
 const chart=q.match(/barras|colunas|linhas|rosca|cascata|tabela/g)?.at(-1);
 if(chart){patch.chart=({barras:'bar',colunas:'column',linhas:'line',rosca:'donut',cascata:'waterfall',tabela:'table'} as const)[chart as 'barras'];patch.showChart=true;}
 if(/destaq|desvio|acima do/.test(q))patch.highlight=true;
 if(/indicador|saldo disponivel/.test(q))patch.showMetric=true;
 const month=months.findIndex(name=>q.includes(name));
 const quarter=/terceiro trimestre|3[ºo]?\s*trimestre/.test(q);
 const years=[...new Set((context?.periods||[]).map(p=>p.slice(0,4)))];
 if(/todo o periodo|periodo completo|toda a base/.test(q)){patch.period='all';patch.dateFrom=null;patch.dateTo=null;}
 else if(month>=0||quarter){
  const year=q.match(/\b20\d{2}\b/g)?.at(-1)||(years.length===1?years[0]:undefined);
  if(!year)return clarify(`Você quer ${quarter?'o terceiro trimestre':months[month]} de qual ano${years.length?`: ${years.join(' ou ')}`:''}?`);
  const first=quarter?7:month+1,last=quarter?9:month+1;
  patch.period='range';patch.dateFrom=`${year}-${String(first).padStart(2,'0')}-01`;
  patch.dateTo=`${year}-${String(last).padStart(2,'0')}-${new Date(Date.UTC(Number(year),last,0)).getUTCDate()}`;
 }
 if(create&&!/financeir|despesa|orcamento|gasto|saldo|desvio/.test(q)&&!center&&!company)return clarify('O que você quer acompanhar no dashboard? Posso comparar despesas e orçamento, mostrar saldo disponível ou destacar desvios.');
 if(create)return ready('create','Seu dashboard de despesas e orçamento',{...patch,screen:'dashboard'});
 if(Object.keys(patch).length)return ready(context?.pendingProposal?.kind|| (chart?'chart':patch.highlight?'highlight':patch.showMetric?'metric':'filter'),'Ajustar sua análise',patch);
 if(/proje|fechamento|previs/.test(q))return ready('forecast','Explorar fechamento',{screen:'scenarios'},'Projeção ilustrativa por média, sem modelo preditivo.');
 return clarify('O que você quer analisar? Neste modo demonstrativo, posso comparar despesas e orçamento por empresa, centro e período. Para pedidos mais amplos, use o provedor de IA.');
}};
