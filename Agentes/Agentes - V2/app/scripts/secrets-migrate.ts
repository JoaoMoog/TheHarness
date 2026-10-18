/** One-time migration: uploads known credential keys without printing their values. */
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {parseEnv} from 'node:util';
import {SecretsManagerClient,CreateSecretCommand,GetSecretValueCommand} from '@aws-sdk/client-secrets-manager';

async function main(){
 const file=resolve(process.env.CLARA_ENV_FILE||'.env.local'),source=readFileSync(file,'utf8'),env={...parseEnv(source),...process.env};
 if(!env.AWS_REGION||!env.CLARA_SECRET_NAME)throw new Error('Defina AWS_REGION, AWS_PROFILE (se local) e CLARA_SECRET_NAME no ambiente.');
 Object.assign(process.env,env);
 const keys=['SAP_SAC_CLIENT_SECRET','SAP_READ_TOKEN'];
 const values=Object.fromEntries(keys.filter(key=>env[key]).map(key=>[key,env[key]]));
 if(!Object.keys(values).length)throw new Error('Nenhuma credencial local para migrar.');
 const client=new SecretsManagerClient({region:env.AWS_REGION});
 try{
  const result=await client.send(new CreateSecretCommand({Name:env.CLARA_SECRET_NAME,Description:'Credenciais privadas da CLARA',SecretString:JSON.stringify(values),...(env.CLARA_SECRET_KMS_KEY_ID?{KmsKeyId:env.CLARA_SECRET_KMS_KEY_ID}:{}),Tags:[{Key:'Application',Value:'CLARA'}]}));
  const check=await client.send(new GetSecretValueCommand({SecretId:result.ARN,VersionStage:'AWSCURRENT'}));
  if(check.SecretString!==JSON.stringify(values))throw new Error('Verificação do segredo falhou; arquivo local preservado.');
  const lines=source.split(/\r?\n/).filter(line=>!keys.some(key=>line.startsWith(key+'='))&&!line.startsWith('CLARA_SECRET_ID=')&&!line.startsWith('CLARA_SECRETS_REQUIRED='));
  lines.push(`CLARA_SECRET_ID=${result.ARN}`,'CLARA_SECRETS_REQUIRED=true');
  writeFileSync(file,lines.join('\n')+'\n');
  console.log(JSON.stringify({secretArn:result.ARN,migratedKeys:Object.keys(values),file}));
 }finally{client.destroy();}
}
main().catch(error=>{console.error('Migração não concluída:',error?.name||'Error');process.exitCode=1;});
