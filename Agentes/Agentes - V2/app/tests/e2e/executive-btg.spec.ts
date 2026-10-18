import {test,expect} from '@playwright/test';
import {pilotHarness} from '../pilot-harness.mjs';
import {writeFileSync} from 'node:fs';

test('apresentação BTG: slides legíveis, navegação, apêndice e impressão',async({page,browser},info)=>{
 test.setTimeout(90000);const pilot=await pilotHarness();
 try{
  await page.request.post(pilot.url+'/api/auth/register',{headers:{origin:pilot.url},data:{mode:'local',name:'Executivo',email:crypto.randomUUID()+'@example.test',password:'Apresentacao-2026!'}});
  const boot=await(await page.request.get(pilot.url+'/api/v1/studio/bootstrap')).json();
  const response=await page.request.post(pilot.url+'/api/v1/studio/presentations',{headers:{origin:pilot.url,'x-clara-workspace':boot.workspace.id},data:{title:'Resultados e prioridades',boardIds:[boot.state.boards[0].id]}});
  expect(response.ok()).toBe(true);const deck=await response.json();writeFileSync(info.outputPath('apresentacao-btg.html'),deck.html);
  const preview=await browser.newPage({viewport:{width:1440,height:1000}});await preview.setContent(deck.html);
  await expect(preview.locator('.slide:visible')).toHaveCount(1);await expect(preview.locator('.cover img')).toHaveAttribute('alt','BTG Pactual');
  for(let i=0;i<deck.slideCount;i++){
   const slide=preview.locator('.slide:visible');
   expect(await slide.evaluate(el=>el.scrollHeight<=el.clientHeight+1&&el.scrollWidth<=el.clientWidth+1)).toBe(true);
   if(i<4)await preview.screenshot({path:info.outputPath(`btg-slide-${i+1}.png`)});
   await preview.keyboard.press('ArrowRight');
  }
  await expect(preview.locator('#next')).toBeDisabled();await expect(preview.locator('.slide:visible')).toContainText('Apêndice');
  await preview.keyboard.press('Home');await expect(preview.locator('.cover')).toBeVisible();
  await preview.setViewportSize({width:390,height:844});expect(await preview.locator('body').evaluate(el=>el.scrollWidth<=innerWidth)).toBe(true);await preview.screenshot({path:info.outputPath('btg-mobile.png')});
  await preview.setViewportSize({width:1440,height:1000});await preview.emulateMedia({media:'print'});await expect(preview.locator('.slide:visible')).toHaveCount(deck.slideCount);await expect(preview.locator('.deck-controls')).not.toBeVisible();await preview.close();
 }finally{await pilot.close();}
});
