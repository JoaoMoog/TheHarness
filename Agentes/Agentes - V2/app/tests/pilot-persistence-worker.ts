import {localActor} from '../src/server/localAuth';
import {bootstrapStudio,commandStudio,queryStudio} from '../src/server/studio/service';
import {session} from '../src/server/auth';
import {db} from '../src/server/store';
async function main(){
 const phase=process.argv[2],email='persist@example.test',password='Persist-test-2026';
 const actor=await localActor({email,password,...(phase==='seed'?{name:'Persistência'}:{})},phase==='seed');
 if(phase==='seed'){
  await queryStudio(actor,undefined,{});const first=bootstrapStudio(actor);
  commandStudio(actor,undefined,{revision:first.state.revision,operationId:'d0b38468-ad59-4ec6-bbb4-fbfca70c45fd',command:{type:'dashboard.save',document:{title:'Dashboard reiniciado',company:'Filial',center:'Tecnologia',period:'q3'}}});
  session(actor);
 }
 const current=bootstrapStudio(actor);
 console.log(JSON.stringify({name:actor.name,title:current.state.boards[0].document.title,revision:current.state.revision,period:current.state.boards[0].document.period,sessions:db().prepare('SELECT COUNT(*) AS n FROM sessions').get()!.n,receipts:db().prepare("SELECT COUNT(*) AS n FROM resources WHERE kind='studio-receipt'").get()!.n}));
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
