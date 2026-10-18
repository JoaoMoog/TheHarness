import {useLayoutEffect,useRef,type RefObject} from 'react';
import {ArrowUp} from 'lucide-react';
import {useApp} from './state';

export function ChatComposer({home=false,inputRef,onSend}:{home?:boolean;inputRef?:RefObject<HTMLTextAreaElement|null>;onSend?:(text:string)=>void}){
 const {s,set,send,busy,chatStatus,server,modal}=useApp();
 const localRef=useRef<HTMLTextAreaElement>(null),input=inputRef||localRef;
 const exhausted=server.credits.available<server.credits.cost;
 const disabled=s.reader||busy>0||exhausted;
 const wasBusy=useRef(false);
 useLayoutEffect(()=>{if(wasBusy.current&&!busy&&!s.reader)input.current?.focus();wasBusy.current=busy>0},[busy,s.reader,input]);
 const submit=()=>{if(!disabled&&s.draft.trim())(onSend||send)(s.draft)};
 useLayoutEffect(()=>{const field=input.current;if(field){field.style.height='auto';field.style.height=`${Math.min(field.scrollHeight,176)}px`}},[s.draft,input]);
 return <div className="chat-compose-wrap">
  <div className={`composer-credit-status ${exhausted?'empty':''}`}><button type="button" title="Saldo restante / total concedido neste mês, incluindo créditos extras. Ver movimentações." onClick={()=>modal('my-credits')}><span aria-live="polite" aria-atomic="true">{server.credits.available.toLocaleString('pt-BR')}/{server.credits.allocated.toLocaleString('pt-BR')} créditos disponíveis</span></button><span>{exhausted?'Sem saldo de IA. Peça créditos extras ao administrador.':`${server.credits.cost} por chamada`}</span></div>
  <form className={`composer chat-compose ${home?'home-compose':''}`} onSubmit={event=>{event.preventDefault();submit()}}>
   <label className="sr-only" htmlFor={home?'home-message':'panel-message'}>Mensagem para CLARA</label>
   <textarea ref={input} id={home?'home-message':'panel-message'} value={s.draft} maxLength={4000} rows={2} disabled={disabled}
    placeholder={s.reader?'Conversa disponível para editores':chatStatus==='clarify'?'Responda à CLARA…':s.messages.length?'O que você quer ajustar?':'Que dashboard você quer criar?'}
    onChange={event=>set({draft:event.target.value})} onKeyDown={event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault();submit()}}}/>
   <div className="chat-compose-actions"><span className="chat-keyboard-hint" title="Enter envia; Shift + Enter insere uma nova linha.">Enter ↵</span><button className="chat-send" type="submit" aria-label="Enviar mensagem" disabled={disabled||!s.draft.trim()}><span>Enviar</span><ArrowUp size={18}/></button></div>
  </form>
 </div>;
}
