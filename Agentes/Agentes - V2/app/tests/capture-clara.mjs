import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const directory = '.impeccable/review/clara';
await mkdir(directory, { recursive: true });
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
const browser = await chromium.launch({ ...(executablePath ? { executablePath } : {}) });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
const page = await context.newPage();
const errors = [];
const widths = [];
page.on('pageerror', error => errors.push(error.message));
async function capture(name, fullPage = true) {
  await page.mouse.move(0, 0);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${directory}/${name}.png`, fullPage, animations: 'disabled' });
}
try {
  await page.goto(process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3100');
  await page.getByRole('button', { name: 'Explorar demonstração' }).waitFor();
  await capture('login-desktop');
  await page.getByRole('button', { name: 'Explorar demonstração' }).click();
  await page.getByRole('heading', { name: /Vamos olhar mais longe/ }).waitFor();
  await capture('home-desktop');
  await page.getByRole('button', { name: 'Despesas e orçamento', exact: true }).click();
  await page.locator('.data-chart svg.recharts-surface').first().waitFor();
  const reportUrl = page.url();
  for (const width of [1440, 1920, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 1000 });
    await page.locator('.saved-dashboard').waitFor();
    widths.push({ width, overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), dashboardWidth: (await page.locator('.saved-dashboard').boundingBox()).width });
    await capture(`dashboard-${width}`);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: 'Seus dados', exact: true }).click();
  await capture('data-desktop');
  await page.getByRole('button', { name: /Importar arquivo Use uma planilha/ }).click();
  await capture('import-desktop');
  await page.getByRole('button', { name: 'Criar dashboard', exact: true }).click();
  await page.getByRole('combobox', { name: 'Quais dados vamos usar?' }).click();
  await page.getByRole('option', { name: 'Despesas e orçamento', exact: true }).click();
  await page.getByRole('textbox', { name: 'O que você quer entender?', exact: true }).fill('Compare despesas por centro de custo com o orçamento e mostre a evolução mensal.');
  await page.getByRole('button', { name: 'Montar prévia' }).click();
  await page.getByRole('button', { name: 'Ver dashboard', exact: true }).waitFor();
  await capture('assistant-desktop');
  await page.getByRole('button', { name: 'Ver dashboard', exact: true }).click();
  await capture('preview-desktop');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Abrir assistente', exact: true }).click();
  await capture('assistant-mobile', false);
  await page.getByRole('combobox', { name: 'Quais dados vamos usar?' }).click();
  await capture('select-mobile', false);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Fechar assistente clara', exact: true }).click();
  await page.getByRole('button', { name: 'Abrir navegação', exact: true }).click();
  await capture('navigation-mobile', false);
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: 'Abrir menu da conta' }).click();
  await page.getByRole('button', { name: 'Integrações', exact: true }).click();
  await capture('integrations-desktop');
  await page.goto(reportUrl);
  await writeFile(`${directory}/checks.json`, JSON.stringify({ widths, errors }, null, 2));
  console.log(JSON.stringify({ widths, errors, directory }));
} finally { await browser.close(); }
