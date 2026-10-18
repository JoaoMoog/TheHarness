'use client';

import {inputLimits} from '@/core/inputLimits';

import { useState } from 'react';
import type { Column, Metric, Plan, Source } from '@/core/types';
import { analysisSource, displayCell, filterValues } from '@/core/engine';
import { validatePlan } from '@/core/planner';
import { compileExpression } from '@/core/expression';
import { Select } from './Select';
import { ErrorMessage } from './shared';
import './analysis.css';

function MultipleValues({ source, column, selected, change }: { source: Source; column: Column; selected: string[]; change: (values: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const values = open ? filterValues(source, column.key).filter(value => displayCell(source, column.key, value).toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR'))) : [];
  return <details className="analysis-selection" onToggle={event => setOpen(event.currentTarget.open)}><summary>{column.label}{selected.length ? ` · ${selected.length} selecionados` : ''}</summary>{open && <><label className="field">Buscar em {column.label.toLowerCase()}<input maxLength={inputLimits.search} value={query} onChange={event => setQuery(event.target.value)} /></label>{selected.length > 0 && <button className="text-button" onClick={() => change([])}>Limpar seleção de {column.label.toLowerCase()}</button>}<fieldset className="analysis-checks"><legend>{column.label}</legend>{values.slice(0, 100).map(value => <label key={value}><input type="checkbox" checked={selected.includes(value)} onChange={event => change(event.target.checked ? [...selected, value] : selected.filter(item => item !== value))} />{displayCell(source, column.key, value)}</label>)}</fieldset>{values.length > 100 && <p>Mostrando 100 de {values.length} valores. Use a busca para localizar outros.</p>}{!values.length && <p>Nenhum valor com esse nome.</p>}</>}</details>;
}

export function AnalysisControls({ source, plan, onPlan }: { source: Source; plan: Plan; onPlan: (plan: Plan) => void }) {
  const [label, setLabel] = useState('');
  const [expression, setExpression] = useState('');
  const [operation, setOperation] = useState('sum');
  const [unit, setUnit] = useState('number');
  const [error, setError] = useState('');
  const [current, setCurrent] = useState(plan.periodComparison?.current || '');
  const [previous, setPrevious] = useState(plan.periodComparison?.previous || '');
  const metrics = analysisSource(source, plan).metrics;
  const periods = source.dateColumn ? filterValues(source, source.dateColumn) : [];
  function apply(next: Plan) { try { validatePlan({ ...next, message: next.message || 'Configuração conferida.' }, source); setError(''); onPlan(next); } catch (e) { setError(e instanceof Error ? e.message : 'Confira as opções.'); } }
  function addMetric() {
    try {
      compileExpression(expression, source.columns.filter(column => column.type === 'number').map(column => column.key));
      if (!label.trim()) throw new Error('Dê um nome ao indicador.');
      const metric: Metric & { expression: string } = { key: `calc_${crypto.randomUUID().replaceAll('-', '')}`, label: label.trim(), expression, unit: unit as Metric['unit'], operation: operation as Metric['operation'] };
      const next = { ...plan, calculatedMetrics: [...(plan.calculatedMetrics || []), metric], selectedMetrics: [...(plan.selectedMetrics || []), metric.key] };
      validatePlan({ ...next, message: next.message || 'Indicador calculado adicionado.' }, source);
      apply(next); setLabel(''); setExpression('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Confira a fórmula.'); }
  }
  return <details className="analysis-controls"><summary>Configurar indicadores, comparação e seleções</summary>
    <div className="analysis-controls-body">
      <section><h3>Indicadores</h3><Select label="Indicador principal" value={plan.primaryMetric} options={metrics.map(metric => ({ value: metric.key, label: metric.label }))} onChange={key => apply({ ...plan, primaryMetric: key, secondaryMetric: key === source.primaryMetric ? source.budgetMetric || null : null })} />
        <fieldset className="analysis-checks"><legend>Mostrar também</legend>{metrics.filter(metric => metric.key !== plan.primaryMetric && metric.key !== plan.secondaryMetric).map(metric => <label key={metric.key}><input type="checkbox" checked={plan.selectedMetrics?.includes(metric.key) || false} onChange={event => apply({ ...plan, selectedMetrics: event.target.checked ? [...(plan.selectedMetrics || []), metric.key] : plan.selectedMetrics?.filter(key => key !== metric.key) })} />{metric.label}</label>)}</fieldset>
        <Select label="Separar os resultados por" value={plan.groupBy} options={source.columns.filter(column => column.type !== 'number').map(column => ({ value: column.key, label: column.label }))} onChange={groupBy => apply({ ...plan, groupBy })} />
      </section>
      <section><h3>Selecionar vários valores</h3><p>Os valores do mesmo campo são combinados. Campos diferentes restringem o recorte juntos.</p>{source.columns.filter(column => column.type !== 'number').map(column => <MultipleValues key={column.key} source={source} column={column} selected={plan.filterSelections?.[column.key] || []} change={values => { const selections = { ...plan.filterSelections }; if (values.length) selections[column.key] = values; else delete selections[column.key]; const filters = { ...plan.filters }; delete filters[column.key]; apply({ ...plan, filters, filterSelections: selections }); }} />)}</section>
      {source.dateColumn && <section><h3>Comparar períodos</h3><p>A comparação preserva os outros filtros e substitui o filtro de data pelos dois períodos escolhidos.</p><Select label="Período atual" value={current} options={periods.map(value => ({ value, label: displayCell(source, source.dateColumn!, value) }))} onChange={setCurrent} /><Select label="Período de referência" value={previous} options={periods.map(value => ({ value, label: displayCell(source, source.dateColumn!, value) }))} onChange={setPrevious} /><div className="analysis-actions"><button className="button secondary" disabled={!current || !previous} onClick={() => apply({ ...plan, periodComparison: { dateColumn: source.dateColumn!, current, previous } })}>Comparar períodos</button>{plan.periodComparison && <button className="text-button" onClick={() => apply({ ...plan, periodComparison: undefined })}>Remover comparação</button>}</div></section>}
      <section><h3>Criar indicador calculado</h3><p>A fórmula é aplicada em cada registro; depois somamos ou calculamos a média dos resultados. Vazios e divisões por zero são excluídos e sinalizados.</p><form onSubmit={event => { event.preventDefault(); addMetric(); }}><label className="field">Nome do indicador<input value={label} maxLength={80} onChange={event => setLabel(event.target.value)} required /></label><label className="field">Fórmula<input value={expression} maxLength={500} onChange={event => setExpression(event.target.value)} placeholder="Ex.: [valor] - [custo]" required /></label><div className="formula-fields">{source.columns.filter(column => column.type === 'number').map(column => <button type="button" className="text-button" key={column.key} disabled={expression.length + column.key.length + 2 > 500} onClick={() => setExpression(value => `${value}[${column.key}]`)}>{column.label} [{column.key}]</button>)}</div><Select label="Como agregar os resultados?" value={operation} onChange={setOperation} options={[{ value: 'sum', label: 'Somar resultados' }, { value: 'average', label: 'Média dos resultados por registro' }]} /><Select label="Unidade do resultado" value={unit} onChange={setUnit} options={[{ value: 'number', label: 'Número' }, { value: 'BRL', label: 'Reais (R$)' }]} /><button className="button secondary" type="submit" disabled={!label.trim() || !expression.trim()}>Adicionar indicador</button></form>
        {(plan.calculatedMetrics || []).map(metric => <p key={metric.key}><strong>{metric.label}</strong>: {metric.expression} <button className="text-button" disabled={plan.primaryMetric === metric.key} onClick={() => apply({ ...plan, calculatedMetrics: plan.calculatedMetrics?.filter(item => item.key !== metric.key), selectedMetrics: plan.selectedMetrics?.filter(key => key !== metric.key) })}>Remover {metric.label}</button></p>)}
      </section>
      {error && <ErrorMessage message={error} />}
    </div>
  </details>;
}
