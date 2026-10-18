import test from 'node:test';
import assert from 'node:assert/strict';
import { records, summarize, simulate, interpret } from './core.mjs';

test('o financeiro fecha em orçamento, realizado e saldo, inclusive por mês', () => {
  const result = summarize(records);
  assert.equal(result.actual, 8190000);
  assert.equal(result.budget, 8319000);
  assert.equal(result.balance, 129000);
  assert.equal(result.months.reduce((s,m)=>s+m.actual,0), result.actual);
  assert.equal(result.groups.filter(g=>g.actual>g.budget).length, 2);
});
test('o recorte mantém filtros de centro, período e empresa combinados', () => {
  const result = summarize(records, {center:'Tecnologia',period:'q3',company:'Matriz'});
  assert.equal(result.groups.length, 1);
  assert.equal(result.months.length, 3);
  assert.equal(result.count, 3);
  assert.ok(result.actual > 0 && result.actual < 3210000);
});
test('simulação de Tecnologia não altera realizado nem registros de origem', () => {
  const before = JSON.stringify(records);
  const result = simulate(summarize(records), 5);
  assert.equal(result.saving,160500);
  assert.equal(result.actual,8029500);
  assert.equal(result.balance,289500);
  assert.equal(JSON.stringify(records),before);
  assert.throws(()=>simulate(summarize(records),101));
});
test('o chat identifica os pedidos demonstráveis e pede clareza nos demais', () => {
  assert.equal(interpret('Mostre apenas Tecnologia.').kind,'filter');
  assert.equal(interpret('Troque este gráfico por barras horizontais').kind,'chart');
  assert.equal(interpret('Simule redução de 5% em Tecnologia').kind,'scenario');
  assert.equal(interpret('Monte um dashboard financeiro de janeiro a setembro de 2026').kind,'create');
  assert.equal(interpret('Mostre o faturamento de clientes').kind,'unsupported');
});
