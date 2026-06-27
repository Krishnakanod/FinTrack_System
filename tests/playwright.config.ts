import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for FinTrack e2e tests
 *
 * Usage:
 *   npx playwright test                    # Run all tests
 *   npx playwright test --project=chromium # Run specific project
 *   npx playwright test --grep "login"     # Run tests matching "login"
 *   npx playwright test --debug            # Debug mode with UI
 *   npx playwright test --ui               # Open UI mode
 */
export default defineConfig({
  testDir: './tests',
  outputDir: './test-results',
  timeout: 60000,
  expect: {
    timeout: 5000,
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 1,
  reporter: [
    ['html', { outputFolder: './playwright-report' }],
    ['list'],
  ],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    headless: true,
    viewport: { width: 1280, height: 720 },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
  webServer: {
    command: 'cd ../frontend && npm run dev',
    port: 3000,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
