import {modelConfig} from './modelConfig';
import {randomUUID} from 'node:crypto';
import {BedrockAgentCoreClient,InvokeHarnessCommand,type HarnessMessage,type HarnessSystemContentBlock} from '@aws-sdk/client-bedrock-agentcore';
import {fromTemporaryCredentials} from '@aws-sdk/credential-providers';
import {HttpError} from './auth';

export function agentcoreSettings(){
 const region=process.env.AWS_REGION,arn=process.env.AGENTCORE_HARNESS_ARN,qualifier=process.env.AGENTCORE_ENDPOINT||'live';
 const match=arn?.match(/^arn:aws:bedrock-agentcore:([a-z0-9-]+):(\d{12}):harness\/[A-Za-z0-9_-]+$/);
 if(!region||!arn||!match||match[1]!==region||!/^\w{1,48}$/.test(qualifier))throw new HttpError(503,'AgentCore pendente: confira região, ARN do agente e endpoint no servidor.');
 const roleArn=process.env.AGENTCORE_INVOKER_ROLE_ARN;
 if(roleArn&&!new RegExp(`^arn:aws:iam::${match[2]}:role/[A-Za-z0-9_+=,.@/-]+$`).test(roleArn))throw new HttpError(503,'Confira a função de acesso ao AgentCore no servidor.');
 return {region,arn,qualifier,roleArn};
}

export function agentcoreError(error:unknown,aborted=false){
 if(error instanceof HttpError)return error;
 const name=(error as {name?:string})?.name||'';
 if(aborted||/Abort|Timeout/.test(name))return new HttpError(504,'A IA excedeu o prazo. Nenhuma alteração foi aplicada.');
 if(/Credentials|Token|SSO|Unauthorized/.test(name))return new HttpError(503,'Credenciais AWS ausentes ou expiradas. Autentique o perfil AWS configurado no servidor.');
 if(/AccessDenied/.test(name))return new HttpError(403,'O servidor não tem permissão para acessar o agente da CLARA.');
 if(/Throttling|Quota/.test(name))return new HttpError(429,'A IA atingiu um limite de uso. Aguarde antes de tentar novamente.');
 if(/Validation|ResourceNotFound/.test(name))return new HttpError(502,'Confira a configuração e o estado do agente no Amazon Bedrock AgentCore.');
 return new HttpError(502,'O AgentCore está indisponível. Nenhuma alteração foi aplicada.');
}

/** Only server-owned prompts and authorized text enter this boundary. Never accept AWS overrides from HTTP input. */
export async function invokeClaraAgent(systemPrompt:HarnessSystemContentBlock[],messages:HarnessMessage[],requestSignal?:AbortSignal){
 const {region,arn,qualifier,roleArn}=agentcoreSettings(),options=modelConfig();
 const client=new BedrockAgentCoreClient({region,maxAttempts:1,...roleArn?{credentials:fromTemporaryCredentials({clientConfig:{region},params:{RoleArn:roleArn,RoleSessionName:'clara-chat',DurationSeconds:900}})}:{}});
 const signal=AbortSignal.any([AbortSignal.timeout(options.timeoutMs),...(requestSignal?[requestSignal]:[])]),started=Date.now();
 // A fresh microVM session per request prevents retained agent state crossing users or sources.
 // CLARA's authorized, bounded database history is the authoritative conversation memory.
 const runtimeSessionId=randomUUID();
 try{
  const response=await client.send(new InvokeHarnessCommand({harnessArn:arn,qualifier,runtimeSessionId,systemPrompt,messages,
   allowedTools:[],tools:[],skills:[],maxIterations:1,maxTokens:options.maxTokens,timeoutSeconds:Math.max(5,Math.floor(options.timeoutMs/1000)-5)}),{abortSignal:signal});
  if(!response.stream)throw new HttpError(502,'O AgentCore não retornou uma resposta.');
  let text='',stopReason:string|undefined,inputTokens:number|undefined,outputTokens:number|undefined;
  for await(const event of response.stream){
   signal.throwIfAborted();
   if(event.validationException||event.internalServerException||event.runtimeClientError)throw new HttpError(502,'O agente não conseguiu concluir a resposta. Tente novamente.');
   if(event.contentBlockStart?.start?.toolUse||event.contentBlockDelta?.delta?.toolUse)throw new HttpError(502,'O agente solicitou uma operação fora do contrato.');
   text+=event.contentBlockDelta?.delta?.text||'';
   if(text.length>24000)throw new HttpError(502,'A resposta da IA excedeu o tamanho permitido.');
   if(event.messageStop)stopReason=event.messageStop.stopReason;
   if(event.metadata?.usage){inputTokens=event.metadata.usage.inputTokens;outputTokens=event.metadata.usage.outputTokens;}
  }
  if(stopReason!=='end_turn')throw new HttpError(stopReason==='timeout_exceeded'?504:502,'O agente não concluiu a resposta. Nenhuma alteração foi aplicada.');
  console.info(JSON.stringify({event:'agentcore.invoke',endpoint:qualifier,durationMs:Date.now()-started,inputTokens,outputTokens}));
  return text;
 }catch(error){throw agentcoreError(error,signal.aborted)}finally{client.destroy()}
}
