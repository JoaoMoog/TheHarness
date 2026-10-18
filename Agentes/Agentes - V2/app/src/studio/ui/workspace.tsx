import React,{useEffect,useRef} from 'react';
import {ArrowRight,ArrowUp,Check,ChevronDown,Database,Download,Expand,History,LayoutPanelTop,MessageSquare,PanelRightClose,Pencil,Plus,Save,Send,Settings2,Share2,ShieldCheck,SlidersHorizontal,Sparkles,Undo2,X,GripVertical,Copy,Trash2,ArrowDown,ArrowUpRight,TriangleAlert,CheckCheck} from 'lucide-react';
import {Conversation} from './Conversation';
import {ChatComposer} from './ChatComposer';
import {ProposalReview} from './ProposalReview';
import {useApp,ChartKind} from './state';
import {FinancialFilters} from './FinancialFilters';
import {periodLabel,sourceLabel,centers,money,number} from '../domain';
import {Button,IconButton,Select,Badge,MetricStrip,DataTable,Empty} from './ui';
import {CompareChart,TrendChart} from './charts';

export const Filters=FinancialFilters;
export {Dashboard} from './Dashboard';

export function Chat(){
 const {s,set,modal,setChat,send,busy,data,canUndo,undo,server,chatStatus,newConversation}=useApp();
 return <aside className="assistant" aria-label="CLARA IA">
  <header className="assistant-head"><div className="assistant-brand"><div className="ai-mark"><Sparkles size={19}/></div><div><h2>CLARA IA</h2></div></div><IconButton icon={PanelRightClose} label="Recolher CLARA IA" onClick={()=>setChat(false)}/></header>
  <div className="assistant-context"><Database size={14}/><span>{sourceLabel(data.lineage.provider)}</span><Button quiet icon={Plus} disabled={busy>0} onClick={newConversation}>Nova conversa</Button></div>
  <div className="conversation"><Conversation><ProposalReview/>{canUndo&&!s.reader&&<Button quiet icon={Undo2} onClick={undo}>Desfazer último ajuste</Button>}</Conversation></div>
  <div className="composer-area"><span className="composer-context"><span className="status-dot"/>{s.center==='all'?'Dashboard financeiro':s.center} · {data.count} registros</span>
   <ChatComposer/>
   <span className="ai-disclaimer">{server.runtime.aiProvider==='demo'?'Assistente demonstrativo. Provedor de IA pendente.':'Confira os dados e critérios da proposta.'}</span>
  </div>
 </aside>;
}

export {ChartEditor as Editor} from './ChartEditor';
