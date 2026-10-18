import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import type {Actor} from '@/core/types';
import type {CreditBalance,CreditDirectory,CreditEntry,CreditUser,UsageReport} from '@/platform/contracts';
import {db,transaction} from './store';
import {HttpError} from './auth';
import {requirePlatformAdmin} from './platformAccess';

const initialized=new WeakSet<object>();
export function creditDb(){
 const database=db();if(!initialized.has(database)){
  database.exec(`CREATE TABLE IF NOT EXISTS credit_users(id TEXT PRIMARY KEY,name TEXT NOT NULL,email TEXT NOT NULL,auth TEXT NOT NULL,available INTEGER NOT NULL CHECK(available>=0),reserved INTEGER NOT NULL DEFAULT 0 CHECK(reserved>=0),consumed INTEGER NOT NULL DEFAULT 0 CHECK(consumed>=0),allocated INTEGER NOT NULL CHECK(allocated>=0),period TEXT NOT NULL,created_at TEXT NOT NULL,last_seen TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS credit_ledger(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,kind TEXT NOT NULL,amount INTEGER NOT NULL,reason TEXT NOT NULL,admin_id TEXT,admin_name TEXT,created_at TEXT NOT NULL);
   CREATE INDEX IF NOT EXISTS credit_ledger_user ON credit_ledger(user_id,created_at);
   CREATE TABLE IF NOT EXISTS ai_credit_requests(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,workspace TEXT NOT NULL,feature TEXT NOT NULL,provider TEXT NOT NULL,cost INTEGER NOT NULL,period TEXT NOT NULL,state TEXT NOT NULL CHECK(state IN ('reserved','consumed','refunded','blocked')),started_at TEXT NOT NULL,finished_at TEXT,duration_ms INTEGER,expires_at INTEGER NOT NULL);
   CREATE INDEX IF NOT EXISTS ai_credit_user ON ai_credit_requests(user_id,state);
   CREATE INDEX IF NOT EXISTS ai_credit_time ON ai_credit_requests(started_at);
   CREATE TABLE IF NOT EXISTS platform_events(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,feature TEXT NOT NULL,workspace TEXT NOT NULL,created_at TEXT NOT NULL);
   CREATE INDEX IF NOT EXISTS platform_events_time ON platform_events(created_at);
   CREATE TABLE IF NOT EXISTS platform_metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL);`);
  database.prepare('INSERT OR IGNORE INTO platform_metadata VALUES(?,?)').run('tracking_since',new Date().toISOString());initialized.add(database);
 }return database;
}
function integerEnv(key:string,fallback:number,min:number,max:number){const raw=process.env[key];if(raw===undefined)return fallback;const n=Number(raw);if(!Number.isSafeInteger(n)||n<min||n>max)throw new HttpError(503,'A política de créditos precisa ser revisada pelo administrador.');return n;}
export function creditPolicy(){return {monthly:integerEnv('CLARA_MONTHLY_CREDITS',1250,0,1000000),cost:integerEnv('CLARA_AI_CREDIT_COST',5,1,1000000)};}
export function creditPeriod(now=new Date()){
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit'}).formatToParts(now);
 return `${parts.find(p=>p.type==='year')!.value}-${parts.find(p=>p.type==='month')!.value}`;
}
function renew(row:Record<string,unknown>,period:string){
 const d=creditDb(),policy=creditPolicy();if(String(row.period)>=period)return;
 d.prepare('UPDATE credit_users SET available=?,reserved=0,consumed=0,allocated=?,period=? WHERE id=?').run(policy.monthly,policy.monthly,period,String(row.id));
 d.prepare('INSERT OR IGNORE INTO credit_ledger VALUES(?,?,?,?,?,?,?,?)').run(`monthly:${row.id}:${period}`,String(row.id),'monthly',policy.monthly,'Renova\u00e7\u00e3o mensal; extras do m\u00eas anterior n\u00e3o acumulam',null,null,new Date().toISOString());
}
function ensureUser(actor:Actor){
 const d=creditDb(),now=new Date().toISOString(),policy=creditPolicy(),period=creditPeriod();
 const added=d.prepare('INSERT OR IGNORE INTO credit_users(id,name,email,auth,available,allocated,period,created_at,last_seen) VALUES(?,?,?,?,?,?,?,?,?)').run(actor.id,actor.name.slice(0,200),(actor.email||'').slice(0,200),actor.auth||'demo',policy.monthly,policy.monthly,period,now,now);
 if(added.changes)d.prepare('INSERT INTO credit_ledger VALUES(?,?,?,?,?,?,?,?)').run(`monthly:${actor.id}:${period}`,actor.id,'monthly',policy.monthly,'Cota mensal',null,null,now);
 renew(d.prepare('SELECT * FROM credit_users WHERE id=?').get(actor.id)!,period);
 d.prepare('UPDATE credit_users SET name=?,email=?,auth=?,last_seen=? WHERE id=?').run(actor.name.slice(0,200),(actor.email||'').slice(0,200),actor.auth||'demo',now,actor.id);
}

function settle(id:string,success:boolean){
 const d=creditDb(),row=d.prepare("SELECT * FROM ai_credit_requests WHERE id=? AND state='reserved'").get(id);if(!row)return;
 const now=new Date().toISOString(),cost=Number(row.cost);
 d.prepare('UPDATE credit_users SET reserved=reserved-?,available=available+?,consumed=consumed+? WHERE id=? AND period=?').run(cost,success?0:cost,success?cost:0,row.user_id,row.period);
 d.prepare('UPDATE ai_credit_requests SET state=?,finished_at=?,duration_ms=? WHERE id=?').run(success?'consumed':'refunded',now,Math.max(0,Date.now()-Date.parse(String(row.started_at))),id);
 d.prepare('INSERT INTO credit_ledger VALUES(?,?,?,?,?,?,?,?)').run(`settle:${id}`,row.user_id,success?'consumed':'refunded',success?-cost:cost,success?'Resposta de IA concluída':'Crédito devolvido: chamada não concluída',null,null,now);
}
function recover(){const d=creditDb();for(const row of d.prepare("SELECT id FROM ai_credit_requests WHERE state='reserved' AND expires_at<?").all(Date.now()))settle(String(row.id),false);}
function balanceRow(row:Record<string,unknown>):CreditBalance{return {available:Number(row.available),reserved:Number(row.reserved),consumed:Number(row.consumed),allocated:Number(row.allocated),period:String(row.period),renewsAt:new Date(Date.UTC(Number(String(row.period).slice(0,4)),Number(String(row.period).slice(5,7)),1,3)).toISOString(),...creditPolicy()};}
export function myCredits(actor:Actor):CreditBalance{creditDb();return transaction(()=>{ensureUser(actor);recover();return balanceRow(creditDb().prepare('SELECT * FROM credit_users WHERE id=?').get(actor.id)!)});}
export function trackUsage(actor:Actor,feature:string,workspace='',id:string=randomUUID()){
 const d=creditDb();ensureUser(actor);d.prepare('INSERT OR IGNORE INTO platform_events VALUES(?,?,?,?,?)').run(id,actor.id,feature,workspace,new Date().toISOString());
}
function reserve(actor:Actor,workspace:string,feature:string,provider:string){
 creditDb();const result=transaction(()=>{
  ensureUser(actor);recover();const d=creditDb(),cost=creditPolicy().cost,id=randomUUID(),now=new Date().toISOString();
  const updated=d.prepare('UPDATE credit_users SET available=available-?,reserved=reserved+? WHERE id=? AND available>=?').run(cost,cost,actor.id,cost);
  const state=updated.changes?'reserved':'blocked';d.prepare('INSERT INTO ai_credit_requests VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(id,actor.id,workspace,feature,provider,cost,creditPeriod(),state,now,state==='blocked'?now:null,state==='blocked'?0:null,Date.now()+10*60000);
  if(state==='reserved')d.prepare('INSERT INTO credit_ledger VALUES(?,?,?,?,?,?,?,?)').run(`reserve:${id}`,actor.id,'reserved',-cost,'Crédito reservado para chamada de IA',null,null,now);
  return {id,allowed:!!updated.changes};
 });
 if(!result.allowed)throw new HttpError(402,'Seus créditos para a CLARA IA acabaram. Peça mais créditos a um administrador da plataforma.');return result.id;
}
export async function withCredits<T>(actor:Actor,workspace:string,feature:string,provider:string,operation:()=>Promise<T>):Promise<T>{
 const id=reserve(actor,workspace,feature,provider);
 try{const result=await operation();transaction(()=>settle(id,true));return result}catch(error){transaction(()=>settle(id,false));throw error}
}
export const grantSchema=z.object({userId:z.string().min(1).max(150),amount:z.number().int().min(1).max(1000000),reason:z.string().trim().min(5).max(300),operationId:z.string().uuid()}).strict();
export function grantCredits(actor:Actor,input:unknown){
 requirePlatformAdmin(actor);const p=grantSchema.parse(input),d=creditDb();
 return transaction(()=>{const existing=d.prepare('SELECT * FROM credit_ledger WHERE id=?').get(p.operationId);
  if(existing){if(existing.user_id!==p.userId||existing.admin_id!==actor.id||existing.amount!==p.amount||existing.reason!==p.reason)throw new HttpError(409,'Essa operação já foi utilizada para outra concessão.');return {applied:false,balance:balanceRow(d.prepare('SELECT * FROM credit_users WHERE id=?').get(p.userId)!)};}
  let row=d.prepare('SELECT * FROM credit_users WHERE id=?').get(p.userId);if(!row)throw new HttpError(404,'O usuário ainda não acessou a plataforma.');
  renew(row,creditPeriod());row=d.prepare('SELECT * FROM credit_users WHERE id=?').get(p.userId)!;
  if(Number(row.allocated)+p.amount>1000000000)throw new HttpError(422,'A concessão ultrapassa o limite da conta.');
  d.prepare('UPDATE credit_users SET available=available+?,allocated=allocated+? WHERE id=?').run(p.amount,p.amount,p.userId);
  d.prepare('INSERT INTO credit_ledger VALUES(?,?,?,?,?,?,?,?)').run(p.operationId,p.userId,'grant',p.amount,p.reason,actor.id,actor.name,new Date().toISOString());
  return {applied:true,balance:balanceRow(d.prepare('SELECT * FROM credit_users WHERE id=?').get(p.userId)!)};
 });
}
export function creditHistory(actor:Actor,userId=actor.id):CreditEntry[]{if(userId!==actor.id)requirePlatformAdmin(actor);return creditDb().prepare("SELECT id,created_at AS at,kind,amount,reason,admin_name AS adminName FROM credit_ledger WHERE user_id=? AND kind IN ('initial','monthly','grant','consumed','refunded') ORDER BY created_at DESC,rowid DESC LIMIT 100").all(userId) as unknown as CreditEntry[];}
const directorySchema=z.object({search:z.string().trim().max(120).default(''),offset:z.coerce.number().int().min(0).default(0),limit:z.coerce.number().int().min(1).max(100).default(25)}).strict();
export function creditUsers(actor:Actor,input:unknown):CreditDirectory{
 requirePlatformAdmin(actor);const p=directorySchema.parse(input),d=creditDb();transaction(()=>{recover();for(const row of d.prepare('SELECT * FROM credit_users WHERE period<?').all(creditPeriod()))renew(row,creditPeriod());});
 const search=`%${p.search.replace(/[!%_]/g,'!$&')}%`,where="WHERE name LIKE ? ESCAPE '!' OR email LIKE ? ESCAPE '!'";
 const total=Number(d.prepare(`SELECT COUNT(*) AS n FROM credit_users ${where}`).get(search,search)!.n);
 const users=d.prepare(`SELECT * FROM credit_users ${where} ORDER BY last_seen DESC,id LIMIT ? OFFSET ?`).all(search,search,p.limit,p.offset).map(row=>({...balanceRow(row),id:String(row.id),name:String(row.name),email:String(row.email),auth:String(row.auth),lastSeen:String(row.last_seen)})) as CreditUser[];
 const counts=d.prepare('SELECT COUNT(*) AS users,COALESCE(SUM(available),0) AS available,COALESCE(SUM(consumed),0) AS consumed,COALESCE(SUM(reserved),0) AS reserved FROM credit_users').get()!;
 return {users,total,offset:p.offset,limit:p.limit,policy:creditPolicy(),totals:{users:Number(counts.users),available:Number(counts.available),consumed:Number(counts.consumed),reserved:Number(counts.reserved)}};
}
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v);
export const usageSchema=z.object({from:date,to:date}).strict().refine(v=>v.from<=v.to&&Date.parse(v.to)-Date.parse(v.from)<=365*86400000,'Selecione até 366 dias.');
export function platformUsage(actor:Actor,input:unknown):UsageReport{
 requirePlatformAdmin(actor);const {from,to}=usageSchema.parse(input),d=creditDb(),start=from+'T00:00:00.000Z',end=new Date(Date.parse(to)+86400000).toISOString();
 const sums=d.prepare(`SELECT COUNT(*) AS requests,SUM(state='consumed') AS completed,SUM(state='refunded') AS failed,SUM(state='blocked') AS blocked,COALESCE(SUM(CASE WHEN state='consumed' THEN cost ELSE 0 END),0) AS credits,AVG(CASE WHEN state IN ('consumed','refunded') THEN duration_ms END) AS averageMs FROM ai_credit_requests WHERE started_at>=? AND started_at<?`).get(start,end)!;
 const active=d.prepare('SELECT COUNT(DISTINCT user_id) AS n FROM (SELECT user_id FROM platform_events WHERE created_at>=? AND created_at<? UNION ALL SELECT user_id FROM ai_credit_requests WHERE started_at>=? AND started_at<?)').get(start,end,start,end)!;
 const features=d.prepare('SELECT feature,COUNT(*) AS count FROM platform_events WHERE created_at>=? AND created_at<? GROUP BY feature ORDER BY count DESC').all(start,end).map(r=>({feature:String(r.feature),count:Number(r.count)}));
 const count=(key:string)=>features.find(f=>f.feature===key)?.count||0;
 const days=d.prepare(`SELECT substr(started_at,1,10) AS day,COUNT(DISTINCT user_id) AS users,COUNT(*) AS requests,COALESCE(SUM(CASE WHEN state='consumed' THEN cost ELSE 0 END),0) AS credits FROM ai_credit_requests WHERE started_at>=? AND started_at<? GROUP BY day`).all(start,end);
 const daily=[];for(let t=Date.parse(from);t<=Date.parse(to);t+=86400000){const day=new Date(t).toISOString().slice(0,10),r=days.find(r=>r.day===day);daily.push({day,users:Number(r?.users||0),requests:Number(r?.requests||0),credits:Number(r?.credits||0)});}
 const users=d.prepare(`SELECT u.id,u.name,COUNT(*) AS requests,SUM(CASE WHEN r.state='consumed' THEN r.cost ELSE 0 END) AS credits,MAX(r.started_at) AS lastAt FROM ai_credit_requests r JOIN credit_users u ON u.id=r.user_id WHERE r.started_at>=? AND r.started_at<? GROUP BY u.id ORDER BY credits DESC,requests DESC LIMIT 50`).all(start,end).map(r=>({id:String(r.id),name:String(r.name),requests:Number(r.requests),credits:Number(r.credits),lastAt:String(r.lastAt)}));
 return {from,to,trackingSince:String(d.prepare("SELECT value FROM platform_metadata WHERE key='tracking_since'").get()!.value),summary:{activeUsers:Number(active.n),requests:Number(sums.requests),completed:Number(sums.completed||0),failed:Number(sums.failed||0),blocked:Number(sums.blocked||0),credits:Number(sums.credits),averageMs:sums.averageMs==null?null:Math.round(Number(sums.averageMs)),dashboards:count('dashboard.created'),presentations:count('presentation.created'),imports:count('data.imported'),merges:count('dashboard.merged')},daily,features,users};
}
