import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createAvalServer } from '../src/server/app.ts';

const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE ?? 'C:/Users/jpmoo/source/CrossPrototype/node_modules/playwright-core/index.mjs').href);
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH ?? 'C:/Users/jpmoo/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe' });
const output = resolve('auditoria-2026-10-11/correcoes-cobrar');
await mkdir(output, { recursive: true });
const errors = [];
try {
  for (const mode of ['release', 'validation']) {
    const server = createAvalServer({ publicDir: fileURLToPath(new URL(mode === 'release' ? '../dist/release/' : '../public/', import.meta.url)), rateLimit: { limit: 1200, windowMs: 60000 } });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    try {
      const page = await context.newPage();
      page.setDefaultTimeout(10000);
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`http://127.0.0.1:${server.address().port}/?app=1`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'Pular', exact: true }).click();
      await page.getByRole('button', { name: 'Criar conta neste aparelho', exact: true }).click();
      await page.getByLabel('Seu nome', { exact: true }).fill('Teste Cobrança');
      await page.getByLabel('Crie um código de acesso', { exact: true }).fill('483927');
      await page.getByLabel('Repita o código', { exact: true }).fill('483927');
      await page.getByRole('button', { name: 'Criar minha conta', exact: true }).click();
      await page.waitForFunction(() => location.hash === '#/inicio');
      const act = (name, data = {}) => page.evaluate(async ({ name, data }) => { const { actions } = await import('/js/actions/core.js'); actions[name](data); }, { name, data });
      const hash = expected => page.waitForFunction(expected => location.hash === expected, expected);
      const getState = () => page.evaluate(async () => (await import('/js/store.js')).getState());
      await act('setMode', { mode: 'prestador' });
      await page.locator('.device.main [data-action="startCharge"]').first().click();
      await hash('#/cobrar/destinatario');
      assert.equal(await page.locator('[data-bind="ag.description"]').count(), 0);
      assert.equal(await page.locator('[data-bind="ag.recipientInput"]').inputValue(), '');
      await page.getByRole('button', { name: 'Continuar', exact: true }).click();
      assert.equal(await page.locator('[data-bind="ag.recipientInput"]').getAttribute('aria-invalid'), 'true');
      const fresh = await getState();
      await page.keyboard.press('PageDown');
      await page.keyboard.press('ArrowRight');
      assert.deepEqual((await getState()).ui.guide, fresh.ui.guide);
      await page.screenshot({ path: resolve(output, `${mode}-destinatario.png`) });

      for (const entry of [
        { kind: 'phone', value: '11988881001', contact: '(11) 98888-1001', channel: 'whatsapp', known: true },
        { kind: 'email', value: 'Cliente.Teste@Exemplo.com', contact: 'cliente.teste@exemplo.com', channel: 'email' },
        { kind: 'document', value: '52998224725', contact: '529.982.247-25', channel: 'link' },
        { kind: 'document', value: '12abc34501de35', contact: '12.ABC.345/01DE-35', channel: 'link' },
      ]) {
        await act('newCharge');
        await hash('#/cobrar/destinatario');
        assert.equal(await page.locator('.device.main .toast').count(), 0);
        await page.locator(`[data-action="chooseChargeIdentifier"][data-kind="${entry.kind}"]`).click();
        await page.locator('[data-bind="ag.recipientInput"]').fill(entry.value);
        await page.getByRole('button', { name: 'Continuar', exact: true }).click();
        await hash('#/combinado/1');
        await page.locator('.device.main').getByRole('heading', { name: 'Dados da cobrança', exact: true }).waitFor();
        assert.equal(await page.locator('.device.main [data-bind="ag.description"]').evaluate(el => el.closest('label').querySelector('span').textContent), 'Descrição da cobrança');
        assert.equal(await page.locator('.device.main [data-bind="ag.total"]').evaluate(el => el.closest('label').querySelector('span').textContent), 'Valor da cobrança (R$)');
        assert.equal((await getState()).ui.drafts.ag.payer.contact, entry.contact);
        if (entry.known) {
          await page.locator('[data-bind="ag.description"]').fill('');
          await page.getByRole('button', { name: 'Continuar', exact: true }).click();
          assert.equal(await page.locator('#error-ag-description').innerText(), 'Descreva a cobrança.');
        }
        await page.locator('[data-bind="ag.description"]').fill('Pintura da sala para teste de cobrança');
        if (entry.known) {
          await page.locator('[data-bind="ag.total"]').fill('');
          await page.getByRole('button', { name: 'Continuar', exact: true }).click();
          assert.equal(await page.locator('#error-ag-total').innerText(), 'Informe o valor da cobrança.');
        }
        await page.locator('[data-bind="ag.total"]').fill('160,00');
        await page.locator('[data-bind="ag.dueIso"]').fill('2026-12-20');
        const openAddress = page.locator('[data-action="openAddress"]');
        if (await openAddress.count()) await openAddress.click();
        for (const [bind, value] of Object.entries({ street: 'Rua de teste', number: '100', district: 'Centro', city: 'São Paulo', uf: 'SP' })) await page.locator(`[data-bind="ag.${bind}"]`).fill(value);
        await page.getByRole('button', { name: 'Alterar', exact: true }).click();
        await hash('#/cobrar/destinatario');
        assert.equal(await page.locator('[data-bind="ag.recipientInput"]').inputValue(), entry.contact);
        await page.getByRole('button', { name: 'Continuar', exact: true }).click();
        await hash('#/combinado/1');
        assert.equal(await page.locator('[data-bind="ag.description"]').inputValue(), 'Pintura da sala para teste de cobrança');
        await page.screenshot({ path: resolve(output, `${mode}-dados-cobranca.png`) });
        await page.getByRole('button', { name: 'Continuar', exact: true }).click();
        await hash('#/combinado/3');
        assert.match(await page.locator('.device.main').innerText(), new RegExp(entry.contact.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
        assert.equal(await page.locator('[data-action="chooseAgPerson"]').count(), 0);
        await page.locator(`[data-action="chooseChannel"][data-channel="${entry.channel}"]`).click();
        await page.screenshot({ path: resolve(output, `${mode}-revisao-${entry.kind}-${entry.contact.length}.png`) });
        await page.locator('[data-action="sendAgreement"]').click();
        await page.waitForFunction(() => location.hash.startsWith('#/combinado/enviado/'));
        const sent = (await getState()).invites.at(-1);
        assert.equal(sent.contact, entry.contact);
        assert.equal(sent.recipient.contact, entry.contact);
        assert.equal(sent.channel, entry.channel);
        assert.equal(sent.totalCents, 16000);
        assert.match(await page.locator('.device.main').innerText(), /Nenhuma mensagem/);
        if (entry.known) {
          assert.equal(sent.client, 'Marina Costa');
          await page.getByRole('button', { name: 'Simular a resposta da outra pessoa', exact: true }).click();
          assert.equal((await getState()).session.person, 'marina');
          await page.locator('[data-action="chooseManualStages"][data-release="single"]').click();
          await page.locator('[data-bind="ag.accept"]').check();
          await page.locator('[data-bind="ag.arbitration"]').check();
          await page.getByRole('button', { name: 'Aceitar e pagar', exact: true }).click();
          await page.waitForFunction(() => location.hash.startsWith('#/pagar/'));
          const accepted = (await getState()).contracts.at(0);
          assert.equal(accepted.client, 'Marina Costa');
          assert.equal(accepted.provider, 'Teste Cobrança');
          if (mode === 'release') await page.getByRole('button', { name: 'Voltar à minha conta', exact: true }).click();
          else await act('switchRole', { role: 'voce' });
        }
        console.log(`PASS ${mode}: ${entry.kind} is requested first, preserved through editing, reviewed and stored in the simulated charge`);
      }
      await act('newCharge');
      await hash('#/cobrar/destinatario');
      await page.locator('[data-action="chooseChargeIdentifier"][data-kind="document"]').click();
      await page.locator('[data-bind="ag.recipientInput"]').fill('11111111111');
      await page.getByRole('button', { name: 'Continuar', exact: true }).click();
      assert.equal(await page.locator('[data-bind="ag.recipientInput"]').getAttribute('aria-invalid'), 'true');
      assert.equal((await getState()).invites.length, 4);
      await page.evaluate(async () => {
        const { update } = await import('/js/store.js');
        update(s => { s.people.voce.phone = '(11) 97777-3003'; s.people.voce.email = 'proprio@exemplo.com'; });
      });
      await page.locator('[data-action="chooseChargeIdentifier"][data-kind="phone"]').click();
      await page.locator('[data-bind="ag.recipientInput"]').fill('11977773003');
      await page.getByRole('button', { name: 'Continuar', exact: true }).click();
      assert.match(await page.locator('.device.main').innerText(), /outra pessoa/);
      assert.equal((await getState()).ui.drafts.ag.payer, null);
      for (const width of [320, 390, 412]) {
        await page.setViewportSize({ width, height: 844 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        assert.equal(await page.evaluate(() => [...document.querySelectorAll('.device.main svg[data-i] path')].some(path => !path.getAttribute('d'))), false);
      }
      await act('startPayment');
      await hash('#/combinado/1');
      await page.locator('.device.main').getByRole('heading', { name: 'O que vocês combinaram?', exact: true }).waitFor();
      console.log(`PASS ${mode}: invalid identifiers, self billing, layout recovery and payer copy preserved`);
    } finally { await context.close(); await new Promise(resolve => server.close(resolve)); }
  }
  assert.deepEqual(errors, []);
} finally { await browser.close(); }
