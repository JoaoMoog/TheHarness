import {existsSync,readFileSync} from 'node:fs';
import {parseEnv} from 'node:util';
import {resolve} from 'node:path';
/** @param {string} root @param {string} file @param {Record<string,string|undefined>} environment */
export function loadSettings(root,file,environment=process.env){
 const selected=environment.CLARA_ENV_FILE||file;
 const path=resolve(root,selected);
 if(environment.CLARA_ENV_FILE&&!existsSync(path))throw new Error(`Arquivo de ambiente não encontrado: ${selected}`);
 return {...(existsSync(path)?parseEnv(readFileSync(path,'utf8')):{}),...environment};
}
/** @param {string} root @param {Record<string,string|undefined>} environment
 * @returns {Record<string,string|undefined> & {PORT:string,FINANCIAL_TEST_PORT:string}}
 */
export function pilotSettings(root,environment=process.env){
 const configured=loadSettings(root,'.env.dev',environment);
 // Empty integration fields in the shared profiles use the synthetic pilot defaults.
 for(const key of ['SAP_READ_URL','SAP_STUDIO_MAPPING'])if(!configured[key])delete configured[key];
 const port=configured.PORT||'3000',dataPort=configured.FINANCIAL_TEST_PORT||'4010';
 if(configured.AUTH_MODE==='local'&&!configured.LOCAL_AUTH_ENABLED)configured.LOCAL_AUTH_ENABLED='true';
 return {CLARA_STORAGE_MODE:'sqlite',AUTH_MODE:'msal',LOCAL_AUTH_ENABLED:'false',STUDIO_DATA_PROVIDER:'financial-test',STUDIO_AI_PROVIDER:'bedrock',AI_PROVIDER:'bedrock',PROMETEU_DATA_DIR:resolve(root,'.data/pilot'),PUBLIC_APP_URL:`http://127.0.0.1:${port}`,SAP_READ_URL:`http://127.0.0.1:${dataPort}/odata/FinancialFacts`,SAP_STUDIO_MAPPING:JSON.stringify({id:'DocumentId',center:'CostCenter',company:'Company',date:'PostingDate',actual:'ActualAmount',budget:'BudgetAmount',currency:'Currency'}),NEXT_TELEMETRY_DISABLED:'1',...configured,PORT:port,FINANCIAL_TEST_PORT:dataPort};
}
