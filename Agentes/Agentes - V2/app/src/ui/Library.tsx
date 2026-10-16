'use client';

import { useState } from 'react';
import { ArrowRight, ChartNoAxesCombined, Database, Search } from 'lucide-react';
import type { Bootstrap, Report } from '@/core/types';
import { api } from './api';
import { ErrorMessage, PageHeading } from './shared';
import { Select } from './Select';
import type { WorkSession } from './workSession';

export function Library({ data, overview, work, resume, create, bringData, open, refresh, canEdit = true }: {
  data: Bootstrap; overview: boolean; create: (sourceId: string, prompt?: string) => void;
  bringData: () => void; open: (report: Report) => void; refresh: () => Promise<void>;
  work: WorkSession | null; resume: () => void;
  canEdit?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [prompt, setPrompt] = useState('');
  const [sourceId, setSourceId] = useState(data.sources[0]?.id || '');
  const [deleting, setDeleting] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const reports = data.reports.filter(r => r.plan.title.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR')));
  async function remove(id: string) {
    if (pending) return; setPending(true); setError('');
    try { await api(`reports/${id}`, { method: 'DELETE' }); await refresh(); setDeleting(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível excluir.'); }
    finally { setPending(false); }
  }
  return <><PageHeading title={overview ? `Olá, ${data.actor.name.split(' ')[0]}. Vamos olhar mais longe?` : 'Seus dashboards'} subtitle={overview ? 'Um novo olhar sobre os dados. Mais clareza para cada decisão.' : 'Suas perguntas se transformam em perspectivas. Explore as análises salvas.'} />
    {overview && work && <section className="resume-analysis" aria-label="Análise em andamento"><div><h2>Análise em andamento</h2><p>{data.sources.find(source => source.id === work.sourceId)?.name || 'Fonte indisponível'} · Sua pergunta e seus ajustes estão salvos na conta.</p></div><button className="button primary" onClick={resume}>Retomar análise <ArrowRight size={16} /></button></section>}
    {overview && canEdit && <section className="overview-start"><div className="overview-intro"><h2>O que você quer<br />entender hoje?</h2><p>Traga uma pergunta.<br /> Encontre a próxima direção.</p><button className="overview-data-link" onClick={bringData}><Database size={18} /><span>Conectar seus dados<small>SAP, Excel, CSV ou JSON</small></span><ArrowRight size={18} /></button></div><div className="home-question"><form onSubmit={e => { e.preventDefault(); if (sourceId) create(sourceId, prompt); }}><label htmlFor="home-prompt">Conte o que você precisa ver</label><textarea id="home-prompt" rows={2} maxLength={4000} value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Ex.: Compare as despesas das áreas com o orçamento deste mês." /><div className="home-question-actions"><Select label="Dados para a análise" value={sourceId} options={data.sources.map(s => ({ value: s.id, label: s.name }))} onChange={setSourceId} /><button className="button primary" disabled={!sourceId}>Criar pelo chat <ArrowRight size={16} /></button></div>{!sourceId && <p className="no-source-hint">Conecte seus dados para começar sua primeira análise.</p>}</form></div></section>}
    <section className="report-library"><div className="section-heading"><div><h2>{overview ? 'Continue de onde parou' : 'Análises salvas'}</h2><p className="section-description">{overview ? 'As respostas que você já construiu, sempre por perto.' : `${data.reports.length} ${data.reports.length === 1 ? 'dashboard salvo' : 'dashboards salvos'}`}</p></div><div className="search-field"><Search size={16} /><input aria-label="Buscar dashboard" placeholder="Buscar dashboard" value={query} onChange={e => setQuery(e.target.value)} /></div></div>
      {reports.length ? <div className="report-list">{reports.map(report => { const source = data.sources.find(s => s.id === report.sourceId); return <article key={report.id}><div className="report-icon"><ChartNoAxesCombined size={24} /></div><div className="report-info"><button className="report-title" onClick={() => open(report)}>{report.plan.title}</button><p>{source?.name} · {source?.origin === 'sap-demo' ? 'SAP em demonstração' : source?.origin === 'sap' ? 'SAP · leitura' : 'Arquivo importado'}</p><small>Salvo em {new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(report.createdAt))}</small></div><div className="report-actions"><button className="button secondary" onClick={() => open(report)}>Abrir <ArrowRight size={14} /></button>{canEdit && <button className="text-button muted" onClick={() => setDeleting(deleting === report.id ? '' : report.id)} disabled={pending}>Excluir</button>}</div>{deleting === report.id && <div className="delete-confirm" role="group" aria-label={`Confirmar exclusão de ${report.plan.title}`}><p>Excluir este dashboard? Os dados da fonte continuam disponíveis.</p><button className="button secondary" onClick={() => setDeleting('')} disabled={pending}>Cancelar</button><button className="button danger" onClick={() => remove(report.id)} disabled={pending}>{pending ? 'Excluindo…' : 'Confirmar exclusão'}</button></div>}</article>; })}</div> : <div className="empty-state"><h3>{query ? 'Nenhum dashboard com esse nome' : 'Sua próxima análise começa aqui'}</h3><p>{query ? 'Tente outro termo de busca.' : 'Crie uma primeira prévia pelo chat e salve quando estiver pronta.'}</p>{!query && canEdit && <button className="button primary" onClick={() => create(sourceId)}>Criar dashboard</button>}</div>}
      {error && <ErrorMessage message={error} />}
    </section>
  </>;
}
