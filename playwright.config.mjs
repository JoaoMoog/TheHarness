import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e', fullyParallel: true, forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0, workers: process.env.CI ? 2 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL:'http://127.0.0.1:4177', screenshot:'only-on-failure', trace:'on-first-retry' },
  webServer: { command:'node tests/e2e/server.mjs', url:'http://127.0.0.1:4177/ciclo-passo-a-passo.html', reuseExistingServer:false, timeout:15000 },
  projects:[
    { name:'chromium', use:{...devices['Desktop Chrome']} },
    { name:'firefox', use:{...devices['Desktop Firefox']} },
    { name:'webkit', use:{...devices['Desktop Safari']} }
  ]
});
