import {useEffect,useRef} from 'react';
import {ArrowRight,Calculator,CalendarDays,Database,RefreshCw,X} from 'lucide-react';
import {useApp} from './state';
import {Button,IconButton} from './ui';
import {money,number,periodLabel,sourceLabel} from '../domain';

export type EvidenceView={section:'source'|'period'|'calculation'|'updated';metric?:string};
const titles={source:'Fonte dos resultados',period:'Recorte da análise',calculation:'Como este resultado é calculado',updated:'Atualização dos dados'};
const metrics:Record<string,string>={actual:'Realizado',budget:'Orçamento',balance:'Saldo disponível',execution:'Execução orçamentária',comparison:'Comparativo por centro',trend:'Evolução mensal'};

export function EvidenceTrail({selection,open}:{selection:EvidenceView|null;open:(value:EvidenceView)=>void}){
 const {data}=useApp();
 const entries=[['source','Fonte',Database],['period','Período',CalendarDays],['calculation','Cálculo',Calculator],['updated','Atualização',RefreshCw]] as const;
 return <div className="evidence-trail" role="group" aria-label="Trilha de evidências"><span>Confira os resultados</span>{entries.map(([section,label,Icon])=><button key={section} aria-controls="evidence-detail" aria-expanded={selection?.section===section} onClick={()=>open({section})}><Icon size={16}/>{label}</button>)}<small>{data.count.toLocaleString('pt-BR')} registros no recorte</small></div>;
}

export function EvidencePanel({selection,close}:{selection:EvidenceView;close:()=>void}){
 const {data,base,server,s,go}=useApp();
 const heading=useRef<HTMLHeadingElement>(null);
 useEffect(()=>{heading.current?.focus({preventScroll:true});heading.current?.scrollIntoView({block:'nearest'})},[selection]);
 const f=data.lineage.filters;
 const source=data.lineage.sourceId==='finance'?sourceLabel(data.lineage.provider):server.files.find(file=>file.id===data.lineage.sourceId)?.name||'Planilha importada';
 const saved=server.state.boards.find(board=>board.id===s.savedId);
 const excluded=base.lineage.sourceId===data.lineage.sourceId&&base.lineage.revision===data.lineage.revision?Math.max(0,base.count-data.count):null;
 const metric=selection.metric||'actual';
 const formula=metric==='budget'?'Soma dos valores de orçamento dos registros no recorte.':metric==='balance'?`${money(data.budget)} de orçamento − ${money(data.actual)} realizado = ${money(data.balance)} de saldo.`:metric==='execution'?(data.budget?`${money(data.actual)} ÷ ${money(data.budget)} × 100 = ${number(data.execution)}%.`:'O orçamento é zero. A divisão não está definida; não há percentual de execução.'):metric==='comparison'?'Soma do realizado e do orçamento, agrupada por centro de custo. Saldo = orçamento − realizado.':metric==='trend'?'Soma do realizado e do orçamento, agrupada por mês de competência. O ano faz parte de cada período.':'Soma dos valores realizados dos registros no recorte.';
 return <section id="evidence-detail" className="evidence-panel" aria-labelledby="evidence-title">
  <header><h2 id="evidence-title" ref={heading} tabIndex={-1}>{titles[selection.section]}</h2><IconButton icon={X} label="Fechar evidências" onClick={close}/></header>
  {selection.section==='source'&&<><dl><div><dt>Fonte</dt><dd>{source}</dd></div><div><dt>Natureza</dt><dd>{['demo','financial-test'].includes(data.lineage.provider)?'Dados sintéticos para demonstração':data.lineage.provider==='file'?'Arquivo importado':'Dados da conexão configurada'}</dd></div><div><dt>Revisão consultada</dt><dd>{data.lineage.revision}</dd></div><div><dt>Unidade</dt><dd>Reais (BRL), sem conversão cambial</dd></div></dl><p>Os indicadores e gráficos desta análise usam esta mesma fonte e revisão.</p></>}
  {selection.section==='period'&&<><dl><div><dt>Período de competência</dt><dd>{periodLabel(f)}</dd></div><div><dt>Empresa</dt><dd>{f.company==='all'?'Todas as empresas':f.company}</dd></div><div><dt>Centro de custo</dt><dd>{f.center==='all'?'Todos os centros':f.center}</dd></div><div><dt>Registros incluídos</dt><dd>{data.count.toLocaleString('pt-BR')}</dd></div>{excluded!==null&&<div><dt>Fora deste recorte</dt><dd>{excluded.toLocaleString('pt-BR')} registros da mesma revisão</dd></div>}</dl><p>Os filtros atuam juntos. Um registro precisa atender a todos os critérios para entrar nos resultados.</p></>}
  {selection.section==='updated'&&<><dl><div><dt>Dados atualizados em</dt><dd>{new Date(data.lineage.updatedAt).toLocaleString('pt-BR')}</dd></div><div><dt>Revisão atual da fonte</dt><dd>{data.lineage.revision}</dd></div><div><dt>Dashboard editado em</dt><dd>{saved?new Date(saved.updatedAt).toLocaleString('pt-BR'):'Ainda não salvo'}</dd></div><div><dt>Revisão da fonte ao salvar</dt><dd>{saved?.sourceRevision||'Ainda não registrada'}</dd></div></dl><p>{saved?.sourceRevision&&saved.sourceRevision!==data.lineage.revision?'A fonte mudou desde o salvamento. Os resultados exibidos usam a revisão atual.':'A data de edição do dashboard é independente da atualização da fonte.'}</p></>}
  {selection.section==='calculation'&&<><h3>{metrics[metric]||'Realizado'}</h3><p className="evidence-formula">{formula}</p><p>{data.count.toLocaleString('pt-BR')} registros incluídos · {periodLabel(f)} · {f.center==='all'?'Todos os centros':f.center} · {f.company==='all'?'Todas as empresas':f.company}.</p>{data.rows.length>0&&<div className="evidence-sample" role="region" aria-label="Amostra dos registros incluídos" tabIndex={0}><table><caption>Amostra: {Math.min(5,data.rows.length)} de {data.count.toLocaleString('pt-BR')} registros incluídos. O cálculo usa todos os registros do recorte.</caption><thead><tr><th scope="col">Competência</th><th scope="col">Centro</th><th scope="col">Realizado</th><th scope="col">Orçamento</th></tr></thead><tbody>{data.rows.slice(0,5).map(row=><tr key={row.id}><td>{row.date}</td><td>{row.center}</td><td>{money(row.actual)}</td><td>{money(row.budget)}</td></tr>)}</tbody></table></div>}</>}
  <footer><Button icon={ArrowRight} onClick={()=>go('explore')}>Conferir registros do recorte</Button></footer>
 </section>;
}
