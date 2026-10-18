import test from 'node:test';
import assert from 'node:assert/strict';
import {NextRequest} from 'next/server';
import type {Actor} from '../src/core/types';
import {myCredits,withCredits,creditDb,grantCredits,creditUsers,creditHistory,platformUsage,trackUsage,creditPeriod} from '../src/server/credits';
import {platformAccess,directoryClaims} from '../src/server/platformAccess';
import {session} from '../src/server/auth';
import {GET,POST} from '../src/app/api/v1/platform/[...path]/route';
process.env.CLARA_STORAGE_MODE='memory';
process.env.CLARA_MONTHLY_CREDITS='1250';process.env.CLARA_AI_CREDIT_COST='5';
process.env.MSAL_TENANT_ID='11111111-1111-4111-8111-111111111111';
process.env.CLARA_PLATFORM_ADMIN_GROUP_IDS='22222222-2222-4222-8222-222222222222';
const person=(id=crypto.randomUUID()):Actor=>({id,name:'Pessoa de teste',email:'test@example.test',demo:false,auth:'local'});
const admin=():Actor=>({...person(),auth:'msal',directory:{tenantId:process.env.MSAL_TENANT_ID!,objectId:'principal',groups:[process.env.CLARA_PLATFORM_ADMIN_GROUP_IDS!],expiresAt:Date.now()+3600000,overage:false}});

test('créditos: cota de 250 chamadas, débito de 5 e identidade global entre espaços',async()=>{
 const actor=person();assert.equal(myCredits(actor).available,1250);
 await withCredits(actor,'workspace-1','assistant','demo',async()=>({message:'Pronto'}));
 await withCredits(actor,'workspace-2','assistant','demo',async()=>({message:'Qual ano?'}));
 assert.equal(myCredits(actor).available,1240);assert.equal(myCredits(actor).consumed,10);assert.equal(myCredits(actor).reserved,0);
});
test('créditos: falha devolve integralmente; sem saldo bloqueia antes de invocar IA',async()=>{
 const actor=person();myCredits(actor);creditDb().prepare('UPDATE credit_users SET available=5 WHERE id=?').run(actor.id);
 await assert.rejects(()=>withCredits(actor,'','assistant','agentcore',async()=>{throw new Error('Falha de provedor')}),/Falha/);
 assert.equal(myCredits(actor).available,5);await withCredits(actor,'','assistant','demo',async()=>true);
 let called=false;await assert.rejects(()=>withCredits(actor,'','assistant','demo',async()=>{called=true}),e=>(e as {status:number}).status===402);assert.equal(called,false);assert.equal(myCredits(actor).available,0);
});
test('créditos: reservas atômicas impedem saldo negativo em chamadas concorrentes',async()=>{
 const actor=person();myCredits(actor);creditDb().prepare('UPDATE credit_users SET available=5 WHERE id=?').run(actor.id);
 let release!:()=>void;const gate=new Promise<void>(resolve=>release=resolve);
 const pending=withCredits(actor,'','assistant','demo',async()=>{await gate;return true});
 assert.equal(myCredits(actor).reserved,5);assert.equal(myCredits(actor).available,0);
 const more=await Promise.allSettled(Array.from({length:8},()=>withCredits(actor,'','assistant','demo',async()=>true)));
 assert(more.every(result=>result.status==='rejected'));release();await pending;assert.equal(myCredits(actor).consumed,5);assert.equal(myCredits(actor).reserved,0);
});
test('créditos: somente grupo assinado válido; local, outro tenant, token vencido e overage não autorizam',()=>{
 const actor=admin();assert.equal(platformAccess(actor).manageCredits,true);
 for(const other of [{...actor,auth:'local' as const},{...actor,demo:true},{...actor,directory:{...actor.directory!,tenantId:'other'}},{...actor,directory:{...actor.directory!,expiresAt:Date.now()-1}},{...actor,directory:{...actor.directory!,overage:true}},{...actor,directory:{...actor.directory!,groups:[]}}]){assert.equal(platformAccess(other).viewUsage,false);assert.throws(()=>creditUsers(other,{}),/restrito/)}
 const parsed=directoryClaims({groups:[process.env.CLARA_PLATFORM_ADMIN_GROUP_IDS],_claim_names:{groups:'src1'},exp:100});assert.equal(parsed.overage,true);assert.deepEqual(parsed.groups,[]);
});
test('créditos: concessão auditada e idempotente, sem dupla reposição em repetição',()=>{
 const actor=person(),manager=admin();myCredits(actor);const grant={userId:actor.id,amount:250,reason:'Reunião executiva extraordinária',operationId:crypto.randomUUID()};
 assert.equal(grantCredits(manager,grant).balance.available,1500);assert.equal(grantCredits(manager,grant).applied,false);assert.equal(myCredits(actor).available,1500);
 assert.throws(()=>grantCredits(manager,{...grant,amount:500}),/outra concessão/);assert.throws(()=>grantCredits(actor,grant),/restrito/);
 const history=creditHistory(manager,actor.id);assert.equal(history.filter(e=>e.kind==='grant').length,1);assert.equal(history[0].adminName,manager.name);
 assert.throws(()=>creditHistory(person(),actor.id),/restrito/);
});
test('créditos: renovação mensal não acumula extras e não depende de um agendador',()=>{
 const actor=person();myCredits(actor);creditDb().prepare("UPDATE credit_users SET period='2020-01',available=9999,allocated=9999,consumed=30 WHERE id=?").run(actor.id);
 const renewed=myCredits(actor);assert.equal(renewed.available,1250);assert.equal(renewed.consumed,0);assert.equal(renewed.period,creditPeriod());assert.equal(myCredits(actor).available,1250);
 assert.equal(creditPeriod(new Date('2026-11-01T02:59:59Z')),'2026-10');assert.equal(creditPeriod(new Date('2026-11-01T03:00:00Z')),'2026-11');
});
test('créditos: conclusão tardia do mês anterior não desconta a nova cota',async()=>{
 const actor=person();let release!:()=>void;const gate=new Promise<void>(r=>release=r);
 const pending=withCredits(actor,'','assistant','demo',async()=>{await gate;return true});
 creditDb().prepare("UPDATE credit_users SET period='2020-01' WHERE id=?").run(actor.id);creditDb().prepare("UPDATE ai_credit_requests SET period='2020-01' WHERE user_id=?").run(actor.id);
 assert.equal(myCredits(actor).available,1250);release();await pending;assert.equal(myCredits(actor).available,1250);assert.equal(myCredits(actor).reserved,0);
});
test('créditos: reserva abandonada após interrupção é devolvida uma única vez',()=>{
 const actor=person();myCredits(actor);const id=crypto.randomUUID(),now=new Date().toISOString();
 creditDb().prepare('UPDATE credit_users SET available=1245,reserved=5 WHERE id=?').run(actor.id);
 creditDb().prepare('INSERT INTO ai_credit_requests VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(id,actor.id,'','assistant','demo',5,creditPeriod(),'reserved',now,null,null,Date.now()-1);
 assert.equal(myCredits(actor).available,1250);assert.equal(myCredits(actor).reserved,0);assert.equal(myCredits(actor).available,1250);
});
test('utilização: agrega dados reais, não retorna conversas e nega acesso público',async()=>{
 const actor=person(),manager=admin(),day=new Date().toISOString().slice(0,10);
 trackUsage(actor,'dashboard.created','test-space');trackUsage(actor,'presentation.created','test-space');await withCredits(actor,'test-space','assistant','demo',async()=>true);
 const data=platformUsage(manager,{from:day,to:day});assert(data.summary.credits>=5);assert(data.summary.dashboards>=1);assert(data.summary.presentations>=1);assert(data.users.some(u=>u.id===actor.id));assert(!JSON.stringify(data).includes('prompt'));
 assert.throws(()=>platformUsage(actor,{from:day,to:day}),/restrito/);assert.throws(()=>platformUsage(manager,{from:'2020-01-01',to:'2026-01-01'}));
});
async function call(actor:Actor|undefined,path:string,body?:unknown,origin='http://localhost:3000'){
 const url=new URL('http://localhost:3000/api/v1/platform/'+path),method=body===undefined?'GET':'POST';
 const req=new NextRequest(url,{method,headers:{...(actor?{cookie:`prometeu-session=${session(actor)}`}:{}) ,origin,'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
 return (method==='GET'?GET:POST)(req,{params:Promise.resolve({path:url.pathname.split('/').slice(4)})});
}
test('API: usuário comum lê só o próprio saldo; menus restritos também são protegidos no servidor',async()=>{
 const actor=person(),manager=admin();assert.equal((await call(undefined,'me')).status,401);assert.equal((await call(actor,'me')).status,200);
 assert.equal((await call(actor,'credits')).status,403);assert.equal((await call(actor,'usage?from=2026-01-01&to=2026-01-31')).status,403);
 const body={userId:actor.id,amount:20,reason:'Apoio ao teste',operationId:crypto.randomUUID()};
 assert.equal((await call(actor,'grants',body)).status,403);assert.equal((await call(manager,'grants',body,'https://other.test')).status,403);assert.equal((await call(manager,'grants',body)).status,200);
 assert.equal((await call(manager,'credits?search=Pessoa')).status,200);
});
