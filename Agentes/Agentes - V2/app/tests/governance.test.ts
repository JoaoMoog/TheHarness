import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { db, initialize, list, insert } from '../src/server/store';
import { acceptInvite, auditLog, createInvite, createWorkspace, governanceDb, governanceState, handleWorkspaceRequest, listWorkspaces, resolveWorkspace, revokeInvite, updateMember } from '../src/server/workspaces';
import { readiness, recordRequest, workspaceOperations } from '../src/server/operations';
import { parseFile } from '../src/core/import';
import { groupValues, includedRows, calculate, basePlan } from '../src/core/engine';
import { importedSource } from '../src/server/import';
import type { Actor, Source } from '../src/core/types';

const directory = mkdtempSync(join(tmpdir(), 'clara-governance-'));
process.env.PROMETEU_DATA_DIR = directory;
after(() => { db().close(); rmSync(directory, { recursive: true, force: true }); });
const actor = (name = 'Pessoa'): Actor => ({ id: crypto.randomUUID(), name, demo: true });
const status = (expected: number) => (error: unknown) => !!error && typeof error === 'object' && 'status' in error && error.status === expected;

test('espaço pessoal conserva dados legados, aceita convite e protege o proprietário', () => {
  const admin = actor(); initialize(admin); const source = list<Source>('source', admin.id)[0];
  const workspace = resolveWorkspace(admin);
  assert.equal(workspace.id, admin.id); assert.equal(workspace.role, 'admin'); assert.equal(workspace.personal, true);
  assert.equal(list<Source>('source', workspace.owner)[0].id, source.id);
  const guest=actor();acceptInvite(guest,createInvite(admin,workspace.id,'reader').code);
  assert.equal(resolveWorkspace(guest,workspace.id).role,'reader');
  assert.throws(()=>updateMember(admin,workspace.id,admin.id,'reader'),status(409));
  updateMember(admin,workspace.id,guest.id,null);
  assert.throws(()=>resolveWorkspace(guest,workspace.id),status(404));
  assert.equal(listWorkspaces(admin).length, 1);
});

test('papéis aplicados no servidor, isolamento e corte de acesso após remoção', () => {
  const admin = actor('Admin'), reader = actor('Leitor'), editor = actor('Editor'), outsider = actor();
  const workspace = createWorkspace(admin, 'Controladoria');
  acceptInvite(reader, createInvite(admin, workspace.id, 'reader').code);
  acceptInvite(editor, createInvite(admin, workspace.id, 'editor').code);
  assert.equal(resolveWorkspace(reader, workspace.id).role, 'reader');
  assert.throws(() => resolveWorkspace(reader, workspace.id, 'write'), status(403));
  assert.equal(resolveWorkspace(editor, workspace.id, 'write').owner, workspace.id);
  assert.throws(() => governanceState(editor, workspace.id), status(403));
  assert.throws(() => resolveWorkspace(outsider, workspace.id), status(404));
  assert.throws(() => createInvite(reader, workspace.id, 'admin'), status(403));
  updateMember(admin, workspace.id, reader.id, 'editor');
  assert.equal(resolveWorkspace(reader, workspace.id, 'write').role, 'editor');
  updateMember(admin, workspace.id, reader.id, null);
  assert.throws(() => resolveWorkspace(reader, workspace.id), status(404));
});

test('convites single-use, revogação, expiração e armazenamento sem código', () => {
  const admin = actor(), member = actor(), workspace = createWorkspace(admin, 'Equipe');
  const invite = createInvite(admin, workspace.id, 'reader');
  const stored = governanceDb().prepare('SELECT * FROM workspace_invites WHERE id=?').get(invite.id)!;
  assert.ok(!JSON.stringify(stored).includes(invite.code));
  acceptInvite(member, invite.code);
  assert.throws(() => acceptInvite(actor(), invite.code), status(404));
  const revoked = createInvite(admin, workspace.id, 'editor'); revokeInvite(admin, workspace.id, revoked.id);
  assert.throws(() => acceptInvite(actor(), revoked.code), status(404));
  const expired = createInvite(admin, workspace.id, 'admin');
  governanceDb().prepare('UPDATE workspace_invites SET expires_at=? WHERE id=?').run('2000-01-01T00:00:00.000Z', expired.id);
  assert.throws(() => acceptInvite(actor(), expired.code), status(404));
  const duplicate = createInvite(admin, workspace.id, 'reader');
  assert.throws(() => acceptInvite(admin, duplicate.code), status(409));
  assert.equal(resolveWorkspace(admin, workspace.id).role, 'admin');
  assert.ok(!JSON.stringify(governanceState(admin, workspace.id)).includes(duplicate.code));
});

test('último administrador não pode ser removido ou rebaixado; auditoria isolada', () => {
  const admin = actor(), other = actor(), workspace = createWorkspace(admin, 'A');
  assert.throws(() => updateMember(admin, workspace.id, admin.id, null), status(409));
  assert.throws(() => updateMember(admin, workspace.id, admin.id, 'reader'), status(409));
  acceptInvite(other, createInvite(admin, workspace.id, 'admin').code);
  updateMember(admin, workspace.id, admin.id, 'reader');
  assert.throws(() => auditLog(admin, workspace.id), status(403));
  const entries = auditLog(other, workspace.id);
  assert.ok(entries.some(entry => entry.action === 'member.role.reader'));
  assert.ok(entries.some(entry => entry.action === 'member.joined' && entry.actorId === other.id));
  assert.ok(entries.every(entry => !('code' in entry)));
  const next = auditLog(other, workspace.id, entries[0].id, 1);
  assert.equal(next.length, 1); assert.ok(next[0].id < entries[0].id);
  assert.throws(() => handleWorkspaceRequest(other, 'POST', ['workspaces'], { name: 'B', injected: true }));
});

test('monitoramento separa recursos por espaço e limita janela de métricas', () => {
  const admin = actor(); initialize(admin); const workspace = createWorkspace(admin, 'Operação');
  recordRequest(12, 200); recordRequest(120, 503);
  assert.equal(readiness().status, 'ok');
  assert.equal(workspaceOperations(admin, workspace.id).resources.length, 0);
  assert.equal(workspaceOperations(admin, admin.id).resources.length, 2);
  assert.equal(workspaceOperations(admin, workspace.id).processWindow.errors, 1);
});

test('20 mil linhas: importar, agregar com critérios, persistir e consultar espaços isolados', () => {
  const begin = performance.now();
  const rows = Array.from({ length: 20000 }, (_, i) => ({ Região: `Grupo ${i % 200}`, Valor: i % 10 + 1, Status: i % 2 ? 'Confirmado' : 'Pendente', Data: '2026-09-01' }));
  const sample = parseFile(Buffer.from(JSON.stringify(rows)), 'volume.json');
  const admin = actor(); const workspace = createWorkspace(admin, 'Volume');
  const source = importedSource({ ...sample, id: crypto.randomUUID(), owner: workspace.owner, expiresAt: new Date(Date.now() + 60000).toISOString() }, {
    uploadId: crypto.randomUUID(), name: 'Volume', metricKey: 'field1', groupBy: 'field0', dateColumn: 'field3', budgetMetric: null,
    unit: 'number', operation: 'sum', rule: { column: 'field2', value: 'Confirmado' },
  });
  insert('source', source);
  const restored = list<Source>('source', workspace.owner)[0];
  assert.equal(restored.rows.length, 20000);
  assert.equal(list<Source>('source', actor().id).length, 0);
  const included = includedRows(restored), groups = groupValues(restored, basePlan(restored));
  assert.equal(included.length, 10000); assert.equal(groups.length, 100);
  assert.equal(calculate(restored.metrics[0], included), 60000);
  assert.equal(groups.reduce((sum, row) => sum + (row.value ?? 0), 0), 60000);
  assert.ok(performance.now() - begin < 15000, 'Jornada local de 20 mil linhas deve caber no orçamento de 15s');
});
