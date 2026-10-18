import {inputLimits} from '@/core/inputLimits';
import {useState} from 'react';
import {Copy,LayoutGrid,List,Plus,Search,Sparkles,Star,Trash2} from 'lucide-react';
import {initialDocument} from '../contracts';
import {useApp} from './state';
import {Button,IconButton,Badge,Empty} from './ui';
import {BoardPreview} from './BoardPreview';
import {SharedLibrary} from './Sharing';

export function Library(){
 const {server,command,openBoard,set,go,pending,s,setBannerTarget,confirmReplaceAnalysis}=useApp();
 const [search,setSearch]=useState(''),[favorite,setFavorite]=useState(false),[confirm,setConfirm]=useState(''),[view,setView]=useState<'gallery'|'list'>('gallery');
 const boards=server.state.boards.filter(b=>(!favorite||b.favorite)&&b.document.title.toLocaleLowerCase().includes(search.toLocaleLowerCase())).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
 return <div className="analysis-library">
  <div className="page-heading standalone-heading"><div><h1 tabIndex={-1}>Dashboards</h1><p>Análises salvas no seu espaço, prontas para continuar.</p></div><Button primary icon={Plus} disabled={s.reader} onClick={()=>{if(!confirmReplaceAnalysis())return;set({...initialDocument,sourceId:s.sourceId,savedId:null,title:'Nova análise'});go('dashboard')}}>Novo dashboard</Button></div>
  <div className="library-toolbar"><label className="searchbox"><Search size={17}/><input maxLength={inputLimits.search} aria-label="Buscar dashboards" placeholder="Buscar pelo nome" value={search} onChange={e=>setSearch(e.target.value)}/></label><Button icon={Star} aria-pressed={favorite} onClick={()=>setFavorite(!favorite)}>{favorite?'Mostrar todos':'Somente favoritos'}</Button><Badge>{boards.length} análises</Badge><div className="library-view" role="group" aria-label="Visualização da biblioteca"><Button icon={LayoutGrid} aria-pressed={view==='gallery'} onClick={()=>setView('gallery')}>Galeria</Button><Button icon={List} aria-pressed={view==='list'} onClick={()=>setView('list')}>Lista</Button></div></div>
  {!boards.length?<Empty title="Nenhum dashboard encontrado" text="Altere a busca ou crie uma análise."/>:<div className={view==='gallery'?'board-grid':'board-list'}>{boards.map(b=><article className="board-card" key={b.id}>
   <button className="board-open" aria-label={`Abrir ${b.document.title}`} onClick={()=>openBoard(b.id)}><BoardPreview board={b} compactView={view==='list'}/></button>
   <div className="board-card-foot"><span>{b.favorite?'Favorito':'Dashboard'}</span><IconButton icon={Sparkles} label={`Criar capa para ${b.document.title}`} disabled={s.reader} onClick={()=>setBannerTarget(b.id)}/><IconButton icon={Star} aria-pressed={b.favorite} label={`${b.favorite?'Remover favorito':'Favoritar'} ${b.document.title}`} disabled={s.reader||pending} onClick={()=>void command({type:'dashboard.favorite',id:b.id,favorite:!b.favorite})}/><IconButton icon={Copy} label={`Duplicar ${b.document.title}`} disabled={s.reader||pending} onClick={()=>void command({type:'dashboard.duplicate',id:b.id})}/><IconButton icon={Trash2} label={`Excluir ${b.document.title}`} disabled={s.reader||pending} onClick={()=>setConfirm(b.id)}/></div>
   {confirm===b.id&&<div className="inline-confirm"><p>Excluir este dashboard, seu histórico e comentários?</p><Button disabled={pending} onClick={async()=>{if(await command({type:'dashboard.delete',id:b.id}))setConfirm('')}}>Confirmar exclusão</Button><Button onClick={()=>setConfirm('')}>Cancelar</Button></div>}
  </article>)}</div>}
 <SharedLibrary/></div>;
}
