import {useLayoutEffect,useRef} from 'react';
import {X} from 'lucide-react';
import {IconButton} from './ui';

type Props={title:string;anchorId:string;onClose:()=>void;children:React.ReactNode;wide?:boolean};

export function HeaderPanel({title,anchorId,onClose,children}:Props){
 const ref=useRef<HTMLDivElement>(null);
 useLayoutEffect(()=>{
  const panel=ref.current!,anchor=document.getElementById(anchorId);
  const position=()=>{
   const rect=anchor?.getBoundingClientRect(),header=document.querySelector('.global-header')?.getBoundingClientRect();
   const search=anchorId==='header-search';
   const width=Math.min(search?(rect&&rect.width>=240?rect.width:360):380,window.innerWidth-24);
   const rightAligned=anchorId==='header-help'||anchorId==='header-notifications';
   const left=rect?.width?(rightAligned?rect.right-width:rect.left):12;
   const top=(rect?.height?rect.bottom:header?.bottom||48)+8;
   Object.assign(panel.style,{width:`${width}px`,left:`${Math.max(12,Math.min(left,window.innerWidth-width-12))}px`,top:`${top}px`,maxHeight:`${Math.max(120,window.innerHeight-top-12)}px`});
  };
  position();panel.showPopover();
  (panel.querySelector<HTMLElement>('.dialog-body input')||panel.querySelector<HTMLElement>('.dialog-body button,.dialog-body a')||panel.querySelector<HTMLElement>('button'))?.focus();
  const observer=new ResizeObserver(position);if(anchor)observer.observe(anchor);
  window.addEventListener('resize',position);window.visualViewport?.addEventListener('resize',position);
  return()=>{observer.disconnect();window.removeEventListener('resize',position);window.visualViewport?.removeEventListener('resize',position)};
 },[anchorId]);
 return <div ref={ref} popover="auto" role="dialog" aria-labelledby={`${anchorId}-title`} className={`header-panel ${anchorId==='header-search'?'search-panel':''}`} onKeyDown={event=>{if(anchorId!=='header-search'||!['ArrowDown','ArrowUp'].includes(event.key))return;const items=[...ref.current!.querySelectorAll<HTMLElement>('.command-input input,.command-results button')];const current=items.indexOf(document.activeElement as HTMLElement);event.preventDefault();items[(current+(event.key==='ArrowDown'?1:-1)+items.length)%items.length]?.focus()}} onToggle={e=>{if(e.newState==='closed'&&ref.current?.isConnected)onClose()}}>
  <div className="dialog-header"><h2 id={`${anchorId}-title`}>{title}</h2><IconButton icon={X} label="Fechar janela" onClick={onClose}/></div>
  <div className="dialog-body">{children}</div>
 </div>;
}
