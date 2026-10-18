import {useEffect,useState,type RefObject} from 'react';

/** Desktop panels stay in normal reading order; small-screen overlays contain focus. */
export function useOverlayAccessibility(nav:boolean,chat:boolean,editor:boolean,ready:boolean,trigger:RefObject<HTMLElement|null>,close:()=>void){
 const [width,setWidth]=useState(1440);
 useEffect(()=>{const update=()=>setWidth(window.innerWidth);update();window.addEventListener('resize',update);return()=>window.removeEventListener('resize',update)},[]);
 useEffect(()=>{
  if(!ready)return;
  const sidebar=document.querySelector<HTMLElement>('.sidebar');
  if(sidebar)sidebar.inert=width<768&&!nav;
  const overlay=width<768&&nav?sidebar:width<1100&&(chat||editor)?document.querySelector<HTMLElement>('.assistant'):null;
  if(!overlay)return;
  const prior=trigger.current||document.activeElement as HTMLElement|null;
  const background=[...document.querySelectorAll<HTMLElement>('.global-header,.main-content,.sidebar,.assistant,.floating-ai')].filter(el=>el!==overlay&&!el.contains(overlay));
  const previous=background.map(el=>[el,el.inert] as const);background.forEach(el=>{el.inert=true});
  const previousRole=overlay.getAttribute('role');overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');
  const focusables=()=>[...overlay.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),textarea:not(:disabled),select:not(:disabled),[tabindex="0"]')].filter(el=>el.getClientRects().length>0&&!el.closest('[inert]'));
  const focusFirst=()=>focusables()[0]?.focus();focusFirst();
  const key=(event:KeyboardEvent)=>{
   if(document.querySelector('dialog[open],[popover]:popover-open'))return;
   if(event.key==='Escape'){event.preventDefault();close();return}
   if(event.key!=='Tab')return;
   const items=focusables(),first=items[0],last=items.at(-1);
   if(!first){event.preventDefault();return}
   if(event.shiftKey&&(document.activeElement===first||!overlay.contains(document.activeElement))){event.preventDefault();last?.focus()}
   else if(!event.shiftKey&&(document.activeElement===last||!overlay.contains(document.activeElement))){event.preventDefault();first.focus()}
  };
  const focus=(event:FocusEvent)=>{if(!document.querySelector('dialog[open],[popover]:popover-open')&&!overlay.contains(event.target as Node))focusFirst()};
  document.addEventListener('keydown',key);document.addEventListener('focusin',focus);
  return()=>{document.removeEventListener('keydown',key);document.removeEventListener('focusin',focus);previous.forEach(([el,inert])=>{el.inert=inert});if(previousRole)overlay.setAttribute('role',previousRole);else overlay.removeAttribute('role');overlay.removeAttribute('aria-modal');if(prior?.isConnected&&!prior.closest('[inert]'))prior.focus()};
 // The event closure only closes panels, and must not refocus on every render.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[nav,chat,editor,width,ready]);
}
