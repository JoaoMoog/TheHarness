import type { Metric, Plan, Source } from './types';
import { compileExpression } from './expression';

export function includedRows(source: Source, filters: Record<string, string | string[]> = {}) {
  return source.rows.filter(row => (!source.rule || String(row[source.rule.column]) === source.rule.value)
    && Object.entries(filters).every(([key, value]) => (Array.isArray(value) ? value : [value]).some(selected => source.columns.find(c => c.key === key)?.type === 'date'
      ? String(row[key] ?? '').startsWith(selected) : String(row[key]) === selected)));
}

export function planFilters(plan: Plan): Record<string, string | string[]> { return { ...plan.filters, ...plan.filterSelections }; }
export function analysisSource(source: Source, plan: Plan): Source { return { ...source, metrics: [...source.metrics.filter(metric => !plan.calculatedMetrics?.some(item => item.key === metric.key)), ...(plan.calculatedMetrics || [])] }; }

export function calculate(metric: Metric, rows: Source['rows']) {
  if (metric.expression) {
    const formula = compileExpression(metric.expression);
    const values = rows.map(row => formula.evaluate(row)).filter((value): value is number => value != null);
    if (metric.operation === 'count') return values.length;
    if (!values.length) return null;
    const sum = values.reduce((a, b) => a + b, 0);
    const result = metric.operation === 'average' ? sum / values.length : sum;
    return Number.isFinite(result) ? result : null;
  }
  if (metric.operation === 'count') return rows.filter(row => row[metric.key] != null).length;
  const values = rows.map(row => row[metric.key]).filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (!values.length) return null;
  const total = values.reduce((a, b) => a + b, 0);
  const result = metric.operation === 'average' ? total / values.length : total;
  return Number.isFinite(result) ? result : null;
}

export function valuesFor(source: Source, key: string) {
  return [...new Set(source.rows.map(row => row[key]).filter(v => v != null).map(String))].sort();
}

export function filterValues(source: Source, key: string) {
  const values = valuesFor(source, key);
  return source.columns.find(c => c.key === key)?.type === 'date'
    ? [...new Set([...values.map(value => value.slice(0, 4)), ...values.map(value => value.slice(0, 7))])].sort()
    : values;
}

export function groupValues(source: Source, plan: Plan, key = plan.groupBy, filters = planFilters(plan)) {
  source = analysisSource(source, plan);
  const primary = source.metrics.find(m => m.key === plan.primaryMetric)!;
  const secondary = source.metrics.find(m => m.key === plan.secondaryMetric);
  const groups = new Map<string, Source['rows']>();
  for (const row of includedRows(source, filters)) {
    const raw = row[key] == null ? 'Sem informação' : String(row[key]);
    const name = key === plan.dateColumn && /^\d{4}-\d{2}/.test(raw) ? raw.slice(0, 7) : raw;
    const group = groups.get(name);
    if (group) group.push(row); else groups.set(name, [row]);
  }
  return [...groups.entries()].map(([name, rows]) => ({ name, value: calculate(primary, rows), comparison: secondary ? calculate(secondary, rows) : null, count: rows.length }))
    .sort((a, b) => key === plan.dateColumn ? a.name.localeCompare(b.name) : (b.value ?? -Infinity) - (a.value ?? -Infinity));
}

export function formatValue(value: number | null, metric?: Metric, compact = false) {
  if (value == null) return 'Sem valor';
  return new Intl.NumberFormat('pt-BR', {
    ...(metric?.unit === 'BRL' && metric.operation !== 'count' ? { style: 'currency', currency: 'BRL' } : {}),
    minimumFractionDigits: !compact && metric?.unit === 'BRL' && !Number.isInteger(value) ? 2 : 0,
    maximumFractionDigits: metric?.operation === 'count' ? 0 : metric?.unit === 'BRL' ? 2 : 6,
    ...(compact ? { notation: 'compact', maximumFractionDigits: 1 } : {}),
  }).format(value);
}

export function displayCell(source: Pick<Source, 'columns'>, key: string, value: string) {
  if (source.columns.find(c => c.key === key)?.type === 'date' && /^\d{4}$/.test(value)) return `${value} (todo o ano)`;
  if (source.columns.find(c => c.key === key)?.type !== 'date' || !/^\d{4}-\d{2}(?:-\d{2})?$/.test(value)) return value;
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', ...(value.length === 10 ? { day: '2-digit' as const } : {}), timeZone: 'UTC' }).format(new Date(`${value.length === 7 ? value + '-01' : value}T00:00:00Z`));
}

export function fieldLabel(source: Source, key?: string | null) {
  return source.columns.find(c => c.key === key)?.label || key || 'Sem agrupamento';
}

export function calculationText(metric: Metric, source: Source) {
  const operation = metric.operation === 'average' ? 'Média dos valores preenchidos' : metric.operation === 'count' ? 'Contagem dos registros preenchidos' : 'Soma dos valores preenchidos';
  return metric.expression ? `${operation} do resultado de ${metric.expression}, calculado em cada registro. Campos vazios e divisões por zero ficam fora do cálculo.` : `${operation} da coluna “${fieldLabel(source, metric.key)}”. Valores vazios não entram no cálculo.`;
}

export function basePlan(source: Source): Plan {
  return { status: 'ready', title: source.name, message: '', primaryMetric: source.primaryMetric,
    secondaryMetric: source.budgetMetric || null, groupBy: source.groupBy, dateColumn: source.dateColumn || null,
    chart: 'bar', displayTable: true, filters: {} };
}
