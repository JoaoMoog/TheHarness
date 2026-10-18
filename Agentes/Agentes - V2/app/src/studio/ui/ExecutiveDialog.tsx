import {useEffect,useState} from 'react';
import {Download,Presentation,Combine} from 'lucide-react';
import {useApp,workingDocument} from './state';
import {Button,Modal} from './ui';
import {request} from './api';
import type {DashboardDocument} from '../contracts';

export function ExecutiveDialog({kind,close}:{kind:'executive'|'merge';close:()=>void}){
 const {s,set,server,artifactSelection,go,toast}=useApp();
 const [selected,setSelected]=useState<string[]>(()=>{
  const ids=artifactSelection.length?artifactSelection:[kind==='merge'?'current':s.savedId||'current'];
  return [...new Set(ids.map(id=>kind==='merge'&&id===s.savedId?'current':id))];
 });
 const [title,setTitle]=useState(kind==='merge'?'Dashboard consolidado':s.title),[busy,setBusy]=useState(false),[error,setError]=useState(''),[artifact,setArtifact]=useState<{html:string;title:string;slideCount:number}|null>(null),[url,setUrl]=useState('');
 useEffect(()=>{if(!artifact)return;const url=URL.createObjectURL(new Blob([artifact.html],{type:'text/html;charset=utf-8'}));setUrl(url);return()=>URL.revokeObjectURL(url)},[artifact]);
 const toggle=(id:string,checked:boolean)=>setSelected(old=>checked?[...old.filter(other=>!(id==='current'&&other===s.savedId||id===s.savedId&&other==='current')),id]:old.filter(other=>other!==id));
 const current=workingDocument(s),choices=[{id:'current',title:`Análise em edição · ${s.title}`},...server.state.boards.filter(b=>kind!=='merge'||b.id!==s.savedId).map(b=>({id:b.id,title:b.document.title}))];
 const needsAnother=kind==='merge'&&choices.length<2;
 const selectionHint=needsAnother?'Você precisa de pelo menos dois dashboards diferentes neste espaço. Crie ou salve outro dashboard para unificar.':selected.length>12?'Selecione no máximo 12 dashboards.':kind==='merge'&&selected.length<2?'Selecione pelo menos dois dashboards para continuar.':`${selected.length} ${selected.length===1?'dashboard selecionado':'dashboards selecionados'}.`;
 async function create(){setBusy(true);setError('');try{const input={title,boardIds:selected,current};if(kind==='merge'){const document=await request<DashboardDocument>('dashboards/merge',input,server.workspace.id);set({...document,savedId:null});go('dashboard');toast('Dashboards reunidos. Confira os gráficos e salve a nova análise.');close();}else setArtifact(await request('presentations',input,server.workspace.id));}catch(e){setError(e instanceof Error?e.message:'Não foi possível preparar a apresentação.')}finally{setBusy(false)}}
 return <Modal title={kind==='merge'?'Unificar dashboards':'Apresentação executiva'} onClose={close} wide={!!artifact}>{artifact?<><p>{artifact.slideCount} slides · HTML independente, com navegação por teclado e impressão em PDF.</p><iframe title="Prévia da apresentação executiva" className="executive-preview" src={url||undefined} sandbox="allow-scripts allow-modals" allowFullScreen/><div className="dialog-actions"><Button onClick={()=>setArtifact(null)}>Alterar seleção</Button><a className="button primary" href={url} download={`${artifact.title.replace(/[^\p{L}\p{N} _-]/gu,'').slice(0,80)||'clara-apresentacao'}.html`}><Download size={16}/>Baixar apresentação HTML</a></div></>:<><p>{kind==='merge'?'Reúna os gráficos em uma nova análise. Cada gráfico mantém sua fonte e seu recorte.':'Escolha os dashboards. Os slides usam os números atuais e identificam fontes, filtros e revisões.'}</p><label className="field">Título<input value={title} maxLength={120} onChange={e=>setTitle(e.target.value)}/></label><fieldset className="executive-selection" aria-describedby="executive-selection-hint"><legend>Dashboards</legend>{choices.map(b=><label key={b.id}><input type="checkbox" checked={selected.includes(b.id)} onChange={e=>toggle(b.id,e.target.checked)}/><span>{b.title}</span></label>)}</fieldset><p id="executive-selection-hint" role="status">{selectionHint}</p>{needsAnother&&<Button onClick={()=>{close();go('library')}}>Ver dashboards</Button>}{error&&<p role="alert" className="error-banner">{error}</p>}<div className="dialog-actions"><Button disabled={busy} onClick={close}>Cancelar</Button><Button primary icon={kind==='merge'?Combine:Presentation} disabled={busy||!title.trim()||selected.length<(kind==='merge'?2:1)||selected.length>12} onClick={()=>void create()}>{busy?'Preparando…':kind==='merge'?'Unificar dashboards':'Criar apresentação HTML'}</Button></div></>}</Modal>;
}
