import {resolve} from 'node:path';
import {loadSettings} from './pilot-env.mjs';
import {BedrockClient,GetInferenceProfileCommand} from '@aws-sdk/client-bedrock';
import {BedrockRuntimeClient,ConverseCommand} from '@aws-sdk/client-bedrock-runtime';
import {IAMClient,PutRolePolicyCommand} from '@aws-sdk/client-iam';
import {BedrockAgentCoreControlClient,GetHarnessCommand,GetHarnessEndpointCommand,UpdateHarnessCommand,UpdateHarnessEndpointCommand} from '@aws-sdk/client-bedrock-agentcore-control';
import {modelConfig} from '../src/server/modelConfig';

Object.assign(process.env,loadSettings(resolve('.'),process.env.CLARA_ENV_FILE||'.env.local'));
async function main(){
 const region=process.env.AWS_REGION,arn=process.env.AGENTCORE_HARNESS_ARN,modelId=process.env.BEDROCK_MODEL_ID,endpointName=process.env.AGENTCORE_ENDPOINT;
 if(!region||!arn||!modelId||!endpointName)throw new Error('Configure AWS_REGION, AGENTCORE_HARNESS_ARN, AGENTCORE_ENDPOINT e BEDROCK_MODEL_ID.');
 const harnessId=arn.split('/').at(-1)!,options=modelConfig(),runtime=new BedrockRuntimeClient({region}),bedrock=new BedrockClient({region}),control=new BedrockAgentCoreControlClient({region}),iam=new IAMClient({region});
 try{
  // Access must work before changing any role, harness or live endpoint.
  await runtime.send(new ConverseCommand({modelId,messages:[{role:'user',content:[{text:'Responda apenas OK.'}]}],inferenceConfig:{...options.inferenceConfig,maxTokens:64},additionalModelRequestFields:options.additional}));
  const [profile,current,live]=await Promise.all([bedrock.send(new GetInferenceProfileCommand({inferenceProfileIdentifier:modelId})),control.send(new GetHarnessCommand({harnessId})),control.send(new GetHarnessEndpointCommand({harnessId,endpointName}))]);
  if(current.harness?.status!=='READY'||live.endpoint?.status!=='READY')throw new Error('Aguarde o agente e o endpoint ficarem READY.');
  const role=current.harness.executionRoleArn?.split('/').at(-1);if(!role||!profile.inferenceProfileArn||!profile.models?.length)throw new Error('Confira a função de execução e o perfil de inferência.');
  console.log(JSON.stringify({previousVersion:live.endpoint.liveVersion,targetModel:modelId}));
  // Separate policy preserves the old version's permissions for rollback.
  await iam.send(new PutRolePolicyCommand({RoleName:role,PolicyName:'ClaraConfiguredModel',PolicyDocument:JSON.stringify({Version:'2012-10-17',Statement:[{Effect:'Allow',Action:['bedrock:InvokeModel','bedrock:InvokeModelWithResponseStream'],Resource:[profile.inferenceProfileArn,...profile.models.map(m=>m.modelArn)]}]})}));
  const updated=await control.send(new UpdateHarnessCommand({harnessId,model:{bedrockModelConfig:{modelId,...options.inferenceConfig,apiFormat:'converse_stream',additionalParams:options.additional}},maxTokens:options.maxTokens}));
  const version=updated.harness?.harnessVersion;if(!version)throw new Error('O serviço não retornou uma versão. Endpoint preservado.');
  for(let i=0;i<60;i++){const h=await control.send(new GetHarnessCommand({harnessId}));if(h.harness?.status==='READY')break;if(i===59||h.harness?.status?.includes('FAILED'))throw new Error('A nova versão não ficou pronta. Endpoint preservado.');await new Promise(r=>setTimeout(r,2000));}
  if(!process.argv.includes('--activate')){console.log(JSON.stringify({preparedVersion:version,note:'Execute novamente com --activate para apontar o endpoint para o modelo verificado.'}));return;}
  await control.send(new UpdateHarnessEndpointCommand({harnessId,endpointName,targetVersion:version}));
  console.log(JSON.stringify({targetVersion:version,endpoint:endpointName,note:'Confira READY e rode npm run agentcore:check.'}));
 }finally{runtime.destroy();bedrock.destroy();control.destroy();iam.destroy();}
}
main().catch(error=>{console.error('Configuração não concluída:',error?.name||'Error',error instanceof Error?error.message:'');process.exitCode=1;});
