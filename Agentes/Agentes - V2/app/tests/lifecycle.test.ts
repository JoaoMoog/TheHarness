import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NextRequest } from 'next/server';
import { GET, POST, DELETE } from '../src/app/api/[...path]/route';
import { db, initialize, list, read, update } from '../src/server/store';
import { session } from '../src/server/auth';
import { calculate, includedRows } from '../src/core/engine';
import { workOwner } from '../src/core/work';
import type { Actor, Draft, Report, Source } from '../src/core/types';
import type { Workspace } from '../src/core/workspace';

const directory = mkdtempSync(join(tmpdir(), 'clara-lifecycle-'));
process.env.PROMETEU_DATA_DIR = directory;
process.env.AUTH_MODE = 'demo';
process.env.AI_PROVIDER = 'demo';
process.env.LOCAL_AUTH_ENABLED = 'true';
after(() => { db().close(); rmSync(directory, { recursive: true, force: true }); });
type Client = { actor: Actor; cookie: string; workspace?: string };
function account(): Client {
  const actor: Actor = { id: crypto.randomUUID(), name: 'Pessoa de teste', demo: true };
  initialize(actor); return { actor, cookie: `prometeu-session=${session(actor)}` };
}
async function request(path: string, input?: unknown, client?: Client, method = input === undefined ? 'GET' : 'POST') {
  const form = input instanceof FormData;
  const req = new NextRequest(`http://localhost:3000/api/${path}`, { method, headers: {
    ...(client ? { cookie: client.cookie } : {}), ...(client?.workspace ? { 'x-clara-workspace': client.workspace } : {}),
    ...(method !== 'GET' ? { origin: 'http://localhost:3000' } : {}), ...(input !== undefined && !form ? { 'content-type': 'application/json' } : {}),
  }, ...(input !== undefined ? { body: form ? input : JSON.stringify(input) } : {}) });
  return (method === 'GET' ? GET : method === 'DELETE' ? DELETE : POST)(req, { params: Promise.resolve({ path: path.split('/') }) });
}
async function ok<T>(path: string, input: unknown, client?: Client, method?: string): Promise<T> {
  const response = await request(path, input, client, method);
  const payload = await response.json(); assert.equal(response.status, 200, JSON.stringify(payload)); return payload as T;
}
function file(csv: string) {
  const form = new FormData(); form.set('file', new File([csv], 'vendas.csv', { type: 'text/csv' })); return form;
}
async function sourceFor(client: Client) {
  const preview = await ok<{ id: string }>('imports/preview', file('Data;Região;Vendas;Status\n2026-09;Sul;100;Confirmado\n2026-09;Norte;200;Pendente\n2026-10;Norte;300;Confirmado'), client);
  return ok<Source>('imports/confirm', { uploadId: preview.id, name: 'Vendas', metricKey: 'field2', groupBy: 'field1', dateColumn: 'field0', budgetMetric: null, unit: 'BRL', operation: 'sum', rule: { column: 'field3', value: 'Confirmado' } }, client);
}
async function draftFor(client: Client, source: Source) {
  return ok<Draft>('drafts', { sourceId: source.id, prompt: 'Compare vendas por região com tabela.' }, client);
}
async function reportFor(client: Client, source: Source) {
  const draft = await draftFor(client, source);
  return ok<Report>(`drafts/${draft.id}/save`, { revision: draft.revision, plan: draft.plan }, client);
}
function workState(client: Client, source: Source, draft?: Draft) {
  return { version: 1, owner: workOwner(client.actor.id, client.workspace || client.actor.id), sourceId: source.id, sourceRevision: source.revision,
    prompt: 'Texto ainda não enviado', lastPrompt: '', plan: draft?.plan ?? null, assistantOpen: true,
    ...(draft ? { draftId: draft.id, draftRevision: draft.revision, expiresAt: draft.expiresAt } : {}) };
}

test('fonte: colunas reordenadas preservam chaves; cálculo, histórico, conflito e restauração', async () => {
  const client = account(), source = await sourceFor(client), report = await reportFor(client, source);
  const invalid = await request(`sources/${source.id}/replacement-preview`, file('Região;Vendas\nSul;250'), client);
  assert.equal(invalid.status, 400); assert.match((await invalid.json()).error, /colunas/);
  assert.equal(read<Source>('source', source.id, client.actor.id)!.revision, 1);
  const preview = await ok<{ id: string; rows: Record<string, unknown>[] }>(`sources/${source.id}/replacement-preview`, file('Vendas;Status;Região;Data;Canal\n250;Confirmado;Sul;2026-09;Loja\n50;Confirmado;Norte;2026-10;Web\n900;Pendente;Norte;2026-10;Web'), client);
  assert.equal(preview.rows[0].field2, 250); assert.equal(preview.rows[0].field1, 'Sul');
  assert.equal(list<Source>('source', client.actor.id).find(item => item.id === source.id)!.rows[0].field2, 100, 'Prévia não atualiza a fonte');
  const secondPreview = await ok<{ id: string }>(`sources/${source.id}/replacement-preview`, file('Data;Região;Vendas;Status\n2026-09;Sul;999;Confirmado'), client);
  const updated = await ok<Source>(`sources/${source.id}/replace`, { uploadId: preview.id, revision: 1 }, client);
  assert.equal(updated.revision, 2); assert.equal(updated.columns.find(c => c.label === 'Vendas')!.key, 'field2');
  assert.equal(calculate(updated.metrics[0], includedRows(updated)), 300);
  assert.equal((await request(`sources/${source.id}/replace`, { uploadId: secondPreview.id, revision: 1 }, client)).status, 409);
  const bootstrap = await ok<{ sources: Source[]; reports: Report[] }>('bootstrap', undefined, client);
  const reportAfter = bootstrap.reports.find(item => item.id === report.id)!;
  const liveSource = bootstrap.sources.find(item => item.id === reportAfter.sourceId)!;
  assert.equal(reportAfter.sourceRevision, 1); assert.equal(liveSource.revision, 2);
  assert.equal(calculate(liveSource.metrics[0], includedRows(liveSource, reportAfter.plan.filters)), 300, 'Dashboard usa valores atuais da fonte, não snapshot antigo');
  const versions = await ok<(Omit<Source, 'rows'> & { rowCount: number; sourceId: string })[]>(`sources/${source.id}/versions`, undefined, client);
  assert.equal(versions.length, 2); assert.equal(versions[1].revision, 1); assert.ok(!('rows' in versions[1]));
  assert.equal((await request(`sources/${source.id}/restore`, { versionId: versions[1].id, revision: 1 }, client)).status, 409);
  const restored = await ok<Source>(`sources/${source.id}/restore`, { versionId: versions[1].id, revision: 2 }, client);
  assert.equal(restored.revision, 3); assert.equal(calculate(restored.metrics[0], includedRows(restored)), 400);
  assert.equal((await ok<unknown[]>(`sources/${source.id}/versions`, undefined, client)).length, 3);
});

test('fonte: mudanças de tipo e eliminação do critério são rejeitadas sem alterar dados', async () => {
  const client = account(), source = await sourceFor(client);
  assert.equal((await request(`sources/${source.id}/replacement-preview`, file('Data;Região;Vendas;Status\n2026-09;Sul;não numérico;Confirmado'), client)).status, 400);
  assert.equal((await request(`sources/${source.id}/replacement-preview`, file('Data;Região;Vendas;Status\n2026-09;Sul;100;Pendente'), client)).status, 400);
  const other = account();
  assert.equal((await request(`sources/${source.id}/versions`, undefined, other)).status, 404);
  assert.equal((await request(`sources/${source.id}/replacement-preview`, file('Data;Região;Vendas;Status\n2026-09;Sul;100;Confirmado'), other)).status, 404);
  assert.equal(read<Source>('source', source.id, client.actor.id)!.revision, 1);
});

test('dashboard: editar e renomear versiona, conflito preserva, duplicar e restaurar mantêm isolamento', async () => {
  const client = account(), source = await sourceFor(client), report = await reportFor(client, source);
  const updated = await ok<Report>(`reports/${report.id}`, { revision: 1, title: 'Vendas do Sul', plan: { ...report.plan, filters: { field1: 'Sul' }, displayTable: false } }, client);
  assert.equal(updated.revision, 2); assert.equal(updated.plan.title, 'Vendas do Sul'); assert.equal(updated.editedBy, client.actor.id);
  assert.equal((await request(`reports/${report.id}`, { revision: 1, plan: report.plan }, client)).status, 409);
  assert.equal((await request(`reports/${report.id}`, { revision: 2, plan: { ...report.plan, primaryMetric: 'inexistente' } }, client)).status, 400);
  assert.equal(read<Report>('report', report.id, client.actor.id)!.revision, 2);
  const duplicate = await ok<Report>(`reports/${report.id}/duplicate`, {}, client);
  assert.notEqual(duplicate.id, report.id); assert.equal(duplicate.revision, 1); assert.match(duplicate.plan.title, /cópia/); assert.deepEqual(duplicate.plan.filters, updated.plan.filters);
  const versions = await ok<(Report & { reportId: string })[]>(`reports/${report.id}/versions`, undefined, client);
  assert.equal(versions.length, 2); assert.equal(versions[1].plan.title, report.plan.title);
  assert.equal((await request(`reports/${duplicate.id}/restore`, { versionId: versions[1].id, revision: 1 }, client)).status, 404);
  const restored = await ok<Report>(`reports/${report.id}/restore`, { versionId: versions[1].id, revision: 2 }, client);
  assert.equal(restored.revision, 3); assert.deepEqual(restored.plan, report.plan);
  assert.equal((await ok<unknown[]>(`reports/${report.id}/versions`, undefined, client)).length, 3);
  assert.equal((await request(`reports/${report.id}/duplicate`, {}, account())).status, 404);
  await ok(`reports/${report.id}`, undefined, client, 'DELETE');
  assert.equal((await request(`reports/${report.id}/versions`, undefined, client)).status, 404);
  assert.equal(list<Report & { reportId: string }>('report-version', client.actor.id).filter(item => item.reportId === report.id).length, 0);
  assert.ok(read<Report>('report', duplicate.id, client.actor.id));
});

test('trabalho durável: revisão, isolamento entre pessoas e espaços, conversa estrangeira e fonte trocada', async () => {
  const admin = account(), member = account();
  const team = await ok<Workspace>('workspaces', { name: 'Equipe de teste' }, admin);
  const invite = await ok<{ code: string }>(`workspaces/${team.id}/invites`, { role: 'editor' }, admin);
  await ok('workspaces/join', { code: invite.code }, member);
  const scopedAdmin = { ...admin, workspace: team.id }, scopedMember = { ...member, workspace: team.id };
  const source = await sourceFor(scopedAdmin), draft = await draftFor(scopedAdmin, source);
  const state = workState(scopedAdmin, source, draft);
  assert.equal((await ok<{ revision: number }>('work', undefined, scopedAdmin)).revision, 0);
  const saved = await ok<{ revision: number; state: unknown }>('work', { revision: 0, state }, scopedAdmin);
  assert.equal(saved.revision, 1); assert.deepEqual(saved.state, state);
  assert.equal((await request('work', { revision: 0, state: null }, scopedAdmin)).status, 409);
  assert.equal((await ok<{ state: unknown }>('work', undefined, scopedMember)).state, null);
  assert.equal((await ok<{ state: unknown }>('work', undefined, admin)).state, null);
  assert.equal((await request('work', { revision: 0, state }, scopedMember)).status, 403);
  assert.equal((await request('work', { revision: 0, state: { ...state, owner: admin.actor.id } }, admin)).status, 404);
  const foreignSource = await sourceFor(member), foreignDraft = await draftFor(member, foreignSource);
  assert.equal((await request('work', { revision: 1, state: { ...state, draftId: foreignDraft.id } }, scopedAdmin)).status, 404);
  const secondSource = await sourceFor(scopedAdmin);
  assert.equal((await request('work', { revision: 1, state: { ...state, sourceId: secondSource.id } }, scopedAdmin)).status, 409);
  assert.equal((await ok<{ revision: number }>('work', { revision: 1, state: null }, scopedAdmin)).revision, 2);
  assert.equal((await ok<{ state: unknown }>('work', undefined, scopedAdmin)).state, null);
});

test('conta local: scrypt/salt, email normalizado, autenticação, inválidos e duplicidade', async () => {
  const email = `Pessoa.${crypto.randomUUID()}@Example.com`, password = 'senha de teste longa';
  const response = await request('auth/register', { mode: 'local', email, password, name: 'Conta Local' });
  assert.equal(response.status, 200); const registered = await response.json();
  assert.equal(registered.actor.auth, 'local'); assert.equal(registered.actor.demo, false); assert.equal(registered.actor.email, email.toLowerCase());
  const cookie = response.headers.get('set-cookie')!.split(';')[0]; assert.match(response.headers.get('set-cookie')!, /HttpOnly/);
  const stored = db().prepare('SELECT * FROM local_accounts WHERE email=?').get(email.toLowerCase())!;
  assert.equal(String(stored.hash).length, 128); assert.equal(String(stored.salt).length, 64); assert.ok(!JSON.stringify(stored).includes(password));
  assert.equal((await request('auth/register', { mode: 'local', email: email.toLowerCase(), password, name: 'Duplicada' })).status, 409);
  assert.equal((await request('auth/login', { mode: 'local', email, password: 'outra senha errada' })).status, 401);
  assert.equal((await request('auth/login', { mode: 'local', email: 'desconhecido@example.com', password })).status, 401);
  const login = await ok<{ actor: Actor }>('auth/login', { mode: 'local', email: ` ${email.toUpperCase()} `, password });
  assert.equal(login.actor.id, registered.actor.id);
  assert.equal((await request('bootstrap', undefined, { actor: registered.actor, cookie })).status, 200);
  assert.equal((await request('auth/register', { mode: 'local', email: 'invalid', password, name: 'Nome' })).status, 400);
  assert.equal((await request('auth/register', { mode: 'local', email: 'short@example.com', password: 'curta', name: 'Nome' })).status, 400);
  assert.equal((await request('auth/register', { mode: 'local', email: 'missing@example.com', password })).status, 400);
  process.env.LOCAL_AUTH_ENABLED = 'false';
  try { assert.equal((await request('auth/login', { mode: 'local', email, password })).status, 403); }
  finally { process.env.LOCAL_AUTH_ENABLED = 'true'; }
});

test('leitor: API recusa gravações apesar de payload válido; editor não gerencia equipe', async () => {
  const admin = account(), reader = account(), editor = account();
  const team = await ok<Workspace>('workspaces', { name: 'Equipe protegida' }, admin);
  for (const [client, role] of [[reader, 'reader'], [editor, 'editor']] as const) {
    const invite = await ok<{ code: string }>(`workspaces/${team.id}/invites`, { role }, admin); await ok('workspaces/join', { code: invite.code }, client);
  }
  const author = { ...admin, workspace: team.id }, viewer = { ...reader, workspace: team.id }, writer = { ...editor, workspace: team.id };
  const source = await sourceFor(author), report = await reportFor(author, source), draft = await draftFor(author, source);
  assert.equal((await request('bootstrap', undefined, viewer)).status, 200);
  const mutations: [string, unknown, string?][] = [
    ['imports/preview', file('Região;Valor\nSul;1')], ['imports/sap-preview', {}], ['imports/confirm', {}], ['sources/sap', { domain: 'sales' }],
    [`sources/${source.id}/replacement-preview`, file('Data;Região;Vendas;Status\n2026-09;Sul;1;Confirmado')],
    [`sources/${source.id}/replace`, { uploadId: crypto.randomUUID(), revision: 1 }], [`sources/${source.id}/restore`, { versionId: crypto.randomUUID(), revision: 1 }],
    ['drafts', { sourceId: source.id, prompt: 'Compare vendas por região.' }], [`drafts/${draft.id}/save`, { revision: draft.revision, plan: draft.plan }], ['work/resume', { revision: 1, draftId: draft.id }],
    [`reports/${report.id}`, { revision: 1, plan: report.plan }], [`reports/${report.id}/duplicate`, {}], [`reports/${report.id}/restore`, { revision: 1, versionId: crypto.randomUUID() }],
    [`reports/${report.id}`, undefined, 'DELETE'],
  ];
  for (const [path, input, method] of mutations) assert.equal((await request(path, input, viewer, method)).status, 403, path);
  assert.equal((await request(`workspaces/${team.id}/invites`, { role: 'admin' }, writer)).status, 403);
  assert.equal((await request(`workspaces/${team.id}/members/${admin.actor.id}`, { role: 'reader' }, viewer)).status, 403);
  const spoofed = { ...viewer, workspace: admin.actor.id };
  assert.equal((await request('bootstrap', undefined, spoofed)).status, 404);
  assert.equal((await request(`reports/${report.id}/duplicate`, {}, writer)).status, 200);
  assert.equal(read<Source>('source', source.id, team.id)!.revision, 1);
  // A private recovery buffer is not a shared resource mutation; readers may save their own local consultation state.
  assert.equal((await request('work', { revision: 0, state: workState(viewer, source) }, viewer)).status, 200);
});

test('recuperação explícita de conversa expirada preserva o plano local completo e não reabre a antiga', async () => {
  const client = account(), source = await sourceFor(client), draft = await draftFor(client, source);
  const expired = { ...draft, expiresAt: new Date(Date.now() - 1000).toISOString() };
  update('draft', expired);
  assert.equal((await request(`drafts/${draft.id}`, undefined, client)).status, 410);
  const state = { ...workState(client, source, expired), prompt: 'Pergunta ainda não enviada', lastPrompt: 'Pergunta anterior',
    plan: { ...draft.plan, filters: { field1: 'Sul' }, filterSelections: { field3: ['Confirmado'] }, displayTable: false,
      calculatedMetrics: [{ key: 'calc_double', label: 'Vendas em dobro', unit: 'BRL' as const, operation: 'sum' as const, expression: '[field2] * 2' }],
      selectedMetrics: ['field2', 'calc_double'], periodComparison: { dateColumn: 'field0', current: '2026-10', previous: '2026-09' } }, recovery: 'A conversa expirou' };
  await ok('work', { revision: 0, state }, client);
  assert.equal((await request('work/resume', { revision: 2, draftId: draft.id }, client)).status, 409);
  const before = list<Draft>('draft', client.actor.id).length;
  const result = await ok<{ draft: Draft; work: { revision: number; state: typeof state } }>('work/resume', { revision: 1, draftId: draft.id }, client);
  assert.notEqual(result.draft.id, draft.id); assert.equal(result.draft.revision, 1);
  assert.deepEqual(result.draft.plan, state.plan); assert.deepEqual(result.draft.messages, draft.messages);
  assert.ok(Date.parse(result.draft.expiresAt) > Date.now() + 29 * 60000);
  assert.equal(result.work.revision, 2); assert.equal(result.work.state.draftId, result.draft.id);
  assert.equal(result.work.state.prompt, state.prompt); assert.equal(result.work.state.lastPrompt, state.lastPrompt); assert.equal(result.work.state.recovery, '');
  assert.equal((await request(`drafts/${draft.id}`, undefined, client)).status, 410);
  assert.equal((await request(`drafts/${result.draft.id}`, undefined, client)).status, 200);
  assert.equal((await request('work/resume', { revision: 1, draftId: draft.id }, client)).status, 409);
  assert.equal(list<Draft>('draft', client.actor.id).length, before + 1);
});

test('recuperação recusa fonte alterada, plano inválido e estado de outra conta', async () => {
  const client = account(), source = await sourceFor(client), draft = await draftFor(client, source);
  update('draft', { ...draft, expiresAt: new Date(0).toISOString() });
  const state = workState(client, source, draft);
  await ok('work', { revision: 0, state }, client);
  update('source', { ...source, revision: 2 });
  const changed = await request('work/resume', { revision: 1, draftId: draft.id }, client);
  assert.equal(changed.status, 409); assert.match((await changed.json()).error, /fonte mudou/i);
  assert.equal((await ok<{ revision: number }>('work', undefined, client)).revision, 1);
  update('source', source);
  await ok('work', { revision: 1, state: { ...state, plan: { ...draft.plan, filters: { field1: 'Não existe' } } } }, client);
  assert.equal((await request('work/resume', { revision: 2, draftId: draft.id }, client)).status, 400);
  const other = account(), otherSource = await sourceFor(other);
  await ok('work', { revision: 0, state: workState(other, otherSource) }, other);
  assert.equal((await request('work/resume', { revision: 1, draftId: draft.id }, other)).status, 404);
  assert.equal((await request('work', { revision: 1, state }, other)).status, 403);
  assert.equal(list<Draft>('draft', client.actor.id).length, 1);
});

test('idempotência: repetir confirmação de fonte e pedido de cópia não duplica resultados', async () => {
  const client = account(), source = await sourceFor(client), report = await reportFor(client, source);
  const preview = await ok<{ id: string }>(`sources/${source.id}/replacement-preview`, file('Data;Região;Vendas;Status\n2026-09;Sul;500;Confirmado'), client);
  const input = { uploadId: preview.id, revision: source.revision };
  const [a, b] = await Promise.all([ok<Source>(`sources/${source.id}/replace`, input, client), ok<Source>(`sources/${source.id}/replace`, input, client)]);
  assert.equal(a.id, b.id); assert.equal(a.revision, 2); assert.equal(b.revision, 2);
  assert.equal(read<Source>('source', source.id, client.actor.id)!.revision, 2);
  assert.equal((await ok<unknown[]>(`sources/${source.id}/versions`, undefined, client)).length, 2);
  const count = list<Report>('report', client.actor.id).length, requestId = crypto.randomUUID();
  const [first, repeated] = await Promise.all([ok<Report>(`reports/${report.id}/duplicate`, { requestId }, client), ok<Report>(`reports/${report.id}/duplicate`, { requestId }, client)]);
  assert.equal(first.id, repeated.id); assert.equal(list<Report>('report', client.actor.id).length, count + 1);
  assert.equal((await request(`reports/${first.id}/duplicate`, { requestId }, client)).status, 409, 'Mesmo token não pode representar outra operação');
  const other = account(), otherReport = list<Report>('report', other.actor.id)[0];
  assert.equal((await request(`reports/${otherReport.id}/duplicate`, { requestId }, other)).status, 200, 'Tokens de idempotência são isolados por espaço');
});

test('readiness pública verifica o banco; dados de operação exigem administrador do espaço', async () => {
  const response = await request('health/ready'); const health = await response.json();
  assert.equal(response.status, 200); assert.equal(health.status, 'ok'); assert.equal(health.database, 'ready'); assert.equal(health.app, 'prometeu');
  const admin = account(), reader = account(); const team = await ok<Workspace>('workspaces', { name: 'Operação' }, admin);
  assert.equal((await request(`workspaces/${team.id}/operations`)).status, 401);
  const invite = await ok<{ code: string }>(`workspaces/${team.id}/invites`, { role: 'reader' }, admin); await ok('workspaces/join', { code: invite.code }, reader);
  assert.equal((await request(`workspaces/${team.id}/operations`, undefined, reader)).status, 403);
  const ops = await ok<{ health: { status: string }; resources: unknown[] }>(`workspaces/${team.id}/operations`, undefined, admin);
  assert.equal(ops.health.status, 'ok'); assert.equal(ops.resources.length, 0);
});

test('conversas de equipe são privadas por pessoa, inclusive entre administradores; relatórios são compartilhados', async () => {
  const owner = account(), editor = account(), admin = account();
  const team = await ok<Workspace>('workspaces', { name: 'Conversas privadas' }, owner);
  for (const [client, role] of [[editor, 'editor'], [admin, 'admin']] as const) {
    const invite = await ok<{ code: string }>(`workspaces/${team.id}/invites`, { role }, owner);
    await ok('workspaces/join', { code: invite.code }, client);
  }
  const author = { ...owner, workspace: team.id }, otherEditor = { ...editor, workspace: team.id }, otherAdmin = { ...admin, workspace: team.id };
  const source = await sourceFor(author), draft = await draftFor(author, source);
  assert.equal(draft.owner, team.id); assert.equal(draft.createdBy, owner.actor.id);
  for (const other of [otherEditor, otherAdmin]) {
    assert.equal((await request(`drafts/${draft.id}`, undefined, other)).status, 404);
    assert.equal((await request('drafts', { sourceId: source.id, draftId: draft.id, revision: draft.revision, prompt: 'Mostre em linha.' }, other)).status, 404);
    assert.equal((await request(`drafts/${draft.id}/save`, { revision: draft.revision, plan: draft.plan }, other)).status, 404);
    assert.equal((await request('work', { revision: 0, state: workState(other, source, draft) }, other)).status, 404);
    // A persisted buffer from before author checks must not bypass resume's own permission check.
    const work = await ok<{ id: string; owner: string; revision: number; state: ReturnType<typeof workState>; updatedAt: string }>('work', { revision: 0, state: workState(other, source) }, other);
    update('work', { ...work, state: workState(other, source, draft) });
    assert.equal((await request('work/resume', { revision: work.revision, draftId: draft.id }, other)).status, 404);
  }
  assert.equal(read<Draft>('draft', draft.id, team.id)!.revision, draft.revision);
  const own = await ok<Draft>('drafts', { sourceId: source.id, draftId: draft.id, revision: draft.revision, prompt: 'Mostre em linha.' }, author);
  assert.equal(own.createdBy, author.actor.id); assert.equal(own.revision, 2);
  await ok('work', { revision: 0, state: workState(author, source, own) }, author);
  const report = await ok<Report>(`drafts/${own.id}/save`, { revision: own.revision, plan: own.plan }, author);
  for (const other of [otherEditor, otherAdmin]) {
    const bootstrap = await ok<{ reports: Report[]; sources: Source[] }>('bootstrap', undefined, other);
    assert.ok(bootstrap.reports.some(item => item.id === report.id));
    assert.ok(bootstrap.sources.some(item => item.id === source.id));
    assert.equal((await request(`drafts/${draft.id}`, undefined, other)).status, 404, 'Salvar não publica a conversa');
    assert.equal((await request(`drafts/${draft.id}/save`, { revision: own.revision, plan: own.plan }, other)).status, 404, 'Retorno idempotente não contorna privacidade');
  }
});

test('conversas pessoais legadas continuam acessíveis; legado de equipe sem autor é recusado', async () => {
  const client = account(), personalSource = await sourceFor(client), personalDraft = await draftFor(client, personalSource);
  update('draft', { ...personalDraft, createdBy: undefined });
  assert.equal((await request(`drafts/${personalDraft.id}`, undefined, client)).status, 200);
  const refined = await ok<Draft>('drafts', { sourceId: personalSource.id, draftId: personalDraft.id, revision: personalDraft.revision, prompt: 'Mostre em linha.' }, client);
  assert.equal(refined.createdBy, client.actor.id);
  update('draft', { ...refined, createdBy: undefined, expiresAt: new Date(0).toISOString() });
  await ok('work', { revision: 0, state: workState(client, personalSource, refined) }, client);
  const resumed = await ok<{ draft: Draft }>('work/resume', { revision: 1, draftId: refined.id }, client);
  assert.equal(resumed.draft.createdBy, client.actor.id);
  assert.equal((await request(`drafts/${resumed.draft.id}/save`, { revision: resumed.draft.revision, plan: resumed.draft.plan }, client)).status, 200);

  const team = await ok<Workspace>('workspaces', { name: 'Legado sem autor' }, client), scoped = { ...client, workspace: team.id };
  const source = await sourceFor(scoped), draft = await draftFor(scoped, source);
  await ok('work', { revision: 0, state: workState(scoped, source, draft) }, scoped);
  update('draft', { ...draft, createdBy: undefined });
  assert.equal((await request(`drafts/${draft.id}`, undefined, scoped)).status, 404);
  assert.equal((await request('drafts', { sourceId: source.id, draftId: draft.id, revision: draft.revision, prompt: 'Mostre em linha.' }, scoped)).status, 404);
  assert.equal((await request(`drafts/${draft.id}/save`, { revision: draft.revision, plan: draft.plan }, scoped)).status, 404);
  assert.equal((await request('work', { revision: 1, state: workState(scoped, source, draft) }, scoped)).status, 404);
  assert.equal((await request('work/resume', { revision: 1, draftId: draft.id }, scoped)).status, 404);
});

test('limite de pedidos conta a pessoa entre espaços e não bloqueia colegas da equipe', async t => {
  t.mock.method(console, 'info', () => {});
  const admin = account(), editor = account();
  const team = await ok<Workspace>('workspaces', { name: 'Limite individual' }, admin);
  const invite = await ok<{ code: string }>(`workspaces/${team.id}/invites`, { role: 'editor' }, admin);
  await ok('workspaces/join', { code: invite.code }, editor);
  const first = { ...admin, workspace: team.id }, second = { ...editor, workspace: team.id }, source = await sourceFor(first);
  for (let i = 0; i < 20; i++) assert.equal((await request('drafts', { sourceId: source.id, prompt: 'Compare vendas por região.' }, first)).status, 200);
  assert.equal((await request('drafts', { sourceId: source.id, prompt: 'Compare vendas por região.' }, first)).status, 429);
  assert.equal((await request('drafts', { sourceId: source.id, prompt: 'Compare vendas por região.' }, second)).status, 200);
  const personalSource = list<Source>('source', admin.actor.id)[0];
  assert.equal((await request('drafts', { sourceId: personalSource.id, prompt: 'Compare despesas por centro de custo.' }, admin)).status, 429);
});
