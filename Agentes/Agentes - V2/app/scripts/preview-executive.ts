import {writeFileSync} from 'node:fs';
async function main(){
process.env.CLARA_STORAGE_MODE='memory';process.env.STUDIO_DATA_PROVIDER='demo';
const {bootstrapStudio}=await import('../src/server/studio/service');
const {createPresentation}=await import('../src/server/studio/executive');
const actor={id:'preview-btg-synthetic',name:'Prévia de design',demo:true},boot=bootstrapStudio(actor);
const artifact=await createPresentation(actor,boot.workspace.id,{title:'Resultados e prioridades',boardIds:[boot.state.boards[0].id]});
writeFileSync('../docs/clara-executivo-btg.html',artifact.html);
console.log(JSON.stringify({slides:artifact.slideCount,path:'docs/clara-executivo-btg.html',data:'synthetic'}));

}
main().catch(error=>{console.error(error);process.exitCode=1});
