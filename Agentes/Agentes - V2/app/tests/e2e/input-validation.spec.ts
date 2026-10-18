import {test,expect} from '@playwright/test';
import {pilotHarness} from '../pilot-harness.mjs';

test('limites na interface e rejeição de pedidos inválidos no servidor',async({page})=>{
 test.setTimeout(90000);const pilot=await pilotHarness();
 try{
  const registered=await page.request.post(pilot.url+'/api/auth/register',{headers:{origin:pilot.url},data:{mode:'local',name:'Validação',email:crypto.randomUUID()+'@example.test',password:'Validacao-2026!'}});
  expect(registered.ok()).toBe(true);
  await page.goto(pilot.url);await page.getByRole('button',{name:'Pular apresentação',exact:true}).click();
  await page.locator('.sidebar nav').getByRole('button',{name:'Administração',exact:true}).click();
  await page.getByText('Criar um espaço de equipe',{exact:true}).click();
  const name=page.locator('#workspace-name');await expect(name).toHaveAttribute('maxlength','80');
  await name.fill('x'.repeat(79));await name.press('End');await name.pressSequentially('abc');expect((await name.inputValue()).length).toBe(80);
  await name.fill('   ');await expect(page.getByRole('button',{name:'Criar espaço',exact:true})).toBeDisabled();
  await page.getByText('Entrar por convite',{exact:true}).click();await page.locator('#workspace-code').fill('https://');await page.getByRole('button',{name:'Entrar no espaço',exact:true}).click();
  await expect(page.locator('.compact-admin').getByRole('alert')).toContainText('Cole um código de convite válido');
  const email=page.locator('.governance-invite input');await expect(email).toHaveAttribute('maxlength','200');await email.fill('invalido');
  expect(await email.evaluate((el:HTMLInputElement)=>el.checkValidity())).toBe(false);

  const post=(path:string,data:unknown)=>page.request.post(pilot.url+path,{headers:{origin:pilot.url},data});
  const workspace=await post('/api/workspaces',{name:'x'.repeat(81)});expect(workspace.status()).toBe(400);expect((await workspace.json()).error).toContain('80 caracteres');
  const query=await post('/api/v1/studio/query',{search:'x'.repeat(121)});expect(query.status()).toBe(422);expect((await query.json()).error.message).toBe('Busca: use no máximo 120 caracteres.');
  const bootstrap=await(await page.request.get(pilot.url+'/api/v1/studio/bootstrap')).json();
  const board=bootstrap.state.boards[0];
  const save=await post('/api/v1/studio/commands',{revision:bootstrap.state.revision,operationId:crypto.randomUUID(),command:{type:'dashboard.save',id:board.id,document:{...board.document,title:'x'.repeat(121)}}});
  expect(save.status()).toBe(422);expect((await save.json()).error.message).toBe('Título: use no máximo 120 caracteres.');
  const after=await(await page.request.get(pilot.url+'/api/v1/studio/bootstrap')).json();expect(after.state.revision).toBe(bootstrap.state.revision);
 }finally{await pilot.close();}
});
