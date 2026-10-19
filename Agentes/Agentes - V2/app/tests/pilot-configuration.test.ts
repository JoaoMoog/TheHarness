import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {pilotSettings,loadSettings} from '../scripts/pilot-env.mjs';
import {demoEnabled} from '../src/server/auth';
test('Piloto: configuração explícita vence padrões e fica isolada do Studio',t=>{
 const root=mkdtempSync(join(tmpdir(),'clara-env-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
 writeFileSync(join(root,'.env.dev'),'AWS_REGION=eu-west-1\nPORT=3101\n');
 writeFileSync(join(root,'.env.local'),'STUDIO_AI_PROVIDER=bedrock\nCLARA_STORAGE_MODE=sqlite\n');
 const env=pilotSettings(root,{AWS_REGION:'us-east-1'});assert.equal(env.AWS_REGION,'us-east-1');assert.equal(env.PORT,'3101');assert.equal(env.PUBLIC_APP_URL,'http://127.0.0.1:3101');assert.equal(env.AUTH_MODE,'msal');assert.equal(env.LOCAL_AUTH_ENABLED,'false');assert.equal(env.CLARA_STORAGE_MODE,'sqlite');assert.equal(env.PROMETEU_DATA_DIR,resolve(root,'.data/pilot'));
 assert.equal(loadSettings(root,'.env.local',{}).STUDIO_AI_PROVIDER,'bedrock');
});
test('Piloto: login local não permite criar sessão demo',()=>{
 const before=process.env.AUTH_MODE;try{process.env.AUTH_MODE='local';assert.equal(demoEnabled(),false);process.env.AUTH_MODE='demo';assert.equal(demoEnabled(),true);}finally{if(before===undefined)delete process.env.AUTH_MODE;else process.env.AUTH_MODE=before;}
});
