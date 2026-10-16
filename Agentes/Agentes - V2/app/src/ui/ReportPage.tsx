'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Copy, History, MessageSquare, Pencil, Save } from 'lucide-react';
import type { Report, Source } from '@/core/types';
import { analysisSource } from '@/core/engine';
import { describePlanChanges } from '@/core/analysis';
import { api } from './api';
import { Busy, ErrorMessage, PageHeading } from './shared';
import { Dashboard } from './Dashboard';
import './lifecycle.css';

type Version = Report & { reportId: string; changedAt: string; changedBy: string };
export function ReportPage({ report, source, back, create, refresh, open, canEdit = true }: {
  report: Report; source: Source; back: () => void; create: (sourceId: string, prompt?: string) => void;
  refresh: () => Promise<void>; open: (report: Report) => void; canEdit?: boolean;
}) {
  const [plan, setPlan] = useState(report.plan);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(report.plan.title);
  const [history, setHistory] = useState(false);
  const [versions, setVersions] = useState<Version[]>([]);
  const [restoreId, setRestoreId] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [completed, setCompleted] = useState<{ report: Report; duplicate: boolean } | null>(null);
  const copyRequest = useRef(crypto.randomUUID());
  useEffect(() => { setPlan(report.plan); setTitle(report.plan.title); }, [report.plan]);
  useEffect(() => {
    if (!history) return;
    const controller = new AbortController();
    api<Version[]>(`reports/${report.id}/versions`, { signal: controller.signal }).then(setVersions).catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Não foi possível abrir o histórico.'); });
    return () => controller.abort();
  }, [history, report.id, report.revision]);
  async function finish(result: { report: Report; duplicate: boolean }) {
    await refresh(); setCompleted(null); setEditing(false); setRestoreId(''); copyRequest.current = crypto.randomUUID();
    setNotice(result.duplicate ? 'Cópia criada. Você está consultando o novo dashboard.' : 'Dashboard salvo em uma nova versão.');
    if (result.duplicate) open(result.report);
  }
  async function mutate(action: 'save' | 'duplicate' | 'restore') {
    if (pending) return;
    setPending(true); setError(''); setNotice('');
    try {
      const next = await api<Report>(`reports/${report.id}${action === 'save' ? '' : `/${action}`}`, { body: action === 'save' ? { revision: report.revision || 1, plan, title } : action === 'restore' ? { revision: report.revision || 1, versionId: restoreId } : { requestId: copyRequest.current } });
      const result = { report: next, duplicate: action === 'duplicate' }; setCompleted(result);
      await finish(result);
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível salvar esta operação.'); }
    finally { setPending(false); }
  }
  async function retryRefresh() {
    if (!completed || pending) return;
    setPending(true); setError('');
    try { await finish(completed); } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível atualizar a tela.'); } finally { setPending(false); }
  }
  const resolved = analysisSource(source, plan);
  const changes = describePlanChanges(report.plan, { ...plan, title }, source);
  return <><PageHeading title={report.plan.title} subtitle="Explore os dados e abra os indicadores para conferir os cálculos." actions={<><button className="text-button" onClick={back}><ArrowLeft size={15} />Todos os dashboards</button>{canEdit && <button className="button secondary" disabled={pending} onClick={() => create(source.id, `Crie um dashboard sobre ${resolved.metrics.find(m => m.key === plan.primaryMetric)?.label.toLowerCase()} por ${source.columns.find(c => c.key === plan.groupBy)?.label.toLowerCase()}.`)}><MessageSquare size={16} />Pedir outra análise</button>}</>} />
    <div className="report-toolbar">{canEdit && <><button className="button secondary" disabled={pending || editing || !!completed} onClick={() => { setEditing(true); setTitle(plan.title); }}><Pencil size={16} />Editar dashboard</button><button className="text-button" disabled={pending || !!completed} onClick={() => { void mutate('duplicate'); }}><Copy size={16} />Duplicar dashboard</button></>}<button className="text-button" aria-expanded={history} disabled={pending} onClick={() => setHistory(!history)}><History size={16} />{history ? 'Fechar histórico' : 'Histórico de versões'}</button><small>Versão {report.revision || 1} · Fonte na versão {source.revision}</small></div>
    {report.sourceRevision && report.sourceRevision !== source.revision && <div className="recovery-notice"><p>A fonte foi atualizada da versão {report.sourceRevision} para {source.revision}. Os resultados abaixo usam os dados atuais. Confira os filtros e salve uma nova versão para registrar a revisão.</p></div>}
    {editing && <section className="report-editor"><h2>Editar análise salva</h2><p>Ajuste o título, os indicadores e os filtros abaixo. A versão anterior será preservada quando você salvar.</p><div className="field"><label htmlFor="report-title">Título do dashboard</label><input id="report-title" value={title} onChange={event => setTitle(event.target.value)} maxLength={100} disabled={pending} /></div>{changes.length > 0 && <details open><summary>O que mudou nesta análise?</summary><ul>{changes.map(change => <li key={change}>{change}</li>)}</ul></details>}<div className="form-actions"><button className="button secondary" disabled={pending} onClick={() => { setPlan(report.plan); setTitle(report.plan.title); setEditing(false); }}>Cancelar edição</button><button className="button primary" disabled={pending || !title.trim() || !changes.length || !!completed} onClick={() => { void mutate('save'); }}>{pending ? <Busy>Salvando…</Busy> : <><Save size={16} />Salvar nova versão</>}</button></div></section>}
    {history && <section className="report-history"><h2>Histórico do dashboard</h2><p>Restaurar cria uma nova versão, usando a fonte atual e mantendo o histórico.</p><div className="version-list">{versions.map(version => <div key={version.id}><span><strong>Versão {version.revision || 1}: {version.plan.title}</strong><br /><small>{new Date(version.changedAt).toLocaleString('pt-BR')}</small></span>{version.id === report.id ? <small>Atual</small> : canEdit && <button className="text-button" disabled={pending} onClick={() => setRestoreId(version.id)}>Restaurar versão {version.revision || 1}</button>}</div>)}</div>{restoreId && <div className="inline-confirm" role="group" aria-label="Confirmar restauração do dashboard"><p>Restaurar o título, os indicadores e o recorte desta versão com os dados atuais?</p><div className="form-actions"><button className="button secondary" disabled={pending} onClick={() => setRestoreId('')}>Cancelar</button><button className="button primary" disabled={pending || !!completed} onClick={() => { void mutate('restore'); }}>Confirmar restauração</button></div></div>}</section>}
    {notice && <p className="operation-notice" role="status">{notice}</p>}{error && <ErrorMessage message={error} retry={completed ? () => { void retryRefresh(); } : undefined} retryLabel="Atualizar tela" />}
    <section className="saved-dashboard"><Dashboard source={source} plan={editing ? { ...plan, title } : plan} onPlan={setPlan} savedFilters={report.plan.filters} savedFilterSelections={report.plan.filterSelections} /></section>
  </>;
}
