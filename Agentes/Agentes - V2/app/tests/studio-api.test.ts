import test from 'node:test';
import assert from 'node:assert/strict';
import {NextRequest} from 'next/server';
process.env.CLARA_STORAGE_MODE='memory';process.env.AUTH_MODE='demo';process.env.STUDIO_DATA_PROVIDER='demo';process.env.STUDIO_AI_PROVIDER='demo';process.env.PUBLIC_APP_URL='http://localhost:3000';
async function call(path:string,method='GET',body?:unknown,cookie?:string,origin='http://localhost:3000'){
 const module=await import('../src/app/api/v1/studio/[...path]/route').catch(()=>null);assert.ok(module,'API versionada precisa existir');
 const req=new NextRequest(`http://localhost:3000/api/v1/studio/${path}`,{method,headers:{origin,...(cookie?{cookie}:{}),'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
 return module[method as 'GET'|'POST'](req,{params:Promise.resolve({path:path.split('/')})});
}
test('API Studio: requer sessão e nega origem inesperada',async()=>{
 assert.equal((await call('bootstrap')).status,401);
 assert.equal((await call('session','POST',{name:'Ana'},undefined,'https://outro.example')).status,403);
});
test('API Studio: sessão demo é isolada e comandos rejeitam payload inválido',async()=>{
 const first=await call('session','POST',{name:'Ana'});assert.equal(first.status,200);
 const a=await first.json(),cookie=first.headers.get('set-cookie')!.split(';')[0];
 const second=await call('session','POST',{name:'Bruno'});const b=await second.json();assert.notEqual(a.actor.id,b.actor.id);
 const query=await call('query','POST',{},cookie);assert.equal(query.status,200);assert.equal((await query.json()).balance,129000);
 const invalid=await call('commands','POST',{revision:1,operationId:crypto.randomUUID(),command:{type:'model.save',name:'Inválido',formula:'execute'}},cookie);
 assert.equal(invalid.status,422);assert.ok((await invalid.json()).error.requestId);
});
test('API Studio: OpenAPI contém schemas e operações reais',async()=>{
 const response=await call('openapi');assert.equal(response.status,200);const api=await response.json();
 assert.equal(api.openapi,'3.1.0');assert.ok(api.paths['/commands'].post);assert.ok(api.components.schemas.Mutation);
 assert.ok(api.paths['/query'].post.responses['200']);assert.ok(api.components.schemas.DashboardDocument);
 assert.deepEqual(api.components.schemas.Query.required||[],[],'Query aceita objeto vazio');
 assert.ok(!api.components.schemas.AssistantInput.required.includes('percent'),'percent tem valor padrão na entrada');
 assert.ok(api.components.schemas.DashboardDocument.required.includes('schemaVersion'),'documento de saída é completo');
});
