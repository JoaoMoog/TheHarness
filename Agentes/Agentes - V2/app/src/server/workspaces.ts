import {inputLimits} from '../core/inputLimits';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Actor } from '@/core/types';
import type { AuditEntry, GovernanceState, Workspace, WorkspaceInvite, WorkspaceMember, WorkspaceRole } from '@/core/workspace';
import { HttpError } from './auth';
import { db, transaction } from './store';

const roles = z.enum(['reader', 'editor', 'admin']);
const initialized = new WeakSet<object>();
export function governanceDb() {
  const database = db();
  if (!initialized.has(database)) {
    database.exec(`CREATE TABLE IF NOT EXISTS workspaces (id TEXT PRIMARY KEY, name TEXT NOT NULL, personal INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS workspace_members (workspace TEXT NOT NULL, actor_id TEXT NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('reader','editor','admin')), joined_at TEXT NOT NULL, PRIMARY KEY(workspace,actor_id));
      CREATE INDEX IF NOT EXISTS memberships_actor ON workspace_members(actor_id);
      CREATE TABLE IF NOT EXISTS workspace_invites (id TEXT PRIMARY KEY, workspace TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE, role TEXT NOT NULL CHECK(role IN ('reader','editor','admin')), expires_at TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS invites_workspace ON workspace_invites(workspace);
      CREATE TABLE IF NOT EXISTS audit_events (id INTEGER PRIMARY KEY AUTOINCREMENT, workspace TEXT NOT NULL, actor_id TEXT NOT NULL, actor_name TEXT NOT NULL, action TEXT NOT NULL, target TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS audit_workspace_id ON audit_events(workspace,id);`);
    if (!database.prepare('PRAGMA table_info(workspace_invites)').all().some(c => c.name === 'email')) database.exec("ALTER TABLE workspace_invites ADD COLUMN email TEXT NOT NULL DEFAULT ''");
    initialized.add(database);
  }
  return database;
}

function personal(actor: Actor) {
  const database = governanceDb();
  database.prepare('INSERT OR IGNORE INTO workspaces VALUES(?,?,1,?)').run(actor.id, 'Meu espaço', new Date().toISOString());
  database.prepare('INSERT OR IGNORE INTO workspace_members VALUES(?,?,?,?,?)').run(actor.id, actor.id, actor.name, 'admin', new Date().toISOString());
}
export function resolveWorkspace(actor: Actor, workspaceId?: string | null, permission: 'read' | 'write' | 'admin' = 'read'): Workspace {
  personal(actor);
  const id = workspaceId || actor.id;
  const row = governanceDb().prepare('SELECT w.id,w.name,w.personal,m.role FROM workspaces w JOIN workspace_members m ON m.workspace=w.id WHERE w.id=? AND m.actor_id=?').get(id, actor.id);
  if (!row) throw new HttpError(404, 'Esse espaço não está disponível para sua conta.');
  if ((permission === 'write' && row.role === 'reader') || (permission === 'admin' && row.role !== 'admin')) throw new HttpError(403, permission === 'admin' ? 'Somente administradores podem gerenciar este espaço.' : 'Seu acesso é de leitura. Peça a um administrador permissão para editar.');
  return { id: String(row.id), owner: String(row.id), name: String(row.name), personal: !!row.personal, role: row.role as WorkspaceRole };
}
export function listWorkspaces(actor: Actor): Workspace[] {
  personal(actor);
  return governanceDb().prepare('SELECT w.id,w.name,w.personal,m.role FROM workspaces w JOIN workspace_members m ON m.workspace=w.id WHERE m.actor_id=? ORDER BY w.personal DESC,w.created_at').all(actor.id)
    .map(row => ({ id: String(row.id), owner: String(row.id), name: String(row.name), personal: !!row.personal, role: row.role as WorkspaceRole }));
}
/** Record metadata only: never prompts, tokens, source rows, or credentials. Call after a successful operation. */
export function audit(actor: Actor, workspaceId: string, action: string, target = '') {
  governanceDb().prepare('INSERT INTO audit_events(workspace,actor_id,actor_name,action,target,created_at) VALUES(?,?,?,?,?,?)').run(workspaceId, actor.id, actor.name.slice(0, 200), action.slice(0, 100), target.slice(0, 200), new Date().toISOString());
}
export function auditLog(actor: Actor, workspaceId: string, before?: number, limit = 50): AuditEntry[] {
  resolveWorkspace(actor, workspaceId, 'admin');
  return governanceDb().prepare('SELECT id,actor_id AS actorId,actor_name AS actorName,action,target,created_at AS createdAt FROM audit_events WHERE workspace=? AND id<? ORDER BY id DESC LIMIT ?')
    .all(workspaceId, before || Number.MAX_SAFE_INTEGER, Math.max(1, Math.min(100, limit))) as unknown as AuditEntry[];
}
export function createWorkspace(actor: Actor, name: string): Workspace {
  const title = z.string().trim().min(1).max(inputLimits.name).parse(name);
  personal(actor);
  if (listWorkspaces(actor).length >= 50) throw new HttpError(400, 'O limite é de 50 espaços por conta.');
  const id = `team-${randomUUID()}`, now = new Date().toISOString();
  transaction(() => {
    governanceDb().prepare('INSERT INTO workspaces VALUES(?,?,0,?)').run(id, title, now);
    governanceDb().prepare('INSERT INTO workspace_members VALUES(?,?,?,?,?)').run(id, actor.id, actor.name, 'admin', now);
    audit(actor, id, 'workspace.created', id);
  });
  return resolveWorkspace(actor, id);
}
function teamAdmin(actor: Actor, id: string) {
  const workspace = resolveWorkspace(actor, id, 'admin');
  return workspace;
}
export function governanceState(actor: Actor, id: string): GovernanceState {
  const workspace = resolveWorkspace(actor, id, 'admin');
  const members = governanceDb().prepare('SELECT actor_id AS actorId,name,role,joined_at AS joinedAt FROM workspace_members WHERE workspace=? ORDER BY joined_at').all(id) as unknown as WorkspaceMember[];
  const invites = governanceDb().prepare('SELECT id,role,email,expires_at AS expiresAt,created_at AS createdAt FROM workspace_invites WHERE workspace=? AND expires_at>? ORDER BY created_at DESC').all(id, new Date().toISOString()) as unknown as WorkspaceInvite[];
  return { workspace, members, invites, audit: auditLog(actor, id) };
}
export function createInvite(actor: Actor, id: string, role: WorkspaceRole, email = '') {
  teamAdmin(actor, id); roles.parse(role);
  email = email ? z.string().trim().email().max(inputLimits.email).parse(email).toLowerCase() : '';
  const now = new Date().toISOString();
  governanceDb().prepare('DELETE FROM workspace_invites WHERE expires_at<=?').run(now);
  if (Number(governanceDb().prepare('SELECT COUNT(*) AS n FROM workspace_invites WHERE workspace=?').get(id)!.n) >= 50) throw new HttpError(400, 'Revogue convites antigos antes de criar outro.');
  const code = randomBytes(24).toString('base64url');
  const invite = { id: randomUUID(), role, createdAt: now, expiresAt: new Date(Date.now() + 7 * 86400000).toISOString() };
  transaction(() => {
    governanceDb().prepare('INSERT INTO workspace_invites(id,workspace,token_hash,role,expires_at,created_at,email) VALUES(?,?,?,?,?,?,?)').run(invite.id, id, createHash('sha256').update(code).digest('hex'), role, invite.expiresAt, now, email);
    audit(actor, id, 'invite.created', invite.id);
  });
  return { ...invite, code };
}
export function acceptInvite(actor: Actor, code: string): Workspace {
  z.string().min(20).max(inputLimits.inviteCode).regex(/^[A-Za-z0-9_-]+$/).parse(code); personal(actor);
  const hash = createHash('sha256').update(code).digest('hex');
  const workspaceId = transaction(() => {
    const invite = governanceDb().prepare('SELECT * FROM workspace_invites WHERE token_hash=? AND expires_at>?').get(hash, new Date().toISOString());
    if (!invite) throw new HttpError(404, 'Esse convite expirou, foi revogado ou já foi usado. Peça um novo código.');
    if (invite.email && (actor.demo || String(actor.email || '').toLowerCase() !== invite.email || actor.auth !== 'msal')) throw new HttpError(403, 'Entre com a conta Microsoft do e-mail convidado para aceitar este convite.');
    const id = String(invite.workspace);
    // A join code must never downgrade an existing administrator or silently alter any member role.
    const existing = governanceDb().prepare('SELECT role FROM workspace_members WHERE workspace=? AND actor_id=?').get(id, actor.id);
    if (existing) throw new HttpError(409, 'Você já participa deste espaço. O convite continua disponível.');
    governanceDb().prepare('INSERT INTO workspace_members VALUES(?,?,?,?,?)').run(id, actor.id, actor.name, String(invite.role), new Date().toISOString());
    governanceDb().prepare('DELETE FROM workspace_invites WHERE id=?').run(invite.id);
    audit(actor, id, 'member.joined', actor.id);
    return id;
  });
  return resolveWorkspace(actor, workspaceId);
}
export function updateMember(actor: Actor, id: string, memberId: string, role: WorkspaceRole | null) {
  teamAdmin(actor, id); if (role) roles.parse(role);
  if (id === memberId && role !== 'admin') throw new HttpError(409, 'O proprietário mantém a administração do próprio espaço.');
  transaction(() => {
    const member = governanceDb().prepare('SELECT role FROM workspace_members WHERE workspace=? AND actor_id=?').get(id, memberId);
    if (!member) throw new HttpError(404, 'Esse membro não está mais no espaço.');
    if (member.role === 'admin' && role !== 'admin' && Number(governanceDb().prepare("SELECT COUNT(*) AS n FROM workspace_members WHERE workspace=? AND role='admin'").get(id)!.n) <= 1) throw new HttpError(409, 'Mantenha ao menos um administrador no espaço.');
    if (role) governanceDb().prepare('UPDATE workspace_members SET role=? WHERE workspace=? AND actor_id=?').run(role, id, memberId);
    else governanceDb().prepare('DELETE FROM workspace_members WHERE workspace=? AND actor_id=?').run(id, memberId);
    audit(actor, id, role ? `member.role.${role}` : 'member.removed', memberId);
  });
  return { ok: true };
}
export function revokeInvite(actor: Actor, id: string, inviteId: string) {
  teamAdmin(actor, id);
  transaction(() => {
    const removed = governanceDb().prepare('DELETE FROM workspace_invites WHERE workspace=? AND id=?').run(id, inviteId);
    if (!removed.changes) throw new HttpError(404, 'Esse convite não está mais disponível.');
    audit(actor, id, 'invite.revoked', inviteId);
  });
  return { ok: true };
}
/** Caller authenticates and checks Origin before dispatch. undefined means this is not a workspace route. */
export function handleWorkspaceRequest(actor: Actor, method: string, path: string[], input: unknown = {}) {
  if (path[0] !== 'workspaces') return undefined;
  const route = path.join('/');
  if (method === 'GET' && path.length === 1) return { workspaces: listWorkspaces(actor) };
  if (method === 'POST' && path.length === 1) return createWorkspace(actor, z.object({ name: z.string() }).strict().parse(input).name);
  if (method === 'POST' && route === 'workspaces/join') return acceptInvite(actor, z.object({ code: z.string() }).strict().parse(input).code.trim());
  const id = path[1];
  if (method === 'GET' && path.length === 2) return governanceState(actor, id);
  if (method === 'GET' && path.length === 3 && path[2] === 'audit') return { entries: auditLog(actor, id, z.object({ before: z.number().int().positive().optional() }).parse(input).before) };
  if (method === 'POST' && path.length === 3 && path[2] === 'invites') { const p = z.object({ role: roles, email: z.string().optional() }).strict().parse(input); return createInvite(actor, id, p.role, p.email); }
  if (method === 'DELETE' && path.length === 4 && path[2] === 'invites') return revokeInvite(actor, id, path[3]);
  if ((method === 'POST' || method === 'DELETE') && path.length === 4 && path[2] === 'members') return updateMember(actor, id, path[3], method === 'DELETE' ? null : z.object({ role: roles }).strict().parse(input).role);
  throw new HttpError(404, 'Essa ação de equipe não está disponível.');
}
