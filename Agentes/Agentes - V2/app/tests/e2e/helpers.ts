import type { Page } from '@playwright/test';
import { test } from '@playwright/test';

/** The demo account is shared by design. Reset its durable work before each independent scenario. */
export async function resetDemo(page: Page) {
  const origin = String(test.info().project.use.baseURL);
  const headers = { Origin: origin };
  const login = await page.request.post('/api/auth/login', { data: { mode: 'demo' }, headers });
  if (!login.ok()) throw new Error('Could not prepare demo account');
  const work = await (await page.request.get('/api/work')).json();
  const clear = await page.request.post('/api/work', { data: { revision: work.revision, state: null }, headers });
  if (!clear.ok()) throw new Error('Could not isolate durable work');
  await page.request.post('/api/auth/logout', { headers });
}
