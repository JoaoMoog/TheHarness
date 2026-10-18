import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadAwsSecrets} from '../src/server/secrets';

test('Secrets Manager substitui apenas credenciais permitidas e falha sem carga parcial',async()=>{
 const env:Record<string,string|undefined>={AWS_REGION:'us-east-1',CLARA_SECRET_ID:'clara/test',SAP_READ_TOKEN:'old',MSAL_TENANT_ID:'tenant'};
 await loadAwsSecrets(env,async id=>{assert.equal(id,'clara/test');return JSON.stringify({SAP_SAC_CLIENT_SECRET:'new'});});
 assert.equal(env.SAP_SAC_CLIENT_SECRET,'new');assert.equal(env.SAP_READ_TOKEN,undefined);assert.equal(env.MSAL_TENANT_ID,'tenant');
 for(const payload of ['not json','{}','[]','{"AWS_ACCESS_KEY_ID":"bad"}','{"SAP_SAC_CLIENT_SECRET":""}','{"SAP_SAC_CLIENT_SECRET":"private","MSAL_TENANT_ID":"attacker"}']){
  const before={...env};await assert.rejects(loadAwsSecrets(env,async()=>payload),error=>error instanceof Error&&!error.message.includes('private'));assert.deepEqual(env,before);
 }
 await assert.rejects(loadAwsSecrets({CLARA_SECRETS_REQUIRED:'true'}),/CLARA_SECRET_ID/);
 await assert.rejects(loadAwsSecrets(env,async()=>{throw new Error('secret-value')}),error=>error instanceof Error&&!error.message.includes('secret-value'));
});
