import {inputLimits} from '@/core/inputLimits';
import {useEffect,useState} from 'react';
import {Search} from 'lucide-react';
import {useApp} from './state';
import {request} from './api';
import type {QueryResult} from '../contracts';
import {Button} from './ui';

export function DatasetExplore(){
 const {s,server}=useApp(),[search,setSearch]=useState(''),[offset,setOffset]=useState(0),[data,setData]=useState<QueryResult|null>(null),[error,setError]=useState(''),[pending,setPending]=useState(false);
 useEffect(()=>{const ctrl=new AbortController();setPending(true);request<QueryResult>('query',{sourceId:s.sourceId,search,offset,limit:50},server.workspace.id,ctrl.signal).then(setData).catch(e=>{if(!ctrl.signal.aborted)setError(e.message)}).finally(()=>{if(!ctrl.signal.aborted)setPending(false)});return()=>ctrl.abort()},[s.sourceId,server.workspace.id,search,offset]);
 return <><div className="page-heading standalone-heading"><div><h1 tabIndex={-1}>Explorar dados</h1><p>{data?.dataset?.name} · todas as colunas da fonte</p></div></div><label className="searchbox"><Search size={16}/><input maxLength={inputLimits.search} aria-label="Buscar registros" value={search} placeholder="Buscar em qualquer coluna" onChange={e=>{setSearch(e.target.value);setOffset(0)}}/></label>{error&&<p role="alert">{error}</p>}<section className="panel dataset-records"><div className="table-scroll" tabIndex={0} role="region" aria-label="Registros da fonte" aria-busy={pending}><table><thead><tr>{data?.dataset?.columns.map(c=><th key={c.key} scope="col">{c.label}</th>)}</tr></thead><tbody>{data?.dataset?.rows.map((r,i)=><tr key={offset+i}>{data.dataset!.columns.map(c=><td key={c.key}>{r[c.key]==null?'—':String(r[c.key])}</td>)}</tr>)}</tbody></table></div><div className="table-footer"><span>{data?.matchedCount||0} registros</span><div className="inline"><Button disabled={pending||!offset} onClick={()=>setOffset(n=>Math.max(0,n-50))}>Anterior</Button><Button disabled={pending||offset+50>=(data?.matchedCount||0)} onClick={()=>setOffset(n=>n+50)}>Próxima</Button></div></div></section></>;
}
