import {test,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {querySac,readSacSample,authorizeSacPath,sacQuery} from '../src/server/sac';
import {loadAwsSecrets} from '../src/server/secrets';

const original={...process.env};afterEach(()=>{for(const key of Object.keys(process.env))if(!(key in original))delete process.env[key];Object.assign(process.env,original);});
function setup(){Object.assign(process.env,{SAP_SAC_TENANT_URL:'https://tenant.example.test',SAP_SAC_TOKEN_URL:'https://auth.example.test/oauth/token',SAP_SAC_CLIENT_ID:crypto.randomUUID(),SAP_SAC_CLIENT_SECRET:'test-secret',SAP_SAC_WORKSPACE_MODELS:JSON.stringify({finance:[{namespace:'sac',provider:'model1'}]}),SAP_SAC_NAMESPACE:'sac',SAP_SAC_PROVIDER:'model1'});}
const json=(data:unknown)=>new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}});
const token=()=>json({access_token:'synthetic-token',expires_in:3600,token_type:'Bearer'});

test('SAC aplica autorização por espaço/modelo antes de qualquer chamada e bloqueia parâmetros extras',async()=>{
 setup();const fetcher:typeof fetch=async()=>{throw new Error('must not call');};
 for(const [space,path,status] of [['other','providers/sac/model1/FactData',403],['finance','providers/sac/model2/FactData',403],['finance','providers/sac/model1/../../secret',404],['finance','administration/Subscriptions',404]] as const){await assert.rejects(querySac(space,path,new URLSearchParams(),undefined,fetcher),(e:any)=>e.status===status);}
 for(const query of ['$expand=all','$top=1001','$top=1.5','$select=a&$select=b','url=https://evil.test','deltaid=123'])assert.throws(()=>sacQuery(new URLSearchParams(query)));
 assert.equal(authorizeSacPath("administration/Namespaces(NamespaceID='sac')/Providers",'finance').kind,'providers');
});

test('SAC OAuth, catálogo filtrado, metadados e paginação preservam o contrato sem transmitir segredo ao browser',async()=>{
 setup();let tokens=0;
 const fetcher:typeof fetch=async(input,init)=>{
  const url=new URL(String(input));
  if(url.hostname==='auth.example.test'){tokens++;assert.equal(init?.method,'POST');assert.match(String(init?.body),/client_credentials/);return token();}
  assert.equal(init?.redirect,'error');assert.equal(new Headers(init?.headers).get('authorization'),'Bearer synthetic-token');
  if(url.pathname.endsWith('$metadata'))return new Response('<edmx:Edmx Version="4.0"></edmx:Edmx>');
  if(url.pathname.endsWith('Namespaces'))return json({value:[{NamespaceID:'sac'},{NamespaceID:'private'}]});
  if(url.pathname.endsWith('/Providers'))return json({value:[{ProviderID:'model1'},{ProviderID:'model2'}]});
  return json({'@odata.context':'$metadata#FactData',value:[{Area:'Sul',Receita:200}],'@odata.nextLink':'?nextEntity=next'});
 };
 const namespaces=await querySac('finance','administration/Namespaces',undefined,undefined,fetcher);assert.deepEqual((namespaces.body as any).value,[{NamespaceID:'sac'}]);
 const providers=await querySac('finance',"administration/Namespaces(NamespaceID='sac')/Providers",undefined,undefined,fetcher);assert.deepEqual((providers.body as any).value,[{ProviderID:'model1'}]);
 const data=await querySac('finance','providers/sac/model1/FactData',new URLSearchParams('$select=Area,Receita'),undefined,fetcher);assert.equal((data.body as any)['@odata.nextLink'],'/api/v1/sap/dataexport/providers/sac/model1/FactData?nextEntity=next');assert(!JSON.stringify(data).includes('synthetic-token'));
 const metadata=await querySac('finance','providers/sac/model1/$metadata',undefined,undefined,fetcher);assert.match(metadata.type,/xml/);assert.equal(tokens,1);
});

test('SAC rejeita redirecionamento de paginação para outra origem e respostas grandes',async()=>{
 setup();for(const link of ['https://evil.test/collect','https://tenant.example.test/api/v1/dataexport/providers/sac/model2/FactData','https://user:pass@tenant.example.test/api/v1/dataexport/providers/sac/model1/FactData']){
  const fetcher:typeof fetch=async input=>String(input).includes('auth.example')?token():json({value:[],'@odata.nextLink':link});
  await assert.rejects(querySac('finance','providers/sac/model1/FactData',undefined,undefined,fetcher),(e:any)=>e.status===502);
 }
 const fetcher:typeof fetch=async input=>String(input).includes('auth.example')?token():new Response('x'.repeat(8*1024*1024+1));
 await assert.rejects(querySac('finance','providers/sac/model1/FactData',undefined,undefined,fetcher),(e:any)=>e.status===413);
});

test('SAC importa páginas e colunas variáveis sem perder zeros à esquerda ou campos esparsos',async()=>{
 setup();const originalFetch=globalThis.fetch;
 globalThis.fetch=async input=>{const url=new URL(String(input));if(url.hostname==='auth.example.test')return token();return url.search?json({value:[{Codigo:'002',Volume:5,Extra:'novo'}]}):json({value:[{Codigo:'001',Volume:2}],'@odata.nextLink':'?nextEntity=2'});};
 try{const sample=await readSacSample('finance');assert.equal(sample.rows.length,2);assert.equal(sample.columns.length,3);assert.equal(sample.rows[0].field0,'001');assert.equal(sample.rows[0].field2,null);assert.equal(sample.rows[1].field2,'novo');}finally{globalThis.fetch=originalFetch;}
});
