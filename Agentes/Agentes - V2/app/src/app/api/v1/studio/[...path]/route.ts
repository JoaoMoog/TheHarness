import {validationMessage} from '@/server/validation';
import {trackUsage} from '@/server/credits';
import {createPresentation,mergeBoards} from '@/server/studio/executive';
import {queryWidget} from '@/server/studio/datasets';
import {randomUUID} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {filtersSchema} from '@/studio/contracts';
import {localEnabled} from '@/server/localAuth';
import {HttpError,checkOrigin,requireActor,session,demoEnabled} from '@/server/auth';
import {bootstrapStudio,catalogStudio,commandStudio,queryStudio,assistantStudio,scenarioPreview,runtimeStatus} from '@/server/studio/service';
import {studioOpenApi} from '@/studio/openapi';
import {completeOnboarding} from '@/server/studio/preferences';
import {previewFile,commitFile,fileSources,importSapDataset} from '@/server/studio/files';
import {generateBanner,readBanner} from '@/server/studio/banners';
export const runtime='nodejs';export const dynamic='force-dynamic';
const json=(value:unknown,status=200)=>NextResponse.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
async function body(req:NextRequest){const raw=await req.text();if(Buffer.byteLength(raw)>32000)throw new HttpError(413,'O pedido excedeu 32 KB.');try{return JSON.parse(raw)}catch{throw new HttpError(400,'Envie um corpo JSON válido.');}}
async function handler(req:NextRequest,context:{params:Promise<{path:string[]}>}){
 const requestId=randomUUID();
 try{
  const route=(await context.params).path.join('/');
  if(req.method==='GET'&&route==='openapi')return json(studioOpenApi());
  if(req.method==='GET'&&route==='config')return json({runtime:runtimeStatus(),demo:demoEnabled(),local:localEnabled(),sso:{clientId:process.env.MSAL_SPA_CLIENT_ID||process.env.NEXT_PUBLIC_MSAL_CLIENT_ID||'',tenantId:process.env.MSAL_TENANT_ID||process.env.NEXT_PUBLIC_MSAL_TENANT_ID||'',scope:process.env.MSAL_SPA_SCOPE||process.env.NEXT_PUBLIC_MSAL_SCOPE||''}});
  if(req.method!=='GET')checkOrigin(req);
  if(req.method==='POST'&&route==='session'){
   if(!demoEnabled())throw new HttpError(403,'A demonstração está desabilitada. Use o SSO configurado.');
   const input=z.object({name:z.string().trim().max(80).optional()}).strict().parse(await body(req));
   const actor={id:`studio-${randomUUID()}`,name:input.name||'Visitante CLARA',demo:true,auth:'demo' as const};
   const response=json(bootstrapStudio(actor));response.cookies.set('prometeu-session',session(actor),{httpOnly:true,secure:new URL(process.env.PUBLIC_APP_URL||req.url).protocol==='https:',sameSite:'lax',path:'/',maxAge:28800});return response;
  }
  const actor=requireActor(req),workspaceId=req.headers.get('x-clara-workspace')||undefined;
  if(req.method==='POST'&&route==='onboarding')return json(completeOnboarding(actor));
  if(req.method==='GET'&&route==='files')return json(fileSources(actor,workspaceId));
  if(req.method==='POST'&&route==='files/preview'){
   if(Number(req.headers.get('content-length'))>9*1024*1024)throw new HttpError(413,'Use uma planilha de até 8 MB.');
   const form=await req.formData(),file=form.get('file');if(!(file instanceof File))throw new HttpError(422,'Escolha uma planilha.');return json(await previewFile(actor,workspaceId,file));
  }
  if(req.method==='POST'&&route==='datasets/sap'){const result=await importSapDataset(actor,workspaceId,await body(req),req.signal);trackUsage(actor,'data.imported',workspaceId);return json(result);}
  if(req.method==='POST'&&route==='files/import'){const result=commitFile(actor,workspaceId,await body(req));trackUsage(actor,'data.imported',workspaceId);return json(result);}
  if(req.method==='POST'&&route==='banners')return json(await generateBanner(actor,workspaceId,await body(req),req.signal));
  if(req.method==='GET'&&route.startsWith('banners/')){const banner=readBanner(actor,req.nextUrl.searchParams.get('workspace')||workspaceId,route.slice(8));return new NextResponse(Buffer.from(banner.image,'base64'),{headers:{'Content-Type':'image/png','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});}
  if(req.method==='GET'&&route.startsWith('catalog/'))return json(await catalogStudio(actor,workspaceId,req.signal,route.slice(8)));
  if(req.method==='GET'&&route==='bootstrap')return json(bootstrapStudio(actor,workspaceId));
  if(req.method==='GET'&&route==='catalog')return json(await catalogStudio(actor,workspaceId,req.signal));
  if(req.method==='POST'&&route==='presentations'){const result=await createPresentation(actor,workspaceId,await body(req),req.signal);trackUsage(actor,'presentation.created',workspaceId);return json(result);}
  if(req.method==='POST'&&route==='dashboards/merge'){const result=mergeBoards(actor,workspaceId,await body(req));trackUsage(actor,'dashboard.merged',workspaceId);return json(result);}
  if(req.method==='POST'&&route==='widgets/query')return json(await queryWidget(actor,workspaceId,await body(req),req.signal));
  if(req.method==='POST'&&route==='query')return json(await queryStudio(actor,workspaceId,await body(req),req.signal));
  if(req.method==='POST'&&route==='commands')return json(commandStudio(actor,workspaceId,await body(req)));
  if(req.method==='POST'&&route==='assistant')return json(await assistantStudio(actor,workspaceId,await body(req),req.signal));
  if(req.method==='POST'&&route==='scenario'){const input=z.object({percent:z.number().finite().min(0).max(100),center:z.string().min(1).max(100).default('Tecnologia'),filters:filtersSchema.optional()}).strict().parse(await body(req));return json(await scenarioPreview(actor,workspaceId,input.percent,req.signal,input.filters,input.center));}
  throw new HttpError(404,'Operação Studio não encontrada.');
 }catch(error){const status=error instanceof z.ZodError?422:error instanceof HttpError?error.status:500;const message=error instanceof z.ZodError?validationMessage(error):error instanceof HttpError?error.message:'Não foi possível concluir a operação. Tente novamente.';return json({error:{code:({402:'NO_CREDITS',401:'UNAUTHENTICATED',403:'FORBIDDEN',404:'NOT_FOUND',409:'CONFLICT',422:'VALIDATION',429:'RATE_LIMIT',503:'UNAVAILABLE'} as Record<number,string>)[status]||'REQUEST_FAILED',message,requestId}},status)}
}
export const GET=handler;export const POST=handler;
