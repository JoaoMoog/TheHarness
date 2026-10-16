'use client';

import { useEffect, useRef, useState } from 'react';
import type { Source } from '@/core/types';
import { api } from './api';
import { Busy, ErrorMessage } from './shared';
import './lifecycle.css';

type Preview = { id: string; columns: Source['columns']; rows: Source['rows']; rowCount: number; sourceRevision: number; warnings: string[] };
type Version = Omit<Source, 'rows'> & { sourceId: string; rowCount: number; changedAt: string };
export function SourceManager({ source, canEdit, refresh, close }: { source: Source; canEdit: boolean; refresh: () => Promise<void>; close: () => void }) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [restoreId, setRestoreId] = useState('');
  const [completed, setCompleted] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  useEffect(() => {
    const abort = new AbortController();
    api<Version[]>(`sources/${source.id}/versions`, { signal: abort.signal }).then(setVersions).catch(e => { if (!abort.signal.aborted) setError(e instanceof Error ? e.message : 'Não foi possível abrir as versões.'); });
    return () => abort.abort();
  }, [source.id, source.revision]);
  async function upload(file?: File) {
    if (!file || pending) return;
    setPending(true); setError(''); setNotice(''); setCompleted(false);
    try { const form = new FormData(); form.set('file', file); setPreview(await api<Preview>(`sources/${source.id}/replacement-preview`, { body: form })); }
    catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível conferir o arquivo.'); }
    finally { setPending(false); }
  }
  async function consultSap() {
    if (pending) return;
    setPending(true); setError(''); setNotice(''); setCompleted(false);
    try { setPreview(await api<Preview>(`sources/${source.id}/sap-replacement-preview`, { body: {} })); }
    catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível consultar o SAP.'); }
    finally { setPending(false); }
  }
  async function commit(versionId?: string) {
    if (pending) return;
    setPending(true); setError('');
    try {
      if (!completed) {
        if (versionId) await api(`sources/${source.id}/restore`, { body: { revision: source.revision, versionId } });
        else if (preview) await api(`sources/${source.id}/replace`, { body: { revision: preview.sourceRevision, uploadId: preview.id } });
        else return;
        setCompleted(true);
      }
      await refresh(); setPreview(null); setRestoreId(''); setNotice('Fonte atualizada. Os dashboards agora consultam os novos dados; confira seus recortes.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível atualizar a fonte.'); }
    finally { setPending(false); }
  }
  const dates = source.dateColumn ? source.rows.map(row => row[source.dateColumn!]).filter((value): value is string => typeof value === 'string').sort() : [];
  return <section className="source-manager" aria-label={`Gerenciar ${source.name}`}>
    <div className="section-heading"><div><h2 ref={heading} tabIndex={-1}>{source.name}</h2><p className="section-description">Versão {source.revision} · {source.rows.length.toLocaleString('pt-BR')} registros</p></div><button className="text-button" onClick={close} disabled={pending}>Fechar</button></div>
    <details className="source-quality"><summary>Conferir qualidade da fonte</summary><p>{dates.length ? `Cobertura de datas: ${dates[0]} a ${dates.at(-1)}.` : 'Esta fonte não tem cobertura temporal disponível.'}</p><div className="table-scroll"><table><caption>Valores ausentes antes dos filtros</caption><thead><tr><th scope="col">Coluna</th><th scope="col">Ausentes</th><th scope="col">Exemplo disponível</th></tr></thead><tbody>{source.columns.map(column => <tr key={column.key}><th scope="row">{column.label}</th><td>{source.rows.filter(row => row[column.key] == null).length}</td><td>{String(source.rows.find(row => row[column.key] != null)?.[column.key] ?? 'Sem valor')}</td></tr>)}</tbody></table></div></details>
    {canEdit && <div className="source-replace"><h3>Atualizar os dados desta fonte</h3><p>Escolha o arquivo completo da próxima versão. Vamos conferir os nomes e tipos das colunas e manter o histórico.</p><label className="field">Arquivo novo<input type="file" accept=".csv,.xlsx,.json" disabled={pending} onChange={event => { void upload(event.target.files?.[0]); event.target.value = ''; }} /></label>{source.origin === 'sap' && <button className="button secondary" onClick={() => { void consultSap(); }} disabled={pending}>Consultar SAP novamente</button>}</div>}
    {preview && <div className="replacement-preview"><h3>Conferir atualização</h3><p>{source.rows.length.toLocaleString('pt-BR')} → {preview.rowCount.toLocaleString('pt-BR')} registros. Todos os registros serão substituídos; as regras de cálculo serão mantidas.</p>{preview.warnings.map(warning => <p key={warning} className="replacement-warning">{warning}</p>)}<div className="table-scroll"><table><caption>Primeiras cinco linhas da nova versão</caption><thead><tr>{preview.columns.map(c => <th scope="col" key={c.key}>{c.label}</th>)}</tr></thead><tbody>{preview.rows.map((row, i) => <tr key={i}>{preview.columns.map(c => <td key={c.key}>{row[c.key] ?? '—'}</td>)}</tr>)}</tbody></table></div><div className="form-actions"><button className="button secondary" disabled={pending} onClick={() => setPreview(null)}>Cancelar atualização</button><button className="button primary" disabled={pending} onClick={() => { void commit(); }}>{pending ? <Busy>Atualizando…</Busy> : completed ? 'Atualizar tela' : 'Confirmar atualização da fonte'}</button></div></div>}
    <h3>Histórico da fonte</h3><div className="version-list">{versions.map(version => <div key={version.id}><span>Versão {version.revision} · {version.rowCount.toLocaleString('pt-BR')} registros · {new Date(version.changedAt).toLocaleString('pt-BR')}</span>{version.id === source.id ? <small>Atual</small> : canEdit && <button className="text-button" onClick={() => { setCompleted(false); setRestoreId(version.id); }} disabled={pending}>Restaurar versão {version.revision}</button>}</div>)}</div>
    {restoreId && <div className="inline-confirm" role="group" aria-label="Confirmar restauração da fonte"><p>Restaurar esses dados como uma nova versão? Os dashboards passarão a consultar essa versão da fonte.</p><div className="form-actions"><button className="button secondary" onClick={() => setRestoreId('')} disabled={pending}>Cancelar</button><button className="button primary" onClick={() => { void commit(restoreId); }} disabled={pending}>Confirmar restauração</button></div></div>}
    {notice && <p role="status" className="operation-notice">{notice}</p>}{error && <ErrorMessage message={error} retry={completed ? () => { void commit(); } : undefined} retryLabel="Atualizar tela" />}
  </section>;
}
