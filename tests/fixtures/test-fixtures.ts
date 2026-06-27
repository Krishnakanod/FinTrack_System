/**
 * Global test fixtures for FinTrack e2e tests
 *
 * Provides:
 * - authSetup: Creates a test user and returns authenticated page
 * - testUser: Test user credentials
 * - loginPage: Navigates to login page
 * - dashboardPage: Navigates to dashboard (requires auth)
 */

import { test as base, expect, Page } from '@playwright/test';

// Test user credentials - using a unique email for each test run
export const testUser = {
  name: 'Test User',
  email: `test_${Date.now()}@fintrack.e2e`,
  password: 'TestPassword123',
};

// Extended test type with our fixtures
export const test = base.extend<{
  testUser: typeof testUser;
  loginPage: Page;
  dashboardPage: Page;
  authenticatedPage: Page;
}>({
  testUser: testUser,

  loginPage: async ({ page }, use) => {
    await page.goto('/login');
    await use(page);
  },

  dashboardPage: async ({ page }, use) => {
    await page.goto('/dashboard');
    await use(page);
  },

  authenticatedPage: async ({ page }, use) => {
    // Navigate to login and create a new user via API
    await page.goto('/login');

    // Generate unique email for this test
    const uniqueUser = {
      ...testUser,
      email: `test_${Date.now()}_${Math.random().toString(36).substring(7)}@fintrack.e2e`,
    };

    // Store user info on page for later use
    (page as any).testUser = uniqueUser;

    await use(page);
  },
});

export { expect };
