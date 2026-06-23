import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  use: {
    baseURL: 'http://localhost:3001',
    headless: true,
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
  },
  // Disable webServer since we're running the dev server manually
  // webServer: {
  //   command: 'npm run dev',
  //   url: 'http://localhost:3003',
  //   reuseExistingServer: !process.env.CI,
  //   timeout: 120 * 1000,
  // },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});