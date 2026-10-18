import {useEffect,useRef,useState} from 'react';
import {Database} from 'lucide-react';
import type {Board,QueryResult} from '../contracts';
import {compact,periodLabel,sourceLabel} from '../domain';
import {useApp} from './state';
import {currentFilters} from './FinancialFilters';
import {request} from './api';
import {BoardCover} from './BoardCover';

/** Each preview queries its saved scope; hidden cards do not fetch until near the viewport. */
export function BoardPreview({board,compactView=false}:{board:Board;compactView?:boolean}){
 const {server}=useApp();
 const root=useRef<HTMLDivElement>(null);
 const [visible,setVisible]=useState(false),[result,setResult]=useState<{key:string;data?:QueryResult;error?:string}|null>(null);
 const filters=JSON.stringify(currentFilters(board.document));
 const key=`${server.workspace.id}:${filters}:${server.state.sourcePaused}`;
 useEffect(()=>{const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){setVisible(true);observer.disconnect()}},{rootMargin:'160px'});if(root.current)observer.observe(root.current);return()=>observer.disconnect()},[]);
 useEffect(()=>{
  if(!visible||compactView)return;
  if(server.state.sourcePaused){setResult({key,error:'Source paused'});return;}
  const controller=new AbortController();
  request<QueryResult>('query',{...JSON.parse(filters),limit:1},server.workspace.id,controller.signal)
   .then(data=>setResult({key,data})).catch(()=>{if(!controller.signal.aborted)setResult({key,error:'Unavailable'})});
  return()=>controller.abort();
 },[visible,compactView,key,filters,server.workspace.id,server.state.sourcePaused]);
 const current=result?.key===key?result:null;
 const data=current?.data;
 const source=board.document.sourceId==='finance'?sourceLabel(server.runtime.dataProvider):server.files.find(f=>f.id===board.document.sourceId)?.name||'Planilha indisponível';
 const groups=data?[...data.groups].sort((a,b)=>b.actual-a.actual).slice(0,3):[];
 const max=Math.max(1,...groups.map(g=>g.actual));
 return <div ref={root} className={`analysis-preview ${compactView?'is-compact':''}`}>
  {board.bannerId&&!compactView?<BoardCover board={board} workspace={server.workspace.id}/>:<h3>{board.document.title}</h3>}
  <div className="preview-scope"><span><Database size={13}/>{source}</span><span>{periodLabel(currentFilters(board.document))}</span></div>
  {!compactView&&<div className="preview-data" aria-busy={!current}>
   {!current?<span className="preview-placeholder">Carregando prévia…</span>:current.error?<span className="preview-placeholder">Prévia indisponível · abra para conferir a fonte.</span>:!data?.count?<span className="preview-placeholder">Nenhum registro neste recorte.</span>:data.dataset||board.document.mergedFrom?.length?<div className="preview-total"><span>{board.document.mergedFrom?.length?"Dashboards unificados":"Registros na fonte"}</span><strong>{board.document.mergedFrom?.length||data.count}</strong><small>{board.document.widgets?.length||0} visualizações</small></div>:<>
    <div className="preview-total"><span>Realizado no recorte</span><strong>{compact(data.actual)}</strong></div>
    <div className="preview-bars-real" aria-label="Maiores valores por centro de custo">{groups.map(g=><div key={g.name}><span>{g.name}</span><strong>{compact(g.actual)}</strong><i aria-hidden="true" style={{width:`${g.actual/max*100}%`}}/></div>)}</div>
   </>}
  </div>}
  <div className="preview-dates"><span>Editado em <time dateTime={board.updatedAt}>{new Date(board.updatedAt).toLocaleDateString('pt-BR')}</time> · v{board.revision}</span>{!compactView&&data&&<span>Dados atualizados em <time dateTime={data.lineage.updatedAt}>{new Date(data.lineage.updatedAt).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'})}</time></span>}</div>
 </div>;
}
