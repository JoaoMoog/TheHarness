import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {pilotHarness} from '../pilot-harness.mjs';

test('Slate: todas as telas, quatro aparências e quatro larguras',async({page},info)=>{
 test.setTimeout(360000);
 const pilot=await pilotHarness(),errors:string[]=[],issues:unknown[]=[];
 page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.goto(pilot.url);
  await expect(page.locator('.studio-login')).toBeVisible();
  await page.screenshot({path:info.outputPath('login.png')});
  expect((await page.request.post(`${pilot.url}/api/auth/register`,{headers:{origin:pilot.url},data:{mode:'local',name:'Revisão Slate',email:`slate-${Date.now()}@example.test`,password:'Teste-Slate-2026!'}})).ok()).toBeTruthy();
  await page.reload();await page.getByRole('button',{name:'Pular apresentação',exact:true}).click();
  for(const preset of ['slate','tangerine'])for(const mode of ['light','dark']){
   await page.setViewportSize({width:1440,height:1000});
   await page.getByLabel('Paleta da interface').selectOption(preset);
   if((await page.locator('html').getAttribute('class')||'').includes('dark')!==(mode==='dark'))await page.getByRole('button',{name:mode==='dark'?'Usar tema escuro':'Usar tema claro',exact:true}).click();
   for(const [index,label] of ['Início','Dashboards','Explorar dados','Dados','Administração','Dashboard'].entries()){
    await page.setViewportSize({width:1440,height:1000});
    if(label==='Dashboard'){
     await page.locator('.sidebar nav').getByRole('button',{name:'Início',exact:true}).click();
     await page.getByRole('button',{name:'Abrir Desempenho financeiro',exact:true}).click();
    }else await page.locator('.sidebar nav').getByRole('button',{name:label,exact:true}).click();
    await expect(page.locator('#main h1')).toBeVisible();
    if(label==='Explorar dados')await expect(page.locator('.records-scroll tbody tr').first()).toBeVisible();
    if(['Explorar dados'].includes(label))await expect(page.locator('.financial-filter-disclosure>summary')).toBeVisible();
    if(await page.getByRole('button',{name:'Recolher CLARA IA',exact:true}).isVisible())await page.getByRole('button',{name:'Recolher CLARA IA',exact:true}).click();
    for(const width of [1440,1024,768,390]){
     await page.setViewportSize({width,height:width===390?844:1000});
     await page.locator('#main').evaluate(el=>el.scrollTop=0);
     if(['Explorar dados'].includes(label))await expect(page.locator('.financial-filter-disclosure>summary')).toBeInViewport();
     const overflow=await page.locator('#main').evaluate(el=>el.scrollWidth>el.clientWidth+1);
     if(overflow)issues.push({preset,mode,label,width,overflow});
     if(width===1440||width===390){
      await page.screenshot({path:info.outputPath(`${preset}-${mode}-${index}-${width}.png`),animations:'disabled'});
      const audit=new AxeBuilder({page}).include('#main').include('.global-header').withTags(['wcag2a','wcag2aa']);
      if(width===1440)audit.include('.sidebar');
      const result=await audit.analyze();
      for(const v of result.violations)issues.push({preset,mode,label,width,id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))});
     }
    }
   }
   await page.setViewportSize({width:1440,height:1000});
   await page.locator('.sidebar nav').getByRole('button',{name:'Dados',exact:true}).click();
   for(let repeat=0;repeat<2;repeat++){
    await page.getByRole('button',{name:/SAP Use os dados/}).click();
    const dialog=page.getByRole('dialog',{name:'Conexão SAP',exact:true});await expect(dialog).toBeVisible();
    expect((await new AxeBuilder({page}).include('dialog').withTags(['wcag2a','wcag2aa']).analyze()).violations).toEqual([]);
    if(!repeat)await page.screenshot({path:info.outputPath(`${preset}-${mode}-dialog.png`)});
    await dialog.getByRole('button',{name:'Concluir',exact:true}).click();await expect(dialog).toHaveCount(0);
   }
  }
  await page.setViewportSize({width:768,height:900});
  await page.getByRole('button',{name:'Abrir navegação',exact:true}).click();await expect(page.locator('.app-shell')).toHaveClass(/nav-expanded/);
  await page.locator('.sidebar nav').getByRole('button',{name:'Início',exact:true}).click();await expect(page.locator('#main h1')).toHaveText('O que vamos descobrir hoje?');
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:'Abrir navegação',exact:true}).click();await page.locator('.sidebar nav').getByRole('button',{name:'Dados',exact:true}).click();await expect(page.locator('#main h1')).toHaveText('Dados');
  await page.getByLabel('Selecionar planilha').setInputFiles({name:'revisao-slate.csv',mimeType:'text/csv',buffer:Buffer.from('Empresa,Centro de custo,Data,Realizado,Orçamento\nMatriz,Tecnologia,2025-01-01,1200,1500\n')});
  await expect(page.getByRole('dialog',{name:'Confira sua planilha'})).toBeVisible();
  expect((await new AxeBuilder({page}).include('dialog').withTags(['wcag2a','wcag2aa']).analyze()).violations).toEqual([]);
  await page.screenshot({path:info.outputPath('import-mobile.png')});await page.getByRole('button',{name:'Cancelar',exact:true}).click();
  await page.setViewportSize({width:1440,height:1000});await page.reload();
  await expect(page.locator('html')).toHaveClass(/dark/);await expect(page.getByLabel('Paleta da interface')).toHaveValue('tangerine');
  for(let repeat=0;repeat<2;repeat++){
   await page.keyboard.press('Control+k');await expect(page.locator('#header-search')).toHaveAttribute('aria-expanded','true');await page.keyboard.press('Escape');
   await page.getByRole('button',{name:'Seu perfil',exact:true}).click();await expect(page.locator('.profile-popover')).toBeVisible();await page.keyboard.press('Escape');
  }
  await info.attach('review-issues',{body:JSON.stringify(issues,null,2),contentType:'application/json'});
  expect(issues).toEqual([]);expect(errors).toEqual([]);
 }finally{await pilot.close()}
});

test('Slate: acesso legível em celular e desktop nos quatro temas',async({page},info)=>{
 const pilot=await pilotHarness();
 try{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto(pilot.url);await expect(page.locator('.studio-login')).toBeVisible();
  for(const preset of ['slate','tangerine'])for(const mode of ['light','dark']){
   await page.getByLabel('Paleta da interface').selectOption(preset);
   if((await page.locator('html').getAttribute('class')||'').includes('dark')!==(mode==='dark'))await page.getByRole('button',{name:mode==='dark'?'Usar tema escuro':'Usar tema claro',exact:true}).click();
   for(const width of [1440,390]){
    await page.setViewportSize({width,height:width===390?844:1000});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa']).analyze()).violations).toEqual([]);
    await page.screenshot({path:info.outputPath(`${preset}-${mode}-${width}.png`),fullPage:true});
   }
  }
 }finally{await pilot.close()}
});
