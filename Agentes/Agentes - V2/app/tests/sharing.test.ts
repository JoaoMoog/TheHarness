import test from 'node:test';
import assert from 'node:assert/strict';
import {NextRequest} from 'next/server';
import type {Actor} from '../src/core/types';
import {session} from '../src/server/auth';
import {bootstrapStudio,commandStudio,queryStudio} from '../src/server/studio/service';
import {resolveWorkspace,createInvite,acceptInvite,updateMember} from '../src/server/workspaces';
import {sharingDb,inviteDashboard,acceptDashboardInvite,sharedDashboard,dashboardAccess,sharedDashboards,removeDashboardAccess,invitationPreview} from '../src/server/studio/sharing';
import {GET,POST,DELETE} from '../src/app/api/v1/sharing/[[...path]]/route';
process.env.CLARA_STORAGE_MODE='memory';process.env.STUDIO_DATA_PROVIDER='demo';process.env.STUDIO_AI_PROVIDER='demo';
const person=(name='Pessoa'):Actor=>({id:crypto.randomUUID(),name,demo:false,auth:'local',email:'test@example.test'});
const status=(n:number)=>(e:unknown)=>(e as {status:number}).status===n;
const setup=()=>{const owner=person('Dono'),guest=person('Convidado'),boot=bootstrapStudio(owner);return {owner,guest,workspace:boot.workspace.id,board:boot.state.boards[0].id,boot}};
test('compartilhamento individual: apenas gráficos salvos, sem espaço, fontes, outros dashboards ou gestão',async()=>{
 const {owner,guest,workspace,board,boot}=setup();const other=commandStudio(owner,workspace,{revision:boot.state.revision,operationId:crypto.randomUUID(),command:{type:'dashboard.duplicate',id:board}}).targetId!;
 acceptDashboardInvite(guest,{code:inviteDashboard(owner,workspace,board,{}).code});
 const result=await sharedDashboard(guest,workspace,board);assert(result.results.length>0);assert(!('document' in result));assert(!('rows' in result.results[0].data));
 assert.throws(()=>resolveWorkspace(guest,workspace),status(404));assert.throws(()=>dashboardAccess(guest,workspace,board),status(404));assert.throws(()=>inviteDashboard(guest,workspace,board,{}),status(404));
 await assert.rejects(()=>sharedDashboard(guest,workspace,other),status(404));await assert.rejects(()=>queryStudio(guest,workspace,{}),status(404));
 assert.deepEqual(sharedDashboards(guest).map(b=>b.board),[board]);assert.equal(dashboardAccess(owner,workspace,board).members.length,1);
 removeDashboardAccess(owner,workspace,board,'member',guest.id);await assert.rejects(()=>sharedDashboard(guest,workspace,board),status(404));assert.equal(sharedDashboards(guest).length,0);
});
test('convites individuais: uso único, hash, expiração, revogação e e-mail Microsoft',()=>{
 const {owner,guest,workspace,board}=setup();let i=inviteDashboard(owner,workspace,board,{email:'convidado@example.test'});
 assert(!JSON.stringify(sharingDb().prepare('SELECT * FROM dashboard_invites WHERE id=?').get(i.id)).includes(i.code));
 assert.throws(()=>invitationPreview(guest,{code:i.code,kind:'dashboard'}),status(403));
 assert.equal(invitationPreview({...guest,auth:'msal',email:'convidado@example.test'},{code:i.code,kind:'dashboard'}).role,'reader');
 assert.throws(()=>acceptDashboardInvite({...guest,email:'convidado@example.test'},{code:i.code}),status(403));
 assert.throws(()=>acceptDashboardInvite({...guest,auth:'msal',email:'outro@example.test'},{code:i.code}),status(403));
 acceptDashboardInvite({...guest,auth:'msal',email:'CONVIDADO@example.test'},{code:i.code});assert.throws(()=>acceptDashboardInvite(person(),{code:i.code}),status(404));
 i=inviteDashboard(owner,workspace,board,{});assert.throws(()=>acceptDashboardInvite(guest,{code:i.code}),status(409));
 removeDashboardAccess(owner,workspace,board,'invite',i.id);assert.throws(()=>acceptDashboardInvite(person(),{code:i.code}),status(404));
 i=inviteDashboard(owner,workspace,board,{});sharingDb().prepare("UPDATE dashboard_invites SET expires_at='2000-01-01' WHERE id=?").run(i.id);assert.throws(()=>acceptDashboardInvite(person(),{code:i.code}),status(404));
});
test('dashboard compartilhado mantém os indicadores e o recorte salvo sem expor registros',async()=>{
 const {owner,guest,workspace,board,boot}=setup(),doc={...boot.state.boards[0].document,center:'Tecnologia'};
 commandStudio(owner,workspace,{revision:boot.state.revision,operationId:crypto.randomUUID(),command:{type:'dashboard.save',id:board,document:doc}});
 acceptDashboardInvite(guest,{code:inviteDashboard(owner,workspace,board,{}).code});const result=await sharedDashboard(guest,workspace,board);
 assert(result.summary);assert.equal(result.summary.groups.length,1);assert.equal(result.summary.groups[0].name,'Tecnologia');assert.equal(result.summary.actual,result.summary.groups[0].actual);assert(!('rows' in result.summary));assert(result.scope.includes('Tecnologia'));
});
test('acessos herdados e individuais são independentes; exclusão não revive convite',async()=>{
 const {owner,guest,workspace,board,boot}=setup();acceptDashboardInvite(guest,{code:inviteDashboard(owner,workspace,board,{}).code});acceptInvite(guest,createInvite(owner,workspace,'reader').code);
 removeDashboardAccess(owner,workspace,board,'member',guest.id);await sharedDashboard(guest,workspace,board);
 updateMember(owner,workspace,guest.id,null);await assert.rejects(()=>sharedDashboard(guest,workspace,board),status(404));
 const i=inviteDashboard(owner,workspace,board,{});commandStudio(owner,workspace,{revision:boot.state.revision,operationId:crypto.randomUUID(),command:{type:'dashboard.delete',id:board}});
 assert.throws(()=>acceptDashboardInvite(guest,{code:i.code}),status(404));
});
test('convite do espaço pode exigir e-mail e não altera papéis preexistentes',()=>{
 const {owner,guest,workspace}=setup();const i=createInvite(owner,workspace,'editor','member@example.test');
 assert.throws(()=>acceptInvite(guest,i.code),status(403));acceptInvite({...guest,auth:'msal',email:'member@example.test'},i.code);assert.equal(resolveWorkspace(guest,workspace).role,'editor');
 assert.throws(()=>acceptInvite(owner,createInvite(owner,workspace,'reader').code),status(409));assert.equal(resolveWorkspace(owner,workspace).role,'admin');
});
test('API compartilhada exige sessão, origem e não aceita documentos do convidado',async()=>{
 const {owner,guest,workspace,board}=setup(),base='http://localhost:3000/api/v1/sharing/';
 const call=(method:'GET'|'POST'|'DELETE',path:string,actor?:Actor,body?:unknown,origin='http://localhost:3000')=>({GET,POST,DELETE})[method](new NextRequest(base+path,{method,headers:{...(actor?{cookie:`prometeu-session=${session(actor)}`} :{}),origin,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),{params:Promise.resolve({path:path.split('/').filter(Boolean)})});
 assert.equal((await call('GET','')).status,401);assert.equal((await call('GET',`${workspace}/${board}`,guest)).status,404);
 assert.equal((await call('POST',`${workspace}/${board}/invites`,owner,{},'https://evil.test')).status,403);
 const i=await (await call('POST',`${workspace}/${board}/invites`,owner,{})).json();assert.equal((await call('POST','join',guest,{code:i.code})).status,200);
 assert.equal((await call('POST',`${workspace}/${board}`,guest,{document:{}})).status,404);
 assert.equal((await call('GET',`${workspace}/${board}`,guest)).status,200);assert.equal((await call('DELETE',`${workspace}/${board}/members/${owner.id}`,guest)).status,404);
});
