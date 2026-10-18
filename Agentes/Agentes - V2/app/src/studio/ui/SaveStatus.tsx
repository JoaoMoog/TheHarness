import {Check,Save} from 'lucide-react';
import {useApp} from './state';

export function SaveStatus(){
 const {s,server,dirty,saving}=useApp();
 const board=server.state.boards.find(b=>b.id===s.savedId);
 const label=saving?'Salvando…':dirty?'Alterações não salvas':server.runtime.temporary?'Salvo nesta execução':'Salvo';
 return <div className={`save-state dashboard-save-status ${dirty?'is-dirty':''}`} role="status" title={board?`Versão ${board.revision} · ${new Date(board.updatedAt).toLocaleString('pt-BR')}`:undefined}>
  {dirty?<Save size={13} aria-hidden="true"/>:<Check size={13} aria-hidden="true"/>}<span>{label}</span>
 </div>;
}
