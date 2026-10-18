import {test,expect} from '@playwright/test';
import {pilotHarness} from '../pilot-harness.mjs';
test.use({actionTimeout:20000});
test('Piloto: HTTP, Bedrock, exportação e reabertura após reinício',async({page},testInfo)=>{
 test.setTimeout(150000);const pilot=await pilotHarness();const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(pilot.url);await expect(page.getByRole('button',{name:'Começar demonstração',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Criar conta local',exact:true}).click();
  await page.getByLabel('Nome',{exact:true}).fill('Analista Piloto');await page.getByLabel('E-mail',{exact:true}).fill(`pilot-${Date.now()}@example.test`);await page.getByLabel('Senha',{exact:true}).fill('Teste-local-2026!');await page.getByRole('button',{name:'Criar conta',exact:true}).click();
  await page.getByRole('button',{name:'Pular apresentação',exact:true}).click();await expect(page.getByRole('heading',{name:'O que vamos descobrir hoje?'})).toBeVisible();await page.getByRole('button',{name:'Abrir Desempenho financeiro',exact:true}).click();await expect(page.getByRole('heading',{name:'Desempenho financeiro',exact:true})).toBeVisible();await expect(page.getByText('Serviço financeiro de teste',{exact:true}).first()).toBeVisible();
  await page.getByLabel('Mensagem para CLARA').fill('Mostre apenas Filial Sul em setembro de 2025.');await page.getByRole('button',{name:'Enviar mensagem',exact:true}).click();await page.getByRole('button',{name:'Aplicar ajuste',exact:true}).click();
  await page.getByRole('button',{name:'Ajustar filtros',exact:true}).click();await expect(page.getByLabel('Empresa',{exact:true})).toHaveValue('Filial Sul');await expect(page.getByLabel('Data inicial')).toHaveValue('2025-09-01');await expect(page.getByLabel('Data final')).toHaveValue('2025-09-30');
  await page.getByLabel('Mensagem para CLARA').fill('Troque o gráfico por barras horizontais.');await page.getByRole('button',{name:'Enviar mensagem',exact:true}).click();await page.getByRole('button',{name:'Aplicar ajuste',exact:true}).click();
  await page.getByRole('button',{name:'Salvar',exact:true}).click();await page.getByLabel('Nome do dashboard',{exact:true}).last().fill('Piloto persistente');await page.getByRole('button',{name:'Salvar dashboard',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button',{name:'Mais opções do dashboard'}).click();const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Exportar CSV',exact:true}).click();const download=await downloadPromise;await download.saveAs(testInfo.outputPath('financeiro.csv'));
  const csv=await (await import('node:fs/promises')).readFile(testInfo.outputPath('financeiro.csv'),'utf8');expect(csv).toContain('Serviço financeiro de teste');expect(csv).toContain('2025-09-01 a 2025-09-30');expect(csv).toContain('Pesquisa');
  await expect(page.getByRole('button',{name:'Planejamento',exact:true})).toHaveCount(0);
  await page.screenshot({path:testInfo.outputPath('dashboard.png'),fullPage:true});
  await pilot.restart();await page.reload();await expect(page.getByRole('heading',{name:'O que vamos descobrir hoje?'})).toBeVisible();await page.getByRole('button',{name:'Abrir Piloto persistente',exact:true}).click();await expect(page.getByRole('heading',{name:'Piloto persistente',exact:true})).toBeVisible();await page.getByRole('button',{name:'Ajustar filtros',exact:true}).click();await expect(page.getByLabel('Data inicial')).toHaveValue('2025-09-01');
  await page.getByRole('button',{name:'Dados',exact:true}).click();await page.getByText('Estado dos serviços',{exact:true}).click();await expect(page.getByText('AWS Bedrock: Verificado',{exact:false})).toBeVisible();
  await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
  await testInfo.attach('tipo-validacao',{body:Buffer.from(pilot.live?'AWS Bedrock real':'Bedrock HTTP controlado; fonte HTTP real; SQLite persistente'),contentType:'text/plain'});
 }finally{await pilot.close();}
});
