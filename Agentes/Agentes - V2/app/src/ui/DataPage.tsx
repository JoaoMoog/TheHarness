'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, Database, FileSpreadsheet, Upload, Check, ArrowLeft } from 'lucide-react';
import type { ImportPreview, Source } from '@/core/types';
import { api } from './api';
import { ImportWizard } from './ImportWizard';
import { Busy, ErrorMessage, PageHeading, Steps } from './shared';
import { SourceManager } from './SourceManager';

const domains = [
  { id: 'finance', title: 'Financeiro', description: 'Despesas, orçamento e centros de custo' },
  { id: 'sales', title: 'Vendas', description: 'Faturamento por região e produto' },
  { id: 'purchases', title: 'Compras', description: 'Pedidos por fornecedor e categoria' },
  { id: 'inventory', title: 'Estoque', description: 'Quantidade por unidade e produto' },
];

export function DataPage({ sources, refresh, create, canEdit = true }: { sources: Source[]; refresh: () => Promise<void>; create: (id: string) => void; canEdit?: boolean }) {
  const [mode, setMode] = useState<'home' | 'sap' | 'file'>('home');
  const [pending, setPending] = useState('');
  const [error, setError] = useState('');
  const [selected, setSelected] = useState('');
  const source = sources.find(item => item.id === selected);
  const [sapReady, setSapReady] = useState(false);
  const [sapSample, setSapSample] = useState<ImportPreview | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    api<{ configured: boolean }>('sap/configuration', { signal: controller.signal }).then(data => setSapReady(data.configured)).catch(() => {});
    return () => controller.abort();
  }, []);
  async function consultSap() {
    if (pending) return;
    setPending('connected'); setError('');
    try { setSapSample(await api<ImportPreview>('imports/sap-preview', { body: {} })); setMode('file'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível consultar o SAP.'); }
    finally { setPending(''); }
  }
  async function chooseSap(id: string) {
    if (pending) return;
    setPending(id); setError('');
    try { const source = await api<Source>('sources/sap', { body: { domain: id } }); await refresh(); create(source.id); }
    catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível trazer esses dados.'); }
    finally { setPending(''); }
  }
  return <><PageHeading title="Seus dados, seu ponto de partida" subtitle="Traga as informações que sua equipe usa para tomar decisões." /><Steps active={0} />{source && <SourceManager key={source.id} source={source} canEdit={canEdit} refresh={refresh} close={() => setSelected('')} />}
    {mode === 'file' ? <ImportWizard initialSample={sapSample} cancel={() => { setMode('home'); setSapSample(null); }} imported={async source => { await refresh(); create(source.id); }} />
      : mode === 'sap' ? <section className="sap-picker"><button className="text-button back-link" onClick={() => setMode('home')} disabled={!!pending}><ArrowLeft size={16} />Voltar às opções de dados</button><h2>Qual área você quer analisar?</h2><p>Escolha um assunto para explorar com dados de exemplo.</p><div className="demo-notice"><InfoIcon /><span>SAP em demonstração. Nenhuma conexão com a empresa será feita.</span></div>{sapReady && <div className="sap-connected"><h3>Conexão de leitura disponível</h3><p>Consulte a coleção configurada e confira os dados antes de importar.</p><button className="button primary" disabled={!!pending} onClick={() => { void consultSap(); }}>{pending === 'connected' ? 'Consultando…' : 'Consultar SAP conectado'}</button></div>}<div className="domain-list">{domains.map(domain => <button key={domain.id} disabled={!!pending} className="domain-option" onClick={() => chooseSap(domain.id)}><span><strong>{domain.title}</strong><small>{domain.description}</small></span>{pending === domain.id ? <Busy>Preparando…</Busy> : <ArrowRight size={18} />}</button>)}</div>{error && <ErrorMessage message={error} />}</section>
        : <><section className="source-entry"><h2>De onde vêm seus dados?</h2><div className="source-options"><button disabled={!canEdit} onClick={() => setMode('sap')}><Database size={24} /><div><h3>Buscar no SAP</h3><p>Escolha uma área de negócio para começar.</p><span>Dados de exemplo nesta demonstração</span></div><ArrowRight size={20} /></button><button disabled={!canEdit} onClick={() => { setSapSample(null); setMode('file'); }}><Upload size={24} /><div><h3>Importar arquivo</h3><p>Use uma planilha ou um arquivo da sua equipe.</p><span>CSV, Excel ou JSON</span></div><ArrowRight size={20} /></button></div></section>
          <section className="source-library"><div className="section-heading"><h2>Dados disponíveis</h2><span>{sources.length} {sources.length === 1 ? 'fonte' : 'fontes'}</span></div>{sources.length ? <div className="source-list">{sources.map(source => <article key={source.id}>{source.origin === 'file' ? <FileSpreadsheet size={22} /> : <Database size={22} />}<div><h3>{source.name}</h3><p>{source.origin === 'file' ? 'Arquivo importado' : source.origin === 'sap' ? 'SAP · leitura' : 'SAP · demonstração'} · {source.rows.length.toLocaleString('pt-BR')} registros</p><small><Check size={12} />{source.metrics.map(m => m.label).join(' · ')}</small></div><div className="source-item-actions"><button className="button secondary" disabled={!canEdit} onClick={() => create(source.id)}>Pedir dashboard <ArrowRight size={15} /></button><button className="text-button" onClick={() => setSelected(source.id)}>Qualidade e versões</button></div></article>)}</div> : <div className="empty-state"><p>Traga sua primeira fonte para pedir um dashboard.</p></div>}</section></>}
  </>;
}

function InfoIcon() { return <Database size={16} aria-hidden="true" />; }
