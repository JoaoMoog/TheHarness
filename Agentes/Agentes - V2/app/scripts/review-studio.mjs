import {chromium} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
const baseURL=process.env.PLAYWRIGHT_BASE_URL||'http://127.0.0.1:3131';
const output=new URL('../.impeccable/review/studio/',import.meta.url);
await mkdir(output,{recursive:true});
const executablePath=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{}),args:['--no-sandbox']});
const results=[];
for(const device of ['desktop','mobile']){
 const context=await browser.newContext({baseURL,viewport:device==='desktop'?{width:1440,height:1000}:{width:390,height:844}}),page=await context.newPage();
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 async function capture(name){await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:new URL(`${name}.png`,output).pathname.slice(1),fullPage:false,animations:'disabled'});const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();results.push({name,url:page.url(),viewport:page.viewportSize(),overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),violations:axe.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))})),errors:[...errors]});}
 await page.goto('/');await page.getByRole('button',{name:'Começar demonstração',exact:true}).waitFor();await capture(`login-${device}`);
 await page.getByRole('button',{name:'Começar demonstração',exact:true}).click();await page.getByRole('heading',{name:'Desempenho financeiro',exact:true}).waitFor();await capture(device);
 if(device==='mobile'){
  await page.getByRole('button',{name:'Abrir navegação'}).click();await page.getByRole('button',{name:'Conversar com CLARA',exact:true}).click();await page.getByRole('dialog',{name:'CLARA IA'}).waitFor();await capture('chat-mobile');
  await writeFile(new URL('overlay-focus.json',output),JSON.stringify(await page.evaluate(()=>({sidebarInert:(document.querySelector('.sidebar')).inert,assistantInert:(document.querySelector('.assistant')).inert,focusInAssistant:document.querySelector('.assistant').contains(document.activeElement),navigationOpen:!!document.querySelector('.mobile-open')})),null,2));await page.keyboard.press('Escape');
 }
 for(const [label,name] of [['Visão geral','overview'],['Explorar dados','explore'],['Planejamento','planning'],['Previsões e cenários','scenarios'],['Modelos de dados','models'],['Conexões','connections'],['Administração','admin']]){
  if(device==='mobile')await page.getByRole('button',{name:'Abrir navegação'}).click();
  await page.getByRole('button',{name:label,exact:true}).first().click();await page.locator('main h1').waitFor();
  await page.waitForFunction(label=>!document.querySelector('.mobile-open')&&[...document.querySelectorAll('nav button')].some(button=>button.textContent===label&&button.getAttribute('aria-current')==='page'),label);
  if(name==='scenarios')await page.getByRole('button',{name:'Salvar cenário',exact:true}).waitFor();
  await capture(`${name}-${device}`);
 }
 await context.close();
}
await browser.close();await writeFile(new URL('audit.json',output),JSON.stringify(results,null,2));
console.log(JSON.stringify(results.map(r=>({name:r.name,overflow:r.overflow,violations:r.violations.length,errors:r.errors})),null,2));
process.exitCode=results.some(r=>r.overflow||r.violations.length||r.errors.length)?1:0;
