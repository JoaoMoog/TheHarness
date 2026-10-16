import { resetDemo } from './helpers';
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function login(page: Page) {
  await resetDemo(page);
  await page.goto('/classic');
  await page.getByRole('button', { name: 'Explorar demonstração' }).click();
  await expect(page.getByRole('heading', { name: /Vamos olhar mais longe/ })).toBeVisible();
}
async function choose(page: Page, label: string, option: string) {
  await page.getByRole('combobox', { name: label, exact: true }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
}
async function create(page: Page) {
  await page.getByRole('banner').getByRole('button', { name: 'Criar dashboard', exact: true }).click();
  await choose(page, 'Quais dados vamos usar?', 'Despesas e orçamento');
}
async function preview(page: Page) {
  await create(page);
  await page.getByRole('textbox', { name: 'O que você quer entender?', exact: true }).fill('Compare despesas por centro de custo.');
  await page.getByRole('button', { name: 'Montar prévia' }).click();
  await expect(page.locator('.preview-ready')).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  (page as Page & { reviewErrors?: string[] }).reviewErrors = errors;
});
test.afterEach(async ({ page }) => {
  expect((page as Page & { reviewErrors?: string[] }).reviewErrors).toEqual([]);
});

test('retoma texto, conversa e filtros pela home, histórico e recarga', async ({ page }) => {
  await login(page); await create(page);
  const input = page.getByRole('textbox', { name: 'O que você quer entender?', exact: true });
  await input.fill('Compare despesas por centro de custo.');
  await page.getByRole('button', { name: 'Seus dados', exact: true }).click();
  await page.goBack();
  await expect(input).toHaveValue('Compare despesas por centro de custo.');
  await page.goForward();
  await expect(page.getByRole('heading', { name: 'Seus dados, seu ponto de partida' })).toBeVisible();
  await page.goBack();
  await page.getByRole('button', { name: 'Montar prévia' }).click();
  await expect(page.locator('.preview-ready')).toBeVisible();
  const draftUrl = page.url();
  await choose(page, 'Centro de custo', 'Tecnologia');
  const refine = page.getByRole('textbox', { name: 'O que você quer ajustar?' });
  await refine.fill('Mostre em linha.');
  await page.getByRole('button', { name: 'Visão geral', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Retomar análise' })).toBeVisible();
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.screenshot({ path: `.local/daily-review/resume-${width}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: 'Retomar análise' }).click();
  await expect(page).toHaveURL(draftUrl);
  await expect(refine).toHaveValue('Mostre em linha.');
  await expect(page.getByRole('combobox', { name: 'Centro de custo', exact: true })).toHaveText('Tecnologia');
  await page.reload();
  await expect(refine).toHaveValue('Mostre em linha.');
  await expect(page.getByRole('combobox', { name: 'Centro de custo', exact: true })).toHaveText('Tecnologia');
  await expect(page.getByRole('log')).toContainText('Compare despesas por centro de custo.');
});

test('cancelar descarte mantém trabalho; confirmar inicia conversa vazia', async ({ page }) => {
  await login(page);
  await page.request.post('/api/sources/sap', { data: { domain: 'sales' }, headers: { Origin: new URL(page.url()).origin } });
  await page.reload(); await preview(page);
  const input = page.getByRole('textbox', { name: 'O que você quer ajustar?' });
  await input.fill('Pergunta ainda não enviada');
  page.once('dialog', dialog => dialog.dismiss());
  await page.getByRole('button', { name: 'Nova conversa' }).click();
  await expect(input).toHaveValue('Pergunta ainda não enviada');
  page.once('dialog', dialog => dialog.dismiss());
  await page.getByRole('banner').getByRole('button', { name: 'Criar dashboard', exact: true }).click();
  await expect(input).toHaveValue('Pergunta ainda não enviada');
  const bootstrap = await (await page.request.get('/api/bootstrap')).json();
  const alternate = bootstrap.sources.find((source: { name: string }) => source.name !== 'Despesas e orçamento');
  expect(alternate).toBeTruthy();
    page.once('dialog', dialog => dialog.dismiss());
    await choose(page, 'Quais dados vamos usar?', alternate.name);
    await expect(page.getByRole('combobox', { name: 'Quais dados vamos usar?' })).toHaveText('Despesas e orçamento');
    await expect(input).toHaveValue('Pergunta ainda não enviada');
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Nova conversa' }).click();
  await expect(page.getByRole('textbox', { name: 'O que você quer entender?', exact: true })).toBeEmpty();
  await expect(page.locator('.preview-ready')).toHaveCount(0);
  await expect(page.getByRole('log')).toHaveCount(0);
});

test('conversa expirada preserva pergunta e exige iniciar outra análise', async ({ page }) => {
  await login(page); await preview(page);
  const input = page.getByRole('textbox', { name: 'O que você quer ajustar?' });
  await input.fill('Pergunta para depois');
  await page.route('**/api/drafts/*', route => route.fulfill({ status: 410, json: { error: 'Essa conversa expirou.' } }));
  await page.reload();
  await expect(page.locator('.preview-ready')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Iniciar outra análise' })).toBeVisible();
  const recovered = page.getByRole('textbox', { name: 'O que você quer entender?', exact: true });
  await expect(recovered).toHaveValue('Pergunta para depois');
  await expect(recovered).toBeDisabled();
  await page.getByRole('button', { name: 'Iniciar outra análise' }).click();
  await expect(recovered).toBeEnabled();
  await expect(recovered).toHaveValue('Pergunta para depois');
  await expect(page).not.toHaveURL(/draft=/);
});

test('expiração com a página aberta remove a prévia e mantém a última pergunta', async ({ page }) => {
  await page.clock.install();
  await login(page); await preview(page);
  await page.clock.fastForward(31 * 60 * 1000);
  await expect(page.locator('.preview-ready')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Iniciar outra análise' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'O que você quer entender?', exact: true })).toHaveValue('Compare despesas por centro de custo.');
});

test('fonte removida mantém pergunta acessível e permite escolher outra fonte', async ({ page }) => {
  await login(page);
  await page.request.post('/api/sources/sap', { data: { domain: 'sales' }, headers: { Origin: new URL(page.url()).origin } });
  await page.reload(); await preview(page);
  await page.getByRole('textbox', { name: 'O que você quer ajustar?' }).fill('Pergunta para nova fonte');
  await page.route('**/api/bootstrap', async route => {
    const response = await route.fetch(); const data = await response.json();
    await route.fulfill({ json: { ...data, sources: data.sources.filter((source: { name: string }) => source.name !== 'Despesas e orçamento') } });
  });
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Sua pergunta preservada' })).toHaveValue('Pergunta para nova fonte');
  const selector = page.getByRole('combobox', { name: 'Dados para retomar a pergunta' });
  await selector.click();
  await page.getByRole('option').first().click();
  await page.getByRole('button', { name: 'Iniciar outra análise' }).click();
  await expect(page.getByRole('textbox', { name: 'O que você quer entender?', exact: true })).toHaveValue('Pergunta para nova fonte');
  await expect(page.locator('.preview-ready')).toHaveCount(0);
});

test('mudança da revisão invalida prévia e outra conta não recupera texto privado', async ({ page }) => {
  await login(page); await preview(page);
  await page.getByRole('textbox', { name: 'O que você quer ajustar?' }).fill('Texto privado da primeira conta');
  await page.route('**/api/bootstrap', async route => {
    const response = await route.fetch(); const data = await response.json();
    data.sources = data.sources.map((source: { revision: number }) => ({ ...source, revision: source.revision + 1 }));
    await route.fulfill({ json: data });
  });
  await page.reload();
  await expect(page.getByRole('button', { name: 'Iniciar outra análise' })).toBeVisible();
  await expect(page.locator('.preview-ready')).toHaveCount(0);
  await page.unroute('**/api/bootstrap');
  await page.route('**/api/bootstrap', async route => {
    const response = await route.fetch(); const data = await response.json();
    await route.fulfill({ json: { ...data, actor: { id: 'second-user', name: 'Outra conta', demo: true }, sources: [], reports: [] } });
  });
  await page.goto('/classic?view=home');
  await expect(page.getByRole('button', { name: 'Retomar análise' })).toHaveCount(0);
  await expect(page.getByText('Texto privado da primeira conta')).toHaveCount(0);
  await page.getByRole('banner').getByRole('button', { name: 'Criar dashboard', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Primeiro, traga seus dados' })).toBeVisible();
});

test('falha de importação após confirmação recupera tela sem reimportar', async ({ page }) => {
  await login(page);
  await page.getByRole('button', { name: 'Seus dados', exact: true }).click();
  await page.getByRole('button', { name: /Importar arquivo Use/ }).click();
  await page.getByLabel('Escolher arquivo para importar').setInputFiles({ name: 'Retomada.csv', mimeType: 'text/csv', buffer: Buffer.from('Data;Região;Valor\n2025-01-01;Sul;100\n2026-01-01;Norte;300') });
  await expect(page.getByRole('region', { name: 'Resumo do cálculo' })).toContainText('Somar Valor, por Região, considerando todos os registros');
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.screenshot({ path: `.local/daily-review/import-${width}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  let confirms = 0; let failRefresh = true;
  page.on('request', request => { if (request.url().endsWith('/api/imports/confirm')) confirms++; });
  await page.route('**/api/bootstrap', async route => {
    if (failRefresh) { failRefresh = false; await route.fulfill({ status: 503, json: { error: 'Falha temporária' } }); }
    else await route.continue();
  });
  await page.getByRole('button', { name: 'Confirmar e pedir um dashboard' }).click();
  await expect(page.getByRole('heading', { name: 'Fonte importada' })).toBeVisible();
  await expect(page.locator('.error-message')).toContainText('Sua fonte foi importada');
  await page.getByRole('button', { name: 'Atualizar tela', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'O que você quer entender?', exact: true })).toBeVisible();
  expect(confirms).toBe(1);
});

test('repetir salvamento e atualizar tela não reenviam pedido nem duplicam dashboard', async ({ page }) => {
  await login(page); await preview(page);
  let saveCalls = 0; let promptCalls = 0; let failRefresh = true;
  page.on('request', request => { if (request.method() === 'POST' && request.url().endsWith('/api/drafts')) promptCalls++; });
  await page.route('**/api/drafts/*/save', async route => {
    if (++saveCalls === 1) await route.fulfill({ status: 503, json: { error: 'Falha ao salvar' } });
    else await route.continue();
  });
  await page.route('**/api/bootstrap', async route => {
    if (failRefresh) { failRefresh = false; await route.fulfill({ status: 503, json: { error: 'Falha ao atualizar' } }); }
    else await route.continue();
  });
  await page.getByRole('button', { name: 'Salvar dashboard', exact: true }).click();
  await page.getByRole('button', { name: 'Tentar salvar novamente' }).click();
  await expect(page.locator('.error-message')).toContainText('Seu dashboard foi salvo');
  await page.getByRole('button', { name: 'Atualizar tela', exact: true }).click();
  await expect(page.locator('.saved-dashboard')).toBeVisible();
  expect(saveCalls).toBe(2); expect(promptCalls).toBe(0);
  const reportId = new URL(page.url()).searchParams.get('report');
  const data = await (await page.request.get('/api/bootstrap')).json();
  expect(data.reports.filter((report: { id: string }) => report.id === reportId)).toHaveLength(1);
  await page.getByRole('button', { name: 'Visão geral', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Retomar análise' })).toHaveCount(0);
});

test('tabelas equivalentes mostram anos e séries mesmo sem tabela geral', async ({ page }) => {
  await login(page);
  await page.getByRole('button', { name: 'Seus dados', exact: true }).click();
  await page.getByRole('button', { name: /Importar arquivo Use/ }).click();
  await page.getByLabel('Escolher arquivo para importar').setInputFiles({ name: 'Anos.csv', mimeType: 'text/csv', buffer: Buffer.from('Data;Região;Valor;Orçamento\n2025-01-01;Sul;100;120\n2026-01-01;Sul;300;250') });
  await page.locator('summary').filter({ hasText: 'Conferir critérios de cálculo e orçamento' }).click();
  await choose(page, 'Comparar com qual orçamento?', 'Orçamento');
  await page.getByRole('button', { name: 'Confirmar e pedir um dashboard' }).click();
  await page.getByRole('textbox', { name: 'O que você quer entender?', exact: true }).fill('Mostre a evolução de Valor, sem tabela.');
  await page.getByRole('button', { name: 'Montar prévia' }).click();
  await expect(page.locator('.preview-ready')).toBeVisible();
  await expect(page.locator('.results-table')).toHaveCount(0);
  const temporal = page.locator('.chart-panel').filter({ hasText: 'Como mudou ao longo do tempo?' });
  await temporal.locator('summary').click();
  await expect(temporal.locator('table')).toContainText('2025');
  await expect(temporal.locator('table')).toContainText('2026');
  await expect(temporal.locator('tbody tr').first()).toContainText('100');
  await expect(temporal.locator('tbody tr').first()).toContainText('120');
  await expect(temporal.locator('tbody tr').last()).toContainText('300');
  await expect(temporal.locator('tbody tr').last()).toContainText('250');
  await expect(temporal.getByRole('application')).toContainText('2025');
  await expect(temporal.getByRole('application')).toContainText('2026');
  await page.getByRole('button', { name: 'Recolher assistente', exact: true }).click();
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(result.violations.map(v => v.id)).toEqual([]);
    if (width !== 320) await page.screenshot({ path: `.local/daily-review/values-${width}.png`, fullPage: true });
  }
});

test('restaurar recorte usa filtros salvos e mantém original após recarga', async ({ page }) => {
  await login(page); await preview(page);
  await choose(page, 'Centro de custo', 'Tecnologia');
  await page.getByRole('button', { name: 'Salvar dashboard', exact: true }).click();
  await expect(page.locator('.saved-dashboard')).toBeVisible();
  await choose(page, 'Centro de custo', 'Pessoas');
  await expect(page.locator('.consultation-state')).toContainText('Recorte alterado nesta consulta');
  await page.getByRole('button', { name: 'Restaurar recorte salvo' }).click();
  await expect(page.getByRole('combobox', { name: 'Centro de custo', exact: true })).toHaveText('Tecnologia');
  await expect(page.getByRole('button', { name: 'Restaurar recorte salvo' })).toHaveCount(0);
  await choose(page, 'Centro de custo', 'Pessoas');
  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Centro de custo', exact: true })).toHaveText('Tecnologia');
});
