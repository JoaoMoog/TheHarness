import {GetSecretValueCommand,SecretsManagerClient} from '@aws-sdk/client-secrets-manager';

const allowed = new Set(['SAP_SAC_CLIENT_SECRET','SAP_READ_TOKEN']);
type Environment=Record<string,string|undefined>;

/** Configuration remains in env; only these credentials may be hydrated from AWS. */
export async function loadAwsSecrets(env:Environment=process.env,read?: (id:string)=>Promise<string>){
 const id=env.CLARA_SECRET_ID;
 if(!id){
  if(env.CLARA_SECRETS_REQUIRED==='true')throw new Error('Configure CLARA_SECRET_ID para iniciar a CLARA.');
  return;
 }
 if(!(env.AWS_SECRETS_REGION||env.AWS_REGION))throw new Error('Configure AWS_SECRETS_REGION ou AWS_REGION.');
 const client=read?null:new SecretsManagerClient({region:env.AWS_SECRETS_REGION||env.AWS_REGION,maxAttempts:2});
 try{
  const raw=await (read?read(id):client!.send(new GetSecretValueCommand({SecretId:id,VersionStage:'AWSCURRENT'})).then(r=>r.SecretString||''));
  const values:unknown=JSON.parse(raw);
  if(!values||typeof values!=='object'||Array.isArray(values))throw new Error();
  const entries=Object.entries(values);
  if(!entries.length||entries.some(([key,value])=>!allowed.has(key)||typeof value!=='string'||!value.trim()||value.length>16000))throw new Error();
  // Validate everything before replacing anything. Never print secret values/errors from AWS.
  for(const key of allowed)delete env[key];
  for(const [key,value] of entries)env[key]=value as string;
 }catch{throw new Error('Não foi possível carregar as credenciais do AWS Secrets Manager. Confira região, ARN, permissão e formato JSON.');}
 finally{client?.destroy();}
}
