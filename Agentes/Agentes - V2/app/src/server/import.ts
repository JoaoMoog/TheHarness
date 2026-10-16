import { z } from 'zod';
import type { Source, Upload } from '@/core/types';
import { HttpError } from './auth';

export const importSchema = z.object({
  uploadId: z.string().uuid(), name: z.string().trim().min(1).max(100),
  metricKey: z.string(), groupBy: z.string(), dateColumn: z.string().nullable(), budgetMetric: z.string().nullable(),
  unit: z.enum(['BRL', 'number']), operation: z.enum(['sum', 'average', 'count']),
  rule: z.object({ column: z.string(), value: z.string() }).strict().nullable(),
}).strict();

export function importedSource(upload: Upload, input: z.infer<typeof importSchema>): Source {
  const metric = upload.columns.find(c => c.key === input.metricKey);
  const group = upload.columns.find(c => c.key === input.groupBy);
  if (!metric || !group) throw new HttpError(400, 'Escolha o indicador e o agrupamento nas colunas do arquivo.');
  if (input.operation !== 'count' && (metric.type !== 'number' || metric.key === group.key)) throw new HttpError(400, 'Para somar ou calcular uma média, escolha uma coluna numérica diferente do agrupamento.');
  if (input.dateColumn && !upload.columns.some(c => c.key === input.dateColumn && c.type === 'date')) throw new HttpError(400, 'Escolha uma coluna de datas válida, no formato AAAA-MM ou AAAA-MM-DD.');
  if (input.budgetMetric && (!upload.columns.some(c => c.key === input.budgetMetric && c.type === 'number') || input.budgetMetric === input.metricKey || input.budgetMetric === input.groupBy || input.operation !== 'sum')) throw new HttpError(400, 'A comparação com orçamento precisa de outra coluna numérica e da operação soma.');
  if (input.rule && !upload.columns.some(c => c.key === input.rule!.column && upload.rows.some(row => String(row[c.key]) === input.rule!.value))) throw new HttpError(400, 'O critério escolhido não aparece nesse arquivo.');
  const columns = upload.columns.map(c => c.key === group.key ? { ...c, type: c.type === 'date' ? 'date' as const : 'text' as const } : c);
  const rows = upload.rows.map(row => ({ ...row, [group.key]: row[group.key] == null ? null : String(row[group.key]) }));
  if (input.rule && !rows.some(row => String(row[input.rule!.column]) === input.rule!.value)) throw new HttpError(400, 'O critério não seleciona nenhum registro.');
  return { id: crypto.randomUUID(), owner: upload.owner, name: input.name, domain: upload.origin === 'sap' ? 'SAP · leitura' : 'Arquivo importado', origin: upload.origin === 'sap' ? 'sap' : 'file', columns, rows,
    metrics: [{ key: metric.key, label: input.operation === 'count' ? `Quantidade de ${metric.label.toLowerCase()}` : metric.label, unit: input.operation === 'count' ? 'number' : input.unit, operation: input.operation },
      ...(input.budgetMetric ? [{ key: input.budgetMetric, label: upload.columns.find(c => c.key === input.budgetMetric)!.label, unit: input.unit, operation: 'sum' as const }] : [])],
    primaryMetric: metric.key, budgetMetric: input.budgetMetric || undefined, groupBy: group.key, dateColumn: input.dateColumn || undefined,
    rule: input.rule || undefined, createdAt: new Date().toISOString(), revision: 1 };
}
