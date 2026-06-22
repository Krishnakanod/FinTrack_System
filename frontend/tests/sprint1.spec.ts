import { test, expect } from '@playwright/test';

test('Verify login page loads', async ({ page }) => {
  await page.goto('http://localhost:3001');
  await expect(page).toHaveTitle(/FinTrack/);
  await expect(page.getByPlaceholder('Email')).toBeVisible();
  await expect(page.getByPlaceholder('Password')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Login' })).toBeVisible();
});

test('Verify dashboard navigation after login', async ({ page }) => {
  // Assuming login is handled via API for test efficiency
  await page.route('**/api/auth/login', route => route.fulfill({
    status: 200,
    body: JSON.stringify({ token: 'test-token', user: { id: '1', name: 'Test User' } })
  }));

  await page.goto('http://localhost:3001/login');
  await page.fill('input[name="email"]', 'test@example.com');
  await page.fill('input[name="password"]', 'password');
  await page.click('button:has-text("Login")');

  // Verify navigation to dashboard
  await page.waitForURL('**/dashboard');
  await expect(page.getByText('Welcome, Test User')).toBeVisible();
  await expect(page.getByRole('navigation').getByRole('link', { name: 'Transactions' })).toBeVisible();
});