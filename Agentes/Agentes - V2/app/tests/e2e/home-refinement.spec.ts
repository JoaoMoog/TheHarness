import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {pilotHarness} from '../pilot-harness.mjs';

test('Início: conversa e dashboards equilibrados, teclado e acessibilidade',async({page},info)=>{
 const pilot=await pilotHarness(),errors:string[]=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
  const headers={origin:pilot.url};
  expect((await page.request.post(`${pilot.url}/api/auth/register`,{headers,data:{mode:'local',name:'Teste Início',email:`inicio-${Date.now()}@example.test`,password:'Teste-inicio-2026!'}})).ok()).toBeTruthy();
  expect((await page.request.post(`${pilot.url}/api/v1/studio/query`,{headers,data:{}})).ok()).toBeTruthy();
  let boot=await (await page.request.get(`${pilot.url}/api/v1/studio/bootstrap`)).json();
  for(const title of ['Planejamento de despesas e orçamento por centro de custo','Realizado e orçamento · Filial Sul']){
   const result=await page.request.post(`${pilot.url}/api/v1/studio/commands`,{headers,data:{revision:boot.state.revision,operationId:crypto.randomUUID(),command:{type:'dashboard.save',document:{...boot.state.boards[0].document,title}}}});
   expect(result.ok()).toBeTruthy();boot=await result.json();
  }
  await page.goto(pilot.url);await page.getByRole('button',{name:'Pular apresentação',exact:true}).click();
  await expect(page.getByRole('heading',{name:'O que vamos descobrir hoje?'})).toBeVisible();
  await expect(page.locator('.home-recent .board-card')).toHaveCount(3);
  const message=page.getByLabel('Mensagem para CLARA'),send=page.getByRole('button',{name:'Enviar mensagem',exact:true});
  await expect(send).toBeDisabled();
  await expect(page.locator('.chat-context')).not.toHaveAttribute('open','');
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:width===390?844:1000});
   await expect(message).toBeInViewport();
   expect((await page.locator('.home-chat').boundingBox())!.height).toBeLessThan(260);
   await page.screenshot({path:info.outputPath(`chat-compact-${width}.png`),animations:'disabled'});
  }
  await page.setViewportSize({width:1440,height:1000});
  await page.getByRole('group',{name:'Ideias para começar'}).getByRole('button').first().click();await expect(message).toBeFocused();await expect(message).toHaveValue('Compare realizado e orçamento em 2026');await expect(send).toBeEnabled();
  await message.press('Shift+Enter');await expect(message).toHaveValue(/\n/);await message.fill('');
  await page.locator('.chat-context summary').click();await page.getByLabel('Análise da conversa').selectOption(boot.state.boards[0].id);await expect(page.getByLabel('Fonte do novo dashboard')).toHaveCount(0);await page.getByLabel('Análise da conversa').selectOption('');await expect(page.getByLabel('Fonte do novo dashboard')).toBeVisible();
  await page.getByRole('heading',{name:'O que vamos descobrir hoje?'}).click();
  for(const [width,height] of [[1440,1000],[900,1000],[390,844]]){
   await page.setViewportSize({width,height});
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   expect(await page.locator('.home-page').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
   const controls=page.locator('.home-composer-tools select,.home-send');
   expect(await controls.evaluateAll(items=>items.every(el=>el.getBoundingClientRect().height>=44))).toBe(true);
   const audit=await new AxeBuilder({page}).include('.home-page').withTags(['wcag2a','wcag2aa']).analyze();expect(audit.violations).toEqual([]);
   await page.screenshot({path:join(tmpdir(),`clara-inicio-impeccable-${width}.png`),animations:'disabled'});
  }
  await page.setViewportSize({width:1440,height:1000});await message.fill('Troque o gráfico por barras horizontais.');await message.press('Enter');await expect(page.getByRole('button',{name:'Aplicar ajuste',exact:true})).toBeVisible();await page.getByRole('button',{name:'Aplicar ajuste',exact:true}).click();await expect(page.locator('.home-page')).toHaveCount(0);
  expect(errors).toEqual([]);
 }finally{await pilot.close()}
});
