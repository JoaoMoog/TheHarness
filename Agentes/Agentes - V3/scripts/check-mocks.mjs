import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createAvalServer } from '../src/server/app.ts';
import { MOCKS } from '../public/js/mocks/fixtures.js';

const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE ?? 'C:/Users/jpmoo/source/CrossPrototype/node_modules/playwright-core/index.mjs').href);
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH ?? 'C:/Users/jpmoo/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe' });
const server = createAvalServer({ publicDir: resolve('public'), allowMockFrames: true, rateLimit: { limit: 100000, windowMs: 60000 } });
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const output = resolve('mocks/capturas');
await mkdir(output, { recursive: true });
const results = [];
const context = await browser.newContext();
// Font loading must not make a documented snapshot depend on an external service.
await context.route('https://fonts.googleapis.com/**', route => route.abort());
await context.route('https://fonts.gstatic.com/**', route => route.abort());
try {
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { localStorage.setItem('aval-validation-v12', 'user-sentinel'); localStorage.setItem('aval-validation-auth-v1', 'auth-sentinel'); });
  for (const mock of MOCKS) {
    const errors = [];
    const onError = error => errors.push(error.message);
    page.on('pageerror', onError);
    try {
      await page.setViewportSize(mock.surface === 'desktop' ? { width: 1440, height: 1000 } : { width: 390, height: 844 });
      await page.goto(`${base}/?mock=${mock.id}${mock.surface === 'mobile' ? '&app=1' : ''}`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(path => location.hash === `#/${path}` && !!document.querySelector('#stage .screen, #stage .web-main'), mock.path);
      assert.deepEqual(errors, [], mock.id);
      assert.ok(!/\bNaN\b|\bundefined\b/.test(await page.locator('#stage').innerText()), `${mock.id} has no missing fixture values`);
      const state = await page.evaluate(async () => (await import('/js/store.js')).getState());
      assert.equal(Boolean(state.ui.sheet), Boolean(mock.sheet), `${mock.id} sheet`);
      assert.ok(!state.ui.guide, `${mock.id} has no automated guide`);
      if (mock.sheet) assert.ok(await page.locator('[role="dialog"]').count(), `${mock.id} dialog`);
      if (mock.variant.startsWith('onboarding:')) {
        await page.locator('.onboarding').waitFor();
        assert.equal(await page.locator('.onboarding-progress small').innerText(), `${Number(mock.variant.split(':')[1]) + 1} de 4`);
      }
      assert.equal(await page.evaluate(() => localStorage.getItem('aval-validation-v12')), 'user-sentinel');
      assert.equal(await page.evaluate(() => localStorage.getItem('aval-validation-auth-v1')), 'auth-sentinel');
      await page.screenshot({ path: resolve(output, `${mock.id}.png`) });
      results.push({ id: mock.id, title: mock.title, ok: true });
    } catch (error) { const result = { id: mock.id, title: mock.title, ok: false, error: `${error.message}; ${errors.join('; ')}` }; results.push(result); console.log(JSON.stringify(result)); }
    page.off('pageerror', onError);
  }
  await writeFile(resolve('mocks/verificacao.json'), JSON.stringify({ checkedAt: new Date().toISOString(), results }, null, 2));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${base}/mocks.html#mock-015`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Quem vai pagar — telefone', exact: true }).waitFor();
  await page.getByLabel('Buscar funcionalidade').fill('destinatário inválido');
  assert.equal(await page.locator('[data-mock]').count(), 1);
  await page.locator('[data-mock]').click();
  const frame = page.frameLocator('#mc-frame');
  await frame.locator('[aria-invalid="true"]').waitFor();
  await frame.locator('[data-bind="ag.recipientInput"]').fill('11977773003');
  await page.getByRole('button', { name: 'Restaurar exemplo' }).click();
  await frame.locator('[aria-invalid="true"]').waitFor();
  assert.equal(await frame.locator('[data-bind="ag.recipientInput"]').inputValue(), '123');
  await page.goto(`${base}/?mock=mock-002&app=1`, { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Seu nome', { exact: true }).fill('Conta do mock');
  await page.getByLabel('Crie um código de acesso', { exact: true }).fill('483927');
  await page.getByLabel('Repita o código', { exact: true }).fill('483927');
  await page.getByRole('button', { name: 'Criar minha conta', exact: true }).click();
  await page.waitForFunction(() => location.hash === '#/inicio');
  assert.equal(await page.evaluate(() => localStorage.getItem('aval-validation-auth-v1')), 'auth-sentinel');
  assert.equal(await page.evaluate(() => localStorage.getItem('aval-validation-v12')), 'user-sentinel');
  await page.goto(`${base}/mocks.html#mock-018`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Destinatário inválido', exact: true }).waitFor();
  await page.frameLocator('#mc-frame').locator('[aria-invalid="true"]').waitFor();
  await page.screenshot({ path: resolve('mocks/catalogo-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: resolve('mocks/catalogo-mobile.png'), fullPage: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await writeFile(resolve('mocks/verificacao.json'), JSON.stringify({ checkedAt: new Date().toISOString(), results }, null, 2));
  for (const result of results.filter(result => !result.ok)) console.log(JSON.stringify(result));
  console.log(`${results.filter(result => result.ok).length}/${MOCKS.length} mocks rendered; catalog search/reset, mobile and storage isolation checked.`);
  assert.ok(results.every(result => result.ok), 'All mocks must render');
  // Every current route and sheet must have a documented fixture.
  for (const file of await readdir('public/js/screens')) {
    const source = await readFile(`public/js/screens/${file}`, 'utf8');
    for (const match of source.matchAll(/export const \w+Routes\s*=\s*\{([\s\S]*?)\};/g)) {
      for (const entry of match[1].split(',').map(text => text.trim()).filter(Boolean)) {
        const pattern = entry.startsWith('"') ? entry.match(/^"([^"]+)"/)[1] : entry.split(':')[0].trim();
        const re = new RegExp(`^${pattern.split('/').map(part => part.startsWith(':') ? '[^/]+' : part).join('/')}$`);
        assert.ok(MOCKS.some(mock => re.test(mock.path)), `Unregistered route ${pattern}`);
      }
    }
    for (const match of source.matchAll(/export const \w+Sheets\s*=\s*\{([\s\S]*?)\};/g)) for (const entry of match[1].split(',').filter(text => text.trim())) assert.ok(MOCKS.some(mock => mock.sheet === entry.split(':')[0].trim()), `Unregistered sheet ${entry}`);
  }
} finally { await context.close(); await browser.close(); await new Promise(resolve => server.close(resolve)); }
