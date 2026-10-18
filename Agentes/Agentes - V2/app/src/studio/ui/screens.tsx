import {inputLimits} from '@/core/inputLimits';
import {DatasetExplore} from './DatasetExplore';
import {initialDocument} from '../contracts';
import {BoardCover} from './BoardCover';
import React,{useEffect,useState} from 'react';
import {ArrowRight,ArrowUpRight,Database,Download,FileText,GitCompare,LayoutDashboard,Plus,Save,Search,ShieldCheck,Sparkles,Star,Trash2,Copy,Plug,RefreshCw,Table2,Check} from 'lucide-react';
import {GovernancePage} from '@/ui/GovernancePage';
import {useApp} from './state';
import {useWorkspaceDraft} from './useWorkspaceDraft';
import {Button,IconButton,Badge,Empty,Select,MetricStrip,DataTable} from './ui';
import {currentFilters} from './FinancialFilters';
import {sourceLabel,centers,money,number} from '../domain';
import {request} from './api';
import type {QueryResult} from '../contracts';
import {Filters} from './workspace';
import {TrendChart} from './charts';
export function PageHead({title,subtitle,children}:any){return <div className="page-heading standalone-heading"><div><h1 tabIndex={-1}>{title}</h1><p>{subtitle}</p></div><div className="heading-actions">{children}</div></div>}

export {Home as Overview} from './Home';
export {DataPage as Connections} from './DataPage';
export {Library} from './Library';

export function Explore(){const {s,server,exportCsv,data}=useApp();const [search,setSearch]=useState(''),[offset,setOffset]=useState(0),[result,setResult]=useState<QueryResult|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false);useEffect(()=>setOffset(0),[search,s.center,s.period,s.company,s.dateFrom,s.dateTo]);useEffect(()=>{const ctrl=new AbortController();setLoading(true);const timer=setTimeout(()=>request<QueryResult>('query',{...currentFilters(s),search,offset,limit:25},server.workspace.id,ctrl.signal).then(v=>{setResult(v);setError('')}).catch(e=>{if(!ctrl.signal.aborted)setError(e.message)}).finally(()=>{if(!ctrl.signal.aborted)setLoading(false)}),150);return()=>{clearTimeout(timer);ctrl.abort()}},[server.workspace.id,s.sourceId,search,offset,s.center,s.period,s.company,s.dateFrom,s.dateTo]);if(data.dataset)return <DatasetExplore/>;return <><PageHead title="Explorar dados" subtitle="Confira os registros que sustentam a análise."><Button icon={Download} onClick={exportCsv}>Exportar resumo CSV</Button></PageHead><Filters/><div className="library-toolbar"><label className="searchbox"><Search size={17}/><input maxLength={inputLimits.search} aria-label="Buscar registros" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Empresa, centro, competência ou identificador"/></label><Badge>{result?.matchedCount||0} registros</Badge></div>{error?<p role="alert" className="error-banner">{error}</p>:<section className="panel"><div className="table-scroll records-scroll responsive-records" role="region" aria-label="Registros financeiros" tabIndex={0} aria-busy={loading}><table><thead><tr><th>Identificador</th><th>Competência</th><th>Empresa</th><th>Centro</th><th>Realizado</th><th>Orçamento</th></tr></thead><tbody>{result?.rows.map(r=><tr key={r.id}><td data-label="Identificador">{r.id}</td><td data-label="Competência">{r.date}</td><td data-label="Empresa">{r.company}</td><td data-label="Centro">{r.center}</td><td data-label="Realizado">{money(r.actual)}</td><td data-label="Orçamento">{money(r.budget)}</td></tr>)}</tbody></table>{result&&!result.rows.length&&<Empty title="Nenhum registro no recorte" text="Altere os filtros ou o texto da busca."/>}</div><div className="table-footer"><span>{loading?'Consultando…':`${Math.min(offset+1,result?.matchedCount||0)}–${Math.min(offset+25,result?.matchedCount||0)} de ${result?.matchedCount||0}`}</span><div className="inline"><Button disabled={!offset||loading} onClick={()=>setOffset(n=>Math.max(0,n-25))}>Anterior</Button><Button disabled={loading||offset+25>=(result?.matchedCount||0)} onClick={()=>setOffset(n=>n+25)}>Próxima</Button></div></div></section>}</>}

export {FinancialPlanning as Planning,FinancialScenarios as Scenarios} from './FinancialPlanning';

export function Admin(){const {server,reload}=useApp();return <GovernancePage workspace={server.workspace} workspaces={server.workspaces} changed={reload}/>}
