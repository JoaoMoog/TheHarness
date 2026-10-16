import {test,expect} from '@playwright/test';
const baseURL=process.env.PLAYWRIGHT_BASE_URL||'http://127.0.0.1:3000';
async function enter(page:any){await page.goto('/');await page.getByRole('button',{name:'Começar demonstração',exact:true}).click();await expect(page.getByRole('heading',{name:'Desempenho financeiro',exact:true})).toBeVisible();}
test('Studio: entrada sem configuração e cálculos do servidor',async({page})=>{
 await enter(page);await expect(page.getByText('Armazenamento temporário',{exact:false}).first()).toBeVisible();
 await page.getByLabel('Centro de custo',{exact:true}).selectOption('Tecnologia');
 await expect(page.getByText('R$ 3,21 mi',{exact:true}).first()).toBeVisible();
 await page.getByLabel('Mensagem para CLARA').fill('Troque o gráfico por barras horizontais');
 await page.getByRole('button',{name:'Enviar mensagem',exact:true}).click();
 await page.getByRole('button',{name:'Aplicar ajuste',exact:true}).click();
 await expect(page.getByLabel('Centro de custo',{exact:true})).toHaveValue('Tecnologia');
 await page.getByRole('button',{name:'Salvar',exact:true}).click();
 await page.getByLabel('Nome do dashboard',{exact:true}).last().fill('Minha análise integrada');
 await page.getByRole('button',{name:'Salvar dashboard',exact:true}).click();
 await expect(page.getByRole('dialog')).toHaveCount(0);
 await page.reload();await expect(page.getByRole('heading',{name:'Minha análise integrada',exact:true})).toBeVisible();
});
test('Studio: versões de planejamento, cenários e medidas',async({page})=>{
 await enter(page);await page.getByRole('button',{name:'Planejamento',exact:true}).first().click();
 await page.getByLabel('Nome da versão').fill('Revisão aprovada');await page.getByLabel('Orçamento de Tecnologia').fill('3500000');
 await page.getByRole('button',{name:'Salvar versão',exact:true}).click();await expect(page.getByText('Revisão aprovada',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Previsões e cenários',exact:true}).click();await page.getByLabel('Nome do cenário').fill('Economia de tecnologia');
 await page.getByRole('button',{name:'Salvar cenário',exact:true}).click();await expect(page.getByText('Economia de tecnologia',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Modelos de dados',exact:true}).click();await page.getByLabel('Nome da medida').fill('Saldo do período');await page.getByRole('button',{name:'Salvar medida',exact:true}).click();
 await page.reload();await page.getByRole('button',{name:'Modelos de dados',exact:true}).click();await expect(page.getByLabel('Nome da medida')).toHaveValue('Saldo do período');
});
test('Studio: erro de conexão preserva edição e permite reconectar',async({page})=>{
 await enter(page);await page.getByRole('button',{name:'Conexões',exact:true}).click();await page.getByRole('button',{name:'Pausar fonte',exact:true}).click();
 await page.getByRole('button',{name:'Dashboards',exact:false}).first().click();await page.getByRole('button',{name:'Abrir Desempenho financeiro',exact:true}).click();
 await expect(page.getByText('Fonte temporariamente indisponível',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Conexões',exact:true}).click();await page.getByRole('button',{name:'Reconectar fonte',exact:true}).click();
 await page.getByRole('button',{name:'Visão geral',exact:true}).click();await expect(page.getByRole('heading',{name:'Seu próximo passo começa com uma pergunta.'})).toBeVisible();
});
test('Studio: mobile mantém navegação e assistente utilizáveis',async({page})=>{
 await page.setViewportSize({width:390,height:844});await enter(page);
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('button',{name:'CLARA IA',exact:true}).last().click();await expect(page.getByLabel('Mensagem para CLARA')).toBeVisible();
 await page.getByRole('button',{name:'Recolher CLARA IA'}).click();await page.getByRole('button',{name:'Abrir navegação'}).click();await page.getByRole('button',{name:'Planejamento',exact:true}).first().click();await expect(page.getByRole('heading',{name:'Planejamento',exact:true})).toBeVisible();
});

test('Studio: painéis móveis contêm foco e métricas cabem nas células',async({page})=>{
 await page.setViewportSize({width:390,height:844});await enter(page);
 expect(await page.locator('.sidebar').evaluate((el:HTMLElement)=>el.inert)).toBe(true);
 expect(await page.locator('.metric strong').evaluateAll(elements=>elements.every(el=>{const value=el.getBoundingClientRect(),cell=el.parentElement!.getBoundingClientRect();return value.right<=cell.right&&value.left>=cell.left}))).toBe(true);
 const opener=page.getByRole('button',{name:'Abrir navegação'});await opener.click();await expect(page.getByRole('dialog',{name:'Navegação principal'})).toBeVisible();
 await page.keyboard.press('Shift+Tab');expect(await page.locator('.sidebar').evaluate(el=>el.contains(document.activeElement))).toBe(true);await page.keyboard.press('Escape');await expect(opener).toBeFocused();
 await opener.click();await page.getByRole('button',{name:'Conversar com CLARA',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'CLARA IA'})).toBeVisible();expect(await page.locator('.assistant').evaluate((el:HTMLElement)=>!el.inert&&el.contains(document.activeElement))).toBe(true);await page.keyboard.press('Escape');await expect(opener).toBeFocused();
 const chat=page.getByRole('button',{name:'CLARA IA',exact:true}).last();await chat.click();await expect(page.getByRole('dialog',{name:'CLARA IA'})).toBeVisible();await expect(page.getByRole('button',{name:'Dados demonstrativos'})).toBeVisible();
 await page.keyboard.press('Shift+Tab');expect(await page.locator('.assistant').evaluate(el=>el.contains(document.activeElement))).toBe(true);await page.keyboard.press('Escape');await expect(chat).toBeFocused();
 await page.setViewportSize({width:1440,height:1000});await expect.poll(()=>page.locator('.sidebar').evaluate((el:HTMLElement)=>el.inert)).toBe(false);
});
test('Studio: link compartilhado abre o dashboard autorizado e leitor não salva',async({page,context,browser})=>{
 await enter(page);
 const teamResponse=await context.request.post('/api/workspaces',{data:{name:'Equipe de integração'},headers:{origin:baseURL}});expect(teamResponse.ok()).toBeTruthy();const team=await teamResponse.json();
 const bootstrap=await context.request.get('/api/v1/studio/bootstrap',{headers:{'x-clara-workspace':team.id}});const state=await bootstrap.json();
 await page.goto(`/?workspace=${team.id}&dashboard=${state.state.boards[0].id}`);
 await expect(page.getByRole('button',{name:'Equipe de integração',exact:false}).first()).toBeVisible();
 await expect(page.getByRole('heading',{name:'Desempenho financeiro',exact:true})).toBeVisible();
 const invited=await context.request.post(`/api/workspaces/${team.id}/invites`,{data:{role:'reader'},headers:{origin:baseURL}});const invite=await invited.json();
 const reader=await browser.newContext({baseURL:baseURL});
 await reader.request.post('/api/v1/studio/session',{data:{name:'Pessoa leitora'},headers:{origin:baseURL}});
 expect((await reader.request.post('/api/workspaces/join',{data:{code:invite.code},headers:{origin:baseURL}})).ok()).toBeTruthy();
 const readerPage=await reader.newPage();await readerPage.goto(`/?workspace=${team.id}&dashboard=${state.state.boards[0].id}`);
 await expect(readerPage.getByText('Seu acesso é de leitura',{exact:true})).toBeVisible();await expect(readerPage.getByRole('button',{name:'Salvar',exact:true})).toHaveCount(0);
 const denied=await reader.request.post('/api/v1/studio/commands',{headers:{origin:baseURL,'x-clara-workspace':team.id},data:{revision:state.state.revision,operationId:crypto.randomUUID(),command:{type:'scenario.save',name:'Proibido',percent:5}}});expect(denied.status()).toBe(403);
 await reader.close();
});
test('Studio: conflito de revisão aparece na janela e preserva a edição',async({page,context})=>{
 await enter(page);await page.getByRole('button',{name:'Salvar',exact:true}).click();await page.getByLabel('Nome do dashboard',{exact:true}).last().fill('Edição que precisa sobreviver');
 const bootstrap=await (await context.request.get('/api/v1/studio/bootstrap')).json();
 await context.request.post('/api/v1/studio/commands',{headers:{origin:baseURL},data:{revision:bootstrap.state.revision,operationId:crypto.randomUUID(),command:{type:'model.save',name:'Outra alteração',formula:'actual-budget'}}});
 await page.getByRole('button',{name:'Salvar dashboard',exact:true}).click();
 await expect(page.getByRole('dialog').getByText(/espaço mudou/i)).toBeVisible();await expect(page.getByLabel('Nome do dashboard',{exact:true}).last()).toHaveValue('Edição que precisa sobreviver');
});

test('Studio: planejamento preserva rascunho ao recuperar conflito e sessão',async({page,context})=>{
 await page.goto('/');await page.getByRole('button',{name:'Usar conta local',exact:true}).click();await page.getByRole('button',{name:'Criar conta local',exact:true}).click();
 const email=`recovery-${crypto.randomUUID()}@example.test`,password='UmaSenhaDeTeste123!';
 await page.getByLabel('Nome',{exact:true}).fill('Conta de recuperação');await page.getByLabel('E-mail',{exact:true}).fill(email);await page.getByLabel('Senha',{exact:true}).fill(password);await page.getByRole('button',{name:'Criar conta',exact:true}).click();
 await page.getByRole('button',{name:'Planejamento',exact:true}).first().click();await page.getByLabel('Nome da versão').fill('Orçamento em edição');await page.getByLabel('Orçamento de Tecnologia').fill('3456789');
 const bootstrap=await (await context.request.get('/api/v1/studio/bootstrap')).json();await context.request.post('/api/v1/studio/commands',{headers:{origin:baseURL},data:{revision:bootstrap.state.revision,operationId:crypto.randomUUID(),command:{type:'model.save',name:'Mudança concorrente',formula:'actual-budget'}}});
 await page.getByRole('button',{name:'Salvar versão',exact:true}).click();await expect(page.getByText(/espaço mudou/i)).toBeVisible();await page.getByRole('button',{name:'Atualizar do servidor',exact:true}).click();
 await expect(page.getByLabel('Nome da versão')).toHaveValue('Orçamento em edição');await expect(page.getByLabel('Orçamento de Tecnologia')).toHaveValue('3456789');
 await context.clearCookies();await page.getByRole('button',{name:'Salvar versão',exact:true}).click();await page.getByRole('button',{name:'Usar conta local',exact:true}).click();await page.getByLabel('E-mail',{exact:true}).fill(email);await page.getByLabel('Senha',{exact:true}).fill(password);await page.getByRole('button',{name:'Entrar',exact:true}).click();
 await expect(page.getByLabel('Nome da versão')).toHaveValue('Orçamento em edição');await expect(page.getByLabel('Orçamento de Tecnologia')).toHaveValue('3456789');await page.getByRole('button',{name:'Salvar versão',exact:true}).click();await expect(page.getByText('Orçamento em edição',{exact:true})).toBeVisible();
});

test('Studio: link de equipe continua depois de autenticar',async({page,context,browser})=>{
 await enter(page);const headers={origin:baseURL};const team=await (await context.request.post('/api/workspaces',{headers,data:{name:'Equipe do link'}})).json();const state=await (await context.request.get('/api/v1/studio/bootstrap',{headers:{'x-clara-workspace':team.id}})).json();const invite=await (await context.request.post(`/api/workspaces/${team.id}/invites`,{headers,data:{role:'reader'}})).json();
 const member=await browser.newContext({baseURL});const email=`link-${crypto.randomUUID()}@example.test`,password='UmaSenhaDeTeste123!';
 await member.request.post('/api/auth/register',{headers,data:{mode:'local',name:'Leitora do link',email,password}});await member.request.post('/api/workspaces/join',{headers,data:{code:invite.code}});await member.clearCookies();
 const target=await member.newPage();await target.goto(`/?workspace=${team.id}&dashboard=${state.state.boards[0].id}`);await target.getByRole('button',{name:'Usar conta local',exact:true}).click();await target.getByLabel('E-mail',{exact:true}).fill(email);await target.getByLabel('Senha',{exact:true}).fill(password);await target.getByRole('button',{name:'Entrar',exact:true}).click();
 await expect(target.getByRole('button',{name:'Equipe do link',exact:false}).first()).toBeVisible();await expect(target.getByText('Seu acesso é de leitura',{exact:true})).toBeVisible();await member.close();
});
