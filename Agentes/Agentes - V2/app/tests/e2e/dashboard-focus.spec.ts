import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {pilotHarness} from '../pilot-harness.mjs';

test('dashboard: hierarquia compacta, ações acessíveis e módulos futuros fora da navegação',async({page},info)=>{
 test.setTimeout(120000);
 const pilot=await pilotHarness(),errors:string[]=[];
 page.on('pageerror',error=>errors.push(error.message));
 try{
  expect((await page.request.post(`${pilot.url}/api/auth/register`,{headers:{origin:pilot.url},data:{mode:'local',name:'Dashboard',email:`focus-${Date.now()}@example.test`,password:'Teste-focus-2026!'}})).ok()).toBeTruthy();
  await page.goto(pilot.url);
  await page.getByRole('button',{name:'Pular apresentação',exact:true}).click();
  await expect(page.locator('.sidebar nav button')).toHaveCount(5);
  await page.getByRole('button',{name:/Buscar análises/}).click();
  await expect(page.getByRole('button',{name:'Planejamento',exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Previsões e cenários',exact:true})).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Abrir Desempenho financeiro',exact:true}).click();
  if(await page.getByRole('button',{name:'Recolher CLARA IA',exact:true}).isVisible())await page.getByRole('button',{name:'Recolher CLARA IA',exact:true}).click();
  await expect(page.locator('.dashboard-save-status')).toContainText('Salvo');
  await expect(page.locator('.workspace-tabs')).toHaveCount(0);
  await expect(page.locator('.conclusion-detail')).not.toHaveAttribute('open','');
  await page.getByText('Ver análise',{exact:true}).click();
  await expect(page.locator('.conclusion-detail p')).toBeVisible();
  await page.getByText('Ver análise',{exact:true}).click();

  const more=page.getByRole('button',{name:'Mais opções do dashboard'});
  await more.focus();await page.keyboard.press('Enter');
  await expect(page.getByRole('button',{name:'Compartilhar',exact:true})).toBeFocused();
  await page.keyboard.press('End');await expect(page.getByRole('button',{name:'Histórico de versões',exact:true})).toBeFocused();
  await page.keyboard.press('Escape');await expect(more).toBeFocused();
  await more.click();await page.getByRole('button',{name:'Histórico de versões',exact:true}).click();
  await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Escape');
  await expect(more).toBeFocused();
  await more.click();const download=page.waitForEvent('download');await page.getByRole('button',{name:'Exportar CSV',exact:true}).click();expect((await download).suggestedFilename()).toBe('clara-financeiro.csv');

  for(const mode of ['light','dark']){
   await page.setViewportSize({width:1440,height:1000});
   if((await page.locator('html').getAttribute('class')||'').includes('dark')!==(mode==='dark'))await page.getByRole('button',{name:mode==='dark'?'Usar tema escuro':'Usar tema claro',exact:true}).click();
   for(const width of [1440,1024,768,390,320]){
    await page.setViewportSize({width,height:width<600?844:1000});await page.locator('#main').evaluate(el=>el.scrollTop=0);
    await expect(page.locator('.dashboard-header')).toBeInViewport();
    expect(await page.locator('#main').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
    await more.click();
    const bounds=await page.locator('#dashboard-actions').boundingBox();expect(bounds!.x).toBeGreaterThanOrEqual(0);expect(bounds!.x+bounds!.width).toBeLessThanOrEqual(width);
    await page.keyboard.press('Escape');
    if(width===1440||width===390){
     expect((await new AxeBuilder({page}).include('.decision-dashboard').withTags(['wcag2a','wcag2aa']).analyze()).violations).toEqual([]);
     await page.screenshot({path:info.outputPath(`dashboard-${mode}-${width}.png`),animations:'disabled'});
    }
   }
  }
  expect(errors).toEqual([]);
 }finally{await pilot.close()}
});
