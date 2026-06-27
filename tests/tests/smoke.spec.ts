/**
 * Smoke Test - Basic health check
 */

import { test, expect } from '@playwright/test';

test('homepage loads and redirects to login', async ({ page }) => {
  await page.goto('/');

  // Should redirect to login or show FinTrack branding
  await expect(page.locator('h1').or(page.locator('[class*="logo"]'))).toBeVisible();
});

test('backend health check', async ({ page }) => {
  const response = await page.request.get('http://localhost:8000/health');
  expect(response.ok()).toBe(true);

  const body = await response.json();
  expect(body.status).toBe('ok');
});
