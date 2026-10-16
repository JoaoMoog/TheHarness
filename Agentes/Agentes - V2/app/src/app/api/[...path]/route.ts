import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkOrigin, demoEnabled, HttpError, microsoftActor, requireActor, revoke, session } from '@/server/auth';
import { db, initialize, insert, list, read, transaction, update } from '@/server/store';
import { domains, sapSource } from '@/server/seed';
import { MAX_BYTES, parseFile } from '@/core/import';
import { importSchema, importedSource } from '@/server/import';
import { planDashboard } from '@/server/provider';
import { planSchema, validatePlan } from '@/core/planner';
import type { Actor, Draft, Report, Source, Upload } from '@/core/types';
import { localActor } from '@/server/localAuth';
import { audit, handleWorkspaceRequest, listWorkspaces, resolveWorkspace } from '@/server/workspaces';
import { changeReport, confirmReplacement, duplicateReport, prepareReplacement, readDurableWork, readPrivateDraft, reportVersions, restoreReport, restoreSource, resumeDurableWork, saveDurableWork, sourceVersions } from '@/server/lifecycle';
import { readiness, recordRequest, workspaceOperations } from '@/server/operations';
import { readSapSample, sapConfiguration } from '@/server/sap';
import { sourceQuality } from '@/core/analysis';
import type { ImportSample } from '@/core/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const limits = new Map<string, number[]>();
const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
function owned<T extends Source | Draft | Report | Upload>(kind: string, id: string, actor: Actor): T {
  const result = read<T>(kind, id, actor.id);
  if (!result) throw new HttpError(404, 'Esse item não está disponível. Volte ao início e tente novamente.');
  return result;
}
async function body(req: NextRequest) {
  const text = await req.text();
  if (text.length > 32000) throw new HttpError(413, 'O pedido é muito longo. Reduza o texto e tente novamente.');
  try { return JSON.parse(text); } catch { throw new HttpError(400, 'Não foi possível ler o pedido. Tente novamente.'); }
}
function activeDraft(id: string, actor: Actor, realActorId: string) {
  const draft = readPrivateDraft(id, realActorId, actor.id);
  if (!draft.reportId && Date.parse(draft.expiresAt) < Date.now()) throw new HttpError(410, 'Essa conversa expirou. Comece uma nova conversa.');
  return draft;
}
function previewUpload(sample: ImportSample, owner: string, origin?: 'sap') {
  db().prepare("DELETE FROM resources WHERE kind='upload' AND json_extract(data,'$.expiresAt')<?").run(new Date().toISOString());
  const upload: Upload = { ...sample, id: crypto.randomUUID(), owner, origin, expiresAt: new Date(Date.now() + 1800000).toISOString() };
  insert('upload', upload);
  const criteriaOptions = upload.columns.filter(c => c.type === 'text').map(c => ({ key: c.key, label: c.label,
    values: [...new Set(upload.rows.map(row => row[c.key]).filter(v => v != null).map(String))].sort() })).filter(c => c.values.length <= 200);
  return { id: upload.id, name: upload.name, columns: upload.columns, rows: upload.rows.slice(0, 5), rowCount: upload.rows.length, criteriaOptions, quality: sourceQuality(upload) };
}

async function handler(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  try {
    const path = (await context.params).path;
    const route = path.join('/');
    if (req.method === 'GET' && route === 'health') return json({ status: 'ok', app: 'prometeu' });
    if (req.method === 'GET' && route === 'health/ready') { const result = readiness(); return json(result, result.status === 'ok' ? 200 : 503); }
    if (req.method !== 'GET') checkOrigin(req);
    if (req.method === 'POST' && (route === 'auth/login' || route === 'auth/register')) {
      const input = z.object({ mode: z.enum(['demo', 'msal', 'local']), accessToken: z.string().max(16000).optional(), email: z.string().optional(), password: z.string().optional(), name: z.string().optional() }).strict().parse(await body(req));
      if (route === 'auth/register' && input.mode !== 'local') throw new HttpError(400, 'Use Criar conta local para registrar uma conta.');
      if (input.mode === 'demo' && !demoEnabled()) throw new HttpError(403, 'Entre com sua conta Microsoft.');
      const actor: Actor = input.mode === 'local' ? await localActor({ email: input.email, password: input.password, ...(input.name ? { name: input.name } : {}) }, route === 'auth/register') : input.mode === 'demo' ? { id: 'demo-user', name: 'Marina Costa', demo: true, auth: 'demo' } : await microsoftActor(input.accessToken || '');
      initialize(actor);
      const response = json({ actor });
      response.cookies.set('prometeu-session', session(actor), { httpOnly: true, secure: new URL(process.env.PUBLIC_APP_URL || req.url).protocol === 'https:', sameSite: 'lax', path: '/', maxAge: 28800 });
      return response;
    }
    if (req.method === 'POST' && route === 'auth/logout') {
      revoke(req); const response = json({ ok: true }); response.cookies.delete('prometeu-session'); return response;
    }
    const realActor = requireActor(req);
    if (path[0] === 'workspaces' && path.length === 3 && path[2] === 'operations' && req.method === 'GET') return json(workspaceOperations(realActor, path[1]));
    if (path[0] === 'workspaces') {
      const result = handleWorkspaceRequest(realActor, req.method, path, req.method === 'POST' ? await body(req) : undefined);
      if (result !== undefined) return json(result);
    }
    const workspace = resolveWorkspace(realActor, req.headers.get('x-clara-workspace'), req.method === 'GET' || route === 'work' ? 'read' : 'write');
    const actor = { ...realActor, id: workspace.owner };
    if (req.method === 'GET' && route === 'bootstrap') {
      if (workspace.personal) initialize(realActor);
      return json({ actor: realActor, workspace, workspaces: listWorkspaces(realActor), sources: list<Source>('source', actor.id), reports: list<Report>('report', actor.id), provider: process.env.AI_PROVIDER === 'bedrock' ? 'bedrock' : 'demo' });
    }
    if (route === 'work' && req.method === 'GET') return json(readDurableWork(realActor.id, workspace.owner));
    if (route === 'work' && req.method === 'POST') return json(saveDurableWork(realActor.id, workspace.owner, await body(req)));
    if (route === 'work/resume' && req.method === 'POST') {
      const result = resumeDurableWork(realActor.id, workspace.owner, await body(req));
      audit(realActor, workspace.id, 'draft.resumed', result.draft.id); return json(result);
    }
    if (path[0] === 'sources' && path.length === 3 && path[2] === 'sap-replacement-preview' && req.method === 'POST') {
      const source = owned<Source>('source', path[1], actor);
      if (source.origin !== 'sap') throw new HttpError(400, 'Essa fonte não usa a conexão SAP de leitura.');
      const preview = prepareReplacement(path[1], actor.id, await readSapSample({ signal: req.signal }));
      return json({ ...preview, rows: preview.rows.slice(0, 5), rowCount: preview.rows.length });
    }
    if (path[0] === 'sources' && path.length === 3 && path[2] === 'versions' && req.method === 'GET') return json(sourceVersions(path[1], actor.id));
    if (path[0] === 'sources' && path.length === 3 && path[2] === 'replacement-preview' && req.method === 'POST') {
      if (Number(req.headers.get('content-length')) > MAX_BYTES + 64000) throw new HttpError(413, 'Use um arquivo de até 8 MB.');
      const file = (await req.formData()).get('file');
      if (!(file instanceof File) || file.size > MAX_BYTES) throw new HttpError(400, 'Escolha um arquivo de até 8 MB.');
      let sample;
      try { sample = parseFile(new Uint8Array(await file.arrayBuffer()), file.name); }
      catch (error) { throw new HttpError(400, error instanceof Error ? error.message : 'Não foi possível ler o arquivo.'); }
      const preview = prepareReplacement(path[1], actor.id, sample);
      return json({ ...preview, rows: preview.rows.slice(0, 5), rowCount: preview.rows.length });
    }
    if (path[0] === 'sources' && path.length === 3 && ['replace','restore'].includes(path[2]) && req.method === 'POST') {
      const input = await body(req);
      const result = path[2] === 'replace' ? confirmReplacement(path[1], actor.id, input, realActor.id) : restoreSource(path[1], actor.id, input, realActor.id);
      audit(realActor, workspace.id, `source.${path[2]}`, result.id); return json(result);
    }
    if (path[0] === 'reports' && path.length === 3 && path[2] === 'versions' && req.method === 'GET') return json(reportVersions(path[1], actor.id));
    if (path[0] === 'reports' && req.method === 'POST' && (path.length === 2 || (path.length === 3 && ['duplicate','restore'].includes(path[2])))) {
      const result = path.length === 2 ? changeReport(path[1], actor.id, await body(req), realActor.id) : path[2] === 'duplicate' ? duplicateReport(path[1], actor.id, await body(req)) : restoreReport(path[1], actor.id, await body(req), realActor.id);
      audit(realActor, workspace.id, `report.${path[2] || 'updated'}`, result.id); return json(result);
    }
    if (req.method === 'GET' && route === 'sap/domains') return json(domains);
    if (req.method === 'GET' && route === 'sap/configuration') return json(sapConfiguration());
    if (req.method === 'POST' && route === 'imports/sap-preview') return json(previewUpload(await readSapSample({ signal: req.signal }), actor.id, 'sap'));
    if (req.method === 'POST' && route === 'sources/sap') {
      const input = z.object({ domain: z.enum(['finance', 'sales', 'purchases', 'inventory']) }).strict().parse(await body(req));
      const existing = list<Source>('source', actor.id).find(s => s.origin === 'sap-demo' && s.domain === domains.find(d => d.id === input.domain)?.name);
      const source = existing || insert('source', sapSource(input.domain, actor.id));
      if (!existing) audit(realActor, workspace.id, 'source.created', source.id);
      return json(source);
    }
    if (req.method === 'POST' && route === 'imports/preview') {
      if (Number(req.headers.get('content-length')) > MAX_BYTES + 64000) throw new HttpError(413, 'Use um arquivo de até 8 MB.');
      const form = await req.formData();
      const file = form.get('file');
      if (!(file instanceof File) || file.size > MAX_BYTES) throw new HttpError(400, 'Escolha um arquivo de até 8 MB.');
      let sample;
      try { sample = parseFile(new Uint8Array(await file.arrayBuffer()), file.name); }
      catch (error) { throw new HttpError(400, error instanceof Error ? error.message : 'Não foi possível ler o arquivo.'); }
      return json(previewUpload(sample, actor.id));
    }
    if (req.method === 'POST' && route === 'imports/confirm') {
      const input = importSchema.parse(await body(req));
      return transaction(() => {
        const upload = owned<Upload>('upload', input.uploadId, actor);
        if (Date.parse(upload.expiresAt) < Date.now()) throw new HttpError(410, 'A importação expirou. Escolha o arquivo novamente.');
        const source = importedSource(upload, input);
        insert('source', source);
        db().prepare('DELETE FROM resources WHERE id=? AND owner=?').run(upload.id, actor.id);
        audit(realActor, workspace.id, 'source.imported', source.id);
        return json(source);
      });
    }
    if (req.method === 'GET' && path[0] === 'drafts' && path.length === 2) return json(activeDraft(path[1], actor, realActor.id));
    if (req.method === 'POST' && route === 'drafts') {
      const input = z.object({ sourceId: z.string().uuid(), prompt: z.string().trim().min(1).max(4000), draftId: z.string().uuid().optional(), revision: z.number().int().positive().optional(), plan: planSchema.nullable().optional() }).strict().parse(await body(req));
      const timestamps = (limits.get(realActor.id) || []).filter(t => t > Date.now() - 60000);
      if (timestamps.length >= 20) throw new HttpError(429, 'Você fez muitos pedidos em sequência. Aguarde um minuto e tente novamente.');
      limits.set(realActor.id, [...timestamps, Date.now()]);
      const source = owned<Source>('source', input.sourceId, actor);
      const previous = input.draftId ? activeDraft(input.draftId, actor, realActor.id) : undefined;
      if (previous && (previous.reportId || previous.sourceId !== source.id || previous.sourceRevision !== source.revision || previous.revision !== input.revision)) throw new HttpError(409, 'Essa conversa mudou. Reabra a conversa ou comece uma nova.');
      if (previous && previous.messages.length >= 20) throw new HttpError(400, 'Esta conversa chegou a dez pedidos. Salve a prévia ou comece uma nova conversa.');
      const started = Date.now();
      const contextDraft = previous && input.plan ? { ...previous, plan: validatePlan(input.plan, source) } : previous;
      const plan = await planDashboard(input.prompt, source, contextDraft, req.signal);
      if (req.signal.aborted) throw new HttpError(499, 'Pedido cancelado.');
      const draft: Draft = { id: previous?.id || crypto.randomUUID(), owner: actor.id, createdBy: realActor.id, sourceId: source.id, sourceRevision: source.revision,
        revision: (previous?.revision || 0) + 1, plan, messages: [...(previous?.messages || []), { role: 'user', text: input.prompt }, { role: 'assistant', text: plan.message }], expiresAt: new Date(Date.now() + 1800000).toISOString() };
      transaction(() => {
        if (previous) {
          const current = activeDraft(previous.id, actor, realActor.id);
          if (current.revision !== previous.revision || current.reportId) throw new HttpError(409, 'Outro pedido já alterou essa conversa. Reabra para continuar.');
          update('draft', draft);
        } else insert('draft', draft);
        audit(realActor, workspace.id, previous ? 'draft.updated' : 'draft.created', draft.id);
      });
      console.info(JSON.stringify({ event: 'dashboard.planned', actor: actor.id, provider: process.env.AI_PROVIDER || 'demo', status: plan.status, latencyMs: Date.now() - started }));
      return json(draft);
    }
    if (req.method === 'POST' && path[0] === 'drafts' && path[2] === 'save' && path.length === 3) {
      const input = z.object({ revision: z.number().int().positive(), plan: planSchema }).strict().parse(await body(req));
      return transaction(() => {
        const draft = activeDraft(path[1], actor, realActor.id);
        if (draft.reportId) return json(owned<Report>('report', draft.reportId, actor));
        if (draft.revision !== input.revision) throw new HttpError(409, 'A prévia mudou. Confira a versão atual antes de salvar.');
        const source = owned<Source>('source', draft.sourceId, actor);
        const plan = validatePlan(input.plan, source);
        if (draft.plan.status !== 'ready' || plan.status !== 'ready' || source.revision !== draft.sourceRevision) throw new HttpError(400, 'Conclua o pedido e confira os dados antes de salvar.');
      const report: Report = { id: crypto.randomUUID(), owner: actor.id, sourceId: source.id, plan, revision: 1, sourceRevision: source.revision, createdAt: new Date().toISOString() };
        insert('report', report);
        update('draft', { ...draft, revision: draft.revision + 1, reportId: report.id });
        audit(realActor, workspace.id, 'report.created', report.id);
        return json(report);
      });
    }
    if (req.method === 'DELETE' && path[0] === 'reports' && path.length === 2) {
      owned<Report>('report', path[1], actor);
      transaction(() => {
        db().prepare('DELETE FROM resources WHERE id=? AND owner=?').run(path[1], actor.id);
        db().prepare("DELETE FROM resources WHERE kind='report-version' AND owner=? AND json_extract(data,'$.reportId')=?").run(actor.id, path[1]);
        audit(realActor, workspace.id, 'report.deleted', path[1]);
      }); return json({ ok: true });
    }
    throw new HttpError(404, 'Essa ação não está disponível.');
  } catch (error) {
    if (error instanceof HttpError) return json({ error: error.message }, error.status);
    if (error instanceof z.ZodError) return json({ error: 'Confira os campos preenchidos e tente novamente.', fields: error.issues.map(i => ({ field: i.path.join('.'), message: i.message })) }, 400);
    console.error(JSON.stringify({ event: 'request.failed', type: error instanceof Error ? error.name : 'Unknown' }));
    return json({ error: 'Não foi possível concluir essa ação. Seus dados foram preservados. Tente novamente.' }, 500);
  }
}

async function measured(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const start = Date.now();
  const response = await handler(req, context);
  recordRequest(Date.now() - start, response.status);
  return response;
}
export { measured as GET, measured as POST, measured as DELETE };
