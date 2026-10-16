import { z } from 'zod';
import type { Draft, ImportSample, Report, Source, Upload } from '@/core/types';
import { normalized } from '@/core/import';
import { validatePlan } from '@/core/planner';
import { workOwner, workSchema } from '@/core/work';
import { db, insert, list, read, transaction, update } from './store';
import { HttpError } from './auth';

type SourceVersion = Source & { sourceId: string; changedAt: string; changedBy: string };
type ReportVersion = Report & { reportId: string; changedAt: string; changedBy: string };
type Replacement = Upload & { sourceId: string; sourceRevision: number; warnings: string[] };
type Work = { id: string; owner: string; state: z.infer<typeof workSchema> | null; revision: number; updatedAt: string };

function find<T extends { id: string; owner: string }>(kind: string, id: string, owner: string): T {
  const value = read<T>(kind, id, owner);
  if (!value) throw new HttpError(404, 'Esse item não está disponível neste espaço.');
  return value;
}
/** Sources/reports belong to a workspace; conversations belong to one person inside it. */
export function readPrivateDraft(id: string, actor: string, owner: string): Draft {
  const draft = read<Draft>('draft', id, owner);
  // Only personal legacy drafts have an unambiguous author. Never infer team authorship.
  if (!draft || (draft.createdBy ? draft.createdBy !== actor : draft.owner !== actor)) throw new HttpError(404, 'Esta conversa não está disponível para sua conta neste espaço.');
  return draft;
}
const reportRevision = (report: Report) => report.revision || 1;
function snapshotReport(report: Report, actor: string) {
  insert<ReportVersion>('report-version', { ...report, revision: reportRevision(report), id: crypto.randomUUID(), reportId: report.id, changedAt: new Date().toISOString(), changedBy: actor });
}
function snapshotSource(source: Source, actor: string) {
  insert<SourceVersion>('source-version', { ...source, id: crypto.randomUUID(), sourceId: source.id, changedAt: new Date().toISOString(), changedBy: actor });
}

export function sourceVersions(id: string, owner: string) {
  const current = find<Source>('source', id, owner);
  return [{ ...current, sourceId: id, changedAt: current.updatedAt || current.createdAt, changedBy: '' }, ...list<SourceVersion>('source-version', owner).filter(v => v.sourceId === id)].map(({ rows, ...summary }) => ({ ...summary, rowCount: rows.length }));
}
export function prepareReplacement(id: string, owner: string, sample: ImportSample): Replacement {
  const source = find<Source>('source', id, owner);
  const missing = source.columns.filter(old => !sample.columns.some(c => normalized(c.label).trim() === normalized(old.label).trim()));
  if (missing.length) throw new HttpError(400, `O arquivo precisa manter as colunas da fonte: ${missing.map(c => c.label).join(', ')}. Nenhum dado foi alterado.`);
  const mapping = sample.columns.map((column, i) => {
    const old = source.columns.find(c => normalized(c.label).trim() === normalized(column.label).trim());
    if (old && old.type !== 'text' && column.type !== old.type && sample.rows.some(r => r[column.key] != null)) throw new HttpError(400, `A coluna ${old.label} precisa continuar contendo ${old.type === 'date' ? 'datas' : 'números'}. Corrija o arquivo antes de atualizar.`);
    return { from: column.key, column: old || { ...column, key: `extra_${source.revision}_${i}` } };
  });
  const rows = sample.rows.map(row => Object.fromEntries(mapping.map(({ from, column }) => [column.key, column.type === 'text' && row[from] != null ? String(row[from]) : row[from]])));
  const next = { ...source, rows, columns: mapping.map(m => m.column) };
  const warnings = list<Report>('report', owner).filter(r => r.sourceId === id).flatMap(report => {
    try { validatePlan(report.plan, next); return []; } catch { return [`O recorte de “${report.plan.title}” precisará ser conferido com os novos valores.`]; }
  });
  if (source.rule && !rows.some(row => String(row[source.rule!.column]) === source.rule!.value)) throw new HttpError(400, 'O arquivo novo não contém nenhum registro que atende ao critério da fonte. Confira os dados antes de atualizar.');
  const upload: Replacement = { id: crypto.randomUUID(), owner, name: sample.name, columns: next.columns, rows, expiresAt: new Date(Date.now() + 1800000).toISOString(), sourceId: id, sourceRevision: source.revision, warnings };
  return insert('replacement', upload);
}
export function confirmReplacement(id: string, owner: string, input: unknown, actor: string) {
  const { uploadId, revision } = z.object({ uploadId: z.string().uuid(), revision: z.number().int().positive() }).strict().parse(input);
  return transaction(() => {
    const receipt = read<{ id: string; owner: string; sourceId: string }>('replacement-result', `replacement:${uploadId}`, owner);
    if (receipt?.sourceId === id) return find<Source>('source', id, owner);
    const source = find<Source>('source', id, owner);
    const upload = find<Replacement>('replacement', uploadId, owner);
    if (upload.sourceId !== id || upload.sourceRevision !== source.revision || revision !== source.revision) throw new HttpError(409, 'A fonte mudou durante a conferência. Escolha o arquivo novamente.');
    if (Date.parse(upload.expiresAt) < Date.now()) throw new HttpError(410, 'A conferência expirou. Escolha o arquivo novamente.');
    snapshotSource(source, actor);
    const next: Source = { ...source, columns: upload.columns, rows: upload.rows, revision: source.revision + 1, updatedAt: new Date().toISOString() };
    update('source', next);
    insert('replacement-result', { id: `replacement:${uploadId}`, owner, sourceId: id });
    db().prepare('DELETE FROM resources WHERE id=? AND owner=? AND kind=?').run(uploadId, owner, 'replacement');
    return next;
  });
}
export function restoreSource(id: string, owner: string, input: unknown, actor: string) {
  const { versionId, revision } = z.object({ versionId: z.string().uuid(), revision: z.number().int().positive() }).strict().parse(input);
  return transaction(() => {
    const source = find<Source>('source', id, owner); const version = find<SourceVersion>('source-version', versionId, owner);
    if (version.sourceId !== id) throw new HttpError(404, 'Essa versão pertence a outra fonte.');
    if (source.revision !== revision) throw new HttpError(409, 'A fonte mudou. Atualize a tela antes de restaurar.');
    snapshotSource(source, actor);
    const { sourceId: _sourceId, changedBy: _changedBy, changedAt: _changedAt, ...data } = version;
    const next = { ...data, id, revision: source.revision + 1, updatedAt: new Date().toISOString() };
    update('source', next); return next;
  });
}
export function reportVersions(id: string, owner: string) {
  const current = find<Report>('report', id, owner);
  return [{ ...current, revision: reportRevision(current), reportId: id, changedAt: current.updatedAt || current.createdAt, changedBy: current.editedBy || '' }, ...list<ReportVersion>('report-version', owner).filter(v => v.reportId === id)];
}
export function changeReport(id: string, owner: string, input: unknown, actor: string) {
  const data = z.object({ revision: z.number().int().positive(), plan: z.unknown(), title: z.string().trim().min(1).max(100).optional() }).strict().parse(input);
  return transaction(() => {
    const report = find<Report>('report', id, owner);
    if (reportRevision(report) !== data.revision) throw new HttpError(409, 'Outra pessoa alterou esse dashboard. Atualize a tela para conferir a versão atual.');
    const source = find<Source>('source', report.sourceId, owner);
    let plan;
    try { plan = validatePlan(data.plan, source); }
    catch (error) {
      if (error instanceof z.ZodError) throw error;
      throw new HttpError(400, error instanceof Error ? error.message : 'Confira o plano e os campos disponíveis antes de salvar.');
    }
    if (plan.status !== 'ready') throw new HttpError(400, 'Conclua e confira o plano antes de salvar.');
    snapshotReport(report, actor);
    const next = { ...report, plan: { ...plan, title: data.title || plan.title }, revision: reportRevision(report) + 1, sourceRevision: source.revision, updatedAt: new Date().toISOString(), editedBy: actor };
    update('report', next); return next;
  });
}
export function duplicateReport(id: string, owner: string, input: unknown = {}) {
  const { requestId } = z.object({ requestId: z.string().uuid().optional() }).strict().parse(input);
  return transaction(() => {
    const report = find<Report>('report', id, owner);
    const receiptId = requestId ? `copy:${owner}:${requestId}` : undefined;
    type CopyReceipt = { id: string; owner: string; originalId: string; reportId: string };
    const receipt = receiptId && (read<CopyReceipt>('report-copy', receiptId, owner) || read<CopyReceipt>('report-copy', `copy:${requestId}`, owner));
    if (receipt) {
      if (receipt.originalId !== id) throw new HttpError(409, 'Este pedido de cópia já foi usado para outro dashboard. Atualize a tela antes de duplicar.');
      return find<Report>('report', receipt.reportId, owner);
    }
    const copy = insert('report', { ...report, id: crypto.randomUUID(), plan: { ...report.plan, title: `${report.plan.title.slice(0, 88)} — cópia` }, revision: 1, createdAt: new Date().toISOString(), updatedAt: undefined, editedBy: undefined });
    if (receiptId) insert('report-copy', { id: receiptId, owner, originalId: id, reportId: copy.id });
    return copy;
  });
}
export function restoreReport(id: string, owner: string, input: unknown, actor: string) {
  const { versionId, revision } = z.object({ versionId: z.string().uuid(), revision: z.number().int().positive() }).strict().parse(input);
  const version = find<ReportVersion>('report-version', versionId, owner);
  if (version.reportId !== id) throw new HttpError(404, 'Essa versão pertence a outro dashboard.');
  return changeReport(id, owner, { revision, plan: version.plan }, actor);
}
export function readDurableWork(actor: string, owner: string) {
  const id = `work:${workOwner(actor, owner)}`;
  return read<Work>('work', id, owner) || { id, owner, state: null, revision: 0, updatedAt: new Date().toISOString() };
}
export function saveDurableWork(actor: string, owner: string, input: unknown) {
  const { revision, state } = z.object({ revision: z.number().int().nonnegative(), state: workSchema.nullable() }).strict().parse(input);
  return transaction(() => {
    const current = readDurableWork(actor, owner);
    if (current.revision !== revision) throw new HttpError(409, 'Sua análise foi alterada em outra aba ou dispositivo. Recarregue para retomar a versão salva.');
    if (state && state.owner !== workOwner(actor, owner)) throw new HttpError(403, 'Esta análise pertence a outra conta ou espaço.');
    if (state && !read<Source>('source', state.sourceId, owner)) throw new HttpError(404, 'A fonte dessa análise não está disponível neste espaço.');
    if (state?.draftId) {
      const draft = readPrivateDraft(state.draftId, actor, owner);
      if (draft.sourceId !== state.sourceId) throw new HttpError(409, 'A conversa pertence a outra fonte. Reabra a análise correta antes de continuar.');
    }
    const next: Work = { ...current, state, revision: current.revision + 1, updatedAt: new Date().toISOString() };
    if (!current.revision) insert('work', next); else update('work', next);
    return next;
  });
}
/** Explicit recovery revalidates the stored plan against the same source revision; no provider call is made. */
export function resumeDurableWork(actor: string, owner: string, input: unknown) {
  const { revision, draftId } = z.object({ revision: z.number().int().positive(), draftId: z.string().uuid() }).strict().parse(input);
  return transaction(() => {
    const current = readDurableWork(actor, owner);
    if (current.revision !== revision) throw new HttpError(409, 'O rascunho mudou em outra aba. Recarregue antes de recuperar.');
    if (!current.state || current.state.draftId !== draftId) throw new HttpError(404, 'Esse rascunho não é o trabalho salvo na sua conta.');
    const old = readPrivateDraft(draftId, actor, owner);
    const source = find<Source>('source', old.sourceId, owner);
    if (source.id !== current.state.sourceId || source.revision !== old.sourceRevision) throw new HttpError(409, 'A fonte mudou. Sua pergunta foi preservada; inicie outra análise com os dados atuais.');
    if (old.reportId) throw new HttpError(409, 'Essa conversa já foi salva. Abra o dashboard para continuar.');
    let plan;
    try { plan = validatePlan(current.state.plan || old.plan, source); }
    catch { throw new HttpError(400, 'O recorte não é mais válido. Inicie outra análise com a pergunta preservada.'); }
    const draft: Draft = { ...old, id: crypto.randomUUID(), createdBy: actor, revision: 1, plan, expiresAt: new Date(Date.now() + 1800000).toISOString() };
    insert('draft', draft);
    const work: Work = { ...current, revision: current.revision + 1, updatedAt: new Date().toISOString(), state: { ...current.state, draftId: draft.id, draftRevision: draft.revision, expiresAt: draft.expiresAt, plan, recovery: '' } };
    update('work', work);
    return { draft, work };
  });
}
