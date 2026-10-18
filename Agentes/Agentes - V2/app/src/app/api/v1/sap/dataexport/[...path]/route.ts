import {NextRequest,NextResponse} from 'next/server';
import {requireActor,HttpError} from '@/server/auth';
import {resolveWorkspace} from '@/server/workspaces';
import {querySac} from '@/server/sac';

export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(req:NextRequest,context:{params:Promise<{path:string[]}>}){
 const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
 try{
  const actor=requireActor(req),workspaceId=req.headers.get('x-clara-workspace');
  if(!workspaceId)throw new HttpError(422,'Informe x-clara-workspace para consultar o SAP.');
  const workspace=resolveWorkspace(actor,workspaceId);
  const path=(await context.params).path.join('/');
  const result=await querySac(workspace.id,path,req.nextUrl.searchParams,req.signal);
  return typeof result.body==='string'?new NextResponse(result.body,{headers:{...headers,'Content-Type':result.type}}):NextResponse.json(result.body,{headers});
 }catch(e){const status=e instanceof HttpError?e.status:500;return NextResponse.json({error:{code:`SAP_${status}`,message:e instanceof HttpError?e.message:'Não foi possível consultar o SAP.'}},{status,headers});}
}
