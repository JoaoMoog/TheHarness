'use client';
import { useState } from 'react';
import type { Plan, Source } from '@/core/types';
import { executiveReportHtml, contextualCsv } from '@/core/executive-export';

export function downloadAnalysis(content: string, title: string, extension: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a'); link.href = url; link.download = `${title.replace(/[^\p{L}\p{N} -]/gu, '') || 'analise'}.${extension}`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function ExecutiveActions({ source, plan }: { source: Source; plan: Plan }) {
  const [preview, setPreview] = useState<{ html: string; title: string; presentation: boolean } | null>(null);
  function prepare(presentation: boolean) { setPreview({ html: executiveReportHtml(source, plan, presentation), title: plan.title, presentation }); }
  return <section className="executive-export"><h3>Levar esta análise</h3><p>Confira fonte, recorte e cálculos antes de baixar. O HTML abre no navegador e pode ser impresso ou salvo como PDF.</p><div className="executive-actions"><button className="button secondary" onClick={() => prepare(false)}>Conferir relatório executivo</button><button className="button secondary" onClick={() => prepare(true)}>Conferir apresentação</button><button className="text-button" onClick={() => downloadAnalysis(contextualCsv(source, plan), plan.title + ' - contexto', 'csv', 'text/csv;charset=utf-8')}>Exportar CSV com contexto</button></div>{preview && <div className="executive-preview"><h4>Prévia {preview.presentation ? 'da apresentação' : 'do relatório'}</h4><p>Esta prévia preserva o recorte do momento em que foi preparada. Para refletir novos ajustes, prepare novamente.</p><iframe title={preview.presentation ? 'Prévia da apresentação' : 'Prévia do relatório executivo'} srcDoc={preview.html} sandbox="" /><div className="executive-actions"><button className="button primary" onClick={() => downloadAnalysis(preview.html, preview.title + (preview.presentation ? ' - apresentação' : ' - relatório'), 'html', 'text/html;charset=utf-8')}>{preview.presentation ? 'Baixar apresentação HTML conferida' : 'Baixar relatório conferido'}</button><button className="text-button" onClick={() => setPreview(null)}>Fechar prévia</button></div><p>No arquivo baixado, use “Imprimir / Salvar PDF” para gerar o PDF.</p></div>}</section>;
}
