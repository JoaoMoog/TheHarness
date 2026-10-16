import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createAvalServer } from '../src/server/app.ts';

const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE ?? 'C:/Users/jpmoo/source/CrossPrototype/node_modules/playwright-core/index.mjs').href);
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH ?? 'C:/Users/jpmoo/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe' });
const output = resolve('auditoria-2026-10-11/onboarding');
await mkdir(output, { recursive: true });
const results = [];
try {
  for (const mode of ['release', 'validation']) {
    const server = createAvalServer({ publicDir: resolve(mode === 'release' ? 'dist/release' : 'public'), rateLimit: { limit: 10000, windowMs: 60000 }, allowMockFrames: mode === 'validation' });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await context.route('https://fonts.googleapis.com/**', route => route.abort());
    await context.route('https://fonts.gstatic.com/**', route => route.abort());
    try {
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      const base = `http://127.0.0.1:${server.address().port}`;
      await page.goto(`${base}/?app=1&sb=24&nb=24#/entrada`, { waitUntil: 'domcontentloaded' });
      const heading = title => page.getByRole('heading', { name: title, exact: true }).waitFor();
      await heading('Bem-vindo ao Aval');
      assert.equal(await page.locator('.onboarding').getAttribute('aria-modal'), 'true');
      assert.equal(await page.locator('.device.main > .device-inner > .screen').evaluate(el => el.inert), true);
      assert.equal(await page.evaluate(() => document.activeElement.id), 'onboarding-title');
      const stateBefore = await page.evaluate(async () => (await import('/js/store.js')).getState());
      await page.screenshot({ path: resolve(output, `${mode}-01.png`) });
      await page.getByRole('button', { name: 'Continuar', exact: true }).click();
      await heading('Cobrar começa por quem paga');
      await page.reload({ waitUntil: 'domcontentloaded' });
      await heading('Bem-vindo ao Aval');
      // No timer or presentation guide advances this introduction.
      await page.waitForTimeout(900);
      assert.equal(await page.locator('.onboarding-progress small').innerText(), '1 de 4');
      const titles = ['Cobrar começa por quem paga', 'Confira antes de pagar', 'Acompanhe até concluir'];
      for (let i = 0; i < titles.length; i++) {
        await page.getByRole('button', { name: 'Continuar', exact: true }).click();
        await heading(titles[i]);
        await page.screenshot({ path: resolve(output, `${mode}-0${i + 2}.png`) });
      }
      await page.evaluate(() => window.avalBack());
      await heading('Confira antes de pagar');
      await page.getByRole('button', { name: 'Continuar', exact: true }).click();
      await heading('Acompanhe até concluir');
      await page.getByRole('button', { name: 'Começar a usar', exact: true }).focus();
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(() => document.activeElement.dataset.action), 'finishOnboarding');
      assert.equal(await page.evaluate(() => document.activeElement.textContent.trim()), 'Pular');
      await page.keyboard.press('Shift+Tab');
      assert.equal(await page.evaluate(() => document.activeElement.textContent.trim()), 'Começar a usar');
      await page.getByRole('button', { name: 'Começar a usar', exact: true }).click();
      await page.locator('.onboarding').waitFor({ state: 'detached' });
      const flag = mode === 'validation' ? 'aval-validation-onboarding-v1' : 'aval-local-onboarding-v1';
      assert.equal(await page.evaluate(flag => localStorage.getItem(flag), flag), 'done');
      assert.equal(await page.locator('.device.main > .device-inner > .screen').evaluate(el => el.inert), false);
      assert.deepEqual(await page.evaluate(async () => (await import('/js/store.js')).getState()), stateBefore);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'Criar conta neste aparelho', exact: true }).waitFor();
      assert.equal(await page.locator('.onboarding').count(), 0);

      // Replay is available without changing the route or completion preference.
      await page.goto(`${base}/?app=1&sb=24&nb=24#/ajuda`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'Conhecer o Aval', exact: true }).click();
      await heading('Bem-vindo ao Aval');
      await page.setViewportSize({ width: 320, height: 568 });
      await page.addStyleTag({ content: '.onboarding h1{font-size:40px}.onboarding p,.onboarding h2,.onboarding .btn{font-size:24px}.onboarding-progress small{font-size:20px}' });
      await page.getByRole('button', { name: 'Continuar', exact: true }).click();
      await heading('Cobrar começa por quem paga');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      const footer = await page.locator('.onboarding .footer').boundingBox();
      assert.ok(footer.y + footer.height <= 568 - 24 + 1);
      await page.locator('.onboarding-content').evaluate(el => el.scrollTop = el.scrollHeight);
      await page.screenshot({ path: resolve(output, `${mode}-320-texto-ampliado.png`) });
      await page.keyboard.press('Escape');
      await heading('Bem-vindo ao Aval');
      await page.keyboard.press('Escape');
      await page.locator('.onboarding').waitFor({ state: 'detached' });
      assert.equal(await page.evaluate(() => location.hash), '#/ajuda');
      assert.equal(await page.evaluate(() => document.activeElement.dataset.action), 'openOnboarding');
      await page.setViewportSize({ width: 390, height: 844 });

      // A first visit through a charge link returns to that same link after skipping.
      await page.evaluate(flag => localStorage.removeItem(flag), flag);
      await page.goto(`${base}/?app=1#/p/link-inexistente`, { waitUntil: 'domcontentloaded' });
      await heading('Bem-vindo ao Aval');
      await page.getByRole('button', { name: 'Pular', exact: true }).click();
      await page.locator('.onboarding').waitFor({ state: 'detached' });
      assert.equal(await page.evaluate(() => location.hash), '#/p/link-inexistente');

      // A real local signup/logout does not reset the device preference.
      await page.goto(`${base}/?app=1#/cadastro`, { waitUntil: 'domcontentloaded' });
      await page.getByLabel('Seu nome', { exact: true }).fill('Teste Onboarding');
      await page.getByLabel('Crie um código de acesso', { exact: true }).fill('483927');
      await page.getByLabel('Repita o código', { exact: true }).fill('483927');
      await page.getByRole('button', { name: 'Criar minha conta', exact: true }).click();
      await page.waitForFunction(() => location.hash === '#/inicio');
      await page.goto(`${base}/?app=1#/menu`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'Ajuda', exact: true }).click();
      await page.getByRole('button', { name: 'Conhecer o Aval', exact: true }).click();
      await heading('Bem-vindo ao Aval');
      await page.getByRole('button', { name: 'Pular', exact: true }).click();
      await page.locator('.onboarding').waitFor({ state: 'detached' });
      await page.evaluate(async () => (await import('/js/actions/core.js')).actions.logout());
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'Entrar na minha conta', exact: true }).waitFor();
      assert.equal(await page.locator('.onboarding').count(), 0);
      await page.evaluate(flag => localStorage.removeItem(flag), flag);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'Entrar na minha conta', exact: true }).waitFor();
      assert.equal(await page.locator('.onboarding').count(), 0, 'Accounts from earlier versions are not first-time users');
      assert.deepEqual(errors, []);
      results.push({ mode, firstAccess: true, unfinishedRestart: true, completionAndSkipPersist: true, manualNavigation: true, focusTrapAndRestore: true, androidBack: true, replay: true, deepLinkPreserved: true, localSignupAndLogout: true, existingAccount: true, narrowScreenAndLargeText: true });
      console.log(`PASS: ${mode} onboarding, persistence, replay, deep link, local account, keyboard/back, narrow screen`);
    } finally { await context.close(); await new Promise(resolve => server.close(resolve)); }
  }
  await writeFile(resolve(output, 'verificacao.json'), JSON.stringify({ checkedAt: new Date().toISOString(), results }, null, 2));
} finally { await browser.close(); }
