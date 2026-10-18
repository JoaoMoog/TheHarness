import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {randomBytes} from 'node:crypto';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {existsSync,cpSync} from 'node:fs';
import {pilotSettings} from './pilot-env.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const env=pilotSettings(root);
env.FINANCIAL_TEST_TOKEN ||= randomBytes(32).toString('hex');
env.SAP_READ_TOKEN=env.FINANCIAL_TEST_TOKEN;
const children=[];let stopping=false;
function stop(code=0){if(stopping)return;stopping=true;process.exitCode=code;for(const child of children){if(process.platform==='win32'&&child.pid)spawn('taskkill',['/pid',String(child.pid),'/t','/f'],{windowsHide:true,stdio:'ignore'});else child.kill('SIGTERM');}}
async function checkPort(value){const port=Number(value);if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Use portas de 1024 a 65535.');await new Promise((resolve,reject)=>{const s=createServer();s.once('error',()=>reject(new Error(`Porta ${port} ocupada. Defina PORT e FINANCIAL_TEST_PORT livres.`)));s.listen(port,'127.0.0.1',()=>s.close(resolve));});}
function start(args){const child=spawn(process.execPath,args,{cwd:root,env,stdio:'inherit',windowsHide:true});children.push(child);child.on('error',e=>{console.error(e.message);stop(1)});child.on('exit',code=>{if(!stopping)stop(code||1)});return child;}
try{
 if(env.CLARA_STORAGE_MODE!=='sqlite'||!['local','msal'].includes(env.AUTH_MODE)||env.STUDIO_DATA_PROVIDER!=='financial-test')throw new Error('O piloto exige SQLite, autenticação local ou Microsoft e financial-test. Use studio para outros modos.');
 if(env.PORT===env.FINANCIAL_TEST_PORT)throw new Error('A aplicação e o serviço financeiro precisam de portas diferentes.');
 await checkPort(env.PORT);await checkPort(env.FINANCIAL_TEST_PORT);
 start(['--import','tsx','scripts/financial-server.ts']);
 let ready=false;
 for(let i=0;i<50&&!stopping;i++){try{ready=(await fetch(`http://127.0.0.1:${env.FINANCIAL_TEST_PORT}/health`,{signal:AbortSignal.timeout(500)})).ok;}catch{}if(ready)break;await new Promise(r=>setTimeout(r,100));}
 if(!ready)throw new Error('O serviço financeiro não iniciou.');
 if(process.argv.includes('--production')){
  const standalone=resolve(root,'.next/standalone');
  if(!existsSync(resolve(standalone,'server.js')))throw new Error('Execute npm run build antes de pilot:start.');
  cpSync(resolve(root,'.next/static'),resolve(standalone,'.next/static'),{recursive:true});
  if(existsSync(resolve(root,'public')))cpSync(resolve(root,'public'),resolve(standalone,'public'),{recursive:true});
  env.HOSTNAME='127.0.0.1';start([resolve(standalone,'server.js')]);
 }else start([resolve(root,'node_modules/next/dist/bin/next'),'dev','--hostname','127.0.0.1','--port',env.PORT]);
 console.log(`CLARA piloto: ${env.PUBLIC_APP_URL} · SQLite persistente · fonte sintética HTTP · IA ${env.STUDIO_AI_PROVIDER}`);
}catch(error){console.error(error.message);stop(1);}
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>stop());
