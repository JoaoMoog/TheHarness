'use client';

import { useState } from 'react';
import { ArrowRight, ChartNoAxesCombined } from 'lucide-react';
import { PublicClientApplication } from '@azure/msal-browser';
import { api } from './api';
import { Busy, ErrorMessage } from './shared';
import { Brand } from './Brand';
import { BRAND } from '@/core/brand';

export function Login({ demo, loggedIn }: { demo: boolean; loggedIn: () => void }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [localMode, setLocalMode] = useState<'login' | 'register'>('login');
  const [localOpen, setLocalOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const configured = Boolean(process.env.NEXT_PUBLIC_MSAL_CLIENT_ID && process.env.NEXT_PUBLIC_MSAL_TENANT_ID && process.env.NEXT_PUBLIC_MSAL_SCOPE);
  async function login(mode: 'demo' | 'msal') {
    if (pending) return;
    setPending(true); setError('');
    try {
      let accessToken;
      if (mode === 'msal') {
        const client = new PublicClientApplication({ auth: { clientId: process.env.NEXT_PUBLIC_MSAL_CLIENT_ID!, authority: `https://login.microsoftonline.com/${process.env.NEXT_PUBLIC_MSAL_TENANT_ID}`, redirectUri: window.location.origin }, cache: { cacheLocation: 'sessionStorage' } });
        await client.initialize();
        const result = await client.loginPopup({ scopes: [process.env.NEXT_PUBLIC_MSAL_SCOPE!] });
        accessToken = result.accessToken;
      }
      await api('auth/login', { body: { mode, ...(accessToken ? { accessToken } : {}) } });
      loggedIn();
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível entrar. Tente novamente.'); }
    finally { setPending(false); }
  }
  async function localLogin() {
    if (pending) return;
    setPending(true); setError('');
    try { await api(localMode === 'register' ? 'auth/register' : 'auth/login', { body: { mode: 'local', email, password, ...(localMode === 'register' ? { name } : {}) } }); loggedIn(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível entrar.'); }
    finally { setPending(false); }
  }
  return <main className="login-layout">
    <section className="login-intro"><Brand /><div className="login-message"><h1>Seus dados,<br />com clareza.</h1><p>Da sua pergunta à próxima decisão.</p><span>Conecte informações, encontre respostas e explore novas perspectivas para o seu negócio.</span></div><div className="login-signature"><ChartNoAxesCombined size={24} /><span>{BRAND.fullName}</span></div></section>
    <section className="login-form"><h2>Seu próximo insight<br />começa aqui.</h2><p>Entre com sua conta Microsoft para acessar seu espaço de análise.</p>
      <button className="button primary" onClick={() => login('msal')} disabled={!configured || pending}><svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path fill="#f25022" d="M0 0h9v9H0z"/><path fill="#7fba00" d="M11 0h9v9h-9z"/><path fill="#00a4ef" d="M0 11h9v9H0z"/><path fill="#ffb900" d="M11 11h9v9h-9z"/></svg>Entrar com Microsoft</button>
      {!configured && <small>O acesso Microsoft será habilitado quando a organização configurar a integração.</small>}
      {demo && <div className="demo-login"><p>Conheça o produto com dados de exemplo.</p><button className="button secondary" disabled={pending} onClick={() => login('demo')}>{pending ? <Busy>Entrando…</Busy> : <>Explorar demonstração <ArrowRight size={16} /></>}</button><small>SAP e IA simulados. Você também pode importar um arquivo.</small></div>}
      {demo && <div className="local-login"><button className="text-button" aria-expanded={localOpen} aria-controls="local-login-form" onClick={() => setLocalOpen(!localOpen)}>Entrar com conta local</button>{localOpen && <form id="local-login-form" onSubmit={event => { event.preventDefault(); void localLogin(); }}>
        <h3>{localMode === 'register' ? 'Criar sua conta local' : 'Acessar sua conta local'}</h3><p>Suas fontes e rascunhos ficam associados à sua conta neste servidor.</p>
        {localMode === 'register' && <div className="field"><label htmlFor="local-name">Nome</label><input id="local-name" value={name} onChange={e => setName(e.target.value)} required minLength={2} maxLength={80} autoComplete="name" disabled={pending} /></div>}
        <div className="field"><label htmlFor="local-email">E-mail</label><input id="local-email" type="email" value={email} onChange={e => setEmail(e.target.value)} required maxLength={200} autoComplete="username" disabled={pending} /></div>
        <div className="field"><label htmlFor="local-password">Senha</label><input id="local-password" type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={10} maxLength={128} autoComplete={localMode === 'register' ? 'new-password' : 'current-password'} disabled={pending} /><small>Use pelo menos dez caracteres.</small></div>
        <div className="form-actions"><button className="button primary" disabled={pending}>{pending ? 'Entrando…' : localMode === 'register' ? 'Criar conta' : 'Entrar'}</button><button className="text-button" type="button" disabled={pending} onClick={() => { setLocalMode(localMode === 'login' ? 'register' : 'login'); setError(''); }}>{localMode === 'login' ? 'Criar conta local' : 'Já tenho conta'}</button></div>
      </form>}</div>}
      {error && <ErrorMessage message={error} />}
    </section>
  </main>;
}
