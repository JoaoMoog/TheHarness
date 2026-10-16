import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFile } from '../src/core/import';
import { basePlan, calculate, displayCell, formatValue, groupValues, includedRows } from '../src/core/engine';
import { demoPlan, validatePlan } from '../src/core/planner';
import { importedSource, importSchema } from '../src/server/import';
import { sapSource } from '../src/server/seed';

const bytes = (text: string) => new TextEncoder().encode(text);
const finance = () => sapSource('finance', 'test-user');
const imported = (text: string, settings = {}) => {
  const upload = { ...parseFile(bytes(text), 'vendas.csv'), id: crypto.randomUUID(), owner: 'test', expiresAt: new Date(Date.now() + 10000).toISOString() };
  return importedSource(upload, importSchema.parse({ uploadId: upload.id, name: 'Vendas regionais', metricKey: 'field2', groupBy: 'field1', dateColumn: 'field0', budgetMetric: null, unit: 'BRL', operation: 'sum', rule: null, ...settings }));
};

test('importa CSV brasileiro, datas e números sem perder identificadores', () => {
  const parsed = parseFile(bytes('Data;Região;Valor;Código\n01/09/2026;Sul;1.200,50;0012\n02/09/2026;Sudeste;-40,25;0013'), 'vendas.csv');
  assert.equal(parsed.columns[0].type, 'date');
  assert.equal(parsed.columns[1].label, 'Região');
  assert.equal(parsed.columns[3].label, 'Código');
  assert.equal(parsed.rows[0].field0, '2026-09-01');
  assert.equal(parsed.rows[0].field2, 1200.5);
  assert.equal(parsed.rows[1].field2, -40.25);
  assert.equal(parsed.rows[0].field3, '0012');
});

test('CSV preserva acentos em UTF-8, BOM e exportação legada do Excel', () => {
  const text = 'Região;Valor\nSão Paulo;10';
  for (const content of [bytes(text), bytes(`\uFEFF${text}`), Uint8Array.from([...text].map(c => c.charCodeAt(0)))]) {
    const parsed = parseFile(content, 'acentos.csv');
    assert.equal(parsed.columns[0].label, 'Região');
    assert.equal(parsed.rows[0].field0, 'São Paulo');
  }
});

test('rejeita datas inválidas, cabeçalhos duplicados e arquivos vazios', () => {
  assert.throws(() => parseFile(bytes('Data,Valor\n31/02/2026,10'), 'x.csv'), /não é válida/);
  assert.throws(() => parseFile(bytes('Valor,valor\n1,2'), 'x.csv'), /mesmo nome/);
  assert.throws(() => parseFile(bytes('Data,Valor'), 'x.csv'), /vazio/);
  assert.throws(() => parseFile(bytes('x'), 'arquivo.exe'), /CSV/);
});

test('JSON aceita colunas arbitrárias e mantém números negativos e valores ausentes', () => {
  const parsed = parseFile(bytes(JSON.stringify([{ região: 'Sul', margem: -20 }, { região: 'Norte', margem: null }])), 'margens.json');
  assert.equal(parsed.rows[0].field1, -20);
  assert.equal(parsed.rows[1].field1, null);
});

test('fontes inteiramente numéricas ganham agrupamento por registro', () => {
  const sample = parseFile(bytes('Quantidade\n10\n20'), 'estoque.csv');
  assert.equal(sample.columns.at(-1)?.label, 'Registro');
  assert.equal(sample.rows[1].record, '2');
});

test('regra da empresa e filtros selecionam apenas os registros definidos', () => {
  const source = imported('Data,Região,Valor,Status\n2026-09,Sul,100,Confirmado\n2026-09,Sul,200,Pendente\n2026-09,Norte,50,Confirmado', { rule: { column: 'field3', value: 'Confirmado' } });
  const rows = includedRows(source, { field1: 'Sul' });
  assert.equal(rows.length, 1); assert.equal(calculate(source.metrics[0], rows), 100);
  assert.equal(calculate(source.metrics[0], includedRows(source)), 150);
  assert.equal(source.rule?.value, 'Confirmado');
});

test('totais de média usam os registros e não a média das médias dos grupos', () => {
  const source = imported('Data,Região,Valor\n2026-09,Sul,100\n2026-09,Sul,200\n2026-09,Norte,600', { operation: 'average' });
  const groups = groupValues(source, basePlan(source));
  assert.deepEqual(groups.map(row => row.value), [600,150]);
  assert.equal(calculate(source.metrics[0], includedRows(source)), 300);
});

test('valores vazios não viram zero; zero e negativos participam da soma', () => {
  const source = imported('Data,Região,Valor\n2026-09,Sul,0\n2026-09,Sul,-50\n2026-09,Norte,');
  assert.equal(calculate(source.metrics[0], includedRows(source)), -50);
  assert.equal(calculate(source.metrics[0], includedRows(source, { field1: 'Norte' })), null);
});

test('contagem conta valores preenchidos mesmo que sejam texto', () => {
  const source = imported('Data,Região,Valor\n2026-09,Sul,A\n2026-09,Sul,B\n2026-09,Norte,', { operation: 'count', unit: 'number' });
  assert.equal(calculate(source.metrics[0], source.rows), 2);
});

test('a exibição preserva centavos e apresenta datas em linguagem de negócio', () => {
  const metric = finance().metrics[0];
  assert.match(formatValue(1200.5, metric), /1.200,50/);
  assert.equal(displayCell(finance(), 'period', '2026-09'), 'setembro de 2026');
  assert.equal(formatValue(0.125, { ...metric, unit: 'number' }), '0,125');
});

test('não assume orçamento, regra contábil ou moeda para um arquivo', () => {
  const source = imported('Data,Região,Valor\n2026-09,Sul,100');
  assert.equal(source.budgetMetric, undefined);
  assert.equal(source.rule, undefined);
  assert.throws(() => imported('Data,Região,Valor\n2026-09,Sul,100', { rule: { column: 'field1', value: 'Leste' } }), /não aparece/);
});

test('pedido financeiro considera recorte e refinamento preserva filtros', () => {
  const source = finance();
  const plan = demoPlan('Compare despesas de Tecnologia em setembro de 2026.', source);
  assert.deepEqual(plan.filters, { group: 'Tecnologia', period: '2026-09' });
  const refined = demoPlan('Mostre em linha, sem tabela. Use o título: Fechamento mensal', source, plan);
  assert.deepEqual(refined.filters, plan.filters);
  assert.equal(refined.chart, 'line'); assert.equal(refined.displayTable, false);
  assert.equal(refined.title, 'Fechamento mensal');
});

test('pedidos de outras áreas usam o indicador da própria fonte', () => {
  const sales = sapSource('sales', 'test');
  const plan = demoPlan('Compare valor de vendas por região.', sales);
  assert.equal(plan.primaryMetric, 'value'); assert.equal(plan.secondaryMetric, null);
  assert.equal(plan.groupBy, 'group'); assert.match(plan.message, /vendas/);
  const stock = sapSource('inventory', 'test');
  assert.equal(stock.metrics[0].unit, 'number');
});

test('datas diárias permitem pedir um mês inteiro ou um ano e geram evolução mensal', () => {
  const source = imported('Data,Região,Valor\n01/09/2026,Sul,100\n15/09/2026,Sul,200\n01/10/2026,Norte,50');
  const september = demoPlan('Compare valor em setembro de 2026.', source);
  assert.equal(september.filters.field0, '2026-09');
  assert.equal(calculate(source.metrics[0], includedRows(source, september.filters)), 300);
  const annual = demoPlan('Compare valor em 2026.', source);
  assert.equal(annual.filters.field0, '2026');
  assert.equal(calculate(source.metrics[0], includedRows(source, annual.filters)), 350);
  const trend = groupValues(source, basePlan(source), 'field0');
  assert.deepEqual(trend.map(row => [row.name, row.value]), [['2026-09',300],['2026-10',50]]);
  assert.equal(demoPlan('Compare valor em 2025.', source).status, 'clarify');
  assert.equal(demoPlan('Compare valor em 09/2026.', source).filters.field0, '2026-09');
  assert.equal(demoPlan('Compare valor em 2026-09.', source).filters.field0, '2026-09');
});

test('mês em vários anos faz uma pergunta e interpreta a resposta do ano', () => {
  const source = imported('Data,Região,Valor\n01/09/2025,Sul,100\n15/09/2026,Sul,200');
  const question = demoPlan('Compare valor em setembro.', source);
  assert.equal(question.status, 'clarify');
  const answer = demoPlan('2026', source, question);
  assert.equal(answer.status, 'ready'); assert.equal(answer.filters.field0, '2026-09');
});

test('campo ou período ausente vira uma pergunta, nunca um número inventado', () => {
  const source = finance();
  assert.equal(demoPlan('Mostre o lucro.', source).status, 'clarify');
  assert.equal(demoPlan('Despesas em janeiro de 2027', source).status, 'clarify');
  const noDate = { ...source, dateColumn: undefined };
  assert.equal(demoPlan('Mostre em linha', noDate).status, 'clarify');
});

test('plano rejeita colunas, filtros e comandos que não existem no contrato', () => {
  const source = finance();
  const plan = demoPlan('Compare despesas.', source);
  assert.throws(() => validatePlan({ ...plan, primaryMetric: 'lucro' }, source));
  assert.throws(() => validatePlan({ ...plan, filters: { group: 'Área inexistente' } }, source));
  assert.throws(() => validatePlan({ ...plan, sql: 'DELETE FROM resources' }, source));
  assert.throws(() => validatePlan({ ...plan, groupBy: 'value' }, source));
  assert.throws(() => validatePlan({ ...plan, primaryMetric: 'budget' }, source));
});
