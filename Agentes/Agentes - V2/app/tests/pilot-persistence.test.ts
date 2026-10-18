import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createBackup,restoreBackup} from '../scripts/backup.mjs';
test('Piloto: conta, documento, sessão e idempotência sobrevivem ao processo; backup revoga sessão',()=>{
 mkdirSync('.local',{recursive:true});const root=mkdtempSync(resolve('.local/persistence-')),data=join(root,'data');
 function run(phase:string,directory=data){const output=execFileSync(process.execPath,['--import','tsx','tests/pilot-persistence-worker.ts',phase],{encoding:'utf8',env:{...process.env,CLARA_STORAGE_MODE:'sqlite',PROMETEU_DATA_DIR:directory,AUTH_MODE:'local',STUDIO_DATA_PROVIDER:'demo',STUDIO_AI_PROVIDER:'demo'}});return JSON.parse(output.trim().split('\n').at(-1)!);}
 const first=run('seed'),second=run('read');assert.deepEqual(second,first);assert.equal(second.title,'Dashboard reiniciado');assert.equal(second.sessions,1);assert.equal(second.receipts,1);
 const backup=join(root,'backup.sqlite');createBackup(data,backup);const restored=join(root,'restored');restoreBackup(backup,restored);const after=run('read',restored);assert.equal(after.title,first.title);assert.equal(after.period,'q3');assert.equal(after.sessions,0);assert.equal(after.receipts,1);
});
