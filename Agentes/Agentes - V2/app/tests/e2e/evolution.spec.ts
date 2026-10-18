import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const password = 'Clara-local-test-2026!';
const email = () => `clara-${crypto.randomUUID()}@example.test`;
async function register(page: Page, address = email()) {
  await page.goto('/classic');
  await page.getByRole('button', { name: 'Entrar com conta local', exact: true }).click();
  await page.getByRole('button', { name: 'Criar conta local', exact: true }).click();
  await page.getByRole('textbox', { name: 'Nome', exact: true }).fill('Pessoa de teste');
  await page.getByRole('textbox', { name: 'E-mail', exact: true }).fill(address);
  await page.getByLabel('Senha', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Criar conta', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Vamos olhar mais longe/ })).toBeVisible();
  return address;
}
async function choose(page: Page, label: string, option: string) {
  await page.getByRole('combobox', { name: label, exact: true }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
}
async function accessible(page: Page, preview = false) {
  const builder = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']);
  // The opaque sandbox intentionally forbids axe's cross-frame injection; check its HTML separately.
  if (preview) builder.exclude('.executive-preview iframe');
  const result = await builder.analyze();
  expect(result.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) }))).toEqual([]);
}
async function capture(page: Page, name: string) {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    if (width === 390 && name === 'analysis') await page.getByRole('button', { name: 'Ver dashboard', exact: true }).click();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `.local/evolution-review/${name}-${width}.png`, fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
}

test('conta local retoma conversa, fórmula, seleções e texto em outro navegador', async ({ page, browser }) => {
  const address = await register(page);
  await page.getByRole('banner').getByRole('button', { name: 'Criar dashboard', exact: true }).click();
  await page.getByRole('textbox', { name: 'O que você quer entender?', exact: true }).fill('Compare despesas por centro de custo.');
  await page.getByRole('button', { name: 'Montar prévia' }).click();
  await expect(page.locator('.preview-ready')).toBeVisible();
  await page.getByText('Configurar indicadores, comparação e seleções', { exact: true }).click();
  await page.getByLabel('Nome do indicador', { exact: true }).fill('Saldo por registro');
  await page.getByLabel('Fórmula', { exact: true }).fill('[budget] - [value]');
  await page.getByRole('button', { name: 'Adicionar indicador', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Ver cálculo e origem de Saldo por registro', exact: true })).toBeVisible();
  await page.locator('.analysis-selection').filter({ has: page.locator('summary', { hasText: 'Centro de custo' }) }).locator('summary').click();
  await page.locator('.analysis-selection').getByLabel('Comercial', { exact: true }).check();
  await page.locator('.analysis-selection').getByLabel('Tecnologia', { exact: true }).check();
  await choose(page, 'Período atual', 'setembro de 2026');
  await choose(page, 'Período de referência', 'agosto de 2026');
  await page.getByRole('button', { name: 'Comparar períodos', exact: true }).click();
  await page.getByRole('textbox', { name: 'O que você quer ajustar?', exact: true }).fill('Pergunta para amanhã');
  await page.getByRole('button', { name: 'Salvar rascunho agora', exact: true }).click();
  await expect(page.locator('.work-sync')).toContainText('Rascunho salvo na sua conta');
  await capture(page, 'analysis'); await accessible(page);
  await page.getByRole('button', { name: 'Abrir menu da conta', exact: true }).click();
  await page.getByRole('button', { name: 'Sair da conta', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Explorar demonstração' })).toBeVisible();
  const context = await browser.newContext({ baseURL: String(test.info().project.use.baseURL), viewport: { width: 1440, height: 1000 } });
  try {
    const other = await context.newPage(); await other.goto('/classic');
    await other.getByRole('button', { name: 'Entrar com conta local', exact: true }).click();
    await other.getByRole('textbox', { name: 'E-mail', exact: true }).fill(address);
    await other.getByLabel('Senha', { exact: true }).fill(password);
    await other.getByRole('button', { name: 'Entrar', exact: true }).click();
    await other.getByRole('button', { name: 'Retomar análise', exact: true }).click();
    await other.getByRole('button', { name: 'Abrir assistente', exact: true }).click();
    await expect(other.getByRole('textbox', { name: 'O que você quer ajustar?', exact: true })).toHaveValue('Pergunta para amanhã');
    await expect(other.getByRole('button', { name: 'Ver cálculo e origem de Saldo por registro', exact: true })).toBeVisible();
    await other.getByText('Configurar indicadores, comparação e seleções', { exact: true }).click();
    await expect(other.locator('.analysis-selection summary', { hasText: 'Centro de custo' })).toContainText('2 selecionados');
    await expect(other.getByRole('combobox', { name: 'Período atual', exact: true })).toContainText('setembro');
  } finally { await context.close(); }
});

test('atualização de fonte, edição, duplicação, restauração e exportação conferida', async ({ page }) => {
  await register(page);
  await page.getByRole('button', { name: 'Seus dados', exact: true }).click();
  await page.getByRole('button', { name: 'Importar arquivo', exact: false }).click();
  await page.getByLabel('Escolher arquivo para importar').setInputFiles({ name: 'mensal.csv', mimeType: 'text/csv', buffer: Buffer.from('Data;Região;Valor\n2026-08;Sul;100\n2026-09;Norte;200') });
  await page.getByRole('textbox', { name: 'Que nome faz sentido para esses dados?', exact: true }).fill('Ciclo mensal');
  await page.getByRole('button', { name: 'Confirmar e pedir um dashboard' }).click();
  await page.getByRole('textbox', { name: 'O que você quer entender?', exact: true }).fill('Compare Valor por Região.');
  await page.getByRole('button', { name: 'Montar prévia' }).click();
  await page.getByRole('button', { name: 'Salvar dashboard', exact: true }).click();
  await page.getByRole('button', { name: 'Editar dashboard', exact: true }).click();
  await page.getByRole('textbox', { name: 'Título do dashboard', exact: true }).fill('Fechamento mensal');
  await page.getByRole('button', { name: 'Salvar nova versão', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Fechamento mensal', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Duplicar dashboard', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Fechamento mensal — cópia', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Seus dados', exact: true }).click();
  await page.locator('.source-list article').filter({ has: page.getByRole('heading', { name: 'Ciclo mensal', exact: true }) }).getByRole('button', { name: 'Qualidade e versões', exact: true }).click();
  await page.getByLabel('Arquivo novo', { exact: true }).setInputFiles({ name: 'novo.csv', mimeType: 'text/csv', buffer: Buffer.from('Valor;Data;Região\n300;2026-08;Sul\n400;2026-09;Norte') });
  await expect(page.getByRole('heading', { name: 'Conferir atualização' })).toBeVisible();
  await capture(page, 'source-update'); await accessible(page);
  await page.getByRole('button', { name: 'Confirmar atualização da fonte', exact: true }).click();
  await expect(page.locator('.source-manager')).toContainText('Versão 2');
  await page.getByRole('button', { name: 'Dashboards', exact: true }).click();
  await page.getByRole('button', { name: 'Fechamento mensal', exact: true }).click();
  await expect(page.locator('.saved-dashboard')).toContainText('700');
  await expect(page.locator('.recovery-notice')).toContainText('A fonte foi atualizada');
  await page.getByRole('button', { name: 'Histórico de versões', exact: true }).click();
  await page.getByRole('button', { name: 'Restaurar versão 1', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar restauração', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Valor por região', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Conferir relatório executivo', exact: true }).click();
  const frame = page.frameLocator('iframe[title="Prévia do relatório executivo"]');
  await expect(frame.getByText('Ciclo mensal', { exact: false }).first()).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Baixar relatório conferido', exact: true }).click();
  expect((await download).suggestedFilename()).toMatch(/relatório\.html$/);
  await page.locator('.executive-preview iframe').scrollIntoViewIfNeeded();
  await page.screenshot({ path: '.local/evolution-review/report-preview-visible.png' });
  await capture(page, 'report'); await accessible(page, true);
  const exported = await page.context().newPage();
  try { await exported.setContent((await page.locator('.executive-preview iframe').getAttribute('srcdoc'))!); await accessible(exported); }
  finally { await exported.close(); }
});

test('equipe compartilhada aplica leitura e revogação, sem perder isolamento pessoal', async ({ page, browser }) => {
  await register(page);
  await page.getByRole('button', { name: 'Equipe e operação', exact: true }).click();
  await page.getByRole('textbox', { name: 'Nome do espaço', exact: true }).fill('Equipe de fechamento');
  await page.getByRole('button', { name: 'Criar espaço', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Espaço de trabalho', exact: true })).toContainText('Equipe de fechamento');
  await page.getByRole('button', { name: 'Criar convite para o espaço', exact: true }).click();
  const code = await page.locator('#new-invite-code').inputValue();
  const workspace = (await (await page.request.get('/api/workspaces')).json()).workspaces.find((space: { name: string }) => space.name === 'Equipe de fechamento');
  const headers = { Origin: new URL(page.url()).origin, 'x-clara-workspace': workspace.id };
  const source = await (await page.request.post('/api/sources/sap', { headers, data: { domain: 'finance' } })).json();
  const draft = await (await page.request.post('/api/drafts', { headers, data: { sourceId: source.id, prompt: 'Compare despesas.' } })).json();
  await page.request.post(`/api/drafts/${draft.id}/save`, { headers, data: { revision: draft.revision, plan: draft.plan } });
  await capture(page, 'team'); await accessible(page);
  const context = await browser.newContext({ baseURL: String(test.info().project.use.baseURL), viewport: { width: 1440, height: 1000 } });
  try {
    const other = await context.newPage(); await register(other);
    await other.getByRole('button', { name: 'Equipe e operação', exact: true }).click();
    await other.getByRole('textbox', { name: 'Código do convite', exact: true }).fill(code);
    await other.getByRole('button', { name: 'Entrar no espaço', exact: true }).click();
    await other.getByRole('button', { name: 'Dashboards', exact: true }).click();
    await expect(other.locator('.report-list article')).toHaveCount(1);
    await expect(other.getByRole('button', { name: 'Criar dashboard', exact: true })).toHaveCount(0);
    const denied = await other.request.post('/api/sources/sap', { headers, data: { domain: 'sales' } }); expect(denied.status()).toBe(403);
    const member = (await (await other.request.get('/api/bootstrap', { headers })).json()).actor;
    const removed = await page.request.delete(`/api/workspaces/${workspace.id}/members/${member.id}`, { headers }); expect(removed.ok()).toBe(true);
    expect((await other.request.get('/api/bootstrap', { headers })).status()).toBe(404);
    await other.reload();
    await expect(other.getByRole('combobox', { name: 'Espaço de trabalho', exact: true })).toContainText('Meu espaço');
    await expect(other.locator('.report-list article')).toHaveCount(1);
    await expect(other.getByRole('banner').getByRole('button', { name: 'Criar dashboard', exact: true })).toBeVisible();
  } finally { await context.close(); }
});
