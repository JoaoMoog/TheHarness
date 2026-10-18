import {resolve} from 'node:path';
import {mkdirSync,writeFileSync} from 'node:fs';
import {pilotSettings} from './pilot-env.mjs';
Object.assign(process.env,pilotSettings(resolve('.')),{CLARA_STORAGE_MODE:'memory'});
async function main(){const {bootstrapStudio}=await import('../src/server/studio/service');const {generateBanner,readBanner}=await import('../src/server/studio/banners');const actor={id:crypto.randomUUID(),name:'Teste de capa',demo:false,auth:'local' as const},boot=bootstrapStudio(actor);const result=await generateBanner(actor,undefined,{boardId:boot.state.boards[0].id,prompt:'Minimal abstract composition, deep navy blue and soft teal architectural shapes, calm editorial style.'});const banner=readBanner(actor,undefined,result.id);mkdirSync('.local',{recursive:true});writeFileSync('.local/banner-check.png',Buffer.from(banner.image,'base64'));console.log('Capa real gerada e validada: .local/banner-check.png');}
main().catch(error=>{console.error(error instanceof Error?error.message:'Falha ao gerar capa.');process.exitCode=1});
