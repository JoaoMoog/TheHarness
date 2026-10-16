import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
const installedBrowsers = process.platform === 'win32'
  ? [join(process.env.ProgramFiles || 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'), join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe')]
  : ['/usr/bin/chromium'];
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || installedBrowsers.find(path => existsSync(path));
export default defineConfig({
  testDir: './tests/e2e', workers: 1, timeout: 45000,
  use: { baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000', viewport: { width: 1440, height: 1000 }, launchOptions: { ...(executablePath ? { executablePath } : {}), args: ['--no-sandbox'] }, trace: 'retain-on-failure' },
  reporter: 'list',
});
