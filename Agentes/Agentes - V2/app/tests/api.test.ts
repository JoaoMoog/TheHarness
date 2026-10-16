import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NextRequest } from 'next/server';
import { GET, POST, DELETE } from '../src/app/api/[...path]/route';
import { db, initialize, list, update } from '../src/server/store';
import { session } from '../src/server/auth';
import type { Actor, Draft, Source, Report } from '../src/core/types';

const directory = mkdtempSync(join(tmpdir(), 'prometeu-test-'));
process.env.PROMETEU_DATA_DIR = directory;
process.env.AI_PROVIDER = 'demo';
process.env.AUTH_MODE = 'demo';
const actor = (id = crypto.randomUUID()): Actor => ({ id, name: 'Teste', demo: true });
function authenticate(person: Actor) { initialize(person); return `prometeu-session=${session(person)}`; }
async function request(path: string, body?: unknown, cookie?: string, method?: string, origin = 'http://localhost:3000') {
  const verb = method || (body ? 'POST' : 'GET');
  const req = new NextRequest(`http://localhost:3000/api/${path}`, { method: verb,
    headers: { ...(cookie ? { cookie } : {}), ...(verb !== 'GET' ? { origin, 'content-type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}) });
  return (verb === 'GET' ? GET : verb === 'DELETE' ? DELETE : POST)(req, { params: Promise.resolve({ path: path.split('/') }) });
}
async function draftFor(person: Actor, cookie: string, prompt = 'Compare despesas por centro de custo.') {
  const source = list<Source>('source', person.id)[0];
  const response = await request('drafts', { sourceId: source.id, prompt }, cookie);
  assert.equal(response.status, 200);
  return { source, draft: await response.json() as Draft };
}

after(() => { db().close(); rmSync(directory, { recursive: true, force: true }); });

test('API exige sessão e recusa mutações de outra origem', async () => {
  assert.equal((await request('bootstrap')).status, 401);
  assert.equal((await request('auth/login', { mode: 'demo' }, undefined, 'POST', 'https://outro-site.example')).status, 403);
  const person = actor(); const cookie = authenticate(person);
  assert.equal((await request('auth/logout', undefined, cookie, 'POST', 'https://outro-site.example')).status, 403);
  assert.equal((await request('bootstrap', undefined, cookie)).status, 200);
});

test('origem usa o host do navegador quando Next resolve a URL como endereço de escuta', async () => {
  const req = new NextRequest('http://0.0.0.0:3000/api/auth/login', { method: 'POST', headers: { host: 'localhost:3000', origin: 'http://localhost:3000', 'content-type': 'application/json' }, body: JSON.stringify({ mode: 'demo' }) });
  assert.equal((await POST(req, { params: Promise.resolve({ path: ['auth','login'] }) })).status, 200);
});

test('login de demonstração gera cookie HttpOnly e saída revoga a sessão', async () => {
  const response = await request('auth/login', { mode: 'demo' });
  assert.equal(response.status, 200);
  const raw = response.headers.get('set-cookie')!;
  assert.match(raw, /HttpOnly/i); assert.match(raw, /SameSite=lax/i);
  const cookie = raw.split(';')[0];
  assert.equal((await request('bootstrap', undefined, cookie)).status, 200);
  assert.equal((await request('auth/logout', undefined, cookie, 'POST')).status, 200);
  assert.equal((await request('bootstrap', undefined, cookie)).status, 401);
});

test('modo MSAL impede entrada de demonstração', async () => {
  process.env.AUTH_MODE = 'msal';
  try { assert.equal((await request('auth/login', { mode: 'demo' })).status, 403); }
  finally { process.env.AUTH_MODE = 'demo'; }
});

test('cada conta vê apenas suas fontes, conversas e dashboards', async () => {
  const first = actor(); const second = actor();
  const firstCookie = authenticate(first); const secondCookie = authenticate(second);
  const { source, draft } = await draftFor(first, firstCookie);
  assert.equal((await request(`drafts/${draft.id}`, undefined, secondCookie)).status, 404);
  assert.equal((await request('drafts', { sourceId: source.id, prompt: 'Compare valores.' }, secondCookie)).status, 404);
  const report = list<Report>('report', first.id)[0];
  assert.equal((await request(`reports/${report.id}`, undefined, secondCookie, 'DELETE')).status, 404);
});

test('prévia não cria relatório; salvar duas vezes cria apenas um', async () => {
  const person = actor(); const cookie = authenticate(person);
  const count = list<Report>('report', person.id).length;
  const { draft } = await draftFor(person, cookie, 'Compare despesas de Tecnologia em setembro de 2026.');
  assert.equal(list<Report>('report', person.id).length, count);
  const [first, second] = await Promise.all([1,2].map(() => request(`drafts/${draft.id}/save`, { revision: draft.revision, plan: draft.plan }, cookie)));
  assert.equal(first.status, 200); assert.equal(second.status, 200);
  const firstReport = await first.json(); const secondReport = await second.json();
  assert.equal(firstReport.id, secondReport.id);
  assert.equal(list<Report>('report', person.id).length, count + 1);
  assert.deepEqual(firstReport.plan.filters, { group: 'Tecnologia', period: '2026-09' });
  const stale = await request('drafts', { sourceId: draft.sourceId, draftId: draft.id, revision: draft.revision, prompt: 'Sem tabela' }, cookie);
  assert.equal(stale.status, 409);
});

test('refinamento preserva filtros escolhidos na prévia e rejeita versão antiga', async () => {
  const person = actor(); const cookie = authenticate(person);
  const { draft } = await draftFor(person, cookie);
  const response = await request('drafts', { sourceId: draft.sourceId, draftId: draft.id, revision: draft.revision,
    plan: { ...draft.plan, filters: { group: 'Comercial' } }, prompt: 'Mostre em linha, sem tabela.' }, cookie);
  assert.equal(response.status, 200);
  const next = await response.json(); assert.equal(next.revision, 2); assert.equal(next.plan.filters.group, 'Comercial');
  assert.equal((await request('drafts', { sourceId: draft.sourceId, draftId: draft.id, revision: 1, prompt: 'Sem tabela' }, cookie)).status, 409);
});

test('pergunta incompleta não pode ser salva nem convertida em pronta pelo cliente', async () => {
  const person = actor(); const cookie = authenticate(person);
  const { draft } = await draftFor(person, cookie, 'Mostre lucro.');
  assert.equal(draft.plan.status, 'clarify');
  assert.equal((await request(`drafts/${draft.id}/save`, { revision: draft.revision, plan: { ...draft.plan, status: 'ready' } }, cookie)).status, 400);
});

test('conversa expirada e fonte alterada são recusadas antes de salvar', async () => {
  const person = actor(); const cookie = authenticate(person);
  const { source, draft } = await draftFor(person, cookie);
  update('draft', { ...draft, expiresAt: new Date(0).toISOString() });
  assert.equal((await request(`drafts/${draft.id}`, undefined, cookie)).status, 410);
  update('draft', draft); update('source', { ...source, revision: 2 });
  assert.equal((await request(`drafts/${draft.id}/save`, { revision: draft.revision, plan: draft.plan }, cookie)).status, 400);
});

test('importação confere todas as linhas para listar critérios e só salva na confirmação', async () => {
  const person = actor(); const cookie = authenticate(person);
  const count = list<Source>('source', person.id).length;
  const form = new FormData(); form.set('file', new File(['Data;Região;Vendas;Status\n2026-09;Sul;100;Confirmado\n2026-09;Norte;200;Pendente'], 'vendas.csv', { type: 'text/csv' }));
  const req = new NextRequest('http://localhost:3000/api/imports/preview', { method: 'POST', headers: { cookie, origin: 'http://localhost:3000' }, body: form });
  const response = await POST(req, { params: Promise.resolve({ path: ['imports', 'preview'] }) });
  assert.equal(response.status, 200);
  const preview = await response.json(); assert.equal(preview.rowCount, 2);
  assert.deepEqual(preview.criteriaOptions.find((c: { key: string }) => c.key === 'field3').values, ['Confirmado','Pendente']);
  assert.equal(list<Source>('source', person.id).length, count);
  const input = { uploadId: preview.id, name: 'Vendas importadas', metricKey: 'field2', groupBy: 'field1', dateColumn: 'field0', budgetMetric: null, unit: 'BRL', operation: 'sum', rule: { column: 'field3', value: 'Confirmado' } };
  const confirmed = await request('imports/confirm', input, cookie);
  assert.equal(confirmed.status, 200);
  const source = await confirmed.json(); assert.equal(source.origin, 'file'); assert.equal(source.rule.value, 'Confirmado');
  assert.equal(list<Source>('source', person.id).length, count + 1);
  assert.equal((await request('imports/confirm', input, cookie)).status, 404);
});

test('áreas SAP são simuladas e podem ser reutilizadas sem duplicar a fonte', async () => {
  const person = actor(); const cookie = authenticate(person);
  const a = await (await request('sources/sap', { domain: 'sales' }, cookie)).json();
  const b = await (await request('sources/sap', { domain: 'sales' }, cookie)).json();
  assert.equal(a.id, b.id); assert.equal(a.origin, 'sap-demo'); assert.equal(a.domain, 'Vendas');
});
