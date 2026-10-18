import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = dirname(fileURLToPath(import.meta.url));
const require = createRequire(resolve(root, '../app/package.json'));
const { chromium } = require('playwright');
const AxeBuilder = require('@axe-core/playwright').default;
const htmlPath = resolve(root, 'clara-web-concept.html');
let html = readFileSync(htmlPath, 'utf8');
if (!html.includes('@font-face')) {
  const faces = [400, 600, 700].map(weight => {
    const bytes = readFileSync(resolve(root, `../app/node_modules/@fontsource/figtree/files/figtree-latin-${weight}-normal.woff2`));
    return `@font-face{font-family:Figtree;font-weight:${weight};font-style:normal;font-display:swap;src:url(data:font/woff2;base64,${bytes.toString('base64')}) format('woff2')}`;
  }).join('\n');
  html = html.replace('/* Local fonts are embedded by the companion verification script. */', faces);
  writeFileSync(htmlPath, html);
}
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/chromium',
].find(existsSync);
const browser = await chromium.launch({ executablePath, headless: true });
const output = resolve(root, 'clara-concept-review'); mkdirSync(output, { recursive: true });
const errors = []; const checks = [];
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(pathToFileURL(htmlPath).href); await page.evaluate(() => document.fonts.ready);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate(() => showScreen('home'));
    for (const screen of ['home', 'analysis']) {
      await page.evaluate(name => { showScreen(name); reset(); showPanel('overview'); }, screen);
      await page.evaluate(async () => { await Promise.all(document.getAnimations().map(animation => animation.finished.catch(() => {}))); });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      const violations = accessibility.violations.map(item => ({ id: item.id, targets: item.nodes.map(node => node.target), detail: item.nodes[0]?.failureSummary }));
      checks.push({ width, screen, overflow, violations });
      await page.screenshot({ path: resolve(output, `${screen}-${width}.png`), fullPage: true });
    }
  }
  await page.getByLabel('Centro de custo', { exact: true }).selectOption({ label: 'Tecnologia' }, { timeout: 5000 });
  if (!await page.locator('#margin-label').textContent().then(text => text.includes('Acima'))) throw new Error('Recorte Tecnologia não mostra o desvio.');
  await page.getByRole('button', { name: 'Restaurar recorte', exact: true }).click();
  if (await page.locator('#group').inputValue() !== 'all') throw new Error('Restaurar não preservou o recorte base.');
  await page.getByRole('button', { name: 'Conversar com CLARA', exact: true }).click();
  if (!await page.getByRole('dialog').isVisible()) throw new Error('Diálogo indisponível.');
  await page.keyboard.press('Escape');
  if (await page.getByRole('dialog').isVisible()) throw new Error('Escape não fechou o diálogo.');
  await page.evaluate(() => showScreen('home'));
  await page.getByRole('searchbox', { name: 'Buscar análises de exemplo' }).fill('setembro');
  if (await page.locator('.report-card:visible').count() !== 1) throw new Error('Busca não filtrou a biblioteca.');
  const result = { errors, checks, interactions: 'filters, restore, modal/Escape and search passed' };
  writeFileSync(resolve(output, 'checks.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ errors, checks: checks.map(check => ({ width: check.width, screen: check.screen, overflow: check.overflow, violations: check.violations.map(item => ({ id: item.id, count: item.targets.length, detail: item.detail })) })), interactions: result.interactions }, null, 2));
  if (errors.length || checks.some(check => check.overflow || check.violations.length)) process.exitCode = 1;
} finally { await browser.close(); }
