import {useEffect,useRef,useState} from 'react';
import {ArrowRight,ChevronDown,Database,MessageSquare,Plus,Upload,History} from 'lucide-react';
import {useApp} from './state';
import {ProposalReview} from './ProposalReview';
import {Conversation} from './Conversation';
import {ChatComposer} from './ChatComposer';
import {BoardPreview} from './BoardPreview';
import {Button} from './ui';
import {analysisSuggestions,hasDocumentChanges,type SuggestionCatalog} from './analysisPresentation';
import {request} from './api';
import {periodLabel,sourceLabel} from '../domain';
import {currentFilters} from './FinancialFilters';

export function Home(){
 const {s,set,server,send,go,openBoard,busy,resumeAnalysis,resume,chatStatus,newConversation}=useApp();
 const [target,setTarget]=useState(s.messages.length?s.savedId||'':'');
 const [contextOpen,setContextOpen]=useState(false);
 const [suggestionData,setSuggestionData]=useState<{key:string;catalog:SuggestionCatalog}|null>(null);
 const input=useRef<HTMLTextAreaElement>(null);
 const boards=[...server.state.boards].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
 const sourceId=boards.find(b=>b.id===target)?.document.sourceId||s.sourceId;
 const catalogKey=`${server.workspace.id}:${sourceId}:${server.state.sourcePaused}`;
 useEffect(()=>{
  if(server.state.sourcePaused)return;
  const controller=new AbortController();
  request<SuggestionCatalog>(`catalog/${encodeURIComponent(sourceId)}`,undefined,server.workspace.id,controller.signal)
   .then(catalog=>setSuggestionData({key:catalogKey,catalog})).catch(()=>{});
  return()=>controller.abort();
 },[sourceId,server.workspace.id,server.state.sourcePaused,catalogKey]);
 const suggestions=analysisSuggestions(suggestionData?.key===catalogKey?suggestionData.catalog:null);
 const resumeDirty=resumeAnalysis&&hasDocumentChanges(resumeAnalysis.document,boards.find(b=>b.id===resumeAnalysis.savedId)?.document);
 const selectedSource=sourceId==='finance'?sourceLabel(server.runtime.dataProvider):server.files.find(file=>file.id===sourceId)?.name||'Planilha importada';

 return <div className={`home-page ${s.messages.length?'is-conversing':''}`}>
  <section className="home-intro">
   <h1 tabIndex={-1}>O que vamos descobrir hoje?</h1>
  </section>
  {resumeAnalysis&&<section className="home-resume" aria-label="Análise em andamento"><History size={22}/><div><h2>{resumeAnalysis.document.title}</h2><p>{resumeDirty?'Alterações não salvas':'Última análise aberta'} · {periodLabel(currentFilters(resumeAnalysis.document))}</p><small>Disponível enquanto esta página estiver aberta.</small></div><Button icon={ArrowRight} onClick={resume}>Retomar análise</Button></section>}
  <section className="home-chat" aria-label="Converse com a CLARA">
   {s.messages.length>0&&<div className="chat-section-head"><h2>Conversa</h2><Button quiet icon={Plus} disabled={busy>0} onClick={()=>{newConversation();setContextOpen(false);input.current?.focus()}}>Nova conversa</Button></div>}
   <details className="chat-context" open={contextOpen} onToggle={event=>setContextOpen(event.currentTarget.open)}>
    <summary><Database size={15}/><span><strong>Dados e análise</strong><span>{selectedSource}</span></span><ChevronDown size={16}/></summary>
    <div className={`home-composer-tools ${target?'existing-analysis':''}`}>
     <label className="home-composer-field"><span>Análise</span><select aria-label="Análise da conversa" value={target} disabled={busy>0} onChange={e=>{newConversation();setTarget(e.target.value)}}>
      <option value="">Novo dashboard</option>
      {boards.map(b=><option key={b.id} value={b.id}>{b.document.title}</option>)}
     </select></label>
     {!target&&<label className="home-composer-field"><span>Fonte</span><select aria-label="Fonte do novo dashboard" value={s.sourceId} disabled={busy>0} onChange={e=>{newConversation();set({sourceId:e.target.value,company:'all',center:'all',period:'all',dateFrom:null,dateTo:null})}}>
      <option value="finance">{sourceLabel(server.runtime.dataProvider)}</option>
      {server.files.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}
     </select></label>}
     <div className="home-import"><Button quiet icon={Upload} disabled={s.reader||busy>0} onClick={()=>go('connections')}>Importar planilha</Button><span>Excel ou CSV</span></div>
    </div>
   </details>
   <Conversation><ProposalReview home/></Conversation>
   <ChatComposer home inputRef={input} onSend={text=>{setContextOpen(false);send(text,target)}}/>
  </section>
  {!s.messages.length&&!!suggestions.length&&<div className="home-suggestions" role="group" aria-label="Ideias para começar">
   <button disabled={s.reader||busy>0} onClick={()=>{set({draft:suggestions[0]});input.current?.focus()}}><span>{suggestions[0]}</span><ArrowRight size={15}/></button>
   <details className="home-more-ideas"><summary>Mais ideias para esta fonte</summary>{suggestions.slice(1).map(text=><button key={text} disabled={s.reader||busy>0} onClick={()=>{set({draft:text});input.current?.focus()}}><span>{text}</span><ArrowRight size={15}/></button>)}</details>
  </div>}
  <section className="home-recent" aria-labelledby="home-recent-title">
   <div className="section-title"><h2 id="home-recent-title">Dashboards recentes</h2><Button quiet icon={ArrowRight} onClick={()=>go('library')}>Ver todos</Button></div>
   {boards.length?<div className="board-grid">
    {boards.slice(0,6).map(board=><article className="board-card" key={board.id}>
     <button className="board-open" aria-label={`Abrir ${board.document.title}`} onClick={()=>openBoard(board.id)}>
      <BoardPreview board={board}/>
     </button>
    </article>)}
   </div>:<div className="home-empty"><Plus size={24}/><div><h3>Seu primeiro dashboard começa aqui.</h3><p>Conte à CLARA o que você quer analisar.</p></div></div>}
  </section>
 </div>;
}
