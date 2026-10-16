import {randomUUID} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {HttpError,checkOrigin,requireActor,session} from '@/server/auth';
import {bootstrapStudio,catalogStudio,commandStudio,queryStudio,assistantStudio,scenarioPreview,runtimeStatus} from '@/server/studio/service';
import {studioOpenApi} from '@/studio/openapi';
export const runtime='nodejs';export const dynamic='force-dynamic';
const json=(value:unknown,status=200)=>NextResponse.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
async function body(req:NextRequest){const raw=await req.text();if(Buffer.byteLength(raw)>32000)throw new HttpError(413,'O pedido excedeu 32 KB.');try{return JSON.parse(raw)}catch{throw new HttpError(400,'Envie um corpo JSON válido.');}}
async function handler(req:NextRequest,context:{params:Promise<{path:string[]}>}){
 const requestId=randomUUID();
 try{
  const route=(await context.params).path.join('/');
  if(req.method==='GET'&&route==='openapi')return json(studioOpenApi());
  if(req.method==='GET'&&route==='config')return json({runtime:runtimeStatus(),demo:process.env.AUTH_MODE!=='msal',sso:{clientId:process.env.MSAL_SPA_CLIENT_ID||process.env.NEXT_PUBLIC_MSAL_CLIENT_ID||'',tenantId:process.env.MSAL_TENANT_ID||process.env.NEXT_PUBLIC_MSAL_TENANT_ID||'',scope:process.env.MSAL_SPA_SCOPE||process.env.NEXT_PUBLIC_MSAL_SCOPE||''}});
  if(req.method!=='GET')checkOrigin(req);
  if(req.method==='POST'&&route==='session'){
   if(process.env.AUTH_MODE==='msal')throw new HttpError(403,'A demonstração está desabilitada. Use o SSO configurado.');
   const input=z.object({name:z.string().trim().max(80).optional()}).strict().parse(await body(req));
   const actor={id:`studio-${randomUUID()}`,name:input.name||'Visitante CLARA',demo:true,auth:'demo' as const};
   const response=json(bootstrapStudio(actor));response.cookies.set('prometeu-session',session(actor),{httpOnly:true,secure:new URL(process.env.PUBLIC_APP_URL||req.url).protocol==='https:',sameSite:'lax',path:'/',maxAge:28800});return response;
  }
  const actor=requireActor(req),workspaceId=req.headers.get('x-clara-workspace')||undefined;
  if(req.method==='GET'&&route==='bootstrap')return json(bootstrapStudio(actor,workspaceId));
  if(req.method==='GET'&&route==='catalog')return json(await catalogStudio(actor,workspaceId,req.signal));
  if(req.method==='POST'&&route==='query')return json(await queryStudio(actor,workspaceId,await body(req),req.signal));
  if(req.method==='POST'&&route==='commands')return json(commandStudio(actor,workspaceId,await body(req)));
  if(req.method==='POST'&&route==='assistant')return json(await assistantStudio(actor,workspaceId,await body(req),req.signal));
  if(req.method==='POST'&&route==='scenario'){const input=z.object({percent:z.number().finite().min(0).max(100)}).strict().parse(await body(req));return json(await scenarioPreview(actor,workspaceId,input.percent,req.signal));}
  throw new HttpError(404,'Operação Studio não encontrada.');
 }catch(error){const status=error instanceof z.ZodError?422:error instanceof HttpError?error.status:500;const message=error instanceof z.ZodError?'O pedido não atende ao contrato. Confira os campos e limites.':error instanceof HttpError?error.message:'Não foi possível concluir a operação. Tente novamente.';return json({error:{code:({401:'UNAUTHENTICATED',403:'FORBIDDEN',404:'NOT_FOUND',409:'CONFLICT',422:'VALIDATION',429:'RATE_LIMIT',503:'UNAVAILABLE'} as Record<number,string>)[status]||'REQUEST_FAILED',message,requestId}},status)}
}
export const GET=handler;export const POST=handler;
