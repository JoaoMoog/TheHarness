import {test} from 'node:test';
import assert from 'node:assert/strict';
import {NextRequest} from 'next/server';
import {GET} from '../src/app/api/v1/sap/dataexport/[...path]/route';
import {session} from '../src/server/auth';
import {resolveWorkspace} from '../src/server/workspaces';

test('API SAC exige sessão e associação ao espaço antes de acessar OAuth ou SAP',async()=>{
 process.env.CLARA_STORAGE_MODE='memory';process.env.AUTH_MODE='local';
 const actor={id:'sac-owner',name:'SAP Owner',demo:false,auth:'local' as const};
 const workspace=resolveWorkspace(actor),cookie='prometeu-session='+session(actor),path=['providers','sac','model1','FactData'];
 const call=(headers:Record<string,string>)=>GET(new NextRequest('http://localhost/api/v1/sap/dataexport/'+path.join('/'),{headers}),{params:Promise.resolve({path})});
 assert.equal((await call({})).status,401);
 assert.equal((await call({cookie})).status,422);
 assert.equal((await call({cookie,'x-clara-workspace':'not-my-workspace'})).status,404);
 process.env.SAP_SAC_WORKSPACE_MODELS='{}';
 const denied=await call({cookie,'x-clara-workspace':workspace.id});assert.equal(denied.status,403);assert.equal((await denied.json()).error.code,'SAP_403');
});
