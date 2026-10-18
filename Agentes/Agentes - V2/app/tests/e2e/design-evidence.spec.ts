import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {pilotHarness} from '../pilot-harness.mjs';

test('evidências, investigação, comparação de proposta e densidade',async({page},info)=>{
 test.setTimeout(120000);
 const pilot=await pilotHarness(),errors:string[]=[];
 page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.addInitScript(()=>localStorage.setItem('clara:ui-density:v1','compact'));
  const headers={origin:pilot.url};
  expect((await page.request.post(`${pilot.url}/api/auth/register`,{headers,data:{mode:'local',name:'Evidências CLARA',email:`evidence-${Date.now()}@example.test`,password:'Teste-evidence-2026!'}})).ok()).toBeTruthy();
  await page.goto(pilot.url);await page.getByRole('button',{name:'Pular apresentação',exact:true}).click();await page.getByRole('button',{name:'Abrir Desempenho financeiro',exact:true}).click();
  await expect(page.getByRole('region',{name:'Conclusão do recorte'})).toBeVisible();
  if(await page.getByRole('button',{name:'Recolher CLARA IA',exact:true}).isVisible())await page.getByRole('button',{name:'Recolher CLARA IA',exact:true}).click();
  await expect(page.locator('.save-state')).toContainText('Salvo');
  await expect(page.getByLabel('Densidade da interface')).toHaveCount(0);await expect(page.locator('.app-shell')).toHaveAttribute('data-density','comfortable');
  await expect(page.locator('.save-state')).toContainText('Salvo');
  await page.screenshot({path:info.outputPath('comfortable-1440.png'),animations:'disabled'});
  await page.reload();await expect(page.locator('.app-shell')).toHaveAttribute('data-density','comfortable');
  await page.getByRole('button',{name:'Abrir Desempenho financeiro',exact:true}).click();
  if(await page.getByRole('button',{name:'Recolher CLARA IA',exact:true}).isVisible())await page.getByRole('button',{name:'Recolher CLARA IA',exact:true}).click();
  await page.getByRole('button',{name:'Investigar',exact:false}).click();
  await expect(page.getByRole('button',{name:'Voltar a todos os centros',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Ajustar filtros',exact:true}).click();
  const selected=await page.getByLabel('Centro de custo',{exact:true}).inputValue();expect(selected).not.toBe('all');
  await page.getByRole('button',{name:'Fechar filtros',exact:true}).click();
  await page.getByRole('button',{name:'Conferir cálculo de Execução orçamentária',exact:true}).click();
  await expect(page.getByRole('region',{name:'Como este resultado é calculado'})).toContainText(selected);
  await expect(page.locator('.evidence-formula')).toContainText('÷');
  await expect(page.getByRole('region',{name:'Amostra dos registros incluídos'})).toContainText('O cálculo usa todos os registros do recorte.');
  await expect(page.getByRole('heading',{name:'Como este resultado é calculado',exact:true})).toBeFocused();
  for(const [width,height] of [[1440,1000],[390,844]]){
   await page.setViewportSize({width,height});
   await page.locator('#evidence-title').evaluate(el=>el.scrollIntoView({block:'start'}));
   await expect(page.getByRole('heading',{name:'Como este resultado é calculado',exact:true})).toBeInViewport();
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   expect((await new AxeBuilder({page}).include('.evidence-panel').include('.evidence-trail').withTags(['wcag2a','wcag2aa']).analyze()).violations).toEqual([]);
   await page.screenshot({path:info.outputPath(`evidence-${width}.png`),animations:'disabled'});
  }
  await page.getByRole('button',{name:'Fechar evidências',exact:true}).click();
  await expect(page.getByRole('button',{name:'Conferir cálculo de Execução orçamentária',exact:true})).toBeFocused();
  await page.locator('.dashboard-evidence>summary').click();
  await page.getByRole('group',{name:'Trilha de evidências'}).getByRole('button',{name:'Fonte',exact:true}).click();
  await expect(page.locator('.evidence-panel')).toContainText('Dados sintéticos para demonstração');await page.getByRole('button',{name:'Fechar evidências',exact:true}).click();
  await page.getByRole('group',{name:'Trilha de evidências'}).getByRole('button',{name:'Atualização',exact:true}).click();
  await expect(page.locator('.evidence-panel')).toContainText('Dashboard editado em');await page.getByRole('button',{name:'Fechar evidências',exact:true}).click();
  await page.getByRole('button',{name:'Voltar a todos os centros',exact:true}).click();
  for(const [width,height] of [[1440,1000],[390,844],[320,740]]){
   await page.setViewportSize({width,height});await page.locator('#main').evaluate(el=>el.scrollTop=0);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   expect((await new AxeBuilder({page}).include('.decision-dashboard').withTags(['wcag2a','wcag2aa']).analyze()).violations).toEqual([]);
   await page.screenshot({path:info.outputPath(`dashboard-${width}.png`),animations:'disabled'});
  }
  await page.setViewportSize({width:1440,height:1000});
  await page.getByText('Ver valores mensais',{exact:true}).click();await expect(page.getByRole('region',{name:'Valores de Evolução das despesas',exact:true})).toContainText('2025-01');
  await page.getByRole('button',{name:'CLARA IA',exact:true}).first().click();
  await page.getByLabel('Mensagem para CLARA').fill('Troque o gráfico por barras horizontais.');await page.getByRole('button',{name:'Enviar mensagem',exact:true}).click();
  const review=page.getByRole('region',{name:'Conferir proposta'});await expect(review).toContainText('Colunas agrupadas');await expect(review).toContainText('Barras horizontais');
  await expect(review.getByRole('rowheader',{name:'Período',exact:true})).toHaveCount(0);
  for(const [width,height] of [[1440,1000],[390,844]]){
   await page.setViewportSize({width,height});
   await review.scrollIntoViewIfNeeded();
   expect((await new AxeBuilder({page}).include('.proposal-review').withTags(['wcag2a','wcag2aa']).analyze()).violations).toEqual([]);
   await page.screenshot({path:info.outputPath(`proposal-${width}.png`),animations:'disabled'});
  }
  await page.getByRole('button',{name:'Aplicar ajuste',exact:true}).click();
  await page.getByRole('button',{name:'Recolher CLARA IA',exact:true}).click();await expect(page.locator('.save-state')).toContainText('Alterações não salvas');
  await page.getByRole('button',{name:'Mais opções do dashboard'}).click();await page.getByRole('button',{name:'Desfazer último ajuste',exact:true}).click();await expect(page.locator('.save-state')).toContainText('Salvo');
  expect(errors).toEqual([]);
 }finally{await pilot.close()}
});
