import { resetDemo } from './helpers';
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';

async function login(page: Page) {
  await resetDemo(page);
  await page.goto('/classic');
  await page.getByRole('button', { name: 'Explorar demonstração' }).click();
  await expect(page.getByRole('heading', { name: /Vamos olhar mais longe/ })).toBeVisible();
}
async function create(page: Page) {
  if ((page.viewportSize()?.width ?? 1440) < 1024) await page.getByRole('button', { name: 'Abrir navegação' }).click();
  await page.getByRole('button', { name: 'Criar dashboard', exact: true }).click();
  await page.getByRole('combobox', { name: 'Quais dados vamos usar?' }).click();
  await page.getByRole('option', { name: 'Despesas e orçamento', exact: true }).click();
}
async function accessible(page: Page) {
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(result.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) }))).toEqual([]);
}

test('assistente preserva texto, pedido em andamento, erro e filtros quando recolhido', async ({ page }) => {
  await login(page); await create(page);
  const input = page.getByRole('textbox', { name: 'O que você quer entender?', exact: true });
  await input.fill('Compare despesas por centro de custo.');
  await page.getByRole('button', { name: 'Recolher assistente', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Assistente CLARA' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Abrir assistente', exact: true }).click();
  await expect(input).toHaveValue('Compare despesas por centro de custo.');
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let entered!: () => void;
  const intercepted = new Promise<void>(resolve => { entered = resolve; });
  await page.route('**/api/drafts', async route => {
    entered(); await gate;
    await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Não foi possível preparar a análise. Tente novamente.' }) });
  });
  try {
    await page.getByRole('button', { name: 'Montar prévia' }).click(); await intercepted;
    await page.getByRole('button', { name: /^Recolher assistente/ }).click();
    await expect(page.getByLabel('Pedido em andamento')).toBeVisible();
    release();
    await expect(page.getByText('Atenção', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: /Abrir assistente/ }).click();
    await expect(page.locator('.error-message')).toContainText('Tente novamente');
    await expect(input).toHaveValue('Compare despesas por centro de custo.');
  } finally { release(); if (!page.isClosed()) await page.unroute('**/api/drafts'); }
  await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Foi isso que você pediu?' })).toBeVisible();
  await page.getByRole('combobox', { name: 'Centro de custo', exact: true }).click();
  await page.getByRole('option', { name: 'Tecnologia', exact: true }).click();
  const refine = page.getByRole('textbox', { name: 'O que você quer ajustar?' });
  await refine.fill('Mostre em linha.');
  await page.getByRole('button', { name: 'Ver dashboard', exact: true }).click();
  await expect(page.locator('.preview-heading h2')).toBeFocused();
  const preview = await page.locator('.preview-panel').boundingBox();
  expect(preview!.width).toBeGreaterThan(1380);
  await page.getByRole('button', { name: 'Abrir assistente', exact: true }).click();
  await expect(refine).toHaveValue('Mostre em linha.');
  await expect(page.getByRole('combobox', { name: 'Centro de custo', exact: true })).toContainText('Tecnologia');
  await expect(page.getByRole('log')).toContainText('Compare despesas por centro de custo.');
  await accessible(page);
});

test('menu, seletor e assistente mantêm foco e estado ao mudar entre celular e desktop', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page); await create(page);
  const dialog = page.getByRole('dialog', { name: 'Assistente CLARA' });
  await expect(dialog).toBeVisible();
  await page.getByRole('combobox', { name: 'Quais dados vamos usar?' }).click();
  await expect(page.getByRole('option', { name: 'Despesas e orçamento', exact: true })).toBeVisible();
  await accessible(page);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  const input = page.getByRole('textbox', { name: 'O que você quer entender?', exact: true });
  await input.fill('Compare despesas.');
  for (let i = 0; i < 16; i++) {
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
  }
  await page.setViewportSize({ width: 1024, height: 900 });
  await expect(dialog).toBeVisible();
  await expect.poll(() => dialog.evaluate(el => el.matches(':modal'))).toBe(false);
  await expect(input).toHaveValue('Compare despesas.');
  await page.setViewportSize({ width: 320, height: 800 });
  await expect.poll(() => dialog.evaluate(el => el.matches(':modal'))).toBe(true);
  await expect(input).toHaveValue('Compare despesas.');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Abrir assistente', exact: true })).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: 'Abrir menu da conta' }).click();
  await page.getByRole('button', { name: 'Integrações', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Integrações', exact: true })).toBeVisible();
  await accessible(page);
});

test('dashboard salvo exporta o recorte e preserva o original ao pedir outra análise', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await login(page);
  await page.getByRole('button', { name: 'Despesas e orçamento', exact: true }).click();
  await page.getByRole('combobox', { name: 'Centro de custo', exact: true }).click();
  await page.getByRole('option', { name: 'Tecnologia', exact: true }).click();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar valores' }).click();
  const download = await downloaded;
  const csv = await readFile((await download.path())!, 'utf8');
  expect(csv).toContain('Tecnologia'); expect(csv).not.toContain('Pessoas');
  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Centro de custo', exact: true })).toHaveText('Todos');
  await expect(page.locator('.saved-dashboard')).toBeVisible();
  const savedUrl = page.url();
  await page.getByRole('button', { name: 'Pedir outra análise' }).click();
  await expect(page.getByRole('textbox', { name: 'O que você quer entender?', exact: true })).not.toBeEmpty();
  await page.getByRole('button', { name: 'Montar prévia' }).click();
  await expect(page.locator('.preview-ready')).toBeVisible();
  expect(await page.locator('.preview-ready').evaluate(el => getComputedStyle(el).animationName)).toBe('none');
  await page.goto(savedUrl);
  await expect(page.locator('.saved-dashboard .indicator').first()).toContainText('8.190.000');
  await accessible(page);
});
