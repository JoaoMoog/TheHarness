import {test,expect} from '@playwright/test';
import {execFileSync} from 'node:child_process';
import {pilotHarness} from '../pilot-harness.mjs';

test('créditos: bloqueio, concessão pelo grupo, histórico, indicadores e persistência',async({page,browser},info)=>{
 test.setTimeout(150000);
 const previousTenant=process.env.MSAL_TENANT_ID,previousGroup=process.env.CLARA_PLATFORM_ADMIN_GROUP_IDS;
 const tenant='11111111-1111-4111-8111-111111111111',group='22222222-2222-4222-8222-222222222222';
 process.env.MSAL_TENANT_ID=tenant;process.env.CLARA_PLATFORM_ADMIN_GROUP_IDS=group;
 const pilot=await pilotHarness(),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.request.post(`${pilot.url}/api/auth/register`,{headers:{origin:pilot.url},data:{mode:'local',name:'Analista de teste',email:`credits-${Date.now()}@example.test`,password:'Creditos-teste-2026!'}});
  const boot=await (await page.request.get(`${pilot.url}/api/v1/studio/bootstrap`)).json();
  // Only the disposable harness database is seeded. Production has no test-login endpoint.
  const actor={id:'platform-admin-e2e',name:'Gestor de teste',email:'manager@example.test',auth:'msal',demo:false,directory:{tenantId:tenant,objectId:'test-principal',groups:[group],expiresAt:Date.now()+3600000,overage:false}};
  const cookie=execFileSync(process.execPath,['--import','tsx','-e',`const {bootstrapStudio}=require('./src/server/studio/service.ts');const {session}=require('./src/server/auth.ts');const {creditDb}=require('./src/server/credits.ts');const actor=JSON.parse(process.env.TEST_PLATFORM_ACTOR);bootstrapStudio(actor);creditDb().prepare('UPDATE credit_users SET available=5 WHERE id=?').run(process.env.TEST_CREDIT_USER);console.log(session(actor));`],{cwd:process.cwd(),env:{...process.env,CLARA_STORAGE_MODE:'sqlite',PROMETEU_DATA_DIR:pilot.dir,TEST_PLATFORM_ACTOR:JSON.stringify(actor),TEST_CREDIT_USER:boot.actor.id},encoding:'utf8'}).trim();
  await page.goto(pilot.url);await page.getByRole('button',{name:'Pular apresentação',exact:true}).click();
  await expect(page.locator('.sidebar nav').getByRole('button',{name:'Créditos',exact:true})).toHaveCount(0);await expect(page.locator('.sidebar nav').getByRole('button',{name:'Uso da plataforma',exact:true})).toHaveCount(0);
  expect((await page.request.get(`${pilot.url}/api/v1/platform/credits`)).status()).toBe(403);
  await page.getByRole('textbox',{name:'Mensagem para CLARA'}).fill('Troque o gráfico por barras horizontais');await page.getByRole('button',{name:'Enviar mensagem',exact:true}).click();
  await expect(page.locator('.composer-credit-status')).toContainText('Sem saldo de IA');await expect(page.getByRole('button',{name:'Enviar mensagem',exact:true})).toBeDisabled();
  expect((await page.request.post(`${pilot.url}/api/v1/studio/assistant`,{headers:{origin:pilot.url},data:{prompt:'Mostre barras',document:boot.state.boards[0].document}})).status()).toBe(402);
  await page.getByRole('button',{name:'Ver meus créditos'}).click();await expect(page.getByRole('dialog',{name:'Meus créditos'})).toContainText('Saldo insuficiente');await page.screenshot({path:info.outputPath('credits-empty.png'),animations:'disabled'});await page.getByRole('button',{name:'Fechar janela',exact:true}).click();
  const context=await browser.newContext({viewport:{width:1440,height:1000}});await context.addCookies([{name:'prometeu-session',value:cookie,url:pilot.url,httpOnly:true,sameSite:'Lax'}]);const manager=await context.newPage();manager.on('pageerror',e=>errors.push(e.message));
  await manager.goto(pilot.url);await manager.getByRole('button',{name:'Pular apresentação',exact:true}).click();await manager.locator('.sidebar nav').getByRole('button',{name:'Créditos',exact:true}).click();await expect(manager.getByRole('heading',{name:'Créditos da CLARA IA',exact:true})).toBeVisible();
  await manager.getByRole('button',{name:'Conceder créditos a Analista de teste',exact:true}).click();await manager.getByLabel('Quantidade de créditos',{exact:true}).fill('25');await manager.getByLabel('Motivo da concessão',{exact:true}).fill('Preparação da reunião executiva');await manager.getByRole('button',{name:'Conceder créditos',exact:true}).click();await expect(manager.getByRole('dialog')).toHaveCount(0);
  await expect(manager.locator('tr').filter({hasText:'Analista de teste'})).toContainText('5 chamadas');await manager.screenshot({path:info.outputPath('credits-desktop.png'),animations:'disabled'});
  await manager.locator('tr').filter({hasText:'Analista de teste'}).getByRole('button',{name:'Histórico'}).click();await expect(manager.getByRole('dialog')).toContainText('Gestor de teste');await expect(manager.getByRole('dialog')).toContainText('Preparação da reunião executiva');await manager.getByRole('button',{name:'Fechar janela',exact:true}).click();
  await page.reload();await expect(page.getByRole('textbox',{name:'Mensagem para CLARA'})).toBeEnabled();await expect(page.locator('.composer-credit-status')).toContainText('25/1.275 créditos disponíveis');
  await manager.locator('.sidebar nav').getByRole('button',{name:'Uso da plataforma',exact:true}).click();await expect(manager.getByRole('heading',{name:'Uso da plataforma',exact:true})).toBeVisible();await expect(manager.locator('.platform-kpis')).toContainText('Chamadas concluídas');await expect(manager.locator('.platform-loading')).toHaveCount(0);await manager.screenshot({path:info.outputPath('usage-desktop.png'),animations:'disabled'});
  const download=manager.waitForEvent('download');await manager.getByRole('button',{name:'Exportar CSV'}).click();await (await download).saveAs(info.outputPath('utilizacao.csv'));
  await manager.setViewportSize({width:390,height:844});expect(await manager.locator('#main').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);await manager.screenshot({path:info.outputPath('usage-mobile.png'),animations:'disabled'});
  await pilot.restart();const balance=await (await page.request.get(`${pilot.url}/api/v1/platform/me`)).json();expect(balance.credits.available).toBe(25);
  expect(errors).toEqual([]);await context.close();
 }finally{await pilot.close();if(previousTenant===undefined)delete process.env.MSAL_TENANT_ID;else process.env.MSAL_TENANT_ID=previousTenant;if(previousGroup===undefined)delete process.env.CLARA_PLATFORM_ADMIN_GROUP_IDS;else process.env.CLARA_PLATFORM_ADMIN_GROUP_IDS=previousGroup;}
});
