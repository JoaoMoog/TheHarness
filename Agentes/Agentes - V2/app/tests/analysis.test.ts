import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compileExpression } from '../src/core/expression';
import { analysisSource, basePlan, calculate, groupValues, includedRows, planFilters } from '../src/core/engine';
import { budgetExceptions, comparePeriods, describePlanChanges, sourceQuality } from '../src/core/analysis';
import { demoPlan, validatePlan } from '../src/core/planner';
import { contextualCsv, executiveReportHtml } from '../src/core/executive-export';
import type { Source } from '../src/core/types';
import { sapSource } from '../src/server/seed';

const source: Source = { id: 's', owner: 'u', name: 'Vendas', origin: 'file', domain: 'sales', columns: [{ key: 'date', label: 'Data', type: 'date' }, { key: 'region', label: 'Região', type: 'text' }, { key: 'revenue', label: 'Receita', type: 'number' }, { key: 'cost', label: 'Custo', type: 'number' }], rows: [{ date: '2026-01', region: 'Sul', revenue: 100, cost: 20 }, { date: '2026-02', region: 'Sul', revenue: 180, cost: 30 }, { date: '2026-02', region: 'Norte', revenue: 50, cost: 0 }, { date: '2026-02', region: 'Leste', revenue: null, cost: 10 }], metrics: [{ key: 'revenue', label: 'Receita', unit: 'BRL', operation: 'sum' }], primaryMetric: 'revenue', groupBy: 'region', dateColumn: 'date', revision: 1, createdAt: '2026-01-01' };
const plan = () => ({ ...basePlan(source), message: 'Confira os dados.' });

test('fórmulas respeitam precedência, sinais, vazios e divisão por zero sem executar código', () => {
  assert.equal(compileExpression('([revenue] - [cost]) * 2', ['revenue', 'cost']).evaluate(source.rows[0]), 160);
  assert.equal(compileExpression('-2 + 3 * 4').evaluate({}), 10);
  assert.equal(compileExpression('[revenue]/[cost]').evaluate(source.rows[2]), null);
  assert.equal(compileExpression('[revenue]+2').evaluate(source.rows[3]), null);
  for (const expression of ['process.exit()', '[revenue];alert(1)', 'constructor.constructor(1)', '[missing]+1', '1e309', '2**3', '1+']) assert.throws(() => compileExpression(expression, ['revenue']));
  assert.throws(() => compileExpression('9'.repeat(400)), /finitos/);
});

test('métrica calculada agrega por registro e preserva média ponderada por registros', () => {
  const metric = { key: 'calc_margin', label: 'Margem', expression: '[revenue]-[cost]', operation: 'average' as const, unit: 'BRL' as const };
  assert.equal(calculate(metric, source.rows), 280 / 3);
  const next = validatePlan({ ...plan(), primaryMetric: metric.key, calculatedMetrics: [metric] }, source);
  assert.equal(analysisSource(source, next).metrics.length, 2);
  assert.deepEqual(groupValues(source, next).map(group => group.value), [115, 50, null]);
  assert.throws(() => validatePlan({ ...next, calculatedMetrics: [{ ...metric, expression: '[region]*2' }] }, source), /numérico/);
});

test('agregações não exibem infinito quando números finitos excedem o limite numérico', () => {
  const rows = [{ revenue: Number.MAX_VALUE }, { revenue: Number.MAX_VALUE }];
  assert.equal(calculate(source.metrics[0], rows), null);
  assert.equal(calculate({ ...source.metrics[0], operation: 'average' }, rows), null);
  assert.equal(calculate({ ...source.metrics[0], expression: '[revenue]' }, rows), null);
  assert.equal(calculate(source.metrics[0], [{ revenue: 0 }, { revenue: 12 }]), 12);
});

test('exceções revelam grupo acima do orçamento mesmo quando total está abaixo e preservam recorte', () => {
  const finance = sapSource('finance', 'test');
  const financialPlan = basePlan(finance);
  const primary = finance.metrics.find(metric => metric.key === finance.primaryMetric)!;
  const budget = finance.metrics.find(metric => metric.key === finance.budgetMetric)!;
  assert.ok(calculate(primary, finance.rows)! < calculate(budget, finance.rows)!);
  const exceptions = budgetExceptions(finance, financialPlan);
  assert.ok(exceptions.some(item => item.key === 'group' && item.value === 'Tecnologia' && item.difference > 0 && item.canFilter));
  assert.ok(!budgetExceptions(finance, { ...financialPlan, filters: { group: 'Pessoas' } }).some(item => item.key === 'group' && item.value === 'Tecnologia'));
  assert.ok(executiveReportHtml(finance, financialPlan).includes('Exceções de orçamento'));
});

test('agregação escala para 20 mil registros sem perder grupos ou totais', () => {
  const large = { ...source, rows: Array.from({ length: 20000 }, (_, index) => ({ date: '2026-01', region: index % 2 ? 'Sul' : 'Norte', revenue: 1, cost: 0 })) };
  const groups = groupValues(large, plan());
  assert.deepEqual(groups.map(group => group.value), [10000, 10000]);
  assert.equal(sourceQuality({ ...source, rows: [{ date: '2026-02-31', region: 'Sul', revenue: 1, cost: 0 }] })[0].invalid, 1);
});

test('multisseleção usa OR no campo e AND entre campos; comparação substitui somente datas', () => {
  const next = { ...plan(), filterSelections: { region: ['Sul', 'Norte'], date: ['2026-02'] }, periodComparison: { dateColumn: 'date', current: '2026-02', previous: '2026-01' } };
  assert.equal(includedRows(source, planFilters(next)).length, 2);
  const comparison = comparePeriods(source, validatePlan(next, source))[0];
  assert.equal(comparison.currentValue, 230); assert.equal(comparison.previousValue, 100); assert.equal(comparison.percentage, 130);
  assert.throws(() => validatePlan({ ...next, filterSelections: { region: ['Inexistente'] } }, source), /seleções/);
  assert.throws(() => validatePlan({ ...next, periodComparison: { ...next.periodComparison, previous: '2026' } }, source), /meses/);
});

test('refinamento por conversa substitui e limpa multisseleções sem modificar plano anterior', () => {
  const previous = { ...plan(), filterSelections: { region: ['Sul', 'Norte'], date: ['2026-01'] } };
  const refined = demoPlan('Compare receita no Norte em fevereiro de 2026', source, previous);
  assert.equal(includedRows(source, planFilters(refined)).length, 1);
  assert.equal(calculate(source.metrics[0], includedRows(source, planFilters(refined))), 50);
  assert.deepEqual(previous.filterSelections.region, ['Sul', 'Norte']);
  assert.deepEqual(planFilters(demoPlan('Remova os filtros', source, previous)), {});
  assert.ok(demoPlan('Mostre a evolução', source, previous).message.includes('Sul ou Norte'));
});

test('qualidade e resumo de mudanças informam valores ausentes e alterações reais', () => {
  assert.equal(sourceQuality(source).find(column => column.key === 'revenue')?.missing, 1);
  assert.deepEqual(describePlanChanges(plan(), plan(), source), []);
  assert.equal(describePlanChanges(plan(), { ...plan(), filters: { region: 'Sul' } }, source).length, 1);
});

test('relatório e apresentação escapam conteúdo e preservam contexto; CSV neutraliza fórmulas', () => {
  const next = { ...plan(), title: '<script>alert(1)</script>', filterSelections: { region: ['Sul'] } };
  const html = executiveReportHtml(source, next);
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;')); assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.ok(html.includes('Região: Sul')); assert.ok(html.includes('Revisão') || html.includes('revisão 1'));
  assert.ok(executiveReportHtml(source, next, true).includes('size:landscape'));
  const csv = contextualCsv({ ...source, name: '=SUM(A1)' }, next);
  assert.ok(csv.includes("'=SUM(A1)")); assert.ok(csv.includes('"Registros"')); assert.ok(csv.includes('"280"'));
});
