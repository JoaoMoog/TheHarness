import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const result = spawnSync(process.execPath, [resolve(root, 'node_modules/@playwright/test/cli.js'), 'test', ...process.argv.slice(2)], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, PWTEST_CACHE_DIR: process.env.PWTEST_CACHE_DIR || resolve(root, '.local/playwright-cache') },
});
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
