import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Actor, Draft, Report, Source, Upload } from '@/core/types';
import { basePlan } from '@/core/engine';
import { sapSource } from './seed';

let database: DatabaseSync | undefined;
export function db() {
  if (!database) {
    const directory = process.env.PROMETEU_DATA_DIR || resolve('.data');
    const temporary = process.env.CLARA_STORAGE_MODE === 'memory';
    if (!temporary) mkdirSync(directory, { recursive: true, mode: 0o700 });
    database = new DatabaseSync(temporary ? ':memory:' : resolve(directory, 'prometeu.sqlite'));
    database.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS resources (id TEXT PRIMARY KEY, owner TEXT NOT NULL, kind TEXT NOT NULL, data TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS owner_kind ON resources(owner,kind);
      CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, actor TEXT NOT NULL, expires INTEGER NOT NULL);`);
  }
  return database;
}

type Resource = { id: string; owner: string };
export function insert<T extends Resource>(kind: string, resource: T): T {
  db().prepare('INSERT INTO resources VALUES(?,?,?,?)').run(resource.id, resource.owner, kind, JSON.stringify(resource));
  return resource;
}
export function read<T extends Resource>(kind: string, id: string, owner: string): T | undefined {
  const row = db().prepare('SELECT data FROM resources WHERE id=? AND kind=? AND owner=?').get(id, kind, owner);
  return row ? JSON.parse(String(row.data)) as T : undefined;
}
export function list<T extends Resource>(kind: string, owner: string): T[] {
  return db().prepare('SELECT data FROM resources WHERE kind=? AND owner=? ORDER BY rowid DESC').all(kind, owner).map(row => JSON.parse(String(row.data)) as T);
}
export function update<T extends Resource>(kind: string, resource: T) {
  db().prepare('UPDATE resources SET data=? WHERE id=? AND owner=? AND kind=?').run(JSON.stringify(resource), resource.id, resource.owner, kind);
}
export function transaction<T>(operation: () => T): T {
  db().exec('BEGIN IMMEDIATE');
  try { const result = operation(); db().exec('COMMIT'); return result; }
  catch (error) { db().exec('ROLLBACK'); throw error; }
}
export function initialize(actor: Actor) {
  transaction(() => {
    if (list<Source>('source', actor.id).length) return;
    const source = sapSource('finance', actor.id);
    insert('source', source);
    insert('report', { id: crypto.randomUUID(), owner: actor.id, sourceId: source.id,
      plan: { ...basePlan(source), title: 'Despesas e orçamento', message: 'Compare despesas e orçamento por centro de custo.' }, createdAt: new Date().toISOString() });
  });
}
