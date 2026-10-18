import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {pilotHarness} from '../pilot-harness.mjs';

test('conversa pergunta, retém contexto, permite refinamento e cria o dashboard',async({page},info)=>{
 test.setTimeout(120000);
 const calls:any[]=[];
 const pilot=await pilotHarness({assistantAnswer:async(input:any)=>{
  calls.push(input);
  await new Promise(resolve=>setTimeout(resolve,250));
  if(!input.history.length)return {status:'clarify',message:'O que você quer acompanhar no dashboard?',proposal:null};
  if(input.prompt!=='2025'&&!input.pendingProposal)return {status:'clarify',message:'Você quer setembro de 2025 ou de 2026?',proposal:null};
  return {status:'ready',message:'Vamos comparar as despesas e o orçamento da Filial Sul em setembro de 2025.',proposal:{kind:'create',title:'Despesas da Filial Sul',description:'Comparativo de despesas e orçamento no período escolhido.',patch:{title:'Despesas da Filial Sul',company:'Filial Sul',period:'range',dateFrom:'2025-09-01',dateTo:'2025-09-30',chart:input.pendingProposal?'line':'bar',screen:'dashboard'}}};
 }});
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 try{
  const headers={origin:pilot.url};
  expect((await page.request.post(`${pilot.url}/api/auth/register`,{headers,data:{mode:'local',name:'Conversa CLARA',email:`conversa-${Date.now()}@example.test`,password:'Teste-conversa-2026!'}})).ok()).toBeTruthy();
  await page.goto(pilot.url);await page.getByRole('button',{name:'Pular apresentação',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const message=page.getByLabel('Mensagem para CLARA'),transcript=page.getByRole('log',{name:'Histórico da conversa'});
  await message.fill('Crie um dashboard');await page.getByRole('button',{name:'Enviar mensagem',exact:true}).click();
  await expect(transcript).toContainText('Crie um dashboard');
  await expect(transcript).toContainText('O que você quer acompanhar');
  await expect(page.getByRole('region',{name:'Conferir proposta'})).toHaveCount(0);await expect(message).toBeFocused();
  await message.fill('Compare despesas e orçamento da Filial Sul em setembro em barras');await message.press('Enter');
  await expect(transcript).toContainText('2025 ou de 2026');
  await expect(page.getByRole('group',{name:'Ideias para começar'})).toHaveCount(0);
  for(const [width,height] of [[1440,1000],[1024,900],[768,900],[390,844],[320,740]]){
   await page.setViewportSize({width,height});
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   expect((await new AxeBuilder({page}).include('.home-chat').withTags(['wcag2a','wcag2aa']).analyze()).violations).toEqual([]);
   await page.screenshot({path:info.outputPath(`conversation-${width}.png`),animations:'disabled'});
  }
  const reading=page.getByRole('region',{name:'Mensagens e proposta'});
  await reading.evaluate(element=>element.scrollTop=0);
  await expect(page.getByRole('button',{name:'Ir para a última mensagem'})).toBeVisible();
  await message.fill('Estou lendo o histórico');
  expect(await reading.evaluate(element=>element.scrollTop)).toBe(0);
  await page.getByRole('button',{name:'Ir para a última mensagem'}).click();
  await expect(page.getByRole('button',{name:'Ir para a última mensagem'})).toHaveCount(0);
  await message.fill('Uma descrição mais longa\ncom várias linhas\npara detalhar a análise\npor empresa e por período\ncom orçamento e realizado');
  expect(await message.evaluate(element=>element.clientHeight)).toBeGreaterThan(80);
  await message.fill('2025');await message.press('Enter');
  const review=page.getByRole('region',{name:'Conferir proposta'});await expect(review).toContainText('Barras horizontais');
  expect(calls[2].history.map((m:any)=>m.text).join(' ')).toContain('Filial Sul em setembro em barras');
  await message.fill('Prefiro em linhas');await message.press('Enter');await expect(review).toContainText('Linhas');
  expect(calls[3].pendingProposal.patch.company).toBe('Filial Sul');
  await page.route('**/api/v1/studio/assistant',route=>route.fulfill({status:503,json:{error:{message:'Não foi possível enviar. Tente novamente.'}}}),{times:1});
  await message.fill('Pode manter em linhas');await message.press('Enter');
  await expect(message).toHaveValue('Pode manter em linhas');await expect(message).toBeEnabled();
  await expect(review).toContainText('Linhas');await expect(transcript).not.toContainText('Pode manter em linhas');
  await message.press('Enter');await expect(transcript).toContainText('Pode manter em linhas');await expect(review).toBeVisible();
  await page.setViewportSize({width:1440,height:1000});
  await page.getByRole('button',{name:'Criar dashboard',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Despesas da Filial Sul',exact:true})).toBeVisible();
  await expect(page.locator('.save-state')).toContainText('Alterações não salvas');
  if(!await transcript.isVisible())await page.getByRole('button',{name:'CLARA IA',exact:true}).first().click();
  await expect(transcript).toContainText('Prefiro em linhas');
  await page.getByRole('button',{name:'Nova conversa',exact:true}).click();await expect(page.locator('.chat-transcript')).toBeEmpty();
  await message.fill('Outra análise');await message.press('Enter');await expect(transcript).toContainText('O que você quer acompanhar');
  expect(calls.at(-1).history).toEqual([]);
  expect(errors).toEqual([]);
 }finally{await pilot.close()}
});
