import {modelConfig} from '../modelConfig';
import {BedrockRuntimeClient,ConverseCommand} from '@aws-sdk/client-bedrock-runtime';
import {type AnalysisPlanner} from '@/studio/contracts';
import {HttpError} from '../auth';
import {recordCheck} from './diagnostics';

import {plannerSystem,plannerPayload,parsePlannerAnswer} from './plannerContext';

export function bedrockError(error:unknown,aborted=false){
 const name=(error as {name?:string})?.name||'';
 if(error instanceof HttpError)return error;
 if(aborted||/Timeout|Abort/.test(name))return new HttpError(504,'A IA excedeu o prazo. Nenhuma alteração foi aplicada.');
 if(/Credentials|Token|SSO|Unauthorized/.test(name))return new HttpError(503,'Credenciais AWS ausentes ou expiradas. Autentique o perfil AWS configurado no servidor.');
 if(name==='AccessDeniedException'&&String((error as {message?:string}).message||'').includes('INVALID_PAYMENT_INSTRUMENT'))return new HttpError(403,'A AWS exige um meio de pagamento válido para ativar este modelo no AWS Marketplace. Confira o faturamento da conta AWS e tente novamente após a ativação.');
 if(/AccessDenied/.test(name))return new HttpError(403,'A identidade AWS não tem acesso ao modelo ou perfil de inferência configurado.');
 if(/Throttling|Quota/.test(name))return new HttpError(429,'O Bedrock atingiu um limite de uso. Aguarde antes de tentar novamente.');
 if(/Validation|ResourceNotFound/.test(name))return new HttpError(502,'Confira o modelo, perfil de inferência e região configurados no Bedrock.');
 return new HttpError(502,'O Bedrock está indisponível. Nenhuma alteração foi aplicada.');
}
export const bedrockPlanner:AnalysisPlanner={async propose(input,data,requestSignal,context){
 if(!process.env.AWS_REGION||!process.env.BEDROCK_MODEL_ID)throw new HttpError(503,'IA pendente: configure região, modelo e credenciais AWS no servidor.');
 const options=modelConfig();
 const client=new BedrockRuntimeClient({region:process.env.AWS_REGION,maxAttempts:2});
 const signal=AbortSignal.any([AbortSignal.timeout(options.timeoutMs),...(requestSignal?[requestSignal]:[])]),start=Date.now();
 try{
  const response=await client.send(new ConverseCommand({modelId:process.env.BEDROCK_MODEL_ID,
   system:plannerSystem,
   messages:[{role:'user',content:[{text:JSON.stringify(plannerPayload(input,data,context))}]}],inferenceConfig:options.inferenceConfig,additionalModelRequestFields:options.additional}),{abortSignal:signal});
  const text=response.output?.message?.content?.map(v=>v.text||'').join('')||'';
  const answer=parsePlannerAnswer(text);
  console.info(JSON.stringify({event:'bedrock.converse',model:process.env.BEDROCK_MODEL_ID,durationMs:Date.now()-start,inputTokens:response.usage?.inputTokens,outputTokens:response.usage?.outputTokens,requestId:response.$metadata.requestId}));
  recordCheck('ai',true,'Bedrock respondeu com proposta estruturada válida.');return answer;
 }catch(error){const safe=bedrockError(error,signal.aborted);recordCheck('ai',false,safe.message);throw safe;}finally{client.destroy();}
}};
