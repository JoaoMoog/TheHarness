import test from 'node:test';
import assert from 'node:assert/strict';
process.env.CLARA_STORAGE_MODE = 'memory';
process.env.STUDIO_DATA_PROVIDER = 'demo';
process.env.STUDIO_AI_PROVIDER = 'demo';
const admin = { id: 'studio-test-admin', name: 'Ana', demo: true };
const other = { id: 'studio-test-other', name: 'Bruno', demo: true };
async function services() {
  const module = await import('../src/server/studio/service').catch(() => null);
  assert.ok(module, 'Serviços Studio precisam existir');
  return module;
}
const op = () => crypto.randomUUID();

test('Studio: cálculos do servidor respeitam filtros e base original', async () => {
  const s = await services();
  const all = await s.queryStudio(admin, undefined, {});
  assert.equal(all.actual, 8190000); assert.equal(all.budget, 8319000);
  assert.equal(all.balance, 129000); assert.equal(all.count, 72);
  const filtered = await s.queryStudio(admin, undefined, {center:'Tecnologia',company:'Filial',period:'q3'});
  assert.equal(filtered.count, 3); assert.ok(filtered.actual < 3210000);
  assert.equal(filtered.lineage.provider, 'demo');
  await assert.rejects(s.queryStudio(admin, undefined, {center:'Inexistente'}), /centro/i);
});

test('Studio: salvar é idempotente, revisões evitam perda de trabalho', async () => {
  const s = await services(); const first = s.bootstrapStudio(admin);
  const input = {revision:first.state.revision,operationId:op(),command:{type:'dashboard.save',document:{...first.state.boards[0].document,title:'Teste de versão'}}};
  const result = s.commandStudio(admin, undefined, input);
  assert.equal(result.state.boards.length, first.state.boards.length + 1);
  assert.deepEqual(s.commandStudio(admin, undefined, input), result);
  assert.throws(()=>s.commandStudio(admin, undefined,{...input,operationId:op()}), /mudou|atualiz/i);
  assert.throws(()=>s.commandStudio(admin, undefined,{...input,command:{...input.command,document:{...input.command.document,title:'Diferente'}}}), /identificador|repet/i);
});

test('Studio: comentários e versões pertencem a um dashboard; autor vem da sessão', async () => {
  const s = await services(); const first = s.bootstrapStudio(admin); const board = first.state.boards[0];
  const result = s.commandStudio(admin,undefined,{revision:first.state.revision,operationId:op(),command:{type:'comment.add',boardId:board.id,text:'Conferido'}});
  const comment = result.state.comments.at(-1)!;
  assert.equal(comment.authorId,admin.id); assert.equal(comment.boardId,board.id);
  assert.throws(()=>s.commandStudio(admin,undefined,{revision:result.state.revision,operationId:op(),command:{type:'comment.add',boardId:'missing',text:'Inválido'}}), /dashboard/i);
  const outsider = s.bootstrapStudio(other);
  assert.equal(outsider.state.comments.length,0);
  assert.throws(()=>s.bootstrapStudio(other,admin.id), /disponível/i);
});

test('Studio: planejamento e cenário têm versões e resultados calculados', async () => {
  const s = await services(); let result = s.bootstrapStudio(admin);
  result = s.commandStudio(admin,undefined,{revision:result.state.revision,operationId:op(),command:{type:'plan.save',name:'Revisão de outubro',budgets:[3500000,2100000,1540000,1279000]}});
  assert.equal(result.state.plans[0].total,8419000);
  result = s.commandStudio(admin,undefined,{revision:result.state.revision,operationId:op(),command:{type:'scenario.save',name:'Redução 5%',percent:5}});
  assert.equal(result.state.scenarios[0].saving,160500);
  assert.equal(result.state.scenarios[0].actual,8029500);
  assert.equal((await s.queryStudio(admin,undefined,{})).actual,8190000);
  assert.throws(()=>s.commandStudio(admin,undefined,{revision:result.state.revision,operationId:op(),command:{type:'scenario.save',name:'Inválido',percent:101}}));
});

test('Studio: RBAC vale no servidor e usuário revogado perde acesso', async () => {
  const s = await services(); const w = await import('../src/server/workspaces');
  const team = w.createWorkspace(admin,'Equipe Studio');
  w.acceptInvite(other,w.createInvite(admin,team.id,'reader').code);
  const state = s.bootstrapStudio(other,team.id).state;
  assert.throws(()=>s.commandStudio(other,team.id,{revision:state.revision,operationId:op(),command:{type:'scenario.save',name:'Bloqueado',percent:5}}), /leitura/i);
  w.updateMember(admin,team.id,other.id,'editor');
  assert.throws(()=>s.commandStudio(other,team.id,{revision:state.revision,operationId:op(),command:{type:'source.toggle',paused:true}}), /administrador/i);
  w.updateMember(admin,team.id,other.id,null);
  await assert.rejects(s.queryStudio(other,team.id,{}), /disponível/i);
});

test('Studio: fonte pausada bloqueia consulta e assistente sem fallback', async () => {
  const s = await services(); const actor = {...admin,id:'paused-studio'}; let b = s.bootstrapStudio(actor);
  b = s.commandStudio(actor,undefined,{revision:b.state.revision,operationId:op(),command:{type:'source.toggle',paused:true}});
  await assert.rejects(s.queryStudio(actor,undefined,{}), /pausada/i);
  await assert.rejects(s.assistantStudio(actor,undefined,{prompt:'Crie dashboard',document:b.state.boards[0].document}), /pausada/i);
});

test('Studio: assistente propõe alterações tipadas, pede esclarecimento e não salva', async () => {
  const s = await services(); const first=s.bootstrapStudio(admin); const document=first.state.boards[0].document;
  const answer=await s.assistantStudio(admin,undefined,{prompt:'Mostre apenas Tecnologia',document});
  assert.equal(answer.proposal?.patch.center,'Tecnologia'); assert.equal(answer.provider,'demo');
  assert.equal(s.bootstrapStudio(admin).state.revision,first.state.revision);
  const unsupported=await s.assistantStudio(admin,undefined,{prompt:'Qual o lucro líquido consolidado?',document});
  assert.equal(unsupported.status,'clarify'); assert.equal(unsupported.proposal,null);
  const outsider=s.bootstrapStudio(other);
  assert.equal(outsider.messages.length,0);
});

test('Studio: documento, números inválidos e comandos desconhecidos são recusados', async () => {
  const s=await services(); const b=s.bootstrapStudio(admin);
  for (const command of [{type:'anything'},{type:'plan.save',name:'Inválido',budgets:[NaN,0,0,0]},{type:'model.save',name:'Código',formula:'eval(1)'}]) {
    assert.throws(()=>s.commandStudio(admin,undefined,{revision:b.state.revision,operationId:op(),command}));
  }
});
