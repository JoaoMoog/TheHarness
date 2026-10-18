import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {pilotHarness} from '../pilot-harness.mjs';
import {compact} from '../../src/studio/domain';

test('prioridade de design: prévias reais, lista, retomada e salvamento confirmado',async({page},info)=>{
 test.setTimeout(100000);
 const pilot=await pilotHarness(),errors:string[]=[];
 page.on('pageerror',error=>errors.push(error.message));
 try{
  const headers={origin:pilot.url};
  expect((await page.request.post(`${pilot.url}/api/auth/register`,{headers,data:{mode:'local',name:'Design CLARA',email:`design-${Date.now()}@example.test`,password:'Teste-design-2026!'}})).ok()).toBeTruthy();
  let boot=await (await page.request.get(`${pilot.url}/api/v1/studio/bootstrap`)).json();
  const catalog=await (await page.request.get(`${pilot.url}/api/v1/studio/catalog/finance`)).json();
  const document={...boot.state.boards[0].document,title:'Recorte da equipe',center:catalog.centers[0]};
  const saved=await page.request.post(`${pilot.url}/api/v1/studio/commands`,{headers,data:{revision:boot.state.revision,operationId:crypto.randomUUID(),command:{type:'dashboard.save',document}}});
  expect(saved.ok()).toBeTruthy();boot=await saved.json();
  const query=await (await page.request.post(`${pilot.url}/api/v1/studio/query`,{headers,data:{sourceId:document.sourceId,center:document.center,limit:1}})).json();
  await page.goto(pilot.url);await page.getByRole('button',{name:'Pular apresentação',exact:true}).click();
  const card=page.locator('.home-recent .board-card').filter({hasText:'Recorte da equipe'});
  await expect(card.locator('.preview-total strong')).toHaveText(compact(query.actual));
  await expect(card).toContainText('Editado em');await expect(card).toContainText('Dados atualizados em');
  for(const [width,height] of [[1440,1000],[390,844]]){
   await page.setViewportSize({width,height});
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   expect((await new AxeBuilder({page}).include('.home-page').withTags(['wcag2a','wcag2aa']).analyze()).violations).toEqual([]);
   await page.screenshot({path:info.outputPath(`home-${width}.png`),animations:'disabled'});
  }
  await page.setViewportSize({width:1440,height:1000});
  await page.locator('.sidebar nav').getByRole('button',{name:'Dados',exact:true}).click();await expect(page.getByRole('heading',{name:'Dados',exact:true})).toBeVisible();
  await page.locator('.sidebar nav').getByRole('button',{name:'Dashboards'}).click();
  await page.getByRole('button',{name:'Lista',exact:true}).click();await expect(page.getByRole('button',{name:'Lista',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('.board-list .board-card')).toHaveCount(2);
  await page.getByLabel('Buscar dashboards').fill('Recorte da equipe');await expect(page.locator('.board-list .board-card')).toHaveCount(1);
  await page.getByLabel('Buscar dashboards').fill('');
  for(const [width,height] of [[1440,1000],[390,844]]){
   await page.setViewportSize({width,height});
   await expect(page.getByRole('heading',{name:'Dashboards',exact:true})).toBeInViewport();
   await expect(page.getByRole('complementary',{name:'CLARA IA',exact:true})).toHaveCount(0);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   expect((await new AxeBuilder({page}).include('.analysis-library').withTags(['wcag2a','wcag2aa']).analyze()).violations).toEqual([]);
   await page.screenshot({path:info.outputPath(`library-${width}.png`),animations:'disabled'});
  }
  await page.setViewportSize({width:1440,height:1000});
  await page.getByRole('button',{name:'Abrir Recorte da equipe',exact:true}).click();
  await expect(page.locator('.save-state')).toContainText('Salvo');
  await page.getByRole('button',{name:'Editar',exact:true}).click();
  await page.getByLabel('Nome do dashboard',{exact:true}).fill('Análise revisada');
  await expect(page.locator('.save-state')).toContainText('Alterações não salvas');
  await page.getByRole('button',{name:'Concluir edição',exact:true}).click();
  await page.locator('.sidebar nav').getByRole('button',{name:'Início',exact:true}).click();
  await expect(page.getByRole('region',{name:'Análise em andamento'})).toContainText('Análise revisada');
  page.once('dialog',dialog=>dialog.dismiss());
  await page.getByRole('button',{name:'Abrir Desempenho financeiro',exact:true}).click();
  await expect(page.getByRole('region',{name:'Análise em andamento'})).toContainText('Análise revisada');
  await page.getByRole('button',{name:'Retomar análise',exact:true}).click();await expect(page.getByRole('heading',{name:'Análise revisada',exact:true})).toBeVisible();
  // A rejected save must not claim success or clear the editable document.
  await page.route('**/api/v1/studio/commands',async route=>{if(route.request().postDataJSON()?.command?.type==='dashboard.save'){await route.fulfill({status:503,json:{error:{message:'Não foi possível salvar agora.'}}});}else await route.continue();});
  await page.getByRole('button',{name:'Salvar',exact:true}).click();
  await page.getByRole('button',{name:'Salvar dashboard',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('Não foi possível salvar agora.');
  await page.getByRole('button',{name:'Cancelar',exact:true}).click();await expect(page.locator('.save-state')).toContainText('Alterações não salvas');
  await page.unroute('**/api/v1/studio/commands');
  for(const [width,height] of [[1440,1000],[390,844]]){
   await page.setViewportSize({width,height});
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   expect((await new AxeBuilder({page}).include('.save-state').withTags(['wcag2a','wcag2aa']).analyze()).violations).toEqual([]);
   await page.screenshot({path:info.outputPath(`unsaved-${width}.png`),animations:'disabled'});
  }
  await page.getByRole('button',{name:'Salvar',exact:true}).click();await page.getByRole('button',{name:'Salvar dashboard',exact:true}).click();
  await expect(page.locator('.save-state')).toContainText('Salvo');
  await expect(page.getByRole('button',{name:'Salvar',exact:true})).toBeDisabled();
  expect(errors).toEqual([]);
 }finally{await pilot.close()}
});
