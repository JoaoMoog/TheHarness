import {createFinancialServer,type FinancialProfile} from '../src/server/financial-test/server';
const profile=process.env.FINANCIAL_TEST_PROFILE||'normal';
if(!['normal','unavailable','slow','unauthorized','invalid'].includes(profile))throw new Error('Perfil financeiro desconhecido.');
const server=createFinancialServer({token:process.env.FINANCIAL_TEST_TOKEN||'',profile:profile as FinancialProfile});
server.listen(Number(process.env.FINANCIAL_TEST_PORT||4010),'127.0.0.1',()=>console.log('Serviço financeiro de teste pronto (dados sintéticos).'));
for(const signal of ['SIGTERM','SIGINT'] as const)process.on(signal,()=>{server.closeAllConnections();server.close(()=>process.exit(0));});
