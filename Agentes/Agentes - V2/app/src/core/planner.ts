import { z } from 'zod';
import { basePlan, displayCell, fieldLabel, filterValues, planFilters, valuesFor } from './engine';
import type { Plan, Source } from './types';
import { compileExpression } from './expression';
import { analysisSource } from './engine';
const normalized = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export const planSchema = z.object({
  status: z.enum(['ready', 'clarify']), title: z.string().min(1).max(100), message: z.string().min(1).max(2000),
  primaryMetric: z.string(), secondaryMetric: z.string().nullable(), groupBy: z.string(),
  dateColumn: z.string().nullable(), chart: z.enum(['bar', 'line']), displayTable: z.boolean(),
  filters: z.record(z.string(), z.string()),
  filterSelections: z.record(z.string(), z.array(z.string()).min(1).max(200)).optional(),
  selectedMetrics: z.array(z.string()).max(8).optional(),
  calculatedMetrics: z.array(z.object({ key: z.string().regex(/^calc_[a-zA-Z0-9_]+$/), label: z.string().min(1).max(80), unit: z.enum(['BRL', 'number']), operation: z.enum(['sum', 'average', 'count']), expression: z.string().min(1).max(500) }).strict()).max(8).optional(),
  periodComparison: z.object({ dateColumn: z.string(), current: z.string(), previous: z.string() }).strict().optional(),
}).strict();

export function validatePlan(value: unknown, source: Source): Plan {
  const plan = planSchema.parse(value);
  for (const metric of plan.calculatedMetrics || []) {
    if (source.metrics.some(item => item.key === metric.key)) throw new Error('O indicador calculado precisa de uma chave diferente dos indicadores da fonte.');
    compileExpression(metric.expression!, source.columns.filter(column => column.type === 'number').map(column => column.key));
  }
  if (new Set(plan.calculatedMetrics?.map(metric => metric.key)).size !== (plan.calculatedMetrics?.length || 0)) throw new Error('Os indicadores calculados precisam de chaves diferentes.');
  source = analysisSource(source, plan);
  if (plan.selectedMetrics?.some(key => !source.metrics.some(metric => metric.key === key))) throw new Error('Um dos indicadores selecionados não está disponível.');
  for (const [key, values] of Object.entries(plan.filterSelections || {})) {
    if (!source.columns.some(column => column.key === key && column.type !== 'number') || values.some(value => !filterValues(source, key).includes(value))) throw new Error('Uma das seleções não está disponível nesta fonte.');
  }
  if (plan.periodComparison) {
    const { dateColumn, current, previous } = plan.periodComparison;
    if (!source.columns.some(column => column.key === dateColumn && column.type === 'date') || !filterValues(source, dateColumn).includes(current) || !filterValues(source, dateColumn).includes(previous) || current === previous || current.length !== previous.length) throw new Error('Escolha dois meses diferentes ou dois anos diferentes disponíveis para comparar.');
  }
  if (!source.metrics.some(m => m.key === plan.primaryMetric) || (plan.secondaryMetric && !source.metrics.some(m => m.key === plan.secondaryMetric))) throw new Error('O pedido usa um indicador que não existe nesses dados.');
  const metric = source.metrics.find(m => m.key === plan.primaryMetric)!;
  const comparison = source.metrics.find(m => m.key === plan.secondaryMetric);
  if (comparison && (comparison.key !== source.budgetMetric || comparison.key === metric.key || comparison.unit !== metric.unit || comparison.operation !== 'sum' || metric.operation !== 'sum')) throw new Error('A comparação precisa usar o orçamento definido para a fonte e duas somas na mesma unidade.');
  if (!source.columns.some(c => c.key === plan.groupBy && c.type !== 'number')) throw new Error('Escolha uma coluna disponível para separar os valores.');
  if (plan.dateColumn && !source.columns.some(c => c.key === plan.dateColumn && c.type === 'date')) throw new Error('A coluna de datas não está disponível.');
  if (plan.chart === 'line' && !plan.dateColumn) throw new Error('Uma evolução no tempo precisa de uma coluna de datas.');
  for (const [key, value] of Object.entries(plan.filters)) {
    const date = source.columns.find(c => c.key === key)?.type === 'date';
    if (!source.columns.some(c => c.key === key && c.type !== 'number') || !(date ? filterValues(source, key) : valuesFor(source, key)).includes(value)) throw new Error('Esse recorte não existe nos dados.');
  }
  return plan;
}

export function demoPlan(prompt: string, source: Source, previous?: Plan): Plan {
  const text = normalized(prompt);
  const plan = { ...basePlan(source), ...(previous || {}), filters: { ...(previous?.filters || {}) } };
  const selectFilter = (key: string, value: string) => { plan.filters[key] = value; if (plan.filterSelections) { plan.filterSelections = { ...plan.filterSelections }; delete plan.filterSelections[key]; } };
  plan.status = 'ready';
  const unavailable = ['lucro', 'churn', 'inadimplencia', 'nps', 'headcount'].find(term => text.includes(term) && !source.columns.some(c => normalized(c.label).includes(term)));
  const clarify = (message: string): Plan => ({ ...plan, status: 'clarify', message });
  if (unavailable) return clarify(`Não encontrei ${unavailable} nesses dados. Você pode trazer outro arquivo ou analisar ${source.metrics.map(m => m.label.toLowerCase()).join(', ')}. Qual dessas opções faz sentido?`);
  const metric = source.metrics.find(m => text.includes(normalized(m.label)));
  if (metric) { plan.primaryMetric = metric.key; if (plan.secondaryMetric === metric.key) plan.secondaryMetric = null; }
  for (const column of source.columns.filter(c => c.type !== 'number')) {
    if (text.includes(`por ${normalized(column.label)}`)) plan.groupBy = column.key;
    const match = valuesFor(source, column.key).find(value => value.length >= 3 && text.includes(normalized(value)));
    if (match) selectFilter(column.key, match);
  }
  if (/todos os dados|todos os periodos|sem filtros|remova os filtros/.test(text)) { plan.filters = {}; plan.filterSelections = undefined; }
  if (/sem tabela|remov[ae] a tabela/.test(text)) plan.displayTable = false;
  if (/com tabela|inclu[ai] a tabela/.test(text)) plan.displayTable = true;
  if (/linha|evolucao|ao longo do tempo|por mes/.test(text)) {
    if (!source.dateColumn) return clarify('Esses dados não têm uma coluna de datas. Posso comparar os grupos disponíveis ou você pode importar um arquivo com datas.');
    plan.chart = 'line';
    plan.dateColumn = source.dateColumn;
  }
  if (/barras|comparar|compare/.test(text)) plan.chart = 'bar';
  const months = ['janeiro','fevereiro','marco','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  const calendarMonth = text.match(/\b(20\d{2})-(\d{2})(?:-\d{2})?\b/);
  const localMonth = text.match(/\b(\d{2})\/(20\d{2})\b/);
  const month = calendarMonth ? Number(calendarMonth[2]) - 1 : localMonth ? Number(localMonth[1]) - 1 : months.findIndex(m => text.includes(m));
  const year = calendarMonth?.[1] || localMonth?.[2] || text.match(/\b(20\d{2})\b/)?.[1];
  if ((month >= 0 || year) && !source.dateColumn) return clarify('Esses dados não têm datas para selecionar um período. Posso comparar os grupos disponíveis ou você pode trazer um arquivo com datas.');
  if (month >= 0 && source.dateColumn) {
    const available = filterValues(source, source.dateColumn).filter(v => v.length === 7 && v.slice(5, 7) === String(month + 1).padStart(2, '0') && (!year || v.startsWith(year)));
    if (available.length !== 1) {
      if (available.length) selectFilter(source.dateColumn, available[0]);
      return clarify(available.length ? 'Há dados desse mês em mais de um ano. Qual ano você quer analisar?' : 'Esse mês não está disponível nesses dados. Você pode escolher um período na prévia.');
    }
    selectFilter(source.dateColumn, available[0]);
  } else if (year && source.dateColumn) {
    if (!filterValues(source, source.dateColumn).includes(year)) return clarify('Esse ano não está disponível nesses dados. Escolha um período disponível na prévia.');
    const previousMonth = plan.filters[source.dateColumn];
    if (previous?.status === 'clarify' && previous.message.includes('mais de um ano') && previousMonth?.length === 7) {
      const resolved = `${year}-${previousMonth.slice(5)}`;
      if (!filterValues(source, source.dateColumn).includes(resolved)) return clarify('Não há dados desse mês no ano escolhido. Escolha um período disponível na prévia.');
      selectFilter(source.dateColumn, resolved);
    } else selectFilter(source.dateColumn, year);
  }
  const title = prompt.match(/(?:t[ií]tulo\s*:?|chame (?:o dashboard )?de)\s*[“"]?([^”"\n]+)/i)?.[1];
  plan.title = title?.trim().slice(0, 100) || (previous?.title ?? `${source.metrics.find(m => m.key === plan.primaryMetric)?.label} por ${fieldLabel(source, plan.groupBy).toLowerCase()}`);
  const filterText = Object.entries(planFilters(plan)).map(([key, value]) => `${fieldLabel(source, key)}: ${(Array.isArray(value) ? value : [value]).map(item => displayCell(source, key, item)).join(' ou ')}`).join('; ');
  plan.message = `Vou mostrar ${analysisSource(source, plan).metrics.find(m => m.key === plan.primaryMetric)?.label.toLowerCase()} por ${fieldLabel(source, plan.groupBy).toLowerCase()}${plan.chart === 'line' ? ', com a evolução no tempo' : ''}. ${filterText ? `Recorte: ${filterText}.` : 'Vou considerar todos os períodos disponíveis.'} Confira os critérios e a prévia antes de salvar.`;
  return validatePlan(plan, source);
}
