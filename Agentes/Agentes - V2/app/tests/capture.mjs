import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { writeFile } from 'node:fs/promises';
const directory = '.impeccable/review/business';
const browser = await chromium.launch({ executablePath:'/usr/bin/chromium', args:['--no-sandbox'] });
const context = await browser.newContext({ viewport:{width:1440,height:1000} });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
async function capture(name, fullPage = true) { if(fullPage) await page.evaluate(()=>window.scrollTo(0,0)); await page.screenshot({path:`${directory}/${name}.png`,fullPage,animations:'disabled'}); }
async function choose(label, option) { await page.getByRole('combobox',{name:label,exact:true}).click(); await page.getByRole('option',{name:option,exact:true}).click(); }
const results = {};
try {
  await page.goto('http://localhost:3000'); await page.getByRole('button',{name:'Explorar demonstração'}).click();
  await page.getByRole('button',{name:'Seus dados',exact:true}).click();
  await page.getByRole('heading',{name:'Seus dados, seu ponto de partida'}).waitFor();
  await capture('desktop-data');
  await page.getByRole('button',{name:'Criar dashboard',exact:true}).click();
  await choose('Quais dados vamos usar?','Despesas e orçamento');
  await capture('desktop-create');
  results.desktopCreate = (await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations;
  await page.setViewportSize({width:390,height:844}); await page.evaluate(()=>window.scrollTo(0,0));
  await capture('mobile-create');
  const input = page.getByRole('textbox',{name:'O que você quer entender?',exact:true});
  results.mobileComposer = await input.boundingBox();
  await input.fill('Compare despesas por centro de custo com o orçamento e mostre a evolução mensal.');
  await page.getByRole('button',{name:'Montar prévia'}).click();
  await page.getByRole('heading',{name:'Foi isso que você pediu?'}).waitFor();
  await page.setViewportSize({width:1440,height:1000}); await page.evaluate(()=>window.scrollTo(0,0));
  await capture('desktop-preview');
  await page.locator('.indicator').first().click();
  await page.locator('.explanation').first().screenshot({path:`directory/desktop-calculation.png`.replace('directory',directory),animations:'disabled'});
  results.desktopPreview = (await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations;
  await page.locator('.indicator').first().click();
  results.overflow = {};
  for(const width of [320,390,768,1024,1440]) { await page.setViewportSize({width,height:900}); results.overflow[width] = await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth})); }
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:'Ver prévia'}).click();
  await capture('mobile-preview',false);
  await capture('mobile-preview-full');
  results.mobilePreview = (await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations;
  await page.getByRole('combobox',{name:'Centro de custo',exact:true}).click();
  results.mobileOpenSelect = (await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations;
  await page.keyboard.press('Escape');
  results.selectFocus = await page.getByRole('combobox',{name:'Centro de custo',exact:true}).evaluate(el=>el===document.activeElement);
  results.errors = errors;
  await writeFile(`${directory}/checks.json`,JSON.stringify(results,null,2));
  console.log(JSON.stringify({violations:Object.fromEntries(Object.entries(results).filter(([k])=>/Create|Preview|Select/.test(k)).map(([k,v])=>[k,v.length])),overflow:results.overflow,composer:results.mobileComposer,selectFocus:results.selectFocus,errors}));
} finally { await context.close(); await browser.close(); }
