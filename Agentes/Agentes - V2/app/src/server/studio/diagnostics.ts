import {createHash} from 'node:crypto';
import {read,insert,update} from '../store';
type Check={id:string;owner:string;state:'verified'|'failed';checkedAt:string;message:string;fingerprint:string};
function fingerprint(kind:'data'|'ai'){return createHash('sha256').update(JSON.stringify(kind==='data'?[process.env.STUDIO_DATA_PROVIDER,process.env.SAP_READ_URL,process.env.SAP_STUDIO_MAPPING]:[process.env.STUDIO_AI_PROVIDER,process.env.AWS_PROFILE,process.env.AWS_REGION,process.env.BEDROCK_MODEL_ID,process.env.AGENTCORE_HARNESS_ARN,process.env.AGENTCORE_ENDPOINT,process.env.AGENTCORE_INVOKER_ROLE_ARN])).digest('hex');}
export function recordCheck(kind:'data'|'ai',ok:boolean,message:string){const item:Check={id:`integration:${kind}`,owner:'runtime',state:ok?'verified':'failed',checkedAt:new Date().toISOString(),message,fingerprint:fingerprint(kind)};if(read('integration-check',item.id,item.owner))update('integration-check',item);else insert('integration-check',item);}
export function integrationStatus(kind:'data'|'ai'){
 const mode=kind==='data'?process.env.STUDIO_DATA_PROVIDER:process.env.STUDIO_AI_PROVIDER;
 const configured=kind==='data'?!!(process.env.SAP_READ_URL&&process.env.SAP_STUDIO_MAPPING):!!(process.env.AWS_REGION&&(mode==='agentcore'?process.env.AGENTCORE_HARNESS_ARN:process.env.BEDROCK_MODEL_ID));
 const item=read<Check>('integration-check',`integration:${kind}`,'runtime');
 if(item&&item.fingerprint===fingerprint(kind)&&mode!=='demo')return {state:item.state,checkedAt:item.checkedAt,message:item.message};
 return {state:configured&&mode&&mode!=='demo'?'configured':'unconfigured',checkedAt:null,message:mode==='demo'?'Demonstração selecionada':configured?'Aguardando verificação':'Configuração incompleta'};
}
