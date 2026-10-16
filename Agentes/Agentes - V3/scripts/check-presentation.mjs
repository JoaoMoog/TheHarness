// Browser checks for the validation-only presentation. Supply local Playwright paths when needed.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createAvalServer } from '../src/server/app.ts';

const playwright = process.env.PLAYWRIGHT_MODULE ?? 'C:/Users/jpmoo/source/CrossPrototype/node_modules/playwright-core/index.mjs';
const executablePath = process.env.CHROMIUM_PATH ?? 'C:/Users/jpmoo/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe';
const { chromium } = await import(pathToFileURL(playwright).href);
const server = createAvalServer({ publicDir: fileURLToPath(new URL('../public/', import.meta.url)), rateLimit: { limit: 1200, windowMs: 60000 } });
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}`;
const output = resolve('auditoria-2026-10-11/correcoes-apresentacao');
await mkdir(output, { recursive: true });
let browser;
try {
  browser = await chromium.launch({ headless: true, executablePath });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${url}/?ritmo=50`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#stage .screen');
  await page.getByRole('button', { name: 'Pular', exact: true }).click();
  // Enter/Space legitimately activate a focused entry button after the modal restores focus.
  await page.evaluate(() => document.activeElement?.blur());
  const state = () => page.evaluate(async () => {
    const { getState } = await import('/js/store.js');
    const { presenting } = await import('/js/player.js');
    return { hash: location.hash, guide: getState().ui.guide, person: getState().session.person, playing: presenting() };
  });
  const act = (name, data = {}) => page.evaluate(async ({ name, data }) => {
    const { actions } = await import('/js/actions/core.js');
    // Do not await the presentation: it intentionally waits for the user.
    actions[name](data);
  }, { name, data });
  const idle = await state();
  for (const key of ['ArrowRight', 'ArrowLeft', 'PageDown', 'PageUp', 'Enter', 'Space']) await page.keyboard.press(key);
  await page.waitForTimeout(800);
  assert.deepEqual(await state(), idle);
  assert.equal(await page.locator('#dock [data-action="guideNext"]').count(), 0);
  console.log('PASS: navigation keys do not start or advance a scenario while exploring freely');

  await act('switchRole', { role: 'carlos' });
  await page.waitForFunction(() => location.hash === '#/inicio');
  await page.locator('#stage .device.main [data-action="startPayment"]').first().click();
  await page.waitForFunction(() => location.hash === '#/combinado/1');
  await page.waitForTimeout(1000);
  assert.equal((await state()).hash, '#/combinado/1');
  assert.equal((await state()).playing, false);
  assert.equal((await state()).guide, undefined);
  const field = page.locator('#stage .device.main [data-bind="ag.description"]');
  if (await field.count()) {
    await field.fill('Pintura de teste manual, sem cenário.');
    await field.press('ArrowRight');
    await field.press('Enter');
    assert.equal((await state()).hash, '#/combinado/1');
  }
  await page.locator('#stage .device.main [data-bind="ag.total"]').fill('160,00');
  await page.locator('#stage .device.main [data-bind="ag.dueIso"]').fill('2026-11-03');
  const openAddress = page.locator('#stage .device.main [data-action="openAddress"]');
  if (await openAddress.count()) await openAddress.click();
  for (const [bind, value] of [['street', 'Rua de teste'], ['number', '10'], ['district', 'Centro'], ['city', 'São Paulo'], ['uf', 'SP']]) {
    await page.locator(`#stage .device.main [data-bind="ag.${bind}"]`).fill(value);
  }
  await page.locator('#stage .device.main [data-action="agreementNext"]').click();
  await page.waitForFunction(() => location.hash === '#/combinado/2');
  await page.waitForTimeout(1000);
  assert.equal((await state()).hash, '#/combinado/2');
  await page.locator('#stage .device.main [data-action="chooseRelease"][data-release="single"]').click();
  await page.locator('#stage .device.main [data-action="agreementNext"]').click();
  await page.waitForFunction(() => location.hash === '#/combinado/3');
  await page.waitForTimeout(1000);
  assert.equal((await state()).hash, '#/combinado/3');
  assert.equal((await state()).guide, undefined);
  console.log('PASS: manually creating an agreement stays on each selected step');

  await act('playExecutive');
  await page.waitForSelector('.sl-agenda');
  const opening = await state();
  await page.waitForTimeout(300);
  assert.deepEqual((await state()).guide, opening.guide);
  await page.locator('.sl-progress [data-index="5"]').click();
  await page.waitForSelector('.sl-revenue');
  assert.equal(await page.locator('.sl-revenue-group').count(), 3);
  assert.equal(await page.locator('.sl-revenue-group li').count(), 8);
  for (const [width, height] of [[1440, 900], [1280, 720], [1024, 768], [390, 844]]) {
    await page.setViewportSize({ width, height });
    await page.screenshot({ path: resolve(output, `receitas-${width}.png`), fullPage: true });
    const overflow = await page.evaluate(() => {
      const slide = document.querySelector('.sl-revenue');
      const groups = [...slide.querySelectorAll('.sl-revenue-group')];
      return { slide: slide.scrollWidth > slide.clientWidth + 1, groups: groups.some(group => group.scrollWidth > group.clientWidth + 1) };
    });
    assert.deepEqual(overflow, { slide: false, groups: false }, `Revenue slide overflows at ${width}px`);
    if (width > 900) {
      const overlap = await page.evaluate(() => {
        const body = document.querySelector('.sl-revenue .sl-body').getBoundingClientRect();
        const footer = document.querySelector('.sl-revenue .sl-foot').getBoundingClientRect();
        return body.bottom > footer.top + 1 || footer.bottom > innerHeight + 1;
      });
      assert.equal(overlap, false, `Revenue content overlaps controls at ${width}px`);
    }
  }
  console.log('PASS: eight revenue sources remain legible without horizontal overflow at four viewport sizes');
  await page.setViewportSize({ width: 1440, height: 900 });
  await act('playerStop');
  await page.waitForTimeout(1000);
  const stopped = await state();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('PageDown');
  await page.waitForTimeout(800);
  assert.deepEqual(await state(), stopped);
  console.log('PASS: leaving the executive presentation restores free exploration');

  await act('playScenario', { index: 0 });
  await page.waitForSelector('.pv-intro');
  await act('playerNext');
  await page.waitForFunction(() => document.querySelector('.guide-hit') || document.body.classList.contains('touring'));
  assert.equal((await state()).playing, true);
  await act('playerStop');
  await page.waitForTimeout(500);
  const returned = await state();
  await page.waitForTimeout(1000);
  assert.deepEqual(await state(), returned);
  assert.equal(await page.locator('.guide-hit').count(), 0);
  console.log('PASS: an explicitly started scenario still guides the user and stops cleanly');
  assert.deepEqual(errors, []);
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
