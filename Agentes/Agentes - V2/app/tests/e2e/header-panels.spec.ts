import {test,expect} from '@playwright/test';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {pilotHarness} from '../pilot-harness.mjs';

test('Header: painéis ancorados, pesquisa, fechamento e tamanho móvel',async({page},info)=>{
 const pilot=await pilotHarness(),errors:string[]=[];
 page.on('pageerror',e=>errors.push(e.message));
 // The app has no favicon.ico; the browser's automatic probe is unrelated to these controls.
 page.on('console',m=>{if(m.type()==='error'&&!m.location().url.endsWith('/favicon.ico'))errors.push(m.text())});
 try{
  const registration=await page.request.post(`${pilot.url}/api/auth/register`,{headers:{origin:pilot.url},data:{mode:'local',name:'Teste Header',email:`header-${Date.now()}@example.test`,password:'Teste-header-2026!'}});
  expect(registration.ok()).toBeTruthy();await page.goto(pilot.url);
  await page.getByRole('button',{name:'Pular apresentação',exact:true}).click();
  await expect(page.getByRole('heading',{name:'O que vamos descobrir hoje?'})).toBeVisible();
  await expect(page.locator('.global-header')).not.toContainText('Persistente');
  const workspace=page.locator('#header-workspace'),search=page.locator('#header-search');
  await workspace.click();let panel=page.getByRole('dialog',{name:'Escolher espaço',exact:true});await expect(panel).toBeVisible();
  const anchor=await workspace.boundingBox(),box=await panel.boundingBox();
  expect(Math.abs(box!.x-anchor!.x)).toBeLessThan(2);expect(box!.y).toBeGreaterThan(anchor!.y+anchor!.height);expect(box!.y).toBeLessThan(90);
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await workspace.click();await expect(panel).toHaveCount(0);
  await expect(page.locator('#header-help')).toHaveCount(0);

  await search.click();panel=page.getByRole('dialog',{name:'Buscar na CLARA',exact:true});await expect(panel).toBeVisible();await expect(page.getByLabel('Buscar área ou análise')).toBeFocused();
  const searchAnchor=await search.boundingBox(),searchBox=await panel.boundingBox();expect(Math.abs(searchBox!.x-searchAnchor!.x)).toBeLessThan(2);expect(searchBox!.y).toBeLessThan(90);expect(Math.abs(searchBox!.width-searchAnchor!.width)).toBeLessThan(2);
  await page.screenshot({path:info.outputPath('search-aligned-1440.png'),animations:'disabled'});
  await page.getByLabel('Buscar área ou análise').press('ArrowDown');await expect(panel.getByRole('button',{name:'Início',exact:true})).toBeFocused();await page.keyboard.press('ArrowUp');await expect(page.getByLabel('Buscar área ou análise')).toBeFocused();
  await page.getByLabel('Buscar área ou análise').fill('Desempenho financeiro');await page.screenshot({path:join(tmpdir(),'clara-header-pesquisa.png')});await panel.getByRole('button',{name:'Desempenho financeiro Dashboard',exact:true}).click();await expect(panel).toHaveCount(0);await expect(page.getByRole('heading',{name:'Desempenho financeiro',exact:true})).toBeVisible();
  await page.locator('#header-notifications').click();await expect(page.getByRole('dialog',{name:'Atualizações do workspace'})).toBeVisible();await page.getByRole('heading',{name:'Desempenho financeiro',exact:true}).click();await expect(page.locator('.header-panel')).toHaveCount(0);
  await page.setViewportSize({width:390,height:844});await page.keyboard.press('Control+k');panel=page.getByRole('dialog',{name:'Buscar na CLARA',exact:true});await expect(panel).toBeVisible();const mobile=await panel.boundingBox();expect(mobile!.x).toBeGreaterThanOrEqual(12);expect(mobile!.x+mobile!.width).toBeLessThanOrEqual(378);expect(mobile!.y).toBeLessThan(90);await page.screenshot({path:join(tmpdir(),'clara-header-mobile.png')});await page.keyboard.press('Escape');await expect(panel).toHaveCount(0);
  expect(errors).toEqual([]);
 }finally{await pilot.close()}
});
