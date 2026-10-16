import { resetDemo } from './helpers';
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function login(page: Page) {
  await resetDemo(page);
  await page.goto('/classic'); await page.getByRole('button', { name: 'Explorar demonstração' }).click();
  await expect(page.getByRole('heading', { name: /Vamos olhar mais longe/ })).toBeVisible();
}
async function choose(page: Page, label: string, option: string) {
  await page.getByRole('combobox', { name: label, exact: true }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
}
async function a11y(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(results.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) }))).toEqual([]);
}

test('pedido financeiro, critérios, refinamento, restauração e salvamento', async ({ page }) => {
  await login(page); await page.getByRole('button', { name: 'Criar dashboard', exact: true }).click();
  await choose(page, 'Quais dados vamos usar?', 'Despesas e orçamento');
  const input = page.getByRole('textbox', { name: 'O que você quer entender?', exact: true });
  await input.fill('Compare despesas de Tecnologia em setembro de 2026.');
  await page.getByRole('button', { name: 'Montar prévia' }).click();
  await expect(page.getByRole('heading', { name: 'Foi isso que você pediu?' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Centro de custo', exact: true })).toHaveText(/Tecnologia/);
  await page.getByRole('button', { name: /^Despesas.*Ver cálculo e origem/ }).click();
  await expect(page.getByRole('heading', { name: 'Como este número foi calculado' })).toBeVisible();
  await expect(page.locator('.explanation').first().getByText('Somente registros em que status é “Contabilizado”. Esse critério foi definido para esta fonte.', { exact: true })).toBeVisible();
  await choose(page, 'Centro de custo', 'Comercial');
  await page.getByRole('textbox', { name: 'O que você quer ajustar?' }).fill('Mostre em linha, sem tabela. Use o título: Fechamento · teste navegador');
  await page.getByRole('button', { name: 'Pedir ajuste' }).click();
  await expect(page.getByRole('heading', { name: 'Fechamento · teste navegador', exact: true })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Centro de custo', exact: true })).toHaveText(/Comercial/);
  await expect(page.getByRole('heading', { name: 'Quais grupos compõem o resultado?' })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Fechamento · teste navegador', exact: true })).toBeVisible();
  await a11y(page);
  await page.getByRole('button', { name: 'Salvar dashboard' }).click();
  await expect(page.getByRole('heading', { name: 'Fechamento · teste navegador', exact: true })).toBeVisible();
  await expect(page.getByText('Seu dashboard foi salvo.', { exact: true })).toBeVisible();
  await a11y(page);
  await page.getByRole('button', { name: 'Todos os dashboards' }).click();
  const reportRow = page.locator('.report-list article').filter({ has: page.getByRole('button', { name: 'Fechamento · teste navegador', exact: true }) });
  await expect(reportRow).toHaveCount(1); await reportRow.getByRole('button', { name: 'Excluir', exact: true }).click();
  await reportRow.getByRole('button', { name: 'Confirmar exclusão' }).click(); await expect(reportRow).toHaveCount(0);
});

test('SAP de vendas gera dashboard genérico sem orçamento financeiro', async ({ page }) => {
  await login(page); await page.getByRole('button', { name: 'Seus dados', exact: true }).click();
  await page.getByRole('button', { name: /Buscar no SAP Escolha/ }).click();
  await expect(page.getByText('SAP em demonstração. Nenhuma conexão com a empresa será feita.')).toBeVisible();
  await page.getByRole('button', { name: 'Vendas Faturamento por região e produto' }).click();
  await page.getByRole('textbox', { name: 'O que você quer entender?' }).fill('Compare valor de vendas por região.');
  await page.getByRole('button', { name: 'Montar prévia' }).click();
  await expect(page.getByRole('heading', { name: 'Foi isso que você pediu?' })).toBeVisible();
  await expect(page.locator('.indicator')).toHaveCount(1);
  await expect(page.locator('.indicator')).toContainText('Valor de vendas');
  await expect(page.getByRole('combobox', { name: 'Região', exact: true })).toBeVisible();
  await a11y(page);
});

test('arquivo próprio, critério de negócio e total verificável', async ({ page }) => {
  await login(page); await page.getByRole('button', { name: 'Seus dados', exact: true }).click();
  await page.getByRole('button', { name: /Importar arquivo Use uma planilha/ }).click();
  await page.getByLabel('Escolher arquivo para importar').setInputFiles({ name: 'Vendas-teste.csv', mimeType: 'text/csv', buffer: Buffer.from('Data;Região;Valor de vendas;Status\n01/09/2026;Sul;100;Confirmado\n15/09/2026;Sul;500;Pendente\n20/09/2026;Norte;200;Confirmado') });
  await expect(page.getByRole('heading', { name: 'Vamos entender seus dados' })).toBeVisible();
  await page.locator('summary').filter({ hasText: 'Conferir critérios de cálculo e orçamento' }).click();
  await choose(page, 'Quais registros devem entrar?', 'Escolher um valor de status');
  await choose(page, 'Qual valor deve contar?', 'Confirmado');
  await a11y(page);
  await page.getByRole('button', { name: 'Confirmar e pedir um dashboard' }).click();
  await page.getByRole('textbox', { name: 'O que você quer entender?' }).fill('Compare valor de vendas por região em setembro de 2026.');
  await page.getByRole('button', { name: 'Montar prévia' }).click();
  await expect(page.getByRole('combobox', { name: 'Região', exact: true })).toBeVisible();
  await expect(page.locator('.indicator').first()).toContainText('R$ 300');
  await page.locator('.indicator').first().click();
  await expect(page.locator('.explanation').first().getByText(/Somente registros em que status é “Confirmado”/)).toBeVisible();
  await expect(page.locator('.explanation').first().getByText('2 registros considerados', { exact: true })).toBeVisible();
  await expect(page.locator('.results-table tfoot')).toContainText('R$ 300');
  await a11y(page);
});

test('celular: pedido incompleto, foco, cancelamento, menu e ausência de overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await login(page);
  await page.getByRole('button', { name: 'Abrir navegação' }).click();
  await a11y(page); await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Abrir navegação' })).toBeFocused();
  await page.getByRole('button', { name: 'Abrir navegação' }).click();
  await page.getByRole('button', { name: 'Criar dashboard', exact: true }).click();
  await page.getByRole('textbox', { name: 'O que você quer entender?' }).fill('Mostre lucro.');
  await page.getByRole('button', { name: 'Montar prévia' }).click();
  await expect(page.getByRole('heading', { name: 'Vamos completar sua pergunta' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Salvar dashboard' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Usar os dados disponíveis' }).click();
  await page.getByRole('button', { name: 'Ver dashboard', exact: true }).click();
  await expect(page.locator('.preview-heading h2')).toBeFocused();
  for (const width of [320,390,768,1024,1440,1920]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await page.setViewportSize({ width:390,height:844 }); await a11y(page);
  await page.getByRole('button', { name: 'Voltar ao pedido' }).click();
  await expect(page.getByRole('textbox', { name: 'O que você quer ajustar?' })).toBeFocused();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Nova conversa' }).click();
  let release!: () => void;
  const wait = new Promise<void>(resolve => { release = resolve; });
  let entered!: () => void;
  const intercepted = new Promise<void>(resolve => { entered = resolve; });
  let requests = 0;
  await page.route('**/api/drafts', async route => {
    if (++requests > 1) { await route.continue(); return; }
    entered(); await wait;
    try { await route.abort(); } catch (e) {
      if (!(e instanceof Error) || !e.message.includes('Route is already handled')) throw e;
    }
  });
  try {
    const input = page.getByRole('textbox', { name: 'O que você quer entender?' });
    await input.fill('Compare despesas.'); await page.getByRole('button', { name: 'Montar prévia' }).click();
    await intercepted;
    await page.getByRole('button', { name: 'Cancelar pedido' }).click();
    await expect(input).toBeEnabled(); await expect(input).toHaveValue('Compare despesas.');
    await expect(input).toBeFocused();
    await expect(page.getByRole('heading', { name: 'Foi isso que você pediu?' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Montar prévia' }).click();
    release();
    await page.getByRole('button', { name: 'Ver dashboard', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Foi isso que você pediu?' })).toBeVisible();
    await page.getByRole('button', { name: 'Abrir assistente', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'O que você quer ajustar?' })).toBeEnabled();
  } finally { release(); await page.unroute('**/api/drafts'); }
});
