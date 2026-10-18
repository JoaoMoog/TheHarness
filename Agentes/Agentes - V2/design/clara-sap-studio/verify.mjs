import {mkdirSync,writeFileSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const root=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(root,'../../app/package.json'));
const {chromium,expect}=require('@playwright/test');
const AxeBuilder=require('@axe-core/playwright').default;
const out=resolve(root,'.impeccable/review');mkdirSync(out,{recursive:true});
const executablePath=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const browser=await chromium.launch({executablePath,headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
const page=await context.newPage();page.setDefaultTimeout(8000);
const errors=[],requests=[],flows=[],audits=[];
page.on('pageerror',e=>errors.push(e.stack));page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url())});
const state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('clara:sap-studio:v1')));
const nav=async label=>{if(await page.locator('.sidebar').evaluate(el=>el.getBoundingClientRect().x<0))await page.getByRole('button',{name:'Abrir navegação',exact:true}).click();await page.getByRole('navigation').getByRole('button',{name:new RegExp('^'+label+'(?: \\d+)?$')}).click()};
const chat=async text=>{if(!await page.getByRole('textbox',{name:'Mensagem para CLARA',exact:true}).isVisible()){await page.getByRole('button',{name:'Conversar com CLARA',exact:true}).click()}await page.getByRole('textbox',{name:'Mensagem para CLARA',exact:true}).fill(text);await page.getByRole('button',{name:'Enviar mensagem',exact:true}).click()};
const close=()=>page.getByRole('button',{name:'Fechar janela',exact:true}).click();
const capture=async name=>{if(process.env.SKIP_CAPTURE==='1'&&name!=='mobile-chat')return;await page.evaluate(async()=>{await document.fonts.ready;document.querySelector('main').scrollTop=0});await page.screenshot({path:resolve(out,name+'.png'),fullPage:true});};
try{
 await page.goto(pathToFileURL(resolve(root,'index.html')).href);await expect(page.getByRole('heading',{name:'Desempenho financeiro',exact:true})).toBeVisible();
 await expect(page.locator('.metric-strip')).toContainText('R$ 129.000');
 await page.getByLabel('Centro de custo',{exact:true}).selectOption('Tecnologia');await expect(page.locator('.metric-strip')).toContainText('R$ 190.000');
 await page.getByLabel('Período',{exact:true}).selectOption('q3');await page.getByLabel('Empresa',{exact:true}).selectOption('Matriz');await expect(page.locator('.table-footer')).toContainText('3 registros');
 await page.getByRole('button',{name:'Limpar',exact:true}).click();flows.push('Filtros combinados e totais coerentes');
 await page.getByLabel('Centro de custo',{exact:true}).selectOption('Tecnologia');await page.getByLabel('Período',{exact:true}).selectOption('q3');await page.getByLabel('Empresa',{exact:true}).selectOption('Matriz');
 await chat('Crie um dashboard financeiro');await expect(page.locator('.proposal')).toContainText('Todos os centros');await expect(page.locator('.proposal')).toContainText('Todas as empresas');await expect(page.locator('.proposal')).toContainText('Jan – set de 2026');await page.getByRole('button',{name:'Gerar dashboard',exact:true}).click();await expect(page.locator('.generation-state')).toBeVisible();await expect(page.locator('.generation-state')).toHaveCount(0);assert.equal((await state()).savedId,null);
 await page.getByRole('button',{name:'Desfazer último ajuste',exact:true}).click();assert.equal((await state()).savedId,'financial');assert.equal((await state()).center,'Tecnologia');assert.equal((await state()).period,'q3');assert.equal((await state()).company,'Matriz');await page.getByRole('button',{name:'Limpar',exact:true}).click();flows.push('Pedido, critérios efetivos, carregamento, geração e restauração da identidade');
 await chat('Troque o gráfico por barras horizontais');await page.getByRole('button',{name:'Aplicar ajuste',exact:true}).click();assert.equal((await state()).chart,'bar');
 await page.getByRole('button',{name:'Desfazer alteração',exact:true}).click();assert.equal((await state()).chart,'column');flows.push('Refinamento por IA e desfazer');
 await chat('Simule redução de 5% em Tecnologia');await page.getByRole('button',{name:'Aplicar ajuste',exact:true}).click();await expect(page.locator('.scenario-number')).toContainText('160.500');await expect(page.locator('.scenario-compare')).toContainText('8.029.500');
 await page.getByRole('button',{name:'Otimista 10%',exact:true}).click();await expect(page.locator('.scenario-number')).toContainText('321.000');await page.getByRole('button',{name:'Ver projeção',exact:true}).click();await expect(page.locator('.forecast-panel .recharts-wrapper')).toBeVisible();await page.getByRole('button',{name:'Desfazer último ajuste',exact:true}).click();assert.equal((await state()).percent,5);assert.equal((await state()).screen,'dashboard');flows.push('Simulação, projeção ilustrativa e desfazer completo');
 await nav('Dashboards');await page.getByRole('button',{name:'Abrir Desempenho financeiro',exact:true}).click();
 await page.getByRole('button',{name:'Editar gráfico comparativo',exact:true}).click();await page.getByLabel('Tipo de visualização',{exact:true}).selectOption('bar');await page.getByRole('checkbox',{name:'Destacar desvios acima do orçamento'}).check();await page.getByRole('button',{name:'Duplicar gráfico',exact:true}).click();assert.equal((await state()).duplicate,true);await page.getByRole('button',{name:'Remover cópia',exact:true}).click();await page.getByRole('button',{name:'Concluir edição',exact:true}).click();flows.push('Editor visual, realce e componentes');
 await page.getByRole('button',{name:'Salvar',exact:true}).click();await page.getByRole('dialog').getByLabel('Nome do dashboard',{exact:true}).fill('Análise conferida');await page.getByRole('button',{name:'Salvar dashboard',exact:true}).click();
 await page.reload();await expect(page.getByRole('heading',{name:'Análise conferida',exact:true})).toBeVisible();assert.equal((await state()).chart,'bar');
 await nav('Dashboards');await page.getByRole('textbox',{name:'Buscar dashboards'}).fill('nenhum-resultado');await expect(page.getByRole('heading',{name:'Nenhum dashboard encontrado'})).toBeVisible();await page.getByRole('textbox',{name:'Buscar dashboards'}).fill('Análise');await page.getByRole('button',{name:'Abrir Análise conferida',exact:true}).click();flows.push('Salvar, persistir, buscar e reabrir');
 await page.getByRole('button',{name:'Histórico de versões',exact:true}).click();await expect(page.getByRole('button',{name:'Restaurar',exact:true})).toBeVisible();await close();
 await nav('Planejamento');await page.getByRole('spinbutton',{name:'Orçamento de Tecnologia',exact:true}).fill('3500000');await expect(page.locator('.metric-strip')).toContainText('R$ 100.000');await page.getByRole('textbox',{name:'Nome da versão de planejamento'}).fill('Revisada');await page.getByRole('button',{name:'Salvar versão',exact:true}).click();assert.equal((await state()).planVersion,'Revisada');flows.push('Planejamento revisado preserva a base');
 await nav('Modelos de dados');await page.getByLabel('Nome',{exact:true}).fill('Desvio absoluto');await page.getByLabel('Cálculo',{exact:true}).selectOption('actual-budget');await expect(page.locator('.formula-preview')).toContainText('129.000');await page.getByRole('button',{name:'Salvar medida',exact:true}).click();assert.equal((await state()).measure,'Desvio absoluto');flows.push('Medida calculada com prévia');
 await nav('Conexões');await page.getByRole('button',{name:'Pausar fonte demonstrativa',exact:true}).click();await nav('Dashboards');await page.getByRole('button',{name:'Abrir Análise conferida',exact:true}).click();await expect(page.getByRole('heading',{name:'Fonte temporariamente indisponível'})).toBeVisible();await page.getByRole('button',{name:'Ver conexões',exact:true}).click();await page.getByRole('button',{name:'Reconectar fonte',exact:true}).click();flows.push('Fonte indisponível e recuperação');
 await nav('Administração');await page.getByLabel('Papel de Rafael Lima',{exact:true}).selectOption('Editor');assert.equal((await state()).members[2].role,'Editor');
 await nav('Dashboards');await page.getByRole('button',{name:'Abrir Análise conferida',exact:true}).click();await page.getByRole('button',{name:'Compartilhar',exact:true}).click();await page.getByRole('button',{name:'Visualizar como Leitor',exact:true}).click();await expect(page.getByRole('button',{name:'Editar',exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'Salvar',exact:true})).toHaveCount(0);await nav('Administração');await expect(page.getByRole('heading',{name:'Área restrita'})).toBeVisible();await page.getByRole('button',{name:'Sair da prévia',exact:true}).click();flows.push('Permissões e visão de Leitor');
 await page.keyboard.press('Control+k');await page.getByRole('textbox',{name:'Buscar área ou análise'}).fill('Explorar');await page.getByRole('dialog').getByRole('button',{name:'Explorar dados',exact:true}).click();await page.getByRole('textbox',{name:'Buscar registros'}).fill('Tecnologia');await expect(page.locator('.records-table tbody tr')).toHaveCount(18);await page.getByRole('textbox',{name:'Buscar registros'}).fill('');
 const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Exportar resumo',exact:true}).click();const download=await downloadPromise;assert.equal(download.suggestedFilename(),'clara-financeiro.csv');flows.push('Busca global, registros e exportação CSV');
 await page.evaluate(()=>localStorage.clear());await page.reload();await capture('desktop');
 const audit=async name=>{const a=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();audits.push({name,overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),violations:a.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))})};
 await audit('dashboard-1440');
 for(const label of ['Visão geral','Dashboards','Explorar dados','Planejamento','Previsões e cenários','Modelos de dados','Conexões','Administração']){await nav(label);await audit(label);if(label==='Planejamento')await capture('planning');if(label==='Visão geral')await capture('overview')}
 await nav('Dashboards');await page.getByRole('button',{name:'Abrir Desempenho financeiro',exact:true}).click();
 for(const width of [1920,1280,1024,768,390,320]){await page.setViewportSize({width,height:width<768?844:1080});if(width===1024&&await page.getByRole('button',{name:'Recolher CLARA IA',exact:true}).isVisible())await page.getByRole('button',{name:'Recolher CLARA IA',exact:true}).click();await audit('responsive-'+width);if(width===390)await capture('mobile');}
 await page.setViewportSize({width:390,height:844});if(!await page.getByRole('textbox',{name:'Mensagem para CLARA'}).isVisible())await page.locator('.floating-ai').click();await capture('mobile-chat');await audit('mobile-chat');
 await page.getByRole('button',{name:'Recolher CLARA IA',exact:true}).click();await nav('Planejamento');await expect(page.getByRole('heading',{name:'Planejamento financeiro'})).toBeVisible();flows.push('Navegação móvel, layout e chat sobreposto');
 writeFileSync(resolve(out,'checks.json'),JSON.stringify({flows,errors,requests,audits},null,2));
 assert.equal(errors.length,0,errors.join('\n'));assert.equal(requests.length,0);assert.equal(audits.filter(a=>a.overflow).length,0,'Document overflow');
 const violations=audits.filter(a=>a.violations.length);console.log(JSON.stringify({flows:flows.length,errors,externalRequests:requests.length,audits:audits.length,violations,review:out},null,2));
 if(violations.length)process.exitCode=1;
}catch(error){writeFileSync(resolve(out,'failure.json'),JSON.stringify({message:error.message,flows,errors,requests,audits},null,2));throw error}finally{await browser.close()}



