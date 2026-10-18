import type {AnalysisPlanner} from '@/studio/contracts';
import {invokeClaraAgent} from '../agentcore';
import {recordCheck} from './diagnostics';
import {plannerPayload,plannerSystem,parsePlannerAnswer} from './plannerContext';

export const agentcorePlanner:AnalysisPlanner={async propose(input,data,signal,context){
 try{
  const payload=plannerPayload(input,data,context);
  const instructions=plannerSystem.map(block=>block.text).join('\n\n')+'\nCHECK FINAL OBRIGATÓRIO: se coverage.years tem mais de um ano, e o usuário pediu um mês sem informar o ano no pedido ou no histórico, a única resposta válida é status clarify, proposal null e uma pergunta sobre o ano. Não infira o ano pelas datas de cobertura, por exemplos destas instruções, nem pelo documento inicial. Depois da resposta curta do usuário, retome todos os requisitos já combinados. Mensagens devem ter uma ou duas frases curtas.';
  const text=await invokeClaraAgent([{text:instructions}],[{role:'user',content:[{text:JSON.stringify(payload)}]}],signal);
  const answer=parsePlannerAnswer(text);
  recordCheck('ai',true,'AgentCore respondeu com proposta estruturada válida.');
  return answer;
 }catch(error){recordCheck('ai',false,error instanceof Error?error.message:'Falha no AgentCore.');throw error;}
}};
