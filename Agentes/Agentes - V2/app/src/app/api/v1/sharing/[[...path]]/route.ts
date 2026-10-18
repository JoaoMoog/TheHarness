import {validationMessage} from '@/server/validation';
import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {requireActor,checkOrigin,HttpError} from '@/server/auth';
import {acceptInvite} from '@/server/workspaces';
import {acceptDashboardInvite,dashboardAccess,inviteDashboard,removeDashboardAccess,sharedDashboard,sharedDashboards,invitationPreview} from '@/server/studio/sharing';
export const runtime='nodejs';export const dynamic='force-dynamic';
const json=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'no-store'}});
async function handler(req:NextRequest,ctx:{params:Promise<{path?:string[]}>}){try{
 const actor=requireActor(req);if(req.method!=='GET')checkOrigin(req);const p=(await ctx.params).path||[];
 let input:unknown={};if(req.method==='POST'){const raw=await req.text();if(Buffer.byteLength(raw)>4096)throw new HttpError(413,'Convite muito grande.');try{input=JSON.parse(raw)}catch{throw new HttpError(400,'Pedido inválido.');}}
 if(req.method==='GET'&&!p.length)return json(sharedDashboards(actor));
 if(req.method==='POST'&&p.join('/')==='preview')return json(invitationPreview(actor,input));
 if(req.method==='POST'&&p.join('/')==='join')return json(acceptDashboardInvite(actor,input));
 if(req.method==='POST'&&p.join('/')==='join-workspace')return json(acceptInvite(actor,z.object({code:z.string()}).strict().parse(input).code));
 const [workspace,board,action,id]=p;if(!workspace||!board)throw new HttpError(404,'Operação não encontrada.');
 if(req.method==='GET'&&p.length===2)return json(await sharedDashboard(actor,workspace,board,req.signal));
 if(req.method==='GET'&&p.length===3&&action==='access')return json(dashboardAccess(actor,workspace,board));
 if(req.method==='POST'&&p.length===3&&action==='invites')return json(inviteDashboard(actor,workspace,board,input));
 if(req.method==='DELETE'&&p.length===4&&(action==='members'||action==='invites'))return json(removeDashboardAccess(actor,workspace,board,action==='members'?'member':'invite',id));
 throw new HttpError(404,'Operação não encontrada.');
 }catch(e){const status=e instanceof HttpError?e.status:e instanceof z.ZodError?422:500;return json({error:e instanceof HttpError?e.message:e instanceof z.ZodError?validationMessage(e):'Não foi possível concluir.'},status);}}
export {handler as GET,handler as POST,handler as DELETE};
