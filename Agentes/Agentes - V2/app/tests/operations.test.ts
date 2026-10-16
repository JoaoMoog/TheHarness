import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createBackup, restoreBackup } from '../scripts/backup.mjs';
import { readSapSample } from '../src/server/sap';

test('backup consistente com WAL, restauração, revogação de sessão e recusa de corrupção', () => {
  const directory = mkdtempSync(join(tmpdir(), 'clara-backup-'));
  const database = new DatabaseSync(join(directory, 'prometeu.sqlite'));
  try {
    database.exec("PRAGMA journal_mode=WAL; CREATE TABLE resources(id TEXT PRIMARY KEY,owner TEXT,kind TEXT,data TEXT); CREATE TABLE sessions(token TEXT,actor TEXT,expires INTEGER); INSERT INTO resources VALUES('source','owner','source','{\"id\":\"source\"}'); INSERT INTO sessions VALUES('secret','actor',1);");
    const output = join(directory, 'snapshot.sqlite');
    createBackup(directory, output);
    database.exec("INSERT INTO resources VALUES('later','owner','source','{}');");
    const target = join(directory, 'restored'); restoreBackup(output, target);
    const restored = new DatabaseSync(join(target, 'prometeu.sqlite'));
    try { assert.equal(restored.prepare('SELECT COUNT(*) AS n FROM resources').get()!.n, 1); assert.equal(restored.prepare('SELECT COUNT(*) AS n FROM sessions').get()!.n, 0); }
    finally { restored.close(); }
    assert.throws(() => createBackup(directory, output), /destino já existe/);
    assert.throws(() => restoreBackup(output, target), /pasta nova/);
    const bytes = readFileSync(output); bytes[100] ^= 1; writeFileSync(output, bytes);
    const damagedTarget = join(directory, 'damaged');
    assert.throws(() => restoreBackup(output, damagedTarget), /Checksum/);
    assert.equal(existsSync(damagedTarget), false);
  } finally { database.close(); rmSync(directory, { recursive: true, force: true }); }
});

const response = (body: unknown) => new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
test('SAP JSON/OData pagina somente GET, sem encaminhar credencial para outra coleção', async () => {
  const calls: { url: string; options?: RequestInit }[] = [];
  const sample = await readSapSample({ url: 'https://sap.example/odata/Sales', token: 'test-token', fetcher: (async (url, options) => {
    calls.push({ url: String(url), options });
    return calls.length === 1 ? response({ value: [{ Região: 'Sul', Valor: 10 }], '@odata.nextLink': '?$skiptoken=2' }) : response({ value: [{ Região: 'Norte', Valor: 20 }] });
  }) as typeof fetch });
  assert.equal(sample.rows.length, 2); assert.equal(sample.rows[1].field1, 20);
  assert.ok(calls.every(call => call.options?.method === 'GET' && call.options.redirect === 'error'));
  assert.equal((calls[0].options?.headers as Record<string, string>).Authorization, 'Bearer test-token');
  let requests = 0;
  await assert.rejects(readSapSample({ url: 'https://sap.example/odata/Sales', fetcher: (async () => {
    requests++; return response({ value: [{ A: 1 }], '@odata.nextLink': 'https://evil.example/collect' });
  }) as typeof fetch }), /paginação/);
  assert.equal(requests, 1);
});

test('SAP v2 e JSON simples funcionam; formatos inválidos e volumes excessivos falham claramente', async () => {
  for (const body of [[{ Região: 'Sul', Valor: 10 }], { d: { results: [{ Região: 'Sul', Valor: 10, __metadata: { uri: 'ignored' } }] } }]) {
    const sample = await readSapSample({ url: 'http://localhost:9999/sap', fetcher: (async () => response(body)) as typeof fetch });
    assert.equal(sample.rows[0].field1, 10); assert.equal(sample.columns.length, 2);
  }
  await assert.rejects(readSapSample({ url: 'http://sap.example/data' }), /HTTPS/);
  await assert.rejects(readSapSample({ url: 'https://sap.example/data', fetcher: (async () => response({ value: [{ nested: { secret: true } }] })) as typeof fetch }), /aninhados/);
  await assert.rejects(readSapSample({ url: 'https://sap.example/data', fetcher: (async () => response(Array.from({ length: 20001 }, () => ({ A: 1 })))) as typeof fetch }), /20 mil/);
  await assert.rejects(readSapSample({ url: 'https://sap.example/data', fetcher: (async () => new Response('oops', { status: 401 })) as typeof fetch }), /permissão/);
});
