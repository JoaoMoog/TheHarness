import {test,expect} from '@playwright/test';
import {pilotHarness} from '../pilot-harness.mjs';

test('convites por dashboard e espaço, membros, isolamento e revogação',async({page,browser},info)=>{
 test.setTimeout(120000);page.setDefaultTimeout(12000);const pilot=await pilotHarness(),errors:string[]=[];
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),guest=await context.newPage();guest.setDefaultTimeout(12000);
 page.on('pageerror',e=>errors.push(e.message));guest.on('pageerror',e=>errors.push(e.message));
 const register=async(p:typeof page,name:string)=>{const r=await p.request.post(pilot.url+'/api/auth/register',{headers:{origin:pilot.url},data:{mode:'local',name,email:crypto.randomUUID()+'@example.test',password:'Convites-teste-2026!'}});expect(r.ok()).toBe(true)};
 try{
  await register(page,'Dono do dashboard');const boot=await (await page.request.get(pilot.url+'/api/v1/studio/bootstrap')).json();
  await page.goto(pilot.url);await page.getByRole('button',{name:'Pular apresentação',exact:true}).click();await page.getByRole('button',{name:'Abrir Desempenho financeiro',exact:true}).click();
  await page.getByRole('button',{name:'Mais opções do dashboard'}).click();await page.getByRole('button',{name:'Compartilhar',exact:true}).click();await page.getByRole('button',{name:'Criar convite individual'}).click();
  const link=await page.getByLabel('Link para compartilhar').inputValue();expect(link).toContain('/shared?invite=');
  await page.screenshot({path:info.outputPath('dashboard-invite.png'),animations:'disabled'});
  await guest.goto(link);await expect(guest.getByRole('heading',{name:'Seu espaço de análise.'})).toBeVisible();
  await register(guest,'Convidado individual');await guest.reload();await expect(guest.locator('.shared-invitation')).toContainText('Desempenho financeiro');await guest.getByRole('button',{name:'Aceitar convite',exact:true}).click();
  await expect(guest.getByRole('heading',{name:'Desempenho financeiro',exact:true})).toBeVisible();await expect(guest.locator('.shared-widgets .widget-visual')).toHaveCount(2);await expect(guest.getByRole('button',{name:'Editar',exact:true})).toHaveCount(0);
  expect((await guest.request.get(pilot.url+'/api/v1/studio/bootstrap',{headers:{'x-clara-workspace':boot.workspace.id}})).status()).toBe(404);
  await guest.screenshot({path:info.outputPath('shared-dashboard.png'),animations:'disabled'});await guest.setViewportSize({width:390,height:844});expect(await guest.locator('body').evaluate(el=>el.scrollWidth<=innerWidth)).toBe(true);expect(await guest.locator('.metric').evaluateAll(els=>els.every(el=>el.querySelector('strong')!.scrollWidth<=el.clientWidth-30))).toBe(true);await guest.screenshot({path:info.outputPath('shared-mobile.png'),animations:'disabled'});
  await guest.getByRole('link',{name:'Ir para meu espaço'}).click();await guest.getByRole('button',{name:'Pular apresentação',exact:true}).click();await guest.getByRole('button',{name:'Abrir navegação',exact:true}).click();await guest.locator('.sidebar nav').getByRole('button',{name:'Dashboards',exact:true}).click();await expect(guest.locator('.shared-library').getByRole('link',{name:'Desempenho financeiro'})).toBeVisible();
  await page.getByRole('button',{name:'Fechar janela',exact:true}).click();await page.getByRole('button',{name:'Mais opções do dashboard'}).click();await page.getByRole('button',{name:'Compartilhar',exact:true}).click();
  await expect(page.locator('.sharing-people')).toContainText(['Convidado individual']);page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Remover',exact:true}).click();await expect(page.locator('.dashboard-sharing')).not.toContainText('Convidado individual');
  await guest.goto(pilot.url+`/shared?workspace=${boot.workspace.id}&dashboard=${boot.state.boards[0].id}`);await expect(guest.locator('.shared-page [role=alert]')).toContainText('não disponível');await expect(guest.locator('.widget-visual')).toHaveCount(0);
  await page.getByRole('button',{name:'Fechar janela',exact:true}).click();await page.locator('.sidebar nav').getByRole('button',{name:'Administração',exact:true}).click();await page.getByRole('button',{name:'Criar convite para o espaço',exact:true}).click();const workspaceLink=await page.locator('#new-invite-code').inputValue();
  await guest.goto(workspaceLink);await expect(guest.locator('.shared-invitation')).toContainText('Meu espaço');await guest.getByRole('button',{name:'Aceitar convite',exact:true}).click();await expect(guest).toHaveURL(new RegExp('workspace='));
  expect((await guest.request.get(pilot.url+'/api/v1/studio/bootstrap',{headers:{'x-clara-workspace':boot.workspace.id}})).ok()).toBe(true);
  await page.getByRole('button',{name:'Atualizar',exact:true}).click();await expect(page.locator('.governance-members')).toContainText('Convidado individual');
  const member=page.locator('.governance-member').filter({hasText:'Convidado individual'});await member.getByRole('button',{name:'Remover',exact:true}).click();await member.getByRole('button',{name:'Confirmar remoção'}).click();await expect(page.locator('.governance-members')).not.toContainText('Convidado individual');
  expect((await guest.request.get(pilot.url+'/api/v1/studio/bootstrap',{headers:{'x-clara-workspace':boot.workspace.id}})).status()).toBe(404);
  for(const [width,mode] of [[1440,'light'],[1440,'dark'],[390,'dark'],[390,'light']] as const){
   await page.setViewportSize({width,height:1000});await page.evaluate(mode=>document.documentElement.classList.toggle('dark',mode==='dark'),mode);
   const panels=page.locator('.governance-entry>details');
   const closedHeights=await panels.evaluateAll(els=>els.map(el=>el.getBoundingClientRect().height));
   for(const index of [0,1]){
    await panels.nth(index).locator('summary').click();
    expect(await panels.nth(1-index).evaluate(el=>el.hasAttribute('open'))).toBe(false);
    expect(Math.abs((await panels.nth(1-index).boundingBox())!.height-closedHeights[1-index])).toBeLessThanOrEqual(1);
    if(index===0&&width===1440&&mode==='dark')await page.screenshot({path:info.outputPath('independent-panels.png'),animations:'disabled'});
    await panels.nth(index).locator('summary').click();
   }
   await page.locator('.governance-section').first().scrollIntoViewIfNeeded();
   expect(await page.locator('#main').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
   if(width===1440){
    const controls=await page.locator('.governance-invite input,.governance-invite .select-trigger,.governance-invite>.button').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:r.height}}));
    expect(Math.max(...controls.map(r=>r.top))-Math.min(...controls.map(r=>r.top))).toBeLessThanOrEqual(1);
    expect(Math.max(...controls.map(r=>r.height))-Math.min(...controls.map(r=>r.height))).toBeLessThanOrEqual(1);
    const memberControls=await page.locator('.governance-member').first().locator('.select-trigger,button.button,button.text-button').evaluateAll(els=>els.map(el=>el.getBoundingClientRect().bottom));
    expect(Math.max(...memberControls)-Math.min(...memberControls)).toBeLessThanOrEqual(1);
   }
   await page.screenshot({path:info.outputPath(`members-aligned-${width}-${mode}.png`),animations:'disabled'});
  }
  await page.screenshot({path:info.outputPath('workspace-members.png'),animations:'disabled'});await pilot.restart();expect((await guest.request.get(pilot.url+`/api/v1/sharing/${boot.workspace.id}/${boot.state.boards[0].id}`)).status()).toBe(404);expect(errors).toEqual([]);
 }finally{await context.close();await pilot.close()}
});
