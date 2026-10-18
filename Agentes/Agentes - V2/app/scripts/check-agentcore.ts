import {resolve} from 'node:path';
import {pilotSettings} from './pilot-env.mjs';
import {STSClient,GetCallerIdentityCommand} from '@aws-sdk/client-sts';
import {BedrockAgentCoreControlClient,GetHarnessCommand,GetHarnessEndpointCommand} from '@aws-sdk/client-bedrock-agentcore-control';
import {agentcorePlanner} from '../src/server/studio/agentcore';
import {agentcoreSettings} from '../src/server/agentcore';
import {filtersSchema,initialDocument} from '../src/studio/contracts';
import {summarize,demoRows} from '../src/studio/domain';
Object.assign(process.env,pilotSettings(resolve('.')),{CLARA_STORAGE_MODE:'memory',STUDIO_AI_PROVIDER:'agentcore'});
async function main(){
 const settings=agentcoreSettings(),sts=new STSClient({region:settings.region}),control=new BedrockAgentCoreControlClient({region:settings.region});
 try{
  const identity=await sts.send(new GetCallerIdentityCommand({}));
  if(!settings.arn.includes(`:${identity.Account}:`))throw new Error('O perfil local aponta para outra conta AWS.');
  const harnessId=settings.arn.split('/').at(-1)!;
  const [agent,endpoint]=await Promise.all([control.send(new GetHarnessCommand({harnessId})),control.send(new GetHarnessEndpointCommand({harnessId,endpointName:settings.qualifier}))]);
  console.log(JSON.stringify({account:identity.Account,region:settings.region,agentStatus:agent.harness?.status,endpointStatus:endpoint.endpoint?.status}));
  if(agent.harness?.status!=='READY'||endpoint.endpoint?.status!=='READY')throw new Error('O agente ainda não está pronto.');
  const data=summarize({rows:demoRows,provider:'demo',revision:'agentcore-check',updatedAt:''},filtersSchema.parse({}));
  const answer=await agentcorePlanner.propose({prompt:'Mostre apenas Tecnologia.',document:initialDocument,percent:5},data,undefined,{centers:['Tecnologia'],companies:['Matriz'],periods:['2026-09'],messages:[]});
  if(answer.status!=='ready'||answer.proposal?.patch.center!=='Tecnologia')throw new Error('Resposta semântica inválida.');
  console.log('AgentCore verificado: proposta e filtro válidos, sem salvar alterações.');
 }finally{sts.destroy();control.destroy()}
}
main().catch(error=>{console.error(error instanceof Error?error.message:'Falha no AgentCore');process.exitCode=1});
