'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Database, FileSpreadsheet, MessageSquare, RotateCcw } from 'lucide-react';
import type { Draft, Plan, Report, Source } from '@/core/types';
import { analysisSource, fieldLabel, planFilters } from '@/core/engine';
import { describePlanChanges } from '@/core/analysis';
import { api, ApiError } from './api';
import { validatePlan } from '@/core/planner';
import { readWork, writeWork, type WorkSession } from './workSession';
import { Select } from './Select';
import { Busy, ErrorMessage, PageHeading } from './shared';
import { Dashboard } from './Dashboard';
import { ChatComposer } from './ChatComposer';
import { AdaptivePanel } from './AdaptivePanel';
import { BRAND } from '@/core/brand';
import { recoverDurableWork } from './durableWork';

function draftUrl(id?: string) {
  const url = new URL(window.location.href); url.searchParams.set('view', 'create');
  if (id) url.searchParams.set('draft', id); else url.searchParams.delete('draft');
  window.history.replaceState({}, '', url);
}

export function DashboardBuilder({ owner, resourceOwner = owner, remember, sources, initialSource, initialPrompt, provider, back, bringData, saved }: {
  owner: string; resourceOwner?: string; remember: (work: WorkSession | null) => void;
  sources: Source[]; initialSource: string; initialPrompt: string; provider: 'demo' | 'bedrock';
  back: () => void; bringData: () => void; saved: (report: Report) => Promise<void>;
}) {
  const [initial] = useState(() => {
    const id = new URL(window.location.href).searchParams.get('draft');
    const stored = readWork(owner);
    const work = stored && (!id || stored.draftId === id) ? stored : null;
    return { work, id: id || work?.draftId || null };
  });
  const [sourceId, setSourceId] = useState(initialSource || initial.work?.sourceId || sources[0]?.id || '');
  const [prompt, setPrompt] = useState(initialPrompt || initial.work?.prompt || '');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [pending, setPending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [restoring, setRestoring] = useState(!!initial.id);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<{ operation: 'send' | 'save' | 'refresh' | 'restore'; message: string } | null>(null);
  const [recovery, setRecovery] = useState(initial.work?.recovery || '');
  const [lastPrompt, setLastPrompt] = useState(initial.work?.lastPrompt || '');
  const [changes, setChanges] = useState<string[]>([]);
  const [assistantOpen, setAssistantOpen] = useState(initial.work?.assistantOpen ?? true);
  const assistantToggle = useRef<HTMLButtonElement>(null);
  const lock = useRef(false);
  const saveLock = useRef(false);
  const abort = useRef<AbortController | null>(null);
  const restoreAbort = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const completedReport = useRef<Report | null>(null);
  const finished = useRef(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const messages = useRef<HTMLDivElement>(null);
  const preview = useRef<HTMLHeadingElement>(null);
  const initialSources = useRef(sources);
  const lastValidWork = useRef(initial.work);
  const source = sources.find(s => s.id === sourceId);

  const invalidate = useCallback((message: string) => {
    setRecovery(message); setDraft(null); setPlan(null); setError(null); setHydrated(true);
    setAssistantOpen(true);
    setPrompt(current => current || initial.work?.prompt || initial.work?.lastPrompt || '');
    draftUrl();
  }, [initial]);

  const restore = useCallback(async () => {
    if (!initial.id) {
      const current = initialSources.current.find(s => s.id === initial.work?.sourceId);
      if (initial.work && (!current || current.revision !== initial.work.sourceRevision)) {
        invalidate('A fonte mudou ou não está disponível. Sua pergunta foi preservada; inicie outra análise com os dados atuais.');
      }
      setHydrated(true); return;
    }
    restoreAbort.current?.abort();
    const controller = new AbortController(); restoreAbort.current = controller;
    setRestoring(true); setError(null);
    try {
      const data = await api<Draft>('drafts/' + initial.id, { signal: controller.signal });
      if (controller.signal.aborted) return;
      const current = initialSources.current.find(s => s.id === data.sourceId);
      if (data.owner !== resourceOwner) throw new ApiError(404, 'Essa conversa não pertence ao espaço atual.');
      if (!current || current.revision !== data.sourceRevision) {
        setPrompt(value => value || data.messages.filter(m => m.role === 'user').at(-1)?.text || '');
        invalidate('Esses dados mudaram. Sua pergunta foi preservada; inicie outra análise para conferir os dados atuais.'); return;
      }
      let restoredPlan = data.plan;
      const local = initial.work;
      if (!data.reportId && local?.plan && local.draftId === data.id && local.draftRevision === data.revision && local.sourceRevision === current.revision) {
        try { restoredPlan = validatePlan(local.plan, current); } catch { /* Use the validated server plan if local adjustments are stale. */ }
      }
      setSourceId(data.sourceId); setDraft(data); setPlan(restoredPlan); setRecovery(''); setHydrated(true);
      setLastPrompt(local?.lastPrompt || data.messages.filter(m => m.role === 'user').at(-1)?.text || '');
      draftUrl(data.id);
    } catch (e) {
      if (controller.signal.aborted) return;
      if (e instanceof ApiError && [404, 410].includes(e.status)) invalidate(e.message + ' Sua pergunta foi preservada para iniciar outra análise.');
      else { setError({ operation: 'restore', message: e instanceof Error ? e.message : 'Não foi possível recuperar a conversa.' }); setAssistantOpen(true); }
    } finally { if (!controller.signal.aborted) setRestoring(false); }
  }, [initial, invalidate, resourceOwner]);

  useEffect(() => {
    mounted.current = true; void restore();
    return () => { mounted.current = false; abort.current?.abort(); restoreAbort.current?.abort(); };
  }, [restore]);

  useEffect(() => {
    if (!hydrated || restoring || finished.current) return;
    const hasWork = !!(prompt.trim() || draft || recovery);
    const work: WorkSession | null = hasWork ? {
      version: 1, owner, sourceId, sourceRevision: source?.revision ?? initial.work?.sourceRevision ?? 0,
      draftId: draft?.id || (recovery ? lastValidWork.current?.draftId : undefined), draftRevision: draft?.revision || (recovery ? lastValidWork.current?.draftRevision : undefined), expiresAt: draft?.expiresAt || (recovery ? lastValidWork.current?.expiresAt : undefined),
      prompt, lastPrompt, plan: plan || (recovery ? lastValidWork.current?.plan || null : null), assistantOpen, recovery,
    } : null;
    if (!recovery) lastValidWork.current = work;
    writeWork(owner, work); remember(work);
  }, [owner, sourceId, source?.revision, prompt, lastPrompt, draft, plan, assistantOpen, recovery, hydrated, restoring, remember, initial]);

  useEffect(() => {
    if (!draft || draft.reportId) return;
    const remaining = Date.parse(draft.expiresAt) - Date.now();
    const timer = window.setTimeout(() => {
      setPrompt(value => value || lastPrompt);
      invalidate('Essa conversa expirou. Sua pergunta foi preservada para iniciar outra análise.');
    }, Math.max(0, remaining));
    return () => window.clearTimeout(timer);
  }, [draft, lastPrompt, invalidate]);
  useEffect(() => { messages.current?.scrollTo({ top: messages.current.scrollHeight, behavior: 'instant' }); }, [draft, pending]);

  function reset(nextSource = sourceId) {
    if (pending || saving || restoring) return;
    if ((prompt.trim() || draft) && !window.confirm('Descartar a conversa e os ajustes desta análise? Dashboards salvos serão preservados.')) return;
    setSourceId(nextSource); setDraft(null); setPlan(null); setPrompt(''); setLastPrompt(''); setRecovery(''); setError(null);
    completedReport.current = null; setHydrated(true); draftUrl();
    requestAnimationFrame(() => input.current?.focus());
  }
  function restart() {
    setRecovery(''); setDraft(null); setPlan(null); setError(null); completedReport.current = null;
    draftUrl(); requestAnimationFrame(() => input.current?.focus());
  }
  async function recoverSaved() {
    const id = lastValidWork.current?.draftId;
    if (!id || restoring) return;
    setRestoring(true); setError(null);
    try {
      const restored = await recoverDurableWork(owner, id);
      if (!mounted.current) return;
      setDraft(restored); setPlan(restored.plan); setSourceId(restored.sourceId); setRecovery(''); setHydrated(true); draftUrl(restored.id);
    } catch (e) { if (mounted.current) setError({ operation: 'restore', message: e instanceof Error ? e.message : 'Não foi possível recuperar o rascunho.' }); }
    finally { if (mounted.current) setRestoring(false); }
  }
  function cancelRequest() {
    abort.current?.abort(); abort.current = null;
    lock.current = false; setPending(false);
    requestAnimationFrame(() => input.current?.focus());
  }
  async function send(text = prompt) {
    if (!source || !text.trim() || lock.current || saving || restoring || !hydrated || recovery || draft?.reportId) return;
    lock.current = true; setPending(true); setError(null); setLastPrompt(text);
    const controller = new AbortController(); abort.current = controller;
    try {
      const result = await api<Draft>('drafts', { body: { sourceId: source.id, prompt: text,
        ...(draft ? { draftId: draft.id, revision: draft.revision, plan } : {}) }, signal: controller.signal });
      if (controller.signal.aborted || abort.current !== controller) return;
      setChanges(plan ? describePlanChanges(plan, result.plan, source) : []);
      setDraft(result); setPlan(result.plan); setPrompt(''); draftUrl(result.id);
    } catch (e) {
      if (!controller.signal.aborted && abort.current === controller) {
        if (e instanceof ApiError && [404, 410].includes(e.status)) { setPrompt(text); invalidate(e.message); }
        else setError({ operation: 'send', message: e instanceof Error ? e.message : 'Não foi possível montar a prévia.' });
      }
    } finally { if (abort.current === controller) { abort.current = null; lock.current = false; setPending(false); } }
  }
  async function save() {
    if (!draft || !plan || plan.status !== 'ready' || saveLock.current || pending || restoring || recovery) return;
    saveLock.current = true; setSaving(true); setError(null);
    try {
      const report = completedReport.current || await api<Report>('drafts/' + draft.id + '/save', { body: { revision: draft.revision, plan } });
      completedReport.current = report;
      if (!mounted.current) return;
      setDraft({ ...draft, reportId: report.id });
      await saved(report); finished.current = true;
    } catch (e) {
      if (!mounted.current) return;
      if (e instanceof ApiError && [404, 410].includes(e.status) && !completedReport.current) { setPrompt(value => value || lastPrompt); invalidate(e.message); }
      else setError({ operation: completedReport.current ? 'refresh' : 'save', message: completedReport.current ? 'Seu dashboard foi salvo, mas não foi possível atualizar a tela.' : e instanceof Error ? e.message : 'Não foi possível salvar o dashboard.' });
      setAssistantOpen(true);
    } finally { saveLock.current = false; if (mounted.current) setSaving(false); }
  }
  const metric = source?.metrics.find(m => m.key === source.primaryMetric);
  const examples = source ? [`Compare ${metric?.label.toLowerCase()} por ${fieldLabel(source, source.groupBy).toLowerCase()}.`,
    ...(source.dateColumn ? [`Mostre a evolução de ${metric?.label.toLowerCase()} ao longo do tempo.`] : []),
    source.budgetMetric ? 'Compare as despesas com o orçamento e inclua uma tabela de detalhes.' : 'Monte um dashboard com os valores por grupo e uma tabela de detalhes.'] : [];
  const ready = !recovery && !restoring && plan?.status === 'ready';
  const showPreview = () => { setAssistantOpen(false); requestAnimationFrame(() => { preview.current?.scrollIntoView({ behavior: 'instant', block: 'start' }); preview.current?.focus({ preventScroll: true }); }); };
  const closeAssistant = () => { setAssistantOpen(false); requestAnimationFrame(() => assistantToggle.current?.focus()); };
  const openAssistant = () => { setAssistantOpen(true); requestAnimationFrame(() => input.current?.focus()); };
  return <><PageHeading title="Sua próxima análise" subtitle="Uma pergunta, novas perspectivas. Confira os números antes de salvar." actions={<><button className="text-button" onClick={back} disabled={pending || saving}><ArrowLeft size={16} />Seus dashboards</button><button ref={assistantToggle} className="button secondary assistant-toggle" aria-expanded={assistantOpen} aria-controls="analysis-assistant" disabled={!source} onClick={assistantOpen ? closeAssistant : openAssistant}><MessageSquare size={17} />{assistantOpen ? 'Recolher assistente' : 'Abrir assistente'}{pending && <span className="activity-dot" aria-label="Pedido em andamento" />}{error && !assistantOpen && <span className="assistant-alert">Atenção</span>}</button></>} />
    {!source && recovery && <div className="recovery-notice" role="status"><p>{recovery}</p><div className="field"><label htmlFor="preserved-question">Sua pergunta preservada</label><textarea id="preserved-question" value={prompt || lastPrompt} readOnly /></div>{sources.length > 0 && <Select label="Dados para retomar a pergunta" value="" options={sources.map(item => ({ value: item.id, label: item.name }))} onChange={setSourceId} />}</div>}
    {!source ? <section className="empty-state"><Database size={28} /><h2>Primeiro, traga seus dados</h2><p>Busque dados de exemplo do SAP ou importe um arquivo da sua equipe.</p><button className="button primary" onClick={bringData}>Trazer dados <ArrowRight size={16} /></button></section> : <div className={`builder-layout ${assistantOpen ? 'assistant-open' : ''}`}>
      <section className={`preview-panel ${ready ? 'preview-ready' : ''}`} aria-label="Prévia do dashboard">
        {ready && plan ? <><div className="preview-heading"><div><h2 ref={preview} tabIndex={-1}>{plan.title}</h2></div><div className="preview-actions"><span className="preview-state"><Check size={14} />Prévia para conferir</span><button className="button primary" disabled={pending || saving} onClick={save}>{saving ? <Busy>Salvando…</Busy> : draft?.reportId ? 'Abrir dashboard salvo' : 'Salvar dashboard'}{!saving && <ArrowRight size={16} />}</button></div></div>
          <div className="interpretation"><h3>Foi isso que você pediu?</h3><p>{analysisSource(source, plan).metrics.find(m => m.key === plan.primaryMetric)?.label} por {fieldLabel(source, plan.groupBy).toLowerCase()}{plan.chart === 'line' ? ', com evolução no tempo' : ''}. {Object.keys(planFilters(plan)).length ? 'Os filtros escolhidos aparecem abaixo.' : 'Todos os períodos disponíveis.'}</p><small>Você pode ajustar os filtros ou pedir uma mudança no chat.</small></div>
          {changes.length > 0 && <details className="analysis-change-summary" open><summary>O que mudou nesta análise?</summary><ul>{changes.map(change => <li key={change}>{change}</li>)}</ul></details>}<Dashboard source={source} plan={plan} onPlan={setPlan} preview /><button className="text-button return-chat" onClick={openAssistant}><MessageSquare size={16} />Voltar ao pedido</button>
        </> : <div className="preview-empty"><MessageSquare size={32} /><h2>{plan?.status === 'clarify' ? 'Seu próximo passo está na conversa' : 'Uma boa análise começa com uma pergunta'}</h2><p>{plan?.status === 'clarify' ? 'Responda no assistente ou use os dados disponíveis. A prévia aparece quando o pedido estiver completo.' : 'Descreva a comparação, tendência ou resultado que você precisa ver. Vamos organizar os dados em uma primeira prévia.'}</p><div className="preview-guide"><div><strong>Você conta o objetivo</strong><span>“Compare {metric?.label.toLowerCase()} por {fieldLabel(source, source.groupBy).toLowerCase()}.”</span></div><ArrowRight size={16} /><div><strong>Você confere a resposta</strong><span>Fonte, filtros, gráficos e critérios visíveis.</span></div></div><div className="available-data"><h3>O que temos nesses dados</h3><p>{source.metrics.map(m => m.label).join(' · ')}</p><span>Você pode separar por {source.columns.filter(c => c.type === 'text' && c.key !== 'status').map(c => c.label.toLowerCase()).join(', ')}{source.dateColumn ? ' e acompanhar a evolução no tempo.' : '.'}</span></div></div>}
      </section>
      <AdaptivePanel open={assistantOpen} close={closeAssistant} title={`Assistente ${BRAND.name}`} id="analysis-assistant" className="chat-panel"><div className="chat-source"><Select label="Quais dados vamos usar?" value={sourceId} onChange={reset} options={sources.map(s => ({ value: s.id, label: s.name }))} disabled={pending || saving || restoring} /><div className="source-context">{source.origin === 'file' ? <FileSpreadsheet size={14} /> : <Database size={14} />}<span>{source.origin === 'sap-demo' ? 'SAP · demonstração' : source.origin === 'sap' ? 'SAP · leitura' : 'Arquivo importado'} · {source.rows.length} registros</span></div><button className="text-button" onClick={bringData} disabled={pending || saving}>Trazer outros dados <ArrowRight size={13} /></button></div>
        {restoring ? <div className="chat-restoring"><Busy>Recuperando sua conversa…</Busy></div> : <>
          {draft && <div className="chat-messages" ref={messages} role="log" aria-label="Histórico da conversa" tabIndex={0}>{draft.messages.map((message, i) => <div key={i} className={`chat-message ${message.role}`}><strong>{message.role === 'user' ? 'Você' : BRAND.name}</strong><p>{message.text}</p></div>)}</div>}
          {recovery && <div className="recovery-notice" role="status"><p>{recovery}</p><div className="form-actions">{lastValidWork.current?.draftId && lastValidWork.current.plan && <button className="button primary" onClick={() => { void recoverSaved(); }}>Recuperar rascunho salvo</button>}<button className="button secondary" onClick={restart}>Iniciar outra análise</button></div></div>}
          <ChatComposer prompt={prompt} setPrompt={setPrompt} send={() => { void send(); }} pending={pending} cancel={cancelRequest} continuing={!!draft} disabled={saving || !hydrated || !!recovery || !!draft?.reportId} inputRef={input} />
          {!draft && <div className="chat-examples"><h2>Não sabe por onde começar?</h2>{examples.map(example => <button key={example} onClick={() => { setPrompt(example); input.current?.focus(); }} disabled={pending || saving}>{example}<ArrowRight size={14} /></button>)}</div>}
          {plan?.status === 'clarify' && <div className="clarify-action"><h3>Vamos completar sua pergunta</h3><button className="button secondary" disabled={pending || saving} onClick={() => { void send(`Use os dados disponíveis. Compare ${metric?.label} por ${fieldLabel(source, source.groupBy)}.`); }}>Usar os dados disponíveis</button></div>}
          {error && <ErrorMessage message={error.message}
            retry={!saving && !pending ? error.operation === 'restore' ? () => { void restore(); } : error.operation === 'send' ? () => { void send(lastPrompt); } : () => { void save(); } : undefined}
            retryLabel={error.operation === 'save' ? 'Tentar salvar novamente' : error.operation === 'refresh' ? 'Atualizar tela' : error.operation === 'restore' ? 'Recuperar conversa' : 'Tentar novamente'} />}
          {draft && <div className="chat-tools"><button className="text-button" disabled={pending || saving} onClick={() => reset()}><RotateCcw size={14} />Nova conversa</button>{ready && <button className="text-button" onClick={showPreview}>Ver dashboard <ArrowRight size={14} /></button>}</div>}
        </>}
        <p className="chat-demo-note">{provider === 'demo' ? 'IA em demonstração. Experimente as sugestões e ajuste os campos disponíveis.' : `Revise a proposta da IA. Os números são calculados pela ${BRAND.name} a partir dos seus dados.`}</p>
      </AdaptivePanel>
    </div>}
  </>;
}
