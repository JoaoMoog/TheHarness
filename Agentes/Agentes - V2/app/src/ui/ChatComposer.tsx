'use client';

import { ArrowRight, Send, Square } from 'lucide-react';
import type { RefObject } from 'react';
import { Busy } from './shared';

export function ChatComposer({ prompt, setPrompt, send, pending, cancel, continuing, disabled, inputRef }: {
  prompt: string; setPrompt: (value: string) => void; send: () => void; pending: boolean;
  cancel: () => void; continuing: boolean; disabled: boolean; inputRef: RefObject<HTMLTextAreaElement | null>;
}) {
  return <form className="chat-composer" onSubmit={e => { e.preventDefault(); send(); }}>
    <label htmlFor="dashboard-prompt">{continuing ? 'O que você quer ajustar?' : 'O que você quer entender?'}</label>
    <textarea id="dashboard-prompt" ref={inputRef} value={prompt} onChange={e => setPrompt(e.target.value)} maxLength={4000} disabled={pending || disabled} rows={3} placeholder="Ex.: Compare as despesas de cada centro de custo com o orçamento e mostre a evolução mensal." onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }} aria-describedby="composer-hint" />
    <div className="composer-actions"><small id="composer-hint">Escreva do seu jeito. Enter envia.</small>{pending ? <button type="button" className="button secondary" onClick={e => { e.preventDefault(); cancel(); }}><Square size={14} />Cancelar pedido</button> : <button type="submit" className="button primary" disabled={disabled || !prompt.trim()}>{continuing ? <>Pedir ajuste<Send size={15} /></> : <>Montar prévia<ArrowRight size={16} /></>}</button>}</div>
    {pending && <div className="chat-working"><Busy>Preparando sua prévia…</Busy><small>Nenhum dashboard é salvo automaticamente.</small></div>}
  </form>;
}
