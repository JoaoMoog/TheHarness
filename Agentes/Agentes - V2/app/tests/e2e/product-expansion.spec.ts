import {test,expect} from '@playwright/test';
import {pilotHarness} from '../pilot-harness.mjs';

test('CLARA: marca, calendário, edição individual, dados livres, slides, unificação e administração',async({page},info)=>{
 test.setTimeout(150000);const pilot=await pilotHarness(),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.addInitScript(()=>{if(window===window.top)localStorage.setItem('clara:appearance:v1',JSON.stringify({mode:'light',preset:'tangerine'}))});
  expect((await page.request.post(`${pilot.url}/api/auth/register`,{headers:{origin:pilot.url},data:{mode:'local',name:'Produto CLARA',email:`product-${Date.now()}@example.test`,password:'Teste-product-2026!'}})).ok()).toBeTruthy();
  await page.goto(pilot.url);await page.getByRole('button',{name:'Pular apresentação',exact:true}).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme-preset','slate');await expect(page.getByLabel('Paleta da interface')).toHaveCount(0);
  await expect(page.locator('.global-header .btg-light')).toBeVisible();
  await page.getByRole('button',{name:'Abrir Desempenho financeiro',exact:true}).click();
  if(await page.getByRole('button',{name:'Recolher CLARA IA',exact:true}).isVisible())await page.getByRole('button',{name:'Recolher CLARA IA',exact:true}).click();
  await expect(page.locator('.widget-loading')).toHaveCount(0);await expect(page.locator('.widget-error')).toHaveCount(0);
  const padding=await page.locator('.dashboard-conclusion').evaluate(el=>el.querySelector('h2')!.getBoundingClientRect().left-el.getBoundingClientRect().left);expect(padding).toBeGreaterThanOrEqual(16);
  await page.getByRole('button',{name:'Ajustar filtros',exact:true}).click();
  await page.getByRole('button',{name:'Abrir calendário: Data inicial',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'Calendário: Data inicial'})).toBeVisible();await page.screenshot({path:info.outputPath('calendar.png')});await page.keyboard.press('ArrowRight');await page.keyboard.press('Escape');
  await page.getByLabel('Data inicial',{exact:true}).fill('01/01/2026');await page.getByLabel('Data final',{exact:true}).fill('31/12/2026');await page.getByRole('button',{name:'Aplicar datas',exact:true}).click();await expect(page.locator('.analysis-scope')).toContainText('2026');
  await page.getByRole('button',{name:'Fechar filtros',exact:true}).click();
  await page.getByRole('button',{name:'Editar',exact:true}).click();await page.locator('[data-widget="trend"] .widget-visual').click();await expect(page.getByLabel('Gráfico selecionado')).toHaveValue('trend');
  await page.getByLabel('Título do gráfico',{exact:true}).fill('Evolução revisada');await page.getByLabel('Tipo de visualização',{exact:true}).selectOption('bar');await page.getByLabel('Agregação',{exact:true}).selectOption('average');
  await expect(page.locator('[data-widget="comparison"] h2')).toHaveText('Realizado x orçamento');await expect(page.locator('[data-widget="trend"] h2')).toHaveText('Evolução revisada');
  await expect.poll(()=>page.locator('.metric').evaluateAll(els=>els.every(el=>{const value=el.querySelector('strong')!;return value.scrollWidth<=el.clientWidth-30}))).toBe(true);await expect(page.locator('.widget-loading')).toHaveCount(0);await page.screenshot({path:info.outputPath('chart-editor.png'),animations:'disabled'});await page.getByRole('button',{name:'Concluir edição',exact:true}).click();await page.getByRole('button',{name:'Salvar',exact:true}).click();await page.getByRole('button',{name:'Salvar dashboard',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
  for(const [width,mode] of [[1440,'light'],[390,'light'],[1440,'dark'],[390,'dark']] as const){
   await page.setViewportSize({width,height:width===390?844:1000});
   if((await page.locator('html').getAttribute('class')||'').includes('dark')!==(mode==='dark'))await page.getByRole('button',{name:mode==='dark'?'Usar tema escuro':'Usar tema claro',exact:true}).click();
   await page.locator('#main').evaluate(el=>el.scrollTop=0);expect(await page.locator('#main').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
   await page.screenshot({path:info.outputPath(`dashboard-${mode}-${width}.png`),animations:'disabled'});
  }
  await page.setViewportSize({width:1440,height:1000});
  await page.locator('.sidebar nav').getByRole('button',{name:'Dados',exact:true}).click();
  await page.getByLabel('Selecionar planilha').setInputFiles({name:'Capacidade.csv',mimeType:'text/csv',buffer:Buffer.from('Equipe;Entregas;Pessoas;Data;Status;Código\nSul;120;4;2026-01-01;Ativo;001\nNorte;80;2;2026-02-01;Ativo;002')});
  await expect(page.getByRole('dialog')).toContainText('Todas as colunas serão preservadas');await page.getByRole('button',{name:'Importar dados',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.locator('.data-source-list article').filter({hasText:'Capacidade'}).getByRole('button',{name:'Criar análise'}).click();await expect(page.locator('.canvas-widget')).toHaveCount(2);await expect(page.locator('.widget-loading')).toHaveCount(0);await expect(page.locator('.widget-error')).toHaveCount(0);await expect(page.locator('.metric-strip')).toHaveCount(0);
  await page.getByRole('button',{name:'Salvar',exact:true}).click();await page.getByRole('button',{name:'Salvar dashboard',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button',{name:'Mais opções do dashboard'}).click();await page.getByRole('button',{name:'Criar apresentação HTML',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Criar apresentação HTML',exact:true}).click();
  const deck=page.frameLocator('iframe[title="Prévia da apresentação executiva"]');await expect(deck.getByRole('heading',{name:'Capacidade',exact:true})).toBeVisible();await deck.getByRole('button',{name:'Próximo',exact:true}).click();await expect(deck.getByRole('heading',{name:'Os números em perspectiva',exact:true})).toBeVisible();await expect(deck.locator('.summary-grid')).toContainText('200');
  await page.screenshot({path:info.outputPath('executive-slides.png')});const download=page.waitForEvent('download');await page.getByRole('link',{name:'Baixar apresentação HTML'}).click();await (await download).saveAs(info.outputPath('apresentacao.html'));await page.getByRole('button',{name:'Fechar janela',exact:true}).click();
  await page.getByRole('button',{name:'Mais opções do dashboard'}).click();await page.getByRole('button',{name:'Unificar dashboards',exact:true}).click();await page.getByRole('checkbox',{name:'Desempenho financeiro',exact:true}).check();await page.getByRole('dialog').getByRole('button',{name:'Unificar dashboards',exact:true}).click();await expect(page.locator('.canvas-widget')).toHaveCount(4);await expect(page.locator('.analysis-scope')).toContainText('2 dashboards unificados');await expect(page.locator('.widget-loading')).toHaveCount(0);await expect(page.locator('.widget-error')).toHaveCount(0);
  await page.getByRole('button',{name:'Salvar',exact:true}).click();await page.getByRole('button',{name:'Salvar dashboard',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.locator('.sidebar nav').getByRole('button',{name:'Administração',exact:true}).click();await expect(page.getByText('Estado da operação',{exact:true})).toHaveCount(0);
  await page.locator('.governance-entry summary').filter({hasText:'Criar um espaço'}).click();await page.getByLabel('Nome do espaço',{exact:true}).fill('Equipe de produto');await page.getByRole('button',{name:'Criar espaço',exact:true}).click();await expect(page.getByRole('heading',{name:'Administração',exact:true})).toBeVisible();await expect(page.locator('.governance-context')).toContainText('Equipe de produto');
  await page.getByRole('combobox',{name:'Espaço atual',exact:true}).click();await page.getByRole('option',{name:'Meu espaço',exact:true}).click();await expect(page.getByRole('heading',{name:'Administração',exact:true})).toBeVisible();
  for(const width of [1440,390]){await page.setViewportSize({width,height:width===390?844:1000});expect(await page.locator('#main').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);await page.screenshot({path:info.outputPath(`admin-${width}.png`),animations:'disabled'});}
  expect(errors).toEqual([]);
 }finally{await pilot.close()}
});

test('onboarding percorre funcionalidades com balões e permite voltar e encerrar',async({page},info)=>{
 test.setTimeout(90000);const pilot=await pilotHarness();
 try{await page.request.post(`${pilot.url}/api/auth/register`,{headers:{origin:pilot.url},data:{mode:'local',name:'Onboarding',email:`tour-${Date.now()}@example.test`,password:'Teste-onboarding-2026!'}});await page.goto(pilot.url);await expect(page.locator('.tour-bubble')).toBeVisible();await page.screenshot({path:info.outputPath('onboarding-desktop.png')});for(let i=1;i<12;i++){await page.getByRole('button',{name:'Continuar',exact:true}).click();await expect(page.locator('.tour-bubble header')).toContainText(`${i+1} de 12`);}await page.setViewportSize({width:390,height:844});await page.screenshot({path:info.outputPath('onboarding-mobile.png'),animations:'disabled'});const box=await page.locator('.tour-bubble').boundingBox();expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(390);await page.getByRole('button',{name:'Passo anterior',exact:true}).click();await expect(page.locator('.tour-bubble header')).toContainText('11 de 12');await page.getByRole('button',{name:'Continuar',exact:true}).click();await page.getByRole('button',{name:'Concluir',exact:true}).click();await expect(page.locator('.guided-tour')).toHaveCount(0);await page.reload();await expect(page.locator('.guided-tour')).toHaveCount(0);}finally{await pilot.close()}
});
