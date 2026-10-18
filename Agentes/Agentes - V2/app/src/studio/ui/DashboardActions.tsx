import {useRef} from 'react';
import {Download,Expand,History,MoreHorizontal,Share2,Undo2,Presentation,Combine} from 'lucide-react';
import {useApp} from './state';
import {Button} from './ui';

export function DashboardActions(){
 const {s,modal,exportCsv,canUndo,undo,setArtifactSelection}=useApp();
 const panel=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null);
 const choose=(action:()=>void)=>{panel.current?.hidePopover();trigger.current?.focus();action()};
 return <>
  <button ref={trigger} className="button dashboard-more" popoverTarget="dashboard-actions" aria-label="Mais opções do dashboard"><MoreHorizontal size={18} aria-hidden="true"/><span>Mais opções</span></button>
  <div id="dashboard-actions" ref={panel} popover="auto" className="dashboard-actions-popover" role="group" aria-label="Opções do dashboard" onToggle={event=>{
   if(event.newState!=='open')return;
   const rect=trigger.current!.getBoundingClientRect();
   panel.current!.style.top=`${Math.max(12,Math.min(rect.bottom+8,innerHeight-panel.current!.offsetHeight-12))}px`;panel.current!.style.left=`${Math.max(12,Math.min(rect.right-224,innerWidth-236))}px`;
   panel.current?.querySelector<HTMLButtonElement>('button')?.focus();
  }} onKeyDown={event=>{
   if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;
   const buttons=[...panel.current!.querySelectorAll<HTMLButtonElement>('button')];const i=buttons.indexOf(document.activeElement as HTMLButtonElement);
   event.preventDefault();buttons[event.key==='Home'?0:event.key==='End'?buttons.length-1:(i+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length]?.focus();
  }}>
   <Button quiet icon={Presentation} onClick={()=>choose(()=>{setArtifactSelection(['current']);modal('executive')})}>Criar apresentação HTML</Button>
   {!s.reader&&<Button quiet icon={Combine} onClick={()=>choose(()=>{setArtifactSelection([]);modal('merge')})}>Unificar dashboards</Button>}
   <Button quiet icon={Share2} onClick={()=>choose(()=>modal('share'))}>Compartilhar</Button>
   <Button quiet icon={Expand} onClick={()=>choose(()=>modal('present'))}>Apresentar dashboard</Button>
   <Button quiet icon={Download} onClick={()=>choose(exportCsv)}>Exportar CSV</Button>
   <Button quiet icon={History} onClick={()=>choose(()=>modal('versions'))}>Histórico de versões</Button>
   {canUndo&&!s.reader&&<Button quiet icon={Undo2} onClick={()=>choose(undo)}>Desfazer último ajuste</Button>}
  </div>
 </>;
}
