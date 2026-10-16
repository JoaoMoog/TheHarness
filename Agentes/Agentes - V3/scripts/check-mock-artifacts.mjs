import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createAvalServer } from '../src/server/app.ts';
import { MOCKS } from '../public/js/mocks/fixtures.js';

const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE ?? 'C:/Users/jpmoo/source/CrossPrototype/node_modules/playwright-core/index.mjs').href);
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH ?? 'C:/Users/jpmoo/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe' });
const server = createAvalServer({ publicDir: resolve('public'), allowMockFrames: true, rateLimit: { limit: 10000, windowMs: 60000 } });
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
try {
  const page = await browser.newPage();
  await page.goto(pathToFileURL(resolve('mocks/galeria.html')).href);
  assert.equal(await page.locator('article').count(), MOCKS.length);
  await page.getByRole('searchbox').fill('cobrar');
  assert.ok(await page.locator('article:visible').count() > 0);
  await page.goto(`http://127.0.0.1:${server.address().port}/mocks.html#mock-015`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: /telefone/ }).waitFor();
  const promise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Baixar dados do mock' }).click();
  const download = await promise;
  const data = JSON.parse(await readFile(await download.path(), 'utf8'));
  assert.equal(data.mock.id, 'mock-015');
  assert.equal(data.state.ui.drafts.ag.from, 'provider');
  await writeFile(resolve('mocks/verificacao-artefatos.json'), JSON.stringify({ checkedAt: new Date().toISOString(), offlineGallery: true, galleryFilter: true, canonicalJsonDownload: true }, null, 2));
  console.log('PASS: offline gallery, filter and canonical JSON download');
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
