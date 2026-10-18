'use client';
import {CreditManagement,PlatformUsage,MyCredits,platformRequest} from './PlatformPages';
import {ExecutiveDialog} from './ExecutiveDialog';
import {exportData} from './exportData';
import {Brand} from './Brand';
import React,{useCallback,useEffect,useRef,useState} from 'react';
import {Coins,Activity,Bell,ChartNoAxesCombined,ChevronDown,ChevronsUpDown,House,Layers,LayoutDashboard,Menu,PanelLeftClose,Plug,Search,Settings2,ShieldCheck,Sparkles,RefreshCw} from 'lucide-react';
import {api,setApiWorkspace} from '@/ui/api';
import {AppContext,initialState,snapshot,workingDocument,type ResumeAnalysis,type State,type Screen,type Bootstrap} from './state';
import {initialDocument,type StudioCommand,type QueryResult,type Proposal} from '../contracts';
import {Button,IconButton,Empty} from './ui';
import {currentFilters} from './FinancialFilters';
import {sourceLabel,periodLabel} from '../domain';
import {request,StudioError} from './api';
import {hasDocumentChanges} from './analysisPresentation';
import {ThemeControl} from './ThemeControl';
import {StudioLogin} from './Login';
import {Chat,Dashboard,Editor} from './workspace';
import {Overview,Library,Explore,Connections,Admin} from './screens';
import {Dialogs} from './dialogs';
import {Welcome} from './Welcome';
import {BannerDialog} from './BoardCover';
import {ProfileMenu} from './ProfileMenu';
import {useOverlayAccessibility} from './useOverlayAccessibility';

export function Studio(){
 const [config,setConfig]=useState<any>(null),[server,setServer]=useState<Bootstrap|null>(null),[s,setState]=useState<State>(initialState),[loading,setLoading]=useState(true),[error,setError]=useState(''),[authRequired,setAuthRequired]=useState(false);
 const [chat,setChatState]=useState(false),[editor,setEditorState]=useState(false),[nav,setNav]=useState(false),[collapsed,setCollapsed]=useState(false),[modal,setModal]=useState(''),[toastText,setToast]=useState('');
 const [data,setData]=useState<QueryResult|null>(null),[base,setBase]=useState<QueryResult|null>(null),[catalog,setCatalog]=useState<any>(null),[dataError,setDataError]=useState(''),[dataPending,setDataPending]=useState(false),[refresh,setRefresh]=useState(0);
 const [proposal,setProposal]=useState<Proposal|null>(null),[busy,setBusy]=useState(0),[pending,setPending]=useState(false),[previous,setPrevious]=useState<Partial<State>|null>(null);
 const conversation=useRef<{id:string;scope:string;applied:boolean}|null>(null);
 const [chatStatus,setChatStatus]=useState<'ready'|'clarify'|null>(null);
 const newConversation=()=>{chatController.current?.abort();conversation.current=null;setBusy(0);setProposal(null);setChatStatus(null);set({messages:[],draft:''})};
 const [tabletExpanded,setTabletExpanded]=useState(false);
 const [selectedWidget,setSelectedWidget]=useState<string|null>(null);
 const [artifactSelection,setArtifactSelection]=useState<string[]>([]);
 const [resumeAnalysis,setResumeAnalysis]=useState<ResumeAnalysis|null>(null),[saving,setSaving]=useState(false);
 const [welcome,setWelcome]=useState(false),[bannerTarget,setBannerTarget]=useState<string|null>(null);
 const drafts=useRef(new Map<string,unknown>());
 const overlayTrigger=useRef<HTMLElement|null>(null);
 const toastTimer=useRef<ReturnType<typeof setTimeout>|null>(null),main=useRef<HTMLElement>(null),requestLock=useRef(false),retry=useRef<{fingerprint:string;operationId:string}|null>(null),chatController=useRef<AbortController|null>(null);
 const set=(patch:Partial<State>|((s:State)=>Partial<State>))=>setState(old=>({...old,...(typeof patch==='function'?patch(old):patch)}));
 const toast=(text:string)=>{if(toastTimer.current)clearTimeout(toastTimer.current);setToast(text);toastTimer.current=setTimeout(()=>setToast(''),4500)};
 const capturePanelTrigger=()=>{const active=document.activeElement as HTMLElement;overlayTrigger.current=window.innerWidth<768&&active?.closest('.sidebar')?document.querySelector<HTMLElement>('button[aria-label="Abrir navegação"]'):active;setNav(false)};
 const setChat=(open:boolean)=>{if(s.screen==='overview'&&open){setNav(false);document.getElementById('home-message')?.focus();return;}if(open)capturePanelTrigger();setChatState(open);if(open)setEditorState(false)};
 const setEditor=(open:boolean)=>{if(open&&s.reader)return;if(open)capturePanelTrigger();setEditorState(open);if(open)setChatState(false)};
 const go=(screen:Screen)=>{set({screen});setNav(false);setEditorState(false);if(['overview','library','connections','admin','credits','usage'].includes(screen))setChatState(false);main.current?.scrollTo(0,0);setTimeout(()=>main.current?.querySelector('h1')?.focus(),30)};
 const dirty=hasDocumentChanges(workingDocument(s),server?.state.boards.find(b=>b.id===s.savedId)?.document);
 const workingKey=JSON.stringify(workingDocument(s));
 useEffect(()=>{if(s.screen==='dashboard')setResumeAnalysis({document:JSON.parse(workingKey),savedId:s.savedId})},[s.screen,workingKey,s.savedId]);
 const resume=()=>{if(!resumeAnalysis)return;set({...resumeAnalysis.document,savedId:resumeAnalysis.savedId,screen:'dashboard'});setProposal(null);setPrevious(null);setEditorState(false)};
 const confirmReplaceAnalysis=()=>{
  const work=s.screen==='dashboard'?{document:workingDocument(s),savedId:s.savedId}:resumeAnalysis;
  if(work&&hasDocumentChanges(work.document,server?.state.boards.find(b=>b.id===work.savedId)?.document)&&!window.confirm('Há alterações não salvas na análise em andamento. Descartá-las e abrir outra análise?'))return false;
  setResumeAnalysis(null);setPrevious(null);return true;
 };
 useEffect(()=>{
  const unsaved=s.screen==='dashboard'?dirty:resumeAnalysis&&hasDocumentChanges(resumeAnalysis.document,server?.state.boards.find(b=>b.id===resumeAnalysis.savedId)?.document);
  if(!unsaved||s.reader)return;
  const beforeUnload=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue=''};
  window.addEventListener('beforeunload',beforeUnload);return()=>window.removeEventListener('beforeunload',beforeUnload);
 },[dirty,resumeAnalysis,server,s.screen,s.reader]);
 const acceptServer=useCallback((value:Bootstrap,reset=false)=>{const requested=reset?new URLSearchParams(window.location.search).get('dashboard'):null;const selected=(requested?value.state.boards.find(b=>b.id===requested):undefined)||value.state.boards[0];if(requested&&!value.state.boards.some(b=>b.id===requested))setError('O dashboard do link não está disponível neste espaço.');setServer(value);if(reset){setResumeAnalysis(null);conversation.current=null;setChatStatus(null);setProposal(null)};if(reset)setWelcome(!value.preferences.onboarded);setApiWorkspace(value.workspace.id);setAuthRequired(false);setState(old=>({...old,...(reset?{...initialState,...(selected?.document||initialDocument),savedId:selected?.id||null,screen:requested?'dashboard':['admin','credits','usage'].includes(old.screen)?old.screen:'overview'}:{}),reader:value.workspace.role==='reader'||(!reset&&old.previewReader),previewReader:reset?false:old.previewReader,connection:!value.state.sourcePaused,messages:reset?[]:old.messages,comments:value.state.comments.filter(c=>c.boardId===(reset?selected?.id:old.savedId))}));},[]);
 const reload=useCallback(async(workspaceId?:string)=>{const changed=!!workspaceId&&workspaceId!==server?.workspace.id;setError('');try{const value=await request<Bootstrap>('bootstrap',undefined,workspaceId||server?.workspace.id||new URLSearchParams(window.location.search).get('workspace')||undefined);acceptServer(value,!server||changed||value.actor.id!==server.actor.id);if(changed){chatController.current?.abort();setBusy(0);setProposal(null);setPrevious(null);setChat(false);window.history.replaceState(null,'',window.location.pathname)}setRefresh(n=>n+1)}catch(e){if(e instanceof StudioError&&e.status===401)setAuthRequired(true);setError(e instanceof Error?e.message:'Não foi possível carregar o espaço.')}finally{setLoading(false)}},[acceptServer,server]);
 useEffect(()=>{let active=true;const requestedWorkspace=new URLSearchParams(window.location.search).get('workspace')||undefined;Promise.all([request<any>('config'),request<Bootstrap>('bootstrap',undefined,requestedWorkspace).catch(e=>e)]).then(([cfg,result])=>{if(!active)return;setConfig(cfg);if(result instanceof Error){if(result instanceof StudioError&&result.status===401)setAuthRequired(true);else setError(result.message)}else acceptServer(result,true);setLoading(false)}).catch(e=>{if(active){setError(e.message);setLoading(false)}});setChatState(window.innerWidth>=1100);return()=>{active=false;chatController.current?.abort();if(toastTimer.current)clearTimeout(toastTimer.current)}},[acceptServer]);
 useEffect(()=>{const onKey=(e:KeyboardEvent)=>{if((e.ctrlKey||e.metaKey)&&e.key==='k'){e.preventDefault();setModal('search')}if(e.key==='Escape'){if(document.querySelector('[popover]:popover-open'))return;setNav(false);if(innerWidth<1100){setChatState(false);setEditorState(false)}}};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey)},[]);
 const refreshCredits=useCallback(async()=>{if(!server)return;try{const value=await platformRequest<Pick<Bootstrap,'credits'> & {access:Bootstrap['platformAccess']}>('me');setServer(old=>old&&old.actor.id===server.actor.id?{...old,credits:value.credits,platformAccess:value.access}:old)}catch{}},[server?.actor.id]);
 useEffect(()=>{if(!server)return;const timer=setInterval(()=>void refreshCredits(),30000);const focus=()=>void refreshCredits();window.addEventListener('focus',focus);return()=>{clearInterval(timer);window.removeEventListener('focus',focus)}},[refreshCredits]);
 const workspaceId=server?.workspace.id,paused=server?.state.sourcePaused;
 useEffect(()=>{if(!workspaceId||paused)return;const controller=new AbortController();setDataPending(true);setDataError('');Promise.all([request<QueryResult>('query',currentFilters(s),workspaceId,controller.signal),request<QueryResult>('query',{sourceId:s.sourceId},workspaceId,controller.signal),request<any>(`catalog/${encodeURIComponent(s.sourceId)}`,undefined,workspaceId,controller.signal)]).then(([result,baseResult,metadata])=>{setData(result);setBase(baseResult);setCatalog(metadata)}).catch(e=>{if(!controller.signal.aborted)setDataError(e.message)}).finally(()=>{if(!controller.signal.aborted)setDataPending(false)});return()=>controller.abort()},[workspaceId,paused,s.sourceId,s.center,s.period,s.company,s.dateFrom,s.dateTo,refresh]);
 const command=async(command:StudioCommand)=>{if(!server||requestLock.current)return null;requestLock.current=true;setPending(true);if(command.type==='dashboard.save')setSaving(true);setError('');const fingerprint=JSON.stringify({revision:server.state.revision,command});const operationId=retry.current?.fingerprint===fingerprint?retry.current.operationId:crypto.randomUUID();retry.current={fingerprint,operationId};try{const result=await request<Bootstrap&{targetId?:string}>('commands',{revision:server.state.revision,operationId,command},server.workspace.id);acceptServer(result);retry.current=null;return result}catch(e){if(e instanceof StudioError&&e.status===401)setAuthRequired(true);setError(e instanceof Error?e.message:'Falha de conexão. Tente novamente.');return null}finally{requestLock.current=false;setPending(false);setSaving(false)}};
 const openBoard=(id:string)=>{const board=server?.state.boards.find(b=>b.id===id);if(!board||!confirmReplaceAnalysis())return;chatController.current?.abort();newConversation();set({...board.document,savedId:id,comments:server!.state.comments.filter(c=>c.boardId===id),screen:'dashboard'});setProposal(null);setPrevious(null)};
 const send=async(text:string,targetId?:string)=>{
  if(!server||chatController.current&&!chatController.current.signal.aborted||s.reader||!text.trim())return;
  if(server.credits.available<server.credits.cost){setModal('my-credits');return;}
  if(/(?:ger|cri|faz|personaliz).*?(?:banner|capa)/i.test(text)){const target=s.screen==='overview'?targetId:(targetId||s.savedId);if(target){setBannerTarget(target);set({draft:''});return;}toast('Salve ou escolha um dashboard para criar a capa.');return;}
  const target=targetId?server.state.boards.find(b=>b.id===targetId):undefined;
  const document=target?.document||(s.screen==='overview'?{...initialDocument,sourceId:s.sourceId}:snapshot(s));
  const scope=`${server.workspace.id}:${document.sourceId}:${s.screen==='overview'?(targetId||'new'):(s.savedId||'new')}`;
  const continuing=conversation.current?.scope===scope;
  if(!continuing)conversation.current={id:crypto.randomUUID(),scope,applied:false};
  const activeConversation=conversation.current!;
  const history=continuing?s.messages:[];
  const previousProposal=continuing?proposal:null;
  if(s.screen!=='overview')setChat(true);
  set({...document,savedId:target?.id||(s.screen==='overview'?null:s.savedId),draft:'',messages:[...history,{role:'user',text}]});
  setProposal(null);setBusy(1);setError('');chatController.current?.abort();
  const controller=new AbortController();chatController.current=controller;
  try{
   const answer=await request<{status:'ready'|'clarify';proposal:Proposal|null;messages:State['messages']}>('assistant',{prompt:text,document,percent:s.percent,conversationId:activeConversation.id,proposalApplied:activeConversation.applied},server.workspace.id,controller.signal);
   if(controller.signal.aborted)return;
   activeConversation.applied=false;set({messages:answer.messages});setChatStatus(answer.status);setProposal(answer.proposal);
  }catch(e){if(!controller.signal.aborted){setError(e instanceof Error?e.message:'Falha ao enviar.');set({draft:text,messages:history});setProposal(previousProposal)}}
  finally{void refreshCredits();if(chatController.current===controller){setBusy(0);chatController.current=null;requestAnimationFrame(()=>documentElementComposer()?.focus())}}
 };
 const documentElementComposer=()=>window.document.querySelector<HTMLTextAreaElement>(s.screen==='overview'?'#home-message':'.composer textarea');
 const apply=()=>{if(!proposal)return;if(proposal.kind==='presentation'){setArtifactSelection(proposal.boardIds||['current']);setModal('executive');setProposal(null);return;}if(s.reader)return;if(s.screen==='overview'&&!confirmReplaceAnalysis())return;if(conversation.current){conversation.current.applied=true;conversation.current.scope=`${server?.workspace.id}:${s.sourceId}:${proposal.kind==='create'?'new':s.savedId||'new'}`;}const patch={...proposal.patch,...(['create','merge'].includes(proposal.kind)?{savedId:null}:{})};setPrevious(Object.fromEntries(Object.keys(patch).map(k=>[k,s[k as keyof State]])));set({...patch,screen:'dashboard'} as Partial<State>);setProposal(null);toast('Proposta aplicada à análise. Salve para registrar a versão.')};
 const undo=()=>{if(previous&&!s.reader){set(previous);setPrevious(null);toast('Último ajuste desfeito.')}};
 const exportCsv=async()=>{if(!data||!server)return;try{await exportData(snapshot(s),data,server.workspace.id)}catch(e){setError(e instanceof Error?e.message:'Falha ao exportar os dados.')}};
 const logout=async()=>{try{await api('auth/logout',{body:{}});drafts.current.clear();setResumeAnalysis(null);setServer(null);setState(initialState);setData(null);setBase(null);setModal('');setAuthRequired(true);setApiWorkspace('')}catch(e){setError(e instanceof Error?e.message:'Não foi possível sair.')}};
 useOverlayAccessibility(nav,chat&&s.screen!=='overview',editor&&s.screen!=='overview',!!server&&!authRequired,overlayTrigger,()=>{setNav(false);setChatState(false);setEditorState(false)});
 if(loading)return <main className="startup-state" role="status">Abrindo a CLARA…</main>;
 if(authRequired||!server)return <><div className="login-appearance"><ThemeControl/></div><StudioLogin config={config} done={()=>void reload()}/>{error&&!authRequired&&<div role="alert" className="error-banner">{error}<Button onClick={()=>location.reload()}>Tentar novamente</Button></div>}</>;
 const emptyData:QueryResult={actual:0,budget:0,balance:0,execution:null,groups:[],months:[],rows:[],count:0,matchedCount:0,offset:0,limit:100,lineage:{sourceId:'finance',revision:'',provider:'demo',updatedAt:new Date().toISOString(),unit:'BRL',filters:{center:'all',period:'all',company:'all'}}};
 const context={refreshCredits,artifactSelection,setArtifactSelection,selectedWidget,setSelectedWidget,chatStatus,newConversation,resumeAnalysis,resume,confirmReplaceAnalysis,dirty,saving,s,set,go,modal:setModal,toast,chat,setChat,editor,setEditor,data:data||emptyData,base:base||emptyData,send,proposal,apply,busy,undo,canUndo:!!previous,save:()=>setModal('save'),exportCsv,server,command,reload,openBoard,pending,catalog,logout,bannerTarget,setBannerTarget,lastError:error,drafts:drafts.current};
 const navigation:[Screen,string,React.ElementType][]=[['overview','Início',House],['library','Dashboards',LayoutDashboard],['explore','Explorar dados',ChartNoAxesCombined],['connections','Dados',Plug],['admin','Administração',Settings2],...(server.platformAccess.manageCredits?([['credits','Créditos',Coins],['usage','Uso da plataforma',Activity]] as [Screen,string,React.ElementType][]):[])];
 const screens={overview:<Overview/>,library:<Library/>,dashboard:<Dashboard/>,explore:<Explore/>,connections:<Connections/>,admin:<Admin/>,credits:<CreditManagement/>,usage:<PlatformUsage/>};
 const needsData=!['overview','connections','admin','library','credits','usage'].includes(s.screen);
 return <AppContext.Provider value={context}><a className="skip-link" href="#main">Pular para o conteúdo</a><div data-density="comfortable" className={`app-shell ${collapsed?'nav-collapsed':''} ${tabletExpanded?'nav-expanded':''} ${(chat||editor)&&s.screen!=='overview'?'has-assistant':''}`}>
 <header className="global-header">
 <div className="brand-area"><IconButton icon={Menu} label="Abrir navegação" onClick={()=>{if(innerWidth>=768&&innerWidth<1024){setTabletExpanded(!tabletExpanded);return}if(innerWidth>=1024){setCollapsed(!collapsed);return}overlayTrigger.current=document.activeElement as HTMLElement;setNav(!nav)}}/><Brand><button className="wordmark" onClick={()=>go('overview')}>CLARA<span className="brand-period">.</span></button></Brand></div><span className="header-divider"/>
 <button id="header-workspace" className="workspace-switch" aria-haspopup="dialog" aria-expanded={modal==='workspace'} onClick={()=>setModal(modal==='workspace'?'':'workspace')}>{server.workspace.name}<ChevronDown size={13}/></button>
 <span className="header-location">{s.screen==='dashboard'?'Dashboard':navigation.find(([key])=>key===s.screen)?.[1]}</span><div className="header-search"><button id="header-search" aria-haspopup="dialog" aria-expanded={modal==='search'} onClick={()=>setModal(modal==='search'?'':'search')}><Search size={15}/><span>Buscar análises, dados e mais</span><kbd>Ctrl K</kbd></button></div>
 <div className="header-right"><ThemeControl/><IconButton id="header-notifications" icon={Bell} label="Notificações" aria-haspopup="dialog" aria-expanded={modal==='notifications'} onClick={()=>setModal(modal==='notifications'?'':'notifications')}/><button className="avatar" aria-label="Seu perfil" aria-expanded={modal==='profile'} onClick={()=>setModal('profile')}>{server.actor.name.split(' ').map(v=>v[0]).slice(0,2).join('')}</button></div>
 </header>
 {nav&&<button className="nav-backdrop" aria-label="Fechar navegação" onClick={()=>setNav(false)}/>}
 <aside className={`sidebar ${nav?'mobile-open':''}`} aria-label="Navegação principal"><div className="sidebar-workspace"><div className="workspace-icon">C</div><div><strong>CLARA</strong><span>{server.workspace.name}</span></div></div><nav><div className="nav-group-label">Análise</div>{navigation.map(([screen,label,Icon],i)=><React.Fragment key={screen}>{i===3&&<div className="nav-group-label">Gestão</div>}<button title={label} aria-label={label} className={s.screen===screen||(s.screen==='dashboard'&&screen==='library')?'active':''} aria-current={s.screen===screen||(s.screen==='dashboard'&&screen==='library')?'page':undefined} onClick={()=>go(screen)}><Icon size={18}/><span>{label}</span>{screen==='library'&&<small>{server.state.boards.length}</small>}</button></React.Fragment>)}</nav><div className="sidebar-bottom"><button className="credit-balance-button" aria-label="Ver meus créditos" onClick={()=>setModal('my-credits')}><Coins size={16}/><span><strong>{server.credits.available.toLocaleString('pt-BR')} créditos</strong><small>{Math.floor(server.credits.available/server.credits.cost)} chamadas disponíveis</small></span></button><button className="ai-entry" onClick={()=>setChat(s.screen==='overview'||!chat)}><Sparkles size={18}/><span>Conversar com CLARA</span></button><button className="source-status" onClick={()=>go('connections')}><span className={`status-dot ${paused?'offline':''}`}/><span>{paused?'Fonte pausada':sourceLabel(server.runtime.dataProvider)}<small>{server.runtime.dataProvider==='financial-test'?'Dados sintéticos via HTTP':server.runtime.dataProvider==='demo'?'Integração SAP pendente':'Conexão configurada'}</small></span><ChevronDown size={13}/></button><button className="collapse-nav" aria-label={collapsed?"Expandir navegação":"Recolher navegação"} onClick={()=>setCollapsed(!collapsed)}><PanelLeftClose size={16}/><span>{collapsed?'Expandir menu':'Recolher menu'}</span></button></div></aside>
 <div className="body-layout"><main id="main" ref={main} tabIndex={-1} className="main-content">{server.runtime.temporary&&<div className="runtime-notice">Armazenamento temporário · os dados desta execução são perdidos ao reiniciar o servidor.</div>}{error&&<div className="error-banner" role="alert"><span>{error}</span><Button icon={RefreshCw} onClick={()=>void reload()}>Atualizar do servidor</Button></div>}{s.reader&&<div className="reader-banner">{s.previewReader?'Prévia de Leitor':'Seu acesso é de leitura'}{s.previewReader&&<button onClick={()=>set({previewReader:false,reader:server.workspace.role==='reader'})}>Sair da prévia</button>}</div>}{needsData&&dataError&&!paused?<Empty title="Não foi possível consultar os dados" text={dataError}><Button onClick={()=>setRefresh(n=>n+1)}>Tentar novamente</Button></Empty>:needsData&&dataPending&&!paused?<div className="startup-state" role="status">Consultando os dados do recorte…</div>:needsData&&!data&&!paused?<Empty title="Dados ainda não disponíveis" text="Atualize a conexão para continuar."><Button onClick={()=>setRefresh(n=>n+1)}>Atualizar</Button></Empty>:paused&&needsData?<Empty title="Fonte temporariamente indisponível" text="A fonte foi pausada. Um administrador pode reconectá-la em Dados."><Button onClick={()=>go('connections')}>Ver dados</Button></Empty>:screens[s.screen]}</main>{(chat||editor)&&s.screen!=='overview'&&<><button className="assistant-backdrop" aria-label="Fechar painel lateral" onClick={()=>{setChat(false);setEditor(false)}}/>{editor?<Editor/>:<Chat/>}</>}</div>
 {<button hidden={chat||editor||s.screen==='overview'} className="floating-ai" onClick={()=>setChat(true)}><Sparkles size={19}/>CLARA IA</button>}{modal==='my-credits'?<MyCredits close={()=>setModal('')}/>:modal==='profile'?<ProfileMenu close={()=>setModal('')} onTour={()=>{setModal('');setWelcome(true)}}/>:modal==='executive'||modal==='merge'?<ExecutiveDialog kind={modal} close={()=>setModal('')}/>:modal&&<Dialogs key={modal} kind={modal} close={()=>setModal('')}/>} {welcome&&<Welcome close={()=>setWelcome(false)}/>} {bannerTarget&&server.state.boards.some(b=>b.id===bannerTarget)&&<BannerDialog board={server.state.boards.find(b=>b.id===bannerTarget)!} close={()=>setBannerTarget(null)}/>} <div className={`toast ${toastText?'visible':''}`} role="status">{toastText&&<><ShieldCheck size={17}/>{toastText}</>}</div></div></AppContext.Provider>
}
