import { DatabaseSync } from 'node:sqlite';
import { createHash, randomUUID } from 'node:crypto';
import { chmodSync, existsSync, linkSync, mkdirSync, readFileSync, renameSync, rmdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const checksum = file => createHash('sha256').update(readFileSync(file)).digest('hex');
function verify(database) {
  if (database.prepare('PRAGMA quick_check').get().quick_check !== 'ok') throw new Error('Falha na verificação de integridade SQLite.');
  for (const table of ['resources', 'sessions']) {
    if (!database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table)) throw new Error(`Tabela obrigatória ausente: ${table}.`);
  }
  const invalid = database.prepare("SELECT COUNT(*) AS n FROM resources WHERE NOT json_valid(data)").get().n;
  if (invalid) throw new Error('O banco contém recursos com JSON inválido.');
}

/** VACUUM INTO creates a consistent SQLite snapshot including committed WAL pages. Existing backups are never overwritten. */
export function createBackup(dataDirectory, output) {
  const source = join(resolve(dataDirectory), 'prometeu.sqlite');
  const destination = resolve(output);
  if (!existsSync(source)) throw new Error('Banco de origem não encontrado.');
  if (existsSync(destination) || existsSync(`${destination}.json`)) throw new Error('O destino já existe. Escolha um novo nome para preservar o backup anterior.');
  mkdirSync(dirname(destination), { recursive: true });
  const temporary = `${destination}.${randomUUID()}.tmp`;
  try {
    const database = new DatabaseSync(source, { readOnly: true });
    try { verify(database); database.prepare('VACUUM INTO ?').run(temporary); }
    finally { database.close(); }
    chmodSync(temporary, 0o600);
    const snapshot = new DatabaseSync(temporary);
    try {
      verify(snapshot);
      // Session cookies must not become usable again if this snapshot is restored.
      snapshot.exec('DELETE FROM sessions; PRAGMA journal_mode=DELETE;');
    } finally { snapshot.close(); }
    const manifest = { format: 'clara-sqlite-backup', version: 1, createdAt: new Date().toISOString(), sha256: checksum(temporary), sessionsExcluded: true };
    // Commit the data last. A manifest without data is safely rejected by restore.
    writeFileSync(`${destination}.json`, JSON.stringify(manifest, null, 2), { flag: 'wx', mode: 0o600 });
    // An exclusive hard link publishes a complete file without rename's overwrite race.
    linkSync(temporary, destination);
    return { file: destination, manifest: `${destination}.json`, ...manifest };
  } finally { if (existsSync(temporary)) rmSync(temporary); }
}

/** Restore exclusively to a NEW data directory. Switching a running deployment is intentionally separate. */
export function restoreBackup(backup, targetDirectory) {
  const source = resolve(backup), target = resolve(targetDirectory);
  if (existsSync(target)) throw new Error('Restaure em uma pasta nova. O banco existente nunca é substituído; pare o servidor e selecione a nova pasta depois da conferência.');
  if (!existsSync(source) || !existsSync(`${source}.json`)) throw new Error('Backup e manifesto .json são obrigatórios.');
  const manifest = JSON.parse(readFileSync(`${source}.json`, 'utf8'));
  if (manifest.format !== 'clara-sqlite-backup' || manifest.version !== 1 || !/^[a-f0-9]{64}$/.test(manifest.sha256) || checksum(source) !== manifest.sha256) throw new Error('Checksum ou versão de backup inválido. O destino não foi criado.');
  const inspection = new DatabaseSync(source, { readOnly: true });
  try { verify(inspection); } finally { inspection.close(); }
  const temporary = `${target}.${randomUUID()}.restoring`;
  mkdirSync(dirname(target), { recursive: true });
  mkdirSync(temporary, { mode: 0o700 });
  try {
    writeFileSync(join(temporary, 'prometeu.sqlite'), readFileSync(source), { flag: 'wx', mode: 0o600 });
    const restored = new DatabaseSync(join(temporary, 'prometeu.sqlite'));
    try { restored.exec('DELETE FROM sessions;'); verify(restored); } finally { restored.close(); }
    // Reserve the final directory exclusively; even a concurrent restore cannot overwrite it.
    mkdirSync(target, { mode: 0o700 });
    try { renameSync(join(temporary, 'prometeu.sqlite'), join(target, 'prometeu.sqlite')); }
    catch (error) { try { rmdirSync(target); } catch { /* Preserve anything another process created. */ } throw error; }
    return { directory: target, status: 'restored', sessionsRevoked: true, next: 'Pare o servidor, aponte PROMETEU_DATA_DIR para esta pasta e inicie novamente. Confira /api/health/ready e entre de novo.' };
  } finally { if (existsSync(temporary)) rmSync(temporary, { recursive: true }); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const [command, first, second, ...extra] = process.argv.slice(2);
    if (!first || !second || extra.length || !['create', 'restore'].includes(command)) throw new Error('Uso: node scripts/backup.mjs create <pasta-dados> <arquivo.sqlite> | restore <arquivo.sqlite> <nova-pasta-dados>');
    console.log(JSON.stringify(command === 'create' ? createBackup(first, second) : restoreBackup(first, second), null, 2));
  } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
}
