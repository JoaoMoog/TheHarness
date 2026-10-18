import {test,expect,type Page} from '@playwright/test';
import {pilotHarness} from '../pilot-harness.mjs';

async function signIn(page:Page,url:string){
 const response=await page.request.post(url+'/api/auth/register',{headers:{origin:url},data:{mode:'local',name:'Unificação',email:crypto.randomUUID()+'@example.test',password:'Merge-test-2026!'}});
 expect(response.ok()).toBe(true);
 return (await page.request.get(url+'/api/v1/studio/bootstrap')).json();
}
async function openMerge(page:Page){
 await page.getByRole('button',{name:'Mais opções do dashboard'}).click();
 await page.getByRole('button',{name:'Unificar dashboards',exact:true}).click();
 return page.getByRole('dialog',{name:'Unificar dashboards'});
}

test('menu de unificação explica quando só há um dashboard e não duplica a versão em edição',async({page})=>{
 const pilot=await pilotHarness();
 try{
  await signIn(page,pilot.url);await page.goto(pilot.url);
  await page.getByRole('button',{name:'Pular apresentação',exact:true}).click();
  await page.getByRole('button',{name:'Abrir Desempenho financeiro',exact:true}).click();
  const dialog=await openMerge(page);
  await expect(dialog.getByRole('checkbox')).toHaveCount(1);
  await expect(dialog.getByRole('checkbox')).toBeChecked();
  await expect(dialog).toContainText('Você precisa de pelo menos dois dashboards diferentes neste espaço.');
  await expect(dialog.getByRole('button',{name:'Unificar dashboards',exact:true})).toBeDisabled();
  await dialog.getByRole('button',{name:'Ver dashboards',exact:true}).click();
  await expect(dialog).toHaveCount(0);await expect(page.getByRole('heading',{name:'Dashboards',exact:true})).toBeVisible();
 }finally{await pilot.close();}
});

test('unificação pelo menu preserva a edição atual e salva um novo dashboard sem alterar as origens',async({page})=>{
 const pilot=await pilotHarness();
 try{
  const boot=await signIn(page,pilot.url),original=boot.state.boards[0];
  expect((await page.request.post(pilot.url+'/api/v1/studio/query',{headers:{origin:pilot.url,'x-clara-workspace':boot.workspace.id},data:{sourceId:'finance'}})).ok()).toBe(true);
  const seed=await page.request.post(pilot.url+'/api/v1/studio/commands',{headers:{origin:pilot.url,'x-clara-workspace':boot.workspace.id},data:{revision:boot.state.revision,operationId:crypto.randomUUID(),command:{type:'dashboard.save',document:{...original.document,title:'Operações'}}}});
  expect(seed.ok(),await seed.text()).toBe(true);
  await page.goto(pilot.url);await page.getByRole('button',{name:'Pular apresentação',exact:true}).click();
  await page.locator('.sidebar nav').getByRole('button',{name:'Dashboards',exact:true}).click();
  await page.getByRole('button',{name:'Abrir Desempenho financeiro',exact:true}).click();
  await page.getByRole('button',{name:'Editar',exact:true}).click();
  await page.getByLabel('Título do gráfico',{exact:true}).fill('Gráfico ainda não salvo');
  await page.getByRole('button',{name:'Concluir edição',exact:true}).click();
  const dialog=await openMerge(page);
  await dialog.getByRole('checkbox',{name:'Operações',exact:true}).check();
  await dialog.getByRole('button',{name:'Unificar dashboards',exact:true}).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.canvas-widget')).toHaveCount(4);
  await expect(page.locator('.canvas-widget h2').filter({hasText:'Gráfico ainda não salvo'})).toHaveCount(1);
  await expect(page.locator('.widget-loading')).toHaveCount(0);await expect(page.locator('.widget-error')).toHaveCount(0);
  await page.getByRole('button',{name:'Salvar',exact:true}).click();await page.getByRole('button',{name:'Salvar dashboard',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
  const saved=await(await page.request.get(pilot.url+'/api/v1/studio/bootstrap')).json();
  expect(saved.state.boards).toHaveLength(3);
  expect(saved.state.boards.find((b:{id:string})=>b.id===original.id).document).toEqual(original.document);
  expect(saved.state.boards.find((b:{document:{title:string}})=>b.document.title==='Dashboard consolidado').document.widgets).toHaveLength(4);
 }finally{await pilot.close();}
});
