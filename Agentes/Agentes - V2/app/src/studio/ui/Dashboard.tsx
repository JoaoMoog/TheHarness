import {BoardCanvas} from './BoardCanvas';
import {useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,ArrowUpRight,MessageSquare,Pencil,Save,Settings2,Sparkles,X} from 'lucide-react';
import {useApp} from './state';
import {Button,IconButton,Badge,MetricStrip,DataTable} from './ui';
import {FinancialFilters} from './FinancialFilters';
import {CompareChart,TrendChart} from './charts';
import {SaveStatus} from './SaveStatus';
import {DashboardActions} from './DashboardActions';
import {EvidenceTrail,EvidencePanel,type EvidenceView} from './Evidence';
import {decisionSummary} from './evidenceModel';
import {money,periodLabel,sourceLabel} from '../domain';

function ComparisonLegend({kind}:{kind:string}){
 if(['text','indicator','table'].includes(kind))return null;
 if(kind==='donut')return <div className="chart-legend">Participação no realizado</div>;
 if(kind==='waterfall')return <div className="chart-legend">Saldo = orçamento − realizado</div>;
 return <div className="chart-legend"><span><i/>Realizado</span><span><i className="budget-key"/>Orçamento</span></div>;
}

export function Dashboard(){
 const {s,set,go,modal,chat,setChat,setEditor,data,save,server,saving,dirty}=useApp();
 const [evidence,setEvidence]=useState<EvidenceView|null>(null);
 const filtersOpen=s.filtersExpanded;
 const setFiltersOpen=(value:boolean)=>set({filtersExpanded:value});
 const trigger=useRef<HTMLElement|null>(null);
 const openEvidence=(selection:EvidenceView)=>{trigger.current=document.activeElement as HTMLElement;setEvidence(selection)};
 const closeEvidence=()=>{setEvidence(null);trigger.current?.focus({preventScroll:true})};
 const conclusion=decisionSummary(data);
 const filter=(center:string)=>set({center});
 const f=data.lineage.filters;
 const shortDate=(date:string)=>new Intl.DateTimeFormat('pt-BR',{timeZone:'UTC'}).format(new Date(date+'T12:00:00Z'));
 const period=f.dateFrom&&f.dateTo
  ?f.dateFrom.endsWith('-01-01')&&f.dateTo===f.dateFrom.slice(0,4)+'-12-31'?f.dateFrom.slice(0,4):`${shortDate(f.dateFrom)} a ${shortDate(f.dateTo)}`
  :periodLabel(f);
 return <div className="decision-dashboard">
  <button className="dashboard-back" onClick={()=>go('library')}><ArrowLeft size={14} aria-hidden="true"/>Dashboards</button>
  <header className="dashboard-header"><div className="dashboard-title"><h1 tabIndex={-1}>{s.title}</h1><SaveStatus/></div><div className="dashboard-primary-actions"><Button icon={Pencil} disabled={s.reader} onClick={()=>setEditor(true)}>Editar</Button>{!chat&&<Button icon={Sparkles} onClick={()=>setChat(true)}>CLARA IA</Button>}{!s.reader&&<Button primary icon={Save} disabled={saving||(!dirty&&!!s.savedId)} onClick={save}>{saving?'Salvando…':'Salvar'}</Button>}<DashboardActions/></div></header>
  {s.mergedFrom.length?<div className="analysis-scope"><strong>{s.mergedFrom.length} dashboards unificados</strong><span>Fontes e períodos preservados em cada gráfico</span></div>:<div className="analysis-scope"><div><strong>{period}</strong>{!data.dataset&&<><span>{f.company==='all'?'Todas as empresas':f.company}</span><span>{f.center==='all'?'Todos os centros':f.center}</span></>}{f.center!=='all'&&<Button quiet icon={X} onClick={()=>filter('all')}>Voltar a todos os centros</Button>}</div><Button icon={Settings2} aria-expanded={filtersOpen} aria-controls="dashboard-filters" onClick={()=>setFiltersOpen(!filtersOpen)}>{filtersOpen?'Fechar filtros':'Ajustar filtros'}</Button></div>}
  <div id="dashboard-filters" hidden={!filtersOpen||!!s.mergedFrom.length}><FinancialFilters/></div>
  {!data.dataset&&!s.mergedFrom.length&&<section className={`dashboard-conclusion ${conclusion.tone}`} aria-label="Conclusão do recorte"><div><h2>{conclusion.title}</h2><details className="conclusion-detail"><summary>Ver análise</summary><p>{conclusion.detail}</p></details></div>{conclusion.center&&f.center==='all'&&<Button quiet icon={ArrowRight} onClick={()=>filter(conclusion.center!)}>Investigar {conclusion.center}</Button>}</section>}
  {server.state.boards.find(board=>board.id===s.savedId)?.sourceRevision&&server.state.boards.find(board=>board.id===s.savedId)?.sourceRevision!==data.lineage.revision&&<p className="source-revision-notice">A fonte mudou desde o salvamento. Os resultados usam a revisão atual. <button onClick={()=>openEvidence({section:'updated'})}>Conferir atualização</button></p>}
  {evidence&&<EvidencePanel selection={evidence} close={closeEvidence}/>}
  {!data.dataset&&!s.mergedFrom.length&&<MetricStrip data={data} show={s.showMetric} onEvidence={(metric:string)=>openEvidence({section:'calculation',metric})}/>}
  <BoardCanvas/>
  {!data.dataset&&!s.mergedFrom.length&&<section className="panel detail-panel"><div className="panel-heading"><div className="inline"><h2>Detalhamento por centro de custo</h2><Badge>{data.groups.length} centros</Badge></div><button className="text-button" onClick={()=>go('explore')}>Explorar dados <ArrowUpRight size={14}/></button></div><DataTable groups={data.groups} onSelect={filter} highlight={s.highlight}/><div className="table-footer"><span>{data.count} registros consolidados</span><button onClick={()=>openEvidence({section:'source'})}>Ver fontes e critérios</button></div></section>}
  {!data.dataset&&!s.mergedFrom.length&&<details className="dashboard-evidence"><summary>Fontes e critérios <span>{sourceLabel(data.lineage.provider)}</span></summary><EvidenceTrail selection={evidence} open={openEvidence}/></details>}
  <div className="page-foot"><span>{['demo','financial-test'].includes(data.lineage.provider)?'Dados sintéticos para demonstração':'Resultados da fonte configurada'} · {s.reader?'Visão de Leitor':'Seu espaço de análise'}</span><button onClick={()=>modal('comments')}><MessageSquare size={14}/>{s.comments.length} comentários</button></div>
 </div>;
}
