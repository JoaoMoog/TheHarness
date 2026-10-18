import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {z} from 'zod';
import type {Actor} from '@/core/types';
import {widgetsFor,scopeOf} from '@/studio/widgets';
import {summarize,periodLabel} from '@/studio/domain';
import {governanceDb,resolveWorkspace,audit} from '../workspaces';
import {transaction,read} from '../store';
import type {StudioState} from '@/studio/contracts';
import {HttpError} from '../auth';
import {dataSnapshot} from './providers';
import {aggregateWidget} from './datasets';

const initialized=new WeakSet<object>();
export function sharingDb(){const d=governanceDb();if(!initialized.has(d)){
 d.exec(`CREATE TABLE IF NOT EXISTS dashboard_members(workspace TEXT NOT NULL,board TEXT NOT NULL,actor_id TEXT NOT NULL,name TEXT NOT NULL,email TEXT NOT NULL,joined_at TEXT NOT NULL,PRIMARY KEY(workspace,board,actor_id));
 CREATE INDEX IF NOT EXISTS dashboard_members_actor ON dashboard_members(actor_id);
 CREATE TABLE IF NOT EXISTS dashboard_invites(id TEXT PRIMARY KEY,workspace TEXT NOT NULL,board TEXT NOT NULL,email TEXT NOT NULL,token_hash TEXT NOT NULL UNIQUE,created_at TEXT NOT NULL,expires_at TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS dashboard_invites_board ON dashboard_invites(workspace,board);`);initialized.add(d);
 }return d;}
function storedBoard(workspace:string,id:string){const state=read<StudioState>('studio',`studio:${workspace}`,workspace),board=state?.boards.find(b=>b.id===id);if(!board)throw new HttpError(404,'Dashboard não disponível.');return {state:state!,board};}
function admin(actor:Actor,workspace:string,board:string){resolveWorkspace(actor,workspace,'admin');return storedBoard(workspace,board);}
export function canReadShared(actor:Actor,workspace:string,board:string){
 const d=sharingDb();const allowed=d.prepare('SELECT 1 FROM workspace_members WHERE workspace=? AND actor_id=?').get(workspace,actor.id)||d.prepare('SELECT 1 FROM dashboard_members WHERE workspace=? AND board=? AND actor_id=?').get(workspace,board,actor.id);
 if(!allowed)throw new HttpError(404,'Dashboard não disponível para sua conta.');return storedBoard(workspace,board);
}
export function dashboardAccess(actor:Actor,workspace:string,board:string){
 admin(actor,workspace,board);const d=sharingDb();
 return {members:d.prepare('SELECT actor_id AS actorId,name,email,joined_at AS joinedAt FROM dashboard_members WHERE workspace=? AND board=? ORDER BY joined_at').all(workspace,board),inherited:d.prepare('SELECT actor_id AS actorId,name,role FROM workspace_members WHERE workspace=? ORDER BY joined_at').all(workspace),invites:d.prepare('SELECT id,email,created_at AS createdAt,expires_at AS expiresAt FROM dashboard_invites WHERE workspace=? AND board=? AND expires_at>? ORDER BY created_at DESC').all(workspace,board,new Date().toISOString())};
}
export function inviteDashboard(actor:Actor,workspace:string,board:string,input:unknown){
 admin(actor,workspace,board);const {email}=z.object({email:z.union([z.literal(''),z.string().trim().email().max(200)]).default('')}).strict().parse(input),d=sharingDb();
 const code=randomBytes(24).toString('base64url'),now=new Date().toISOString(),id=randomUUID(),expiresAt=new Date(Date.now()+7*86400000).toISOString();
 transaction(()=>{d.prepare('DELETE FROM dashboard_invites WHERE expires_at<=?').run(now);if(Number(d.prepare('SELECT COUNT(*) AS n FROM dashboard_invites WHERE workspace=? AND board=?').get(workspace,board)!.n)>=50)throw new HttpError(422,'Revogue convites antigos antes de criar outro.');d.prepare('INSERT INTO dashboard_invites VALUES(?,?,?,?,?,?,?)').run(id,workspace,board,email.toLowerCase(),createHash('sha256').update(code).digest('hex'),now,expiresAt);audit(actor,workspace,'dashboard.invite.created',board);});
 return {id,code,expiresAt};
}
export function acceptDashboardInvite(actor:Actor,input:unknown){
 const {code}=z.object({code:z.string().min(20).max(100)}).strict().parse(input),d=sharingDb();
 return transaction(()=>{const invite=d.prepare('SELECT * FROM dashboard_invites WHERE token_hash=? AND expires_at>?').get(createHash('sha256').update(code).digest('hex'),new Date().toISOString());
 if(!invite)throw new HttpError(404,'Convite expirado, revogado ou já utilizado.');
 if(invite.email&&(actor.demo||actor.auth!=='msal'||String(actor.email||'').toLowerCase()!==invite.email))throw new HttpError(403,'Entre com a conta Microsoft do e-mail convidado para aceitar este convite.');
 const workspace=String(invite.workspace),board=String(invite.board);storedBoard(workspace,board);
 if(d.prepare('SELECT 1 FROM workspace_members WHERE workspace=? AND actor_id=?').get(workspace,actor.id)||d.prepare('SELECT 1 FROM dashboard_members WHERE workspace=? AND board=? AND actor_id=?').get(workspace,board,actor.id))throw new HttpError(409,'Você já tem acesso a este dashboard. O convite não foi consumido.');
 d.prepare('INSERT INTO dashboard_members VALUES(?,?,?,?,?,?)').run(workspace,board,actor.id,actor.name,actor.email||'',new Date().toISOString());d.prepare('DELETE FROM dashboard_invites WHERE id=?').run(invite.id);audit(actor,workspace,'dashboard.member.joined',board);return {workspace,board};
 });
}
export function invitationPreview(actor:Actor,input:unknown){
 const p=z.object({code:z.string().min(20).max(100),kind:z.enum(['workspace','dashboard'])}).strict().parse(input),d=sharingDb();
 const row=d.prepare(`SELECT * FROM ${p.kind==='workspace'?'workspace_invites':'dashboard_invites'} WHERE token_hash=? AND expires_at>?`).get(createHash('sha256').update(p.code).digest('hex'),new Date().toISOString());
 if(!row)throw new HttpError(404,'Convite expirado, revogado ou já utilizado.');
 if(row.email&&(actor.demo||actor.auth!=='msal'||String(actor.email||'').toLowerCase()!==row.email))throw new HttpError(403,'Entre com a conta Microsoft do e-mail convidado para visualizar e aceitar este convite.');
 const workspace=d.prepare('SELECT name FROM workspaces WHERE id=?').get(row.workspace);if(!workspace)throw new HttpError(404,'Espaço não disponível.');
 return {title:p.kind==='workspace'?String(workspace.name):storedBoard(String(row.workspace),String(row.board)).board.document.title,workspaceName:String(workspace.name),role:p.kind==='workspace'?String(row.role):'reader',expiresAt:String(row.expires_at)};
}
export function removeDashboardAccess(actor:Actor,workspace:string,board:string,kind:'member'|'invite',id:string){
 admin(actor,workspace,board);const d=sharingDb();transaction(()=>{const result=kind==='member'?d.prepare('DELETE FROM dashboard_members WHERE workspace=? AND board=? AND actor_id=?').run(workspace,board,id):d.prepare('DELETE FROM dashboard_invites WHERE workspace=? AND board=? AND id=?').run(workspace,board,id);if(!result.changes)throw new HttpError(404,'Acesso ou convite não encontrado.');audit(actor,workspace,`dashboard.${kind}.revoked`,board);});return {ok:true};
}
export function sharedDashboards(actor:Actor){const d=sharingDb();return d.prepare('SELECT m.workspace,m.board,w.name FROM dashboard_members m JOIN workspaces w ON w.id=m.workspace WHERE m.actor_id=? ORDER BY m.joined_at DESC').all(actor.id).flatMap(row=>{const s=read<StudioState>('studio',`studio:${row.workspace}`,String(row.workspace)),b=s?.boards.find(b=>b.id===row.board);return b?[{workspace:String(row.workspace),board:b.id,workspaceName:String(row.name),title:b.document.title}]:[];});}
/** A guest never supplies a source, filter, document or widget. Only the saved board is evaluated. */
export async function sharedDashboard(actor:Actor,workspace:string,id:string,signal?:AbortSignal){
 const {state,board}=canReadShared(actor,workspace,id);if(state.sourcePaused)throw new HttpError(503,'A fonte deste dashboard está pausada.');
 const results=[];const snapshots=new Map<string,Awaited<ReturnType<typeof dataSnapshot>>>();
 for(const widget of widgetsFor(board.document)){if(!snapshots.has(widget.sourceId))snapshots.set(widget.sourceId,await dataSnapshot(workspace,signal,false,widget.sourceId));results.push({widget,data:aggregateWidget(snapshots.get(widget.sourceId)!,board.document,widget)});}
 const primary=snapshots.get(board.document.sourceId)||await dataSnapshot(workspace,signal,false,board.document.sourceId);
 const summary=primary.dataset||board.document.mergedFrom?.length?null:(()=>{const {actual,budget,balance,execution,groups,count}=summarize(primary,scopeOf(board.document));return {actual,budget,balance,execution,groups,count,showMetric:board.document.showMetric}})();
 const current=canReadShared(actor,workspace,id);if(current.state.sourcePaused||current.board.revision!==board.revision)throw new HttpError(409,'O dashboard mudou. Atualize para consultar a versão atual.');
 return {title:board.document.title,revision:board.revision,updatedAt:board.updatedAt,results,summary,scope:[periodLabel(board.document),board.document.company==='all'?'Todas as empresas':board.document.company,board.document.center==='all'?'Todos os centros':board.document.center].join(' · ')};
}
