'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, FileSpreadsheet, Upload } from 'lucide-react';
import type { ImportPreview, Source } from '@/core/types';
import { api } from './api';
import { Select } from './Select';
import { Busy, ErrorMessage } from './shared';

type Preview = ImportPreview & { quality?: { key: string; label: string; missing: number; invalid: number; valid: number }[] };
export function ImportWizard({ imported, cancel, initialSample }: { imported: (source: Source) => Promise<void>; cancel: () => void; initialSample?: Preview | null }) {
  const [sample, setSample] = useState<Preview | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [completed, setCompleted] = useState<Source | null>(null);
  const [name, setName] = useState('');
  const [metricKey, setMetric] = useState('');
  const [groupBy, setGroup] = useState('');
  const [dateColumn, setDate] = useState('__none__');
  const [budgetMetric, setBudget] = useState('__none__');
  const [unit, setUnit] = useState('number');
  const [operation, setOperation] = useState('sum');
  const [ruleColumn, setRuleColumn] = useState('__none__');
  const [ruleValue, setRuleValue] = useState('');
  const lock = useRef(false);
  const focusTarget = useRef<HTMLInputElement>(null);
  const prepareSample = useCallback((data: Preview) => {
    const numeric = data.columns.find(c => c.type === 'number');
    const group = data.columns.find(c => c.type === 'text') || data.columns.find(c => c.type === 'date') || data.columns[0];
    setName(data.name); setMetric(numeric?.key || data.columns[0].key); setGroup(group.key);
    setOperation(numeric ? 'sum' : 'count'); setDate(data.columns.find(c => c.type === 'date')?.key || '__none__');
    setUnit(numeric && /valor|despesa|custo|receita|orçamento|gasto/i.test(numeric.label) ? 'BRL' : 'number');
    setBudget('__none__'); setRuleColumn('__none__'); setRuleValue(''); setSample(data);
    requestAnimationFrame(() => focusTarget.current?.focus());
  }, []);
  useEffect(() => { if (initialSample) prepareSample(initialSample); }, [initialSample, prepareSample]);

  async function upload(file?: File) {
    if (!file || lock.current) return;
    if (file.size > 8 * 1024 * 1024) { setError('O arquivo deve ter no máximo 8 MB. Divida a planilha e tente novamente.'); return; }
    lock.current = true; setPending(true); setError('');
    try {
      const form = new FormData(); form.set('file', file);
      prepareSample(await api<Preview>('imports/preview', { body: form }));
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível ler esse arquivo.'); }
    finally { lock.current = false; setPending(false); }
  }
  async function confirm() {
    if (!sample || lock.current) return;
    lock.current = true; setPending(true); setError('');
    try {
      const source = completed || await api<Source>('imports/confirm', { body: { uploadId: sample.id, name, metricKey, groupBy,
        dateColumn: dateColumn === '__none__' ? null : dateColumn, budgetMetric: budgetMetric === '__none__' ? null : budgetMetric,
        unit, operation, rule: ruleColumn === '__none__' ? null : { column: ruleColumn, value: ruleValue } } });
      setCompleted(source);
      try { await imported(source); }
      catch { setError('Sua fonte foi importada, mas não foi possível atualizar a tela. Tente atualizar para continuar.'); }
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível importar.'); }
    finally { lock.current = false; setPending(false); }
  }
  const options = sample?.columns.map(c => ({ value: c.key, label: c.label })) || [];
  const numericOptions = sample?.columns.filter(c => c.type === 'number' && c.key !== metricKey && c.key !== groupBy).map(c => ({ value: c.key, label: c.label })) || [];
  const label = (key: string) => sample?.columns.find(column => column.key === key)?.label || key;
  const operationLabel = operation === 'sum' ? 'Somar' : operation === 'average' ? 'Calcular a média de' : 'Contar os registros preenchidos de';
  if (completed) return <section className="import-wizard"><h2>Fonte importada</h2><p>{completed.name} já está disponível. Não é necessário importar novamente.</p>
    {error && <ErrorMessage message={error} />}
    <div className="form-actions"><button className="button secondary" onClick={cancel} disabled={pending}>Voltar aos dados</button><button className="button primary" onClick={() => { void confirm(); }} disabled={pending}>{pending ? <Busy>Atualizando…</Busy> : 'Atualizar tela'}</button></div>
  </section>;
  return <section className="import-wizard">
    <button className="text-button back-link" onClick={cancel} disabled={pending}><ArrowLeft size={16} />Voltar às opções de dados</button>
    {!sample ? <><h2>Traga sua planilha</h2><p>Escolha um arquivo CSV, Excel ou JSON. Primeiro vamos conferir os dados; nada será salvo antes da sua confirmação.</p>
      <label className="upload-area" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); void upload(e.dataTransfer.files[0]); }}>
        <Upload size={28} /><strong>{pending ? 'Conferindo arquivo…' : 'Arraste seu arquivo ou escolha no computador'}</strong><span>CSV, XLSX ou JSON · até 8 MB e 20 mil registros</span><input aria-label="Escolher arquivo para importar" type="file" accept=".csv,.xlsx,.json" disabled={pending} onChange={e => { void upload(e.target.files?.[0]); e.target.value = ''; }} /></label>
      <details className="file-help"><summary>Como preparar o arquivo?</summary><p>Use a primeira linha para os nomes das colunas e uma única aba. Datas podem estar em AAAA-MM, AAAA-MM-DD ou DD/MM/AAAA. Valores podem usar ponto ou vírgula decimal.</p><p>Exemplo: Data, Região, Valor de vendas. Não é necessário um formato específico do SAP.</p></details></>
      : <><div className="import-heading"><FileSpreadsheet size={24} /><div><h2>Vamos entender seus dados</h2><p>{sample.rowCount.toLocaleString('pt-BR')} registros e {sample.columns.length} colunas encontrados.</p></div><button className="text-button" disabled={pending} onClick={() => { setSample(null); setError(''); }}>Trocar arquivo</button></div>
        <form onSubmit={e => { e.preventDefault(); void confirm(); }}>
          <div className="field"><label htmlFor="source-name">Que nome faz sentido para esses dados?</label><input id="source-name" ref={focusTarget} value={name} maxLength={100} required disabled={pending} onChange={e => setName(e.target.value)} placeholder="Ex.: Vendas por região" /></div>
          <div className="import-fields"><Select label="Qual valor você quer analisar?" value={metricKey} options={options} disabled={pending} onChange={value => { setMetric(value); setBudget('__none__'); if (sample.columns.find(c => c.key === value)?.type !== 'number') setOperation('count'); }} />
            <Select label="Como quer separar os valores?" value={groupBy} options={options} disabled={pending} onChange={value => { setGroup(value); if (value === budgetMetric) setBudget('__none__'); }} hint="Ex.: centro de custo, região ou produto." />
            <Select label="Qual coluna representa a data?" value={dateColumn} options={[{ value: '__none__', label: 'Não há datas neste arquivo' }, ...sample.columns.filter(c => c.type === 'date').map(c => ({ value: c.key, label: c.label }))]} disabled={pending} onChange={setDate} />
            <Select label="O que esses valores representam?" value={unit} options={[{ value: 'BRL', label: 'Dinheiro em reais (R$)' }, { value: 'number', label: 'Quantidade ou outro número' }]} disabled={pending || operation === 'count'} onChange={setUnit} />
          </div>
          <details className="import-criteria"><summary>Conferir critérios de cálculo e orçamento</summary><p>Defina a conta com as regras da sua equipe. Não vamos acrescentar uma regra de negócio automaticamente.</p><div className="import-fields">
            <Select label="Como calcular o indicador?" value={operation} disabled={pending} options={[...(sample.columns.find(c => c.key === metricKey)?.type === 'number' ? [{ value: 'sum', label: 'Somar os valores' }, { value: 'average', label: 'Calcular a média' }] : []), { value: 'count', label: 'Contar os registros preenchidos' }]} onChange={value => { setOperation(value); if (value !== 'sum') setBudget('__none__'); }} />
            <Select label="Comparar com qual orçamento?" value={budgetMetric} disabled={pending || operation !== 'sum'} options={[{ value: '__none__', label: 'Sem comparação com orçamento' }, ...numericOptions]} onChange={setBudget} />
            <Select label="Quais registros devem entrar?" value={ruleColumn} disabled={pending} options={[{ value: '__none__', label: 'Todos os registros' }, ...sample.criteriaOptions.map(c => ({ value: c.key, label: `Escolher um valor de ${c.label.toLowerCase()}` }))]} onChange={value => { setRuleColumn(value); setRuleValue(''); }} hint="Ex.: considerar somente documentos contabilizados. Campos com até 200 valores diferentes." />
            {ruleColumn !== '__none__' && <Select label="Qual valor deve contar?" value={ruleValue} disabled={pending} options={(sample.criteriaOptions.find(c => c.key === ruleColumn)?.values || []).map(value => ({ value, label: value }))} onChange={setRuleValue} hint="Somente registros com esse valor entrarão nos indicadores." />}
          </div></details>
          <section className="import-sample"><h3>Confira uma amostra do arquivo</h3><p>As primeiras cinco linhas, antes de aplicar os critérios.</p><div className="table-scroll"><table><thead><tr>{sample.columns.map(c => <th key={c.key} scope="col">{c.label}</th>)}</tr></thead><tbody>{sample.rows.map((row, i) => <tr key={i}>{sample.columns.map(c => <td key={c.key}>{row[c.key] == null ? '—' : String(row[c.key])}</td>)}</tr>)}</tbody></table></div></section>
          <section className="import-summary" aria-label="Resumo do cálculo"><h3>Confira o cálculo antes de importar</h3>
            <p>{operationLabel} <strong>{label(metricKey)}</strong>, por <strong>{label(groupBy)}</strong>, {ruleColumn === '__none__' ? 'considerando todos os registros' : ruleValue ? `considerando somente ${label(ruleColumn)} igual a “${ruleValue}”` : `com critério de ${label(ruleColumn)} ainda por escolher`}.</p>
            <p>Unidade: {operation === 'count' ? 'registros preenchidos' : unit === 'BRL' ? 'reais (R$)' : 'quantidade ou outro número'}. {dateColumn === '__none__' ? 'Sem coluna de datas.' : `Data: ${label(dateColumn)}.`} {budgetMetric === '__none__' ? 'Sem comparação com orçamento.' : `Orçamento: ${label(budgetMetric)}.`}</p>
          </section>
          {sample.quality && <details className="source-quality"><summary>Qualidade dos dados antes da análise</summary><p>Conferência dos {sample.rowCount.toLocaleString('pt-BR')} registros completos, antes dos critérios de cálculo.</p><div className="table-scroll"><table><thead><tr><th scope="col">Coluna</th><th scope="col">Ausentes</th><th scope="col">Inválidos</th><th scope="col">Válidos</th></tr></thead><tbody>{sample.quality.map(column => <tr key={column.key}><th scope="row">{column.label}</th><td>{column.missing}</td><td>{column.invalid}</td><td>{column.valid}</td></tr>)}</tbody></table></div></details>}
          {error && <ErrorMessage message={error} />}
          <div className="form-actions"><button className="button secondary" type="button" onClick={cancel} disabled={pending}>Cancelar</button><button className="button primary" disabled={pending || !metricKey || !groupBy || !name.trim() || (ruleColumn !== '__none__' && !ruleValue)}>{pending ? <Busy>Importando…</Busy> : <>Confirmar e pedir um dashboard<ArrowRight size={16} /></>}</button></div>
        </form></>}
    {!sample && error && <ErrorMessage message={error} />}
  </section>;
}
