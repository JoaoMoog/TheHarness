import {ArrowDown,Sparkles} from 'lucide-react';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {useApp} from './state';

export function Conversation({children}:{children?:ReactNode}){
 const {s,busy,proposal}=useApp();
 const transcript=useRef<HTMLDivElement>(null);
 const pinned=useRef(true),[away,setAway]=useState(false);
 const latest=()=>{if(transcript.current)transcript.current.scrollTop=transcript.current.scrollHeight;pinned.current=true;setAway(false)};
 useEffect(()=>{if(pinned.current||s.messages.at(-1)?.role==='user')latest()},[s.messages.length,busy,proposal]);
 useEffect(()=>{
  const element=transcript.current;if(!element)return;
  const observer=new ResizeObserver(()=>{
   if(pinned.current)element.scrollTop=element.scrollHeight;
   else setAway(element.scrollHeight-element.scrollTop-element.clientHeight>=48);
  });
  observer.observe(element);if(element.firstElementChild)observer.observe(element.firstElementChild);
  return()=>observer.disconnect();
 },[]);
 return <div className={`chat-reading-area ${!s.messages.length&&!busy&&!proposal?'is-empty':''}`}><div ref={transcript} tabIndex={0} className="chat-scroll" aria-label="Mensagens e proposta" role="region" onScroll={()=>{const element=transcript.current;if(element){const near=element.scrollHeight-element.scrollTop-element.clientHeight<48;pinned.current=near;setAway(!near)}}}>
 <div className="chat-transcript" role="log" aria-label="Histórico da conversa" aria-live="polite" aria-relevant="additions text">
  {s.messages.map((message,index)=><div className={`message from-${message.role}`} key={index}><div className="message-author">{message.role==='assistant'?<><Sparkles size={14}/>CLARA</>:'Você'}</div><p>{message.text}</p></div>)}
  {busy>0&&<div className="chat-thinking" role="status"><span className="thinking-dots" aria-hidden="true"><i/><i/><i/></span>Analisando…</div>}
 </div>{children}</div>{away&&<button className="chat-latest" onClick={latest}><ArrowDown size={14}/>Ir para a última mensagem</button>}</div>;
}
