import {validationMessage} from '@/server/validation';
import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {checkOrigin,HttpError,requireActor} from '@/server/auth';
import {myCredits,creditHistory,creditUsers,grantCredits,platformUsage} from '@/server/credits';
import {platformAccess} from '@/server/platformAccess';
export const runtime='nodejs';export const dynamic='force-dynamic';
const json=(value:unknown,status=200)=>NextResponse.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
async function handler(req:NextRequest,context:{params:Promise<{path:string[]}>}){
 try{
  if(req.method!=='GET')checkOrigin(req);const actor=requireActor(req),route=(await context.params).path.join('/');
  if(req.method==='GET'&&route==='me')return json({credits:myCredits(actor),access:platformAccess(actor)});
  if(req.method==='GET'&&route==='credits')return json(creditUsers(actor,Object.fromEntries(req.nextUrl.searchParams)));
  if(req.method==='GET'&&route==='history')return json(creditHistory(actor,req.nextUrl.searchParams.get('userId')||actor.id));
  if(req.method==='GET'&&route==='usage')return json(platformUsage(actor,Object.fromEntries(req.nextUrl.searchParams)));
  if(req.method==='POST'&&route==='grants'){const raw=await req.text();if(Buffer.byteLength(raw)>4096)throw new HttpError(413,'Pedido muito longo.');let input;try{input=JSON.parse(raw)}catch{throw new HttpError(400,'Envie JSON válido.')}return json(grantCredits(actor,input));}
  throw new HttpError(404,'Operação não encontrada.');
 }catch(error){const status=error instanceof z.ZodError?422:error instanceof HttpError?error.status:500;return json({error:{code:status===402?'NO_CREDITS':status===403?'FORBIDDEN':'REQUEST_FAILED',message:error instanceof z.ZodError?validationMessage(error):error instanceof HttpError?error.message:'Não foi possível concluir a operação.'}},status)}
}
export const GET=handler;export const POST=handler;
