import {resolve} from 'node:path';
import {pilotSettings} from './pilot-env.mjs';
import {bedrockPlanner} from '../src/server/studio/bedrock';
import {initialDocument,filtersSchema} from '../src/studio/contracts';
import {summarize,demoRows} from '../src/studio/domain';
Object.assign(process.env,pilotSettings(resolve('.')));
async function main(){
 const data=summarize({rows:demoRows,provider:'demo',revision:'connection-check',updatedAt:new Date().toISOString()},filtersSchema.parse({}));
 const answer=await bedrockPlanner.propose({prompt:'Mostre apenas Tecnologia.',document:initialDocument,percent:5},data,undefined,{centers:['Tecnologia','Operações','Comercial','Administrativo'],companies:['Matriz','Filial'],periods:['2026-09'],messages:[]});
 if(answer.status!=='ready'||answer.proposal?.patch.center!=='Tecnologia')throw new Error('O modelo respondeu, mas não passou pela verificação semântica do filtro.');
 console.log('Bedrock verificado: resposta estruturada e filtro Tecnologia válidos.');
}
main().catch(error=>{console.error(error instanceof Error?error.message:'Falha na conexão Bedrock.');process.exitCode=1;});
