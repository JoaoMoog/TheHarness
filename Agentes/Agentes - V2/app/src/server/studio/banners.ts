import {withCredits} from '../credits';
import {randomUUID,randomInt} from 'node:crypto';
import {BedrockRuntimeClient,InvokeModelCommand} from '@aws-sdk/client-bedrock-runtime';
import {z} from 'zod';
import type {Actor} from '@/core/types';
import {HttpError} from '../auth';
import {resolveWorkspace} from '../workspaces';
import {insert,read,list} from '../store';
import {repository} from './repository';
import {bedrockError} from './bedrock';
type Banner={id:string;owner:string;boardId:string;image:string;createdAt:string};
export const bannerRequestSchema=z.object({boardId:z.string().min(1).max(150),prompt:z.string().trim().min(5).max(700)}).strict();
export function readBanner(actor:Actor,workspaceId:string|undefined,id:string,boardId?:string){const w=resolveWorkspace(actor,workspaceId),value=read<Banner>('studio-banner',id,w.id);if(!value||boardId&&boardId!==value.boardId)throw new HttpError(404,'Capa não encontrada neste dashboard.');return value;}
const inFlight=new Set<string>();
async function generateBannerUnmetered(actor:Actor,workspaceId:string|undefined,input:unknown,signal?:AbortSignal){const w=resolveWorkspace(actor,workspaceId,'write'),p=bannerRequestSchema.parse(input);if(!repository.get(w.id).boards.some(b=>b.id===p.boardId))throw new HttpError(404,'Salve o dashboard antes de criar uma capa.');
 if(inFlight.has(w.id)||list<Banner>('studio-banner',w.id).filter(b=>Date.parse(b.createdAt)>Date.now()-3600000).length>=10)throw new HttpError(429,'Aguarde antes de gerar outra capa.');
 if(!process.env.AWS_REGION)throw new HttpError(503,'Configure a AWS para gerar capas.');
 inFlight.add(w.id);const client=new BedrockRuntimeClient({region:process.env.BEDROCK_IMAGE_REGION||'us-west-2',maxAttempts:1});const started=Date.now();
 try{const model=process.env.BEDROCK_IMAGE_MODEL_ID||'stability.stable-image-core-v1:1';const response=await client.send(new InvokeModelCommand({modelId:model,contentType:'application/json',accept:'application/json',body:JSON.stringify({prompt:`A single full-bleed fine-art illustration. Refined abstract forms, rich colors, calm composition, generous empty space, edge-to-edge artwork. Art direction: ${p.prompt}`,negative_prompt:'website, screenshot, user interface, dashboard, presentation slide, text, letters, typography, logos, watermarks, numbers, frames, borders',aspect_ratio:'16:9',output_format:'png',seed:randomInt(2147483646)})}),{abortSignal:AbortSignal.any([AbortSignal.timeout(60000),...(signal?[signal]:[])])});
 const parsed=JSON.parse(new TextDecoder().decode(response.body)),image=parsed.images?.[0];
 if(typeof image!=='string'||image.length>6000000||!Buffer.from(image,'base64').subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw new HttpError(502,'A IA não retornou uma imagem válida. Tente outra descrição.');
 const value=insert<Banner>('studio-banner',{id:randomUUID(),owner:w.id,boardId:p.boardId,image,createdAt:new Date().toISOString()});
 console.info(JSON.stringify({event:'bedrock.banner',model,durationMs:Date.now()-started,requestId:response.$metadata.requestId}));return {id:value.id};
 }catch(e){throw bedrockError(e)}finally{client.destroy();inFlight.delete(w.id);}
}

export async function generateBanner(actor:Actor,workspaceId:string|undefined,input:unknown,signal?:AbortSignal){
 const workspace=resolveWorkspace(actor,workspaceId,'write');bannerRequestSchema.parse(input);
 return withCredits(actor,workspace.id,'banner','bedrock',()=>generateBannerUnmetered(actor,workspace.id,input,signal));
}
