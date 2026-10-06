import { test, expect } from '@playwright/test';
const pages=['ciclo-passo-a-passo.html','ciclos-de-desenvolvimento.html','custo-do-copilot.html'];
for (const url of pages) {
  test(url+' loads, controls, keyboard, boundaries, playback and anchors',async({page})=>{
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
    await page.clock.install();
    await page.goto('/'+url);
    await expect(page.getByRole('heading',{level:1})).toBeVisible();
    const status=page.getByRole('status'),prev=page.getByRole('button',{name:'← Anterior'}),next=page.getByRole('button',{name:'Próxima →'});
    await expect(status).toHaveText('Cena 1 de 6');await expect(prev).toBeDisabled();
    await next.click();await expect(status).toHaveText('Cena 2 de 6');
    await page.keyboard.press('ArrowRight');await expect(status).toHaveText('Cena 3 de 6');
    await page.keyboard.press('ArrowLeft');await expect(status).toHaveText('Cena 2 de 6');
    await page.locator('h1').click();await page.keyboard.press('End');await expect(status).toHaveText('Cena 6 de 6');await expect(next).toBeDisabled();
    await page.keyboard.press('ArrowRight');await expect(status).toHaveText('Cena 6 de 6');
    await page.keyboard.press('Home');await page.keyboard.press('ArrowLeft');await expect(status).toHaveText('Cena 1 de 6');
    await page.getByRole('button',{name:'Reproduzir',exact:true}).click();
    await page.clock.fastForward(12000);await expect(status).toHaveText('Cena 2 de 6');
    await page.getByRole('button',{name:'Pausar',exact:true}).click();
    await page.clock.fastForward(24000);await expect(status).toHaveText('Cena 2 de 6');
    await page.locator('h1').click();await page.keyboard.press('End');
    await page.locator('.scene:visible a[href="#c1"]').click();
    await expect(status).toHaveText('Cena 1 de 6');
    await page.getByRole('button',{name:'06 ·'}).click();await expect(status).toHaveText('Cena 6 de 6');
    await page.getByRole('button',{name:'Reproduzir',exact:true}).click();await expect(status).toHaveText('Cena 1 de 6');
    for(let i=0;i<5;i++)await page.clock.fastForward(12000);
    await expect(status).toHaveText('Cena 6 de 6');await expect(page.getByRole('button',{name:'Reproduzir',exact:true})).toBeVisible();
    await page.clock.fastForward(24000);await expect(status).toHaveText('Cena 6 de 6');
    const allText=await page.locator('main').textContent();
    expect(allText).not.toMatch(/\bdeliver\b|azure-devops|\/deliver/);
    expect(allText).toMatch(/manual/i);
    for (const href of await page.locator('a[href$=".html"]').evaluateAll(links=>links.map(a=>a.getAttribute('href'))))
      expect((await page.request.get('/'+href)).ok()).toBeTruthy();
    expect(errors).toEqual([]);
  });
  test(url+' navigation, deep links and small viewport',async({page})=>{
    await page.setViewportSize({width:390,height:844});
    await page.goto('/'+url+'#c4');await expect(page.getByRole('status')).toHaveText('Cena 4 de 6');
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
    expect(overflow).toBe(false);
    await page.getByRole('navigation',{name:'Guias'}).getByRole('link',{name:'Custos'}).click();
    await expect(page).toHaveURL(/custo-do-copilot.html$/);
    await expect(page.getByRole('heading',{level:1})).toHaveText('Menos contexto. Mais evidência.');
  });
}
