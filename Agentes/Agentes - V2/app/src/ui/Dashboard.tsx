'use client';

import { useId, useState } from 'react';
import { BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, Legend, ReferenceLine } from 'recharts';
import { ArrowDown, ArrowUp, ChevronDown, Download, Info, ListFilter, X } from 'lucide-react';
import { analysisSource, calculate, displayCell, fieldLabel, filterValues, formatValue, groupValues, includedRows, planFilters } from '@/core/engine';
import type { Plan, Source } from '@/core/types';
import { Select } from './Select';
import { Explanation } from './Explanation';
import { AnalysisControls } from './AnalysisControls';
import { AnalysisDetails } from './AnalysisDetails';
import { ExecutiveActions } from './ExecutiveActions';

function Chart({ source, plan, trend = false }: { source: Source; plan: Plan; trend?: boolean }) {
  const valuesId = useId();
  const metric = source.metrics.find(m => m.key === plan.primaryMetric)!;
  const secondary = source.metrics.find(m => m.key === plan.secondaryMetric);
  const rows = groupValues(source, plan, trend ? plan.dateColumn! : plan.groupBy);
  const data = trend ? rows : rows.slice(0, 12);
  const dates = rows.map(row => row.name).filter(name => /^\d{4}-\d{2}$/.test(name));
  const multipleYears = new Set(dates.map(name => name.slice(0, 4))).size > 1;
  const periodLabel = (name: string, year = true) => /^\d{4}-\d{2}$/.test(name)
    ? new Intl.DateTimeFormat('pt-BR', { month: 'short', ...(year ? { year: 'numeric' as const } : {}), timeZone: 'UTC' }).format(new Date(name + '-01T00:00:00Z')) : name;
  const chartLabel = trend ? 'Evolução no tempo' : 'Comparação por ' + fieldLabel(source, plan.groupBy);
  const common = <>
    <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 3" />
    <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} tickLine={false} axisLine={false} interval="preserveStartEnd" tickFormatter={name => trend ? periodLabel(String(name), multipleYears) : name} />
    <YAxis width={72} tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} tickLine={false} axisLine={false} tickFormatter={value => formatValue(value, metric, true)} />
    <Tooltip labelFormatter={name => trend ? periodLabel(String(name)) : name} formatter={(value, name) => [formatValue(value == null ? null : Number(value), name === metric.label ? metric : secondary), name]} contentStyle={{ border: '1px solid var(--line)', borderRadius: 4, fontSize: 13 }} />
    {secondary && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />}
    <ReferenceLine y={0} stroke="var(--line)" />
  </>;
  return <div className="data-chart">
    {trend && dates.length > 0 && <p className="chart-range">{periodLabel(dates[0])}{dates.length > 1 ? ' a ' + periodLabel(dates[dates.length - 1]) : ''}</p>}
    <div role="img" aria-label={chartLabel} aria-describedby={valuesId + '-hint'}>
    <ResponsiveContainer width="100%" height={300} minWidth={0}>
      {trend ? <LineChart data={data} margin={{ top: 16, right: 16, left: 0, bottom: 8 }}>{common}<Line isAnimationActive={false} type="monotone" dataKey="value" name={metric.label} stroke="var(--primary)" strokeWidth={2.5} dot={{ r: 3 }} connectNulls={false} />{secondary && <Line isAnimationActive={false} dataKey="comparison" name={secondary.label} stroke="var(--slate-blue)" strokeDasharray="5 4" dot={false} />}</LineChart>
        : <BarChart data={data} margin={{ top: 16, right: 16, left: 0, bottom: 8 }}>{common}<Bar isAnimationActive={false} dataKey="value" name={metric.label} fill="var(--primary)" radius={[3, 3, 0, 0]} maxBarSize={44} />{secondary && <Bar isAnimationActive={false} dataKey="comparison" name={secondary.label} fill="var(--comparison)" radius={[3, 3, 0, 0]} maxBarSize={44} />}</BarChart>}
    </ResponsiveContainer></div>
    <p className="chart-values-hint" id={valuesId + '-hint'}>Os valores deste gráfico estão disponíveis em “Ver valores” abaixo.</p>
    <details className="chart-values" id={valuesId}><summary>Ver valores — {chartLabel.toLowerCase()}</summary>
      <div className="table-scroll" role="region" aria-label={'Valores de ' + chartLabel.toLowerCase()} tabIndex={0}><table>
        <caption>{chartLabel}{!trend && rows.length > 12 ? ' — 12 maiores grupos exibidos' : ''}</caption>
        <thead><tr><th scope="col">{trend ? 'Período' : fieldLabel(source, plan.groupBy)}</th><th scope="col">{metric.label}</th>{secondary && <th scope="col">{secondary.label}</th>}</tr></thead>
        <tbody>{data.map(row => <tr key={row.name}><th scope="row">{trend ? periodLabel(row.name) : row.name}</th><td>{formatValue(row.value, metric)}</td>{secondary && <td>{formatValue(row.comparison, secondary)}</td>}</tr>)}</tbody>
      </table></div>
    </details>
    {!trend && rows.length > 12 && <small>Os 12 maiores grupos aparecem no gráfico. O total considera todos os grupos.</small>}
    {trend && rows.length < 2 && <small>Há um único período neste recorte. Escolha “Todos” no filtro de período para acompanhar a evolução.</small>}
  </div>;
}

function Results({ source, plan }: { source: Source; plan: Plan }) {
  const [ascending, setAscending] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const metric = source.metrics.find(m => m.key === plan.primaryMetric)!;
  const comparison = source.metrics.find(m => m.key === plan.secondaryMetric);
  const rows = groupValues(source, plan).sort((a, b) => ascending ? (a.value ?? Infinity) - (b.value ?? Infinity) : (b.value ?? -Infinity) - (a.value ?? -Infinity));
  const totalRows = includedRows(source, planFilters(plan));
  return <section className="results-section"><div className="section-heading"><h3>Quais grupos compõem o resultado?</h3><span>{rows.length} grupos</span></div>
    <div className="table-scroll"><table className="results-table"><thead><tr><th scope="col">{fieldLabel(source, plan.groupBy)}</th><th scope="col" aria-sort={ascending ? 'ascending' : 'descending'}><button onClick={() => setAscending(!ascending)}>{metric.label}{ascending ? <ArrowUp size={14} /> : <ArrowDown size={14} />}</button></th>{comparison && <th scope="col">{comparison.label}</th>}<th scope="col">Registros</th></tr></thead>
      <tbody>{rows.slice(0, 100).map(row => <ResultsRow key={row.name} row={row} source={source} plan={plan} expanded={expanded === row.name} toggle={() => setExpanded(expanded === row.name ? null : row.name)} />)}</tbody>
      <tfoot><tr><th scope="row">Total do recorte</th><td>{formatValue(calculate(metric, totalRows), metric)}</td>{comparison && <td>{formatValue(calculate(comparison, totalRows), comparison)}</td>}<td>{totalRows.length.toLocaleString('pt-BR')}</td></tr></tfoot></table></div>
    {rows.length > 100 && <small>Mostrando 100 grupos. O total e a exportação incluem todos os grupos.</small>}
  </section>;
}

function ResultsRow({ row, source, plan, expanded, toggle }: { row: ReturnType<typeof groupValues>[number]; source: Source; plan: Plan; expanded: boolean; toggle: () => void }) {
  const metric = source.metrics.find(m => m.key === plan.primaryMetric)!;
  const comparison = source.metrics.find(m => m.key === plan.secondaryMetric);
  const colspan = comparison ? 4 : 3;
  return <><tr><th scope="row"><button className="row-detail" aria-expanded={expanded} onClick={toggle}><ChevronDown size={14} className={expanded ? 'rotate' : ''} />{row.name}</button></th><td>{formatValue(row.value, metric)}</td>{comparison && <td>{formatValue(row.comparison, comparison)}</td>}<td>{row.count.toLocaleString('pt-BR')}</td></tr>
    {expanded && <tr><td colSpan={colspan}><div className="row-explanation"><strong>{row.name}</strong><p>{row.count} registros compõem este grupo, depois dos critérios e filtros.</p><p>{metric.operation === 'average' ? 'Média' : metric.operation === 'count' ? 'Contagem' : 'Soma'} de {fieldLabel(source, metric.key).toLowerCase()}: {formatValue(row.value, metric)}.</p>{comparison && row.value != null && row.comparison != null && <p>Diferença em relação ao orçamento: {formatValue(row.value - row.comparison, metric)}.</p>}</div></td></tr>}</>;
}

export function exportDashboard(source: Source, plan: Plan) {
  const safe = (value: string) => `"${(/^\s*[=+@-]/.test(value) ? "'" + value : value).replace(/"/g, '""')}"`;
  const metric = source.metrics.find(m => m.key === plan.primaryMetric)!;
  const comparison = source.metrics.find(m => m.key === plan.secondaryMetric);
  const rows = groupValues(source, plan);
  const records = [[fieldLabel(source, plan.groupBy), metric.label, ...(comparison ? [comparison.label] : []), 'Registros'],
    ...rows.map(row => [row.name, String(row.value ?? ''), ...(comparison ? [String(row.comparison ?? '')] : []), String(row.count)])];
  const url = URL.createObjectURL(new Blob(['\uFEFF' + records.map(row => row.map(safe).join(';')).join('\n')], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = `${plan.title.replace(/[^\p{L}\p{N} -]/gu, '') || 'dashboard'}.csv`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function Dashboard({ source, plan, onPlan, preview = false, savedFilters, savedFilterSelections }: { source: Source; plan: Plan; onPlan: (plan: Plan) => void; preview?: boolean; savedFilters?: Plan['filters']; savedFilterSelections?: Plan['filterSelections'] }) {
  const [explain, setExplain] = useState<string | null>(null);
  const originalSource = source;
  source = analysisSource(source, plan);
  const consultationChanged = savedFilters !== undefined && (Object.keys(savedFilters).length !== Object.keys(plan.filters).length || Object.entries(savedFilters).some(([key, value]) => plan.filters[key] !== value) || JSON.stringify(savedFilterSelections || {}) !== JSON.stringify(plan.filterSelections || {}));
  const rows = includedRows(source, planFilters(plan));
  const primary = source.metrics.find(m => m.key === plan.primaryMetric)!;
  const secondary = source.metrics.find(m => m.key === plan.secondaryMetric);
  const total = calculate(primary, rows);
  const budget = secondary ? calculate(secondary, rows) : null;
  const deviation = total != null && budget != null ? total - budget : null;
  const dimensionKeys = [...new Set([source.dateColumn, plan.groupBy, ...Object.keys(plan.filters), ...Object.keys(plan.filterSelections || {})].filter((key): key is string => !!key))];
  const setFilter = (key: string, value: string) => {
    const filters = { ...plan.filters }; if (value === '__all__') delete filters[key]; else filters[key] = value;
    const filterSelections = { ...plan.filterSelections }; delete filterSelections[key];
    onPlan({ ...plan, filters, filterSelections });
  };
  return <div className="dashboard-body">
    <div className="dashboard-context"><span>{source.origin === 'sap-demo' ? 'SAP · demonstração' : source.origin === 'sap' ? 'SAP · leitura' : 'Arquivo importado'}</span><span>{source.name}</span><span>{rows.length.toLocaleString('pt-BR')} registros no recorte</span>{!preview && <button className="text-button" onClick={() => exportDashboard(source, plan)}><Download size={15} />Exportar valores</button>}</div>
    {savedFilters && <div className="consultation-state"><p role="status">{consultationChanged ? 'Recorte alterado nesta consulta. A exportação usa estes filtros; o dashboard salvo permanece igual.' : 'Recorte salvo. Alterar os filtros afeta somente esta consulta e sua exportação.'}</p>{consultationChanged && <button className="text-button" onClick={() => onPlan({ ...plan, filters: { ...savedFilters }, filterSelections: { ...savedFilterSelections } })}>Restaurar recorte salvo</button>}</div>}
    <div className="dashboard-filters" aria-label="Filtros do dashboard">{dimensionKeys.map(key => <Select key={key} label={fieldLabel(source, key)} value={plan.filterSelections?.[key] ? '__multiple__' : plan.filters[key] || '__all__'} onChange={value => { if (value !== '__multiple__') setFilter(key, value); }} options={[{ value: '__all__', label: 'Todos' }, ...(plan.filterSelections?.[key] ? [{ value: '__multiple__', label: `${plan.filterSelections[key].length} valores selecionados` }] : []), ...filterValues(source, key).map(value => ({ value, label: displayCell(source, key, value) }))]} />)}</div>
    {Object.keys(planFilters(plan)).length > 0 && <div className="filter-summary"><ListFilter size={15} /><span>Recorte:</span>{Object.entries(planFilters(plan)).map(([key, value]) => { const label = (Array.isArray(value) ? value : [value]).map(item => displayCell(source, key, item)).join(', '); return <button key={key} onClick={() => setFilter(key, '__all__')} aria-label={`Remover filtro ${fieldLabel(source, key)}: ${label}`}>{fieldLabel(source, key)}: {label}<X size={12} /></button>; })}<button className="text-button" onClick={() => onPlan({ ...plan, filters: {}, filterSelections: {} })}>Limpar filtros</button></div>}
    <AnalysisControls source={originalSource} plan={plan} onPlan={onPlan} />
    {!rows.length ? <div className="empty-state"><h3>Nenhum registro neste recorte</h3><p>Tente outro período ou grupo. Os critérios da fonte continuam valendo.</p><button className="button secondary" onClick={() => onPlan({ ...plan, filters: {}, filterSelections: {} })}>Limpar filtros</button></div> : <>
      <div className={`indicators ${secondary ? 'has-budget' : ''}`}><button className="indicator" onClick={() => setExplain(explain === primary.key ? null : primary.key)} aria-expanded={explain === primary.key}><span>{primary.label}<Info size={14} /></span><strong>{formatValue(total, primary)}</strong><small>Ver cálculo e origem</small></button>
        {secondary && <><button className="indicator" onClick={() => setExplain(explain === secondary.key ? null : secondary.key)} aria-expanded={explain === secondary.key}><span>{secondary.label}<Info size={14} /></span><strong>{formatValue(budget, secondary)}</strong><small>Ver cálculo e origem</small></button><button className="indicator" onClick={() => setExplain(explain === 'all' ? null : 'all')} aria-expanded={explain === 'all'}><span>Desvio do orçamento<Info size={14} /></span><strong className={deviation != null && deviation > 0 ? 'text-warning' : ''}>{formatValue(deviation, primary)}</strong><small>{deviation == null ? 'Sem valores para comparar' : deviation > 0 ? 'Acima do orçamento' : deviation < 0 ? 'Abaixo do orçamento' : 'Dentro do orçamento'}</small></button></>}
      </div>
      <AnalysisDetails source={source} plan={plan} onPlan={onPlan} />
      {explain && <Explanation source={source} plan={plan} selected={explain === 'all' ? undefined : explain} />}
      <div className={`chart-grid ${plan.dateColumn ? '' : 'single-chart'}`}><section className="chart-panel"><div className="section-heading"><h3>{plan.chart === 'line' ? 'Como mudou ao longo do tempo?' : 'Onde estão os maiores valores?'}</h3><span>{plan.chart === 'line' ? primary.label : `${primary.label} por ${fieldLabel(source, plan.groupBy).toLowerCase()}`}</span></div><Chart source={source} plan={plan} trend={plan.chart === 'line'} /></section>
        {plan.dateColumn && <section className="chart-panel"><div className="section-heading"><h3>{plan.chart === 'line' ? `Como ${primary.label.toLowerCase()} se distribui?` : 'Como mudou ao longo do tempo?'}</h3><span>{plan.chart === 'line' ? `Por ${fieldLabel(source, plan.groupBy).toLowerCase()}` : primary.label}</span></div><Chart source={source} plan={plan} trend={plan.chart !== 'line'} /></section>}</div>
      {plan.displayTable && <Results source={source} plan={plan} />}
    </>}

    <details className="rules-details"><summary>Critérios e origem dos números <Info size={16} /></summary><Explanation source={source} plan={plan} /></details>
    {!preview && <ExecutiveActions source={source} plan={plan} />}
  </div>;
}
