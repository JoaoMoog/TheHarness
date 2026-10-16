import { analysisSource, calculate, fieldLabel, filterValues, groupValues, includedRows, planFilters } from './engine';
import { compileExpression } from './expression';
import type { Plan, Source } from './types';

export function comparePeriods(source: Source, plan: Plan) {
  if (!plan.periodComparison) return [];
  const { dateColumn, current, previous } = plan.periodComparison;
  const metrics = analysisSource(source, plan).metrics.filter(metric => [plan.primaryMetric, ...(plan.selectedMetrics || [])].includes(metric.key));
  const filters = planFilters(plan);
  return metrics.map(metric => {
    const currentValue = calculate(metric, includedRows(source, { ...filters, [dateColumn]: current }));
    const previousValue = calculate(metric, includedRows(source, { ...filters, [dateColumn]: previous }));
    const difference = currentValue == null || previousValue == null ? null : currentValue - previousValue;
    return { metric, currentValue, previousValue, difference, percentage: difference == null || !previousValue ? null : difference / Math.abs(previousValue) * 100 };
  });
}

export function budgetExceptions(source: Source, plan: Plan) {
  const resolved = analysisSource(source, plan);
  const primary = resolved.metrics.find(metric => metric.key === plan.primaryMetric);
  const comparison = resolved.metrics.find(metric => metric.key === plan.secondaryMetric);
  if (!primary || !comparison || comparison.key !== source.budgetMetric || primary.unit !== comparison.unit || primary.operation !== 'sum' || comparison.operation !== 'sum') return [];
  const dimensions = [...new Set([plan.groupBy, plan.dateColumn].filter((key): key is string => !!key))];
  return dimensions.flatMap(key => {
    const available = new Set(filterValues(source, key));
    return groupValues(source, plan, key).flatMap(row => row.value != null && row.comparison != null && row.value > row.comparison
      ? [{ key, value: row.name, actual: row.value, budget: row.comparison, difference: row.value - row.comparison, count: row.count, canFilter: available.has(row.name) }]
      : []);
  }).sort((a, b) => b.difference - a.difference);
}

export function sourceQuality(source: Pick<Source, 'columns' | 'rows'>) {
  return source.columns.map(column => {
    const missing = source.rows.filter(row => row[column.key] == null || row[column.key] === '').length;
    const invalid = source.rows.filter(row => {
      const value = row[column.key];
      if (value == null || value === '') return false;
      if (column.type === 'number') return typeof value !== 'number' || !Number.isFinite(value);
      if (column.type === 'date') { if (typeof value !== 'string' || !/^\d{4}-\d{2}(?:-\d{2})?$/.test(value)) return true; const full = value.length === 7 ? value + '-01' : value; const date = new Date(full + 'T00:00:00Z'); return Number.isNaN(+date) || date.toISOString().slice(0, 10) !== full; }
      return false;
    }).length;
    return { key: column.key, label: column.label, missing, invalid, valid: source.rows.length - missing - invalid };
  });
}

export function analysisExceptions(source: Source, plan: Plan) {
  const resolved = analysisSource(source, plan);
  const rows = includedRows(source, planFilters(plan));
  return resolved.metrics.filter(metric => [plan.primaryMetric, ...(plan.selectedMetrics || [])].includes(metric.key)).map(metric => {
    const formula = metric.expression ? compileExpression(metric.expression) : null;
    const omitted = rows.reduce((sum, row) => sum + (formula ? formula.evaluate(row) == null ? 1 : 0 : row[metric.key] == null || (metric.operation !== 'count' && (typeof row[metric.key] !== 'number' || !Number.isFinite(row[metric.key]))) ? 1 : 0), 0);
    return { metric, omitted, total: rows.length };
  }).filter(item => item.omitted > 0);
}

export function describePlanChanges(previous: Plan, next: Plan, source: Source): string[] {
  const result: string[] = [];
  const metrics = analysisSource(source, next).metrics;
  if (previous.title !== next.title) result.push(`Título: ${previous.title} → ${next.title}`);
  if (previous.primaryMetric !== next.primaryMetric) result.push(`Indicador: ${metrics.find(m => m.key === previous.primaryMetric)?.label || previous.primaryMetric} → ${metrics.find(m => m.key === next.primaryMetric)?.label || next.primaryMetric}`);
  if (previous.groupBy !== next.groupBy) result.push(`Agrupamento: ${fieldLabel(source, previous.groupBy)} → ${fieldLabel(source, next.groupBy)}`);
  if (previous.secondaryMetric !== next.secondaryMetric) result.push(next.secondaryMetric ? 'Comparação com orçamento incluída ou alterada.' : 'Comparação com orçamento removida.');
  if (previous.dateColumn !== next.dateColumn) result.push(`Data da análise: ${fieldLabel(source, next.dateColumn)}`);
  if (JSON.stringify(planFilters(previous)) !== JSON.stringify(planFilters(next))) result.push('O recorte de dados foi alterado. Confira as seleções nos filtros.');
  if (previous.chart !== next.chart) result.push(`Gráfico principal: ${next.chart === 'line' ? 'evolução no tempo' : 'comparação por grupo'}`);
  if (JSON.stringify(previous.selectedMetrics) !== JSON.stringify(next.selectedMetrics)) result.push('A lista de indicadores adicionais foi alterada.');
  if (JSON.stringify(previous.calculatedMetrics) !== JSON.stringify(next.calculatedMetrics)) result.push('As fórmulas dos indicadores calculados foram alteradas.');
  if (JSON.stringify(previous.periodComparison) !== JSON.stringify(next.periodComparison)) result.push('A comparação entre períodos foi alterada.');
  if (previous.displayTable !== next.displayTable) result.push(next.displayTable ? 'Tabela de detalhes incluída.' : 'Tabela de detalhes recolhida.');
  return result;
}
