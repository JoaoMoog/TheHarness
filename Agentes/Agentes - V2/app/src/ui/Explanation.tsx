import { ArrowRight, Database, FileSpreadsheet, Calculator, ListFilter, Info } from 'lucide-react';
import { analysisSource, calculate, calculationText, displayCell, fieldLabel, formatValue, includedRows, planFilters } from '@/core/engine';
import { compileExpression } from '@/core/expression';
import type { Plan, Source } from '@/core/types';

export function Explanation({ source, plan, selected }: { source: Source; plan: Plan; selected?: string }) {
  source = analysisSource(source, plan);
  const rows = includedRows(source, planFilters(plan));
  const metrics = source.metrics.filter(m => selected ? m.key === selected : m.key === plan.primaryMetric || m.key === plan.secondaryMetric || plan.selectedMetrics?.includes(m.key));
  const filters = Object.entries(planFilters(plan));
  return <section className="explanation" aria-label="Origem e cálculo dos números">
    <div className="explanation-heading"><Info size={18} /><h3>Como este número foi calculado</h3></div>
    <ol className="lineage" aria-label="Caminho dos dados até o indicador">
      <li>{source.origin === 'file' ? <FileSpreadsheet size={18} /> : <Database size={18} />}<div><strong>{source.name}</strong><span>{source.origin === 'file' ? 'Arquivo importado' : source.origin === 'sap' ? 'SAP · leitura' : 'SAP · dados de exemplo'} · {source.rows.length.toLocaleString('pt-BR')} registros</span></div></li>
      <li className="lineage-arrow" aria-hidden="true"><ArrowRight size={18} /></li>
      <li><ListFilter size={18} /><div><strong>Critérios aplicados</strong><span>{rows.length.toLocaleString('pt-BR')} registros considerados</span></div></li>
      <li className="lineage-arrow" aria-hidden="true"><ArrowRight size={18} /></li>
      <li><Calculator size={18} /><div><strong>Indicador</strong><span>{metrics.map(m => m.label).join(' e ')}</span></div></li>
    </ol>
    <div className="calculation-details"><div><h4>Quais registros entram?</h4>
      <p>{source.rule ? `Somente registros em que ${fieldLabel(source, source.rule.column).toLowerCase()} é “${source.rule.value}”. Esse critério foi definido para esta fonte.` : 'Todos os registros da fonte. Nenhum critério de negócio foi acrescentado.'}</p>
      <p>{filters.length ? `Recorte do dashboard: ${filters.map(([key, value]) => `${fieldLabel(source, key)} = ${(Array.isArray(value) ? value : [value]).map(item => displayCell(source, key, item)).join(' ou ')}`).join('; ')}.` : 'Sem filtros adicionais: todos os períodos e grupos disponíveis.'}</p>
      <small>{source.rows.length - rows.length} registros ficaram fora por causa dos critérios e filtros.</small></div>
      <div><h4>Qual é a conta?</h4>{metrics.map(metric => { const formula = metric.expression ? compileExpression(metric.expression) : null; return <div className="metric-calculation" key={metric.key}><strong>{metric.label}: {formatValue(calculate(metric, rows), metric)}</strong><p>{calculationText(metric, source)}</p><small>{rows.filter(row => formula ? formula.evaluate(row) != null : metric.operation === 'count' ? row[metric.key] != null : typeof row[metric.key] === 'number').length} valores válidos neste recorte.</small></div>; })}
      {plan.secondaryMetric && !selected && <p>Desvio do orçamento = {source.metrics.find(m => m.key === plan.primaryMetric)?.label.toLowerCase()} − {source.metrics.find(m => m.key === plan.secondaryMetric)?.label.toLowerCase()}. Um valor positivo significa que o realizado está acima do orçamento.</p>}</div></div>
    {source.origin === 'sap-demo' && <p className="source-disclaimer">Dados ilustrativos. Este ambiente não está conectado ao SAP da empresa.</p>}
  </section>;
}
