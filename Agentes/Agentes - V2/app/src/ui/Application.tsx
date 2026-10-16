'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChartNoAxesCombined, X } from 'lucide-react';
import { AppHeader, type View } from './AppHeader';
import type { Bootstrap, Report } from '@/core/types';
import { api, ApiError, setApiWorkspace } from './api';
import { Login } from './Login';
import { Library } from './Library';
import { DataPage } from './DataPage';
import { DashboardBuilder } from './DashboardBuilder';
import { ReportPage } from './ReportPage';
import { Busy, ErrorMessage } from './shared';
import { readWork, type WorkSession } from './workSession';
import { flushWork, forgetWork, hasUnsavedWork, loadDurableWork, queueWork } from './durableWork';
import { workOwner } from '@/core/work';
import { Select } from './Select';
import { GovernancePage } from './GovernancePage';
import { IntegrationSettings } from './IntegrationSettings';
import './lifecycle.css';

function rememberWorkspace(id = '') {
  setApiWorkspace(id);
  try { if (id) sessionStorage.setItem('clara:workspace', id); else sessionStorage.removeItem('clara:workspace'); }
  catch { /* The active workspace still works when tab storage is unavailable. */ }
}

export function Application({ demo }: { demo: boolean }) {
  const [data, setData] = useState<Bootstrap | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>('home');
  const [reportId, setReportId] = useState('');
  const [seed, setSeed] = useState({ sourceId: '', prompt: '', version: 0 });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [logoutPending, setLogoutPending] = useState(false);
  const [work, setWork] = useState<WorkSession | null>(null);
  const [syncNotice, setSyncNotice] = useState('');
  const activeWork = useRef('');
  const main = useRef<HTMLElement>(null);
  const refresh = useCallback(async () => {
    let next: Bootstrap;
    try { next = await api<Bootstrap>('bootstrap'); }
    catch (error) {
      if (!(error instanceof ApiError && error.status === 404)) throw error;
      rememberWorkspace(); next = await api<Bootstrap>('bootstrap');
    }
    const workspace = next.workspace?.id || next.actor.id;
    activeWork.current = workOwner(next.actor.id, workspace);
    let restored = readWork(activeWork.current);
    try { restored = await loadDurableWork(activeWork.current, workspace, setSyncNotice); }
    catch { setSyncNotice('Não foi possível recuperar o rascunho da conta. Os ajustes desta aba continuam disponíveis.'); }
    setData(next); setWork(restored);
  }, []);
  const remember = useCallback((next: WorkSession | null) => { setWork(next); queueWork(next?.owner || activeWork.current, next); }, []);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { await refresh(); } catch (e) { if (!(e instanceof Error && /Entre para continuar|sessão terminou/.test(e.message))) setError(e instanceof Error ? e.message : 'Não foi possível carregar.'); }
    finally { setLoading(false); }
  }, [refresh]);
  useEffect(() => {
    function restoreRoute() {
      const url = new URL(window.location.href); const requested = url.searchParams.get('view') as View;
      setView(['home', 'create', 'data', 'reports', 'report', 'settings', 'team'].includes(requested) ? requested : 'home');
      setReportId(url.searchParams.get('report') || '');
      setSeed(s => ({ sourceId: '', prompt: '', version: s.version + 1 }));
      setError('');
      requestAnimationFrame(() => main.current?.focus({ preventScroll: true }));
    }
    try { setApiWorkspace(sessionStorage.getItem('clara:workspace') || ''); } catch { setApiWorkspace(''); }
    restoreRoute(); void load();
    window.addEventListener('popstate', restoreRoute);
    return () => window.removeEventListener('popstate', restoreRoute);
  }, [load]);
  useEffect(() => {
    const flush = () => { if (document.visibilityState === 'hidden') void flushWork(activeWork.current); };
    const warn = (event: BeforeUnloadEvent) => { if (hasUnsavedWork(activeWork.current)) { event.preventDefault(); event.returnValue = ''; } };
    document.addEventListener('visibilitychange', flush); window.addEventListener('beforeunload', warn);
    return () => { document.removeEventListener('visibilitychange', flush); window.removeEventListener('beforeunload', warn); };
  }, []);
  function navigate(next: View, report?: string, draftId?: string) {
    void flushWork(activeWork.current);
    setView(next); setError('');
    const url = new URL(window.location.href); url.search = ''; url.searchParams.set('view', next);
    if (report) url.searchParams.set('report', report);
    if (draftId) url.searchParams.set('draft', draftId);
    if (url.href !== window.location.href) window.history.pushState(null, '', url);
    requestAnimationFrame(() => { window.scrollTo({ top: 0, behavior: 'instant' }); main.current?.focus({ preventScroll: true }); });
  }
  function create(sourceId = '', prompt = '') {
    if (data?.workspace?.role === 'reader') return;
    const current = data && readWork(activeWork.current);
    if (current?.recovery) prompt = prompt || current.prompt || current.lastPrompt;
    else if (current && !window.confirm('Descartar a análise em andamento e começar outra? Dashboards salvos serão preservados.')) return;
    if (data) queueWork(activeWork.current, null);
    setWork(null); setSeed(s => ({ sourceId, prompt, version: s.version + 1 })); navigate('create');
  }
  function resume() {
    if (!data) return;
    const current = readWork(activeWork.current);
    setSeed(s => ({ sourceId: '', prompt: '', version: s.version + 1 }));
    navigate('create', undefined, current?.draftId);
  }
  function openReport(report: Report) { setReportId(report.id); navigate('report', report.id); }
  async function saved(report: Report) {
    await refresh();
    if (data) { queueWork(activeWork.current, null); await flushWork(activeWork.current); }
    setWork(null); setNotice('Seu dashboard foi salvo.'); openReport(report);
  }
  async function logout() {
    if (logoutPending) return; setLogoutPending(true);
    try {
      if (await flushWork(activeWork.current) === false) { setError('Não foi possível salvar o rascunho na conta. Tente salvar novamente antes de sair.'); return; }
      await api('auth/logout', { method: 'POST' }); await forgetWork(activeWork.current); setWork(null); setData(null); setSyncNotice(''); rememberWorkspace(); navigate('home');
    }
    catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível sair.'); }
    finally { setLogoutPending(false); }
  }
  async function switchWorkspace(id?: string) {
    if (await flushWork(activeWork.current) === false) { setError('Salve o rascunho antes de trocar de espaço. Seus ajustes continuam nesta aba.'); return; }
    if (id) rememberWorkspace(id);
    setWork(null); setSyncNotice(''); await refresh();
    setSeed(s => ({ sourceId: '', prompt: '', version: s.version + 1 }));
    if (view === 'report' || view === 'create') navigate('home');
  }
  if (loading) return <main className="app-loading"><ChartNoAxesCombined size={28} /><Busy>Preparando seu espaço de análise…</Busy></main>;
  if (!data) return <><Login demo={demo} loggedIn={load} />{error && <div className="login-error"><ErrorMessage message={error} retry={load} /></div>}</>;
  const report = data.reports.find(r => r.id === reportId);
  const source = data.sources.find(s => s.id === report?.sourceId);
  const canEdit = data.workspace?.role !== 'reader';
  return <div className="app-shell"><a className="skip-link" href="#main-content">Pular para o conteúdo</a>
    <AppHeader actor={data.actor} view={view} navigate={navigate} create={create} logout={logout} logoutPending={logoutPending} canEdit={canEdit} />
    {data.workspace && <div className="workspace-context"><div><Select label="Espaço de trabalho" value={data.workspace.id} options={(data.workspaces || [data.workspace]).map(space => ({ value: space.id, label: space.name }))} onChange={id => { void switchWorkspace(id).catch(e => setError(e instanceof Error ? e.message : 'Não foi possível trocar de espaço.')); }} /><span className="workspace-role">{data.workspace.role === 'admin' ? 'Administrador' : data.workspace.role === 'editor' ? 'Editor' : 'Leitor'}</span></div><button className="text-button" aria-current={view === 'team' ? 'page' : undefined} onClick={() => navigate('team')}>Equipe e operação</button></div>}
    <main className="app-main" id="main-content" ref={main} tabIndex={-1}><div className="page-content">
      {notice && <div className="success-notice" role="status">{notice}<button aria-label="Fechar aviso" onClick={() => setNotice('')}><X size={14} /></button></div>}
      {error && <ErrorMessage message={error} />}
      {work && syncNotice && <div className="work-sync" role="status"><span>{syncNotice}</span><button className="text-button" onClick={() => { void flushWork(activeWork.current); }}>Salvar rascunho agora</button></div>}
      {(view === 'home' || view === 'reports') && <Library key={view} canEdit={canEdit} data={data} overview={view === 'home'} work={work} resume={resume} create={create} bringData={() => navigate('data')} open={openReport} refresh={refresh} />}
      {view === 'data' && <DataPage sources={data.sources} refresh={refresh} create={create} canEdit={canEdit} />}
      {view === 'create' && canEdit && <DashboardBuilder key={`${activeWork.current}:${seed.version}`} owner={activeWork.current} resourceOwner={data.workspace?.owner || data.actor.id} remember={remember} sources={data.sources} initialSource={seed.sourceId} initialPrompt={seed.prompt} provider={data.provider} back={() => navigate('reports')} bringData={() => navigate('data')} saved={saved} />}
      {view === 'create' && !canEdit && <ErrorMessage message="Seu acesso é de leitura. Abra uma análise salva ou peça a um administrador permissão para editar." />}
      {view === 'report' && (report && source ? <ReportPage key={report.id} report={report} source={source} back={() => navigate('reports')} create={create} refresh={refresh} open={openReport} canEdit={canEdit} /> : <div className="empty-state"><h1>Esse dashboard não está disponível</h1><button className="button secondary" onClick={() => navigate('reports')}>Ver seus dashboards</button></div>)}
      {view === 'team' && data.workspace && <GovernancePage key={data.workspace.id} workspace={data.workspace} workspaces={data.workspaces || [data.workspace]} changed={switchWorkspace} />}
      {view === 'settings' && <IntegrationSettings actor={data.actor} provider={data.provider} />}
    </div></main>
  </div>;
}
