import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3003';

// Mock API and auth before each test
test.beforeEach(async ({ page }) => {
  // Mock all API endpoints
  await page.route('/api/v1/**', async (route) => {
    const url = route.request().url();
    const method = route.request().method();

    if (url.includes('/expenses') || url.includes('/income')) {
      if (method === 'GET') {
        await route.fulfill({ json: { items: [], total: 0 } });
      } else if (method === 'DELETE') {
        await route.fulfill({ status: 204 });
      } else {
        await route.fulfill({ status: 200, json: { id: '1' } });
      }
      return;
    }
    await route.continue();
  });

  // Inject auth state synchronously before any script runs
  await page.addInitScript(() => {
    // Set localStorage
    window.localStorage.setItem('fintrack-auth', JSON.stringify({
      state: { user: { id: 'test-id', email: 'test@example.com', name: 'Test User', avatar_url: null } },
      version: 0,
    }));
  });
});

test.describe('Income Page', () => {
  test('loads and shows heading', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/income`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: 'Income' })).toBeVisible({ timeout: 10000 });
  });

  test('add dialog opens', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/income`);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Add Income' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('form fields are present', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/income`);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Add Income' }).click();
    await expect(page.getByLabel('Source Type *')).toBeVisible();
    await expect(page.getByLabel('Amount (₹) *')).toBeVisible();
    await expect(page.getByLabel('Date *')).toBeVisible();
  });

  test('source type toggle works', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/income`);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Add Income' }).click();
    await expect(page.getByRole('button', { name: 'Salary' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'From Friend' })).toBeDisabled();
  });

  test('date defaults to today', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/income`);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Add Income' }).click();
    await expect(page.getByLabel('Date *')).toHaveValue(/\d{4}-\d{2}-\d{2}/);
  });

  test('amount field accepts decimals', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/income`);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Add Income' }).click();
    const amountInput = page.getByLabel('Amount (₹) *');
    await amountInput.fill('1234.56');
    await expect(amountInput).toHaveValue('1234.56');
  });
});
