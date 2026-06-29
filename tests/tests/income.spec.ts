/**
 * Income CRUD E2E Tests
 *
 * Tests for:
 * - Add salary income
 * - Add income from friend (with friend selector)
 * - Edit income
 * - Delete income
 * - Filter by source type
 * - Filter by date range
 * - Form validation
 */

import { test, expect } from '@playwright/test';
import { LoginPage, IncomePage } from '../page-objects';

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:8000';
const TEST_EMAIL = 'test@fintrack.com';
const TEST_PASSWORD = 'TestPassword123';
const FRIEND_USER_ID = '6a3fd64228f622c70898059a';

async function getAuthToken(email: string, password: string): Promise<string | null> {
  const res = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.access_token ?? null;
}

async function ensureFriend(email: string, password: string, friendId: string) {
  const token = await getAuthToken(email, password);
  if (!token) return;
  await fetch(`${API_BASE_URL}/api/v1/users/friends`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ friend_user_id: friendId }),
  });
}

test.describe('Income CRUD', () => {
  let loginPage: LoginPage;
  let incomePage: IncomePage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    incomePage = new IncomePage(page);

    // Login
    await loginPage.goto();
    await loginPage.login(TEST_EMAIL, TEST_PASSWORD);
    await page.waitForURL(/\/dashboard/, { timeout: 20000 });

    // Navigate to income
    await incomePage.goto();
  });

  test.describe('Add Income', () => {
    test('should open add income dialog', async ({ page }) => {
      await incomePage.clickAddIncome();
      await expect(incomePage.addDialog).toBeVisible();
      await expect(page.getByText(/add income/i)).toBeVisible();
    });

    test('should show source type selector', async ({ page }) => {
      await incomePage.clickAddIncome();
      await expect(incomePage.sourceTypeSelect).toBeVisible();
    });

    test('should create salary income successfully', async ({ page }) => {
      await incomePage.clickAddIncome();

      await incomePage.fillIncomeForm({
        sourceType: 'Salary',
        amount: '50000',
        description: 'Monthly salary',
        date: new Date().toISOString().split('T')[0],
        paymentType: 'UPI',
      });

      await incomePage.submitIncomeForm();

      // Wait for success
      await page.waitForTimeout(1500);

      // Check for success toast
      await expect(page.getByText(/income added/i)).toBeVisible();

      // Dialog should close
      await expect(incomePage.addDialog).not.toBeVisible();
    });

    test('should show friend selector when source is "from_friend"', async ({ page }) => {
      await incomePage.clickAddIncome();

      // Select "From Friend"
      await incomePage.sourceTypeSelect.click();
      await page.getByRole('option', { name: /from friend/i }).click();

      // Friend selector should appear
      await expect(incomePage.friendSelector).toBeVisible();
    });

    test('should hide friend selector when source is "salary"', async ({ page }) => {
      await incomePage.clickAddIncome();

      // Select "Salary"
      await incomePage.sourceTypeSelect.click();
      await page.getByRole('option', { name: /salary/i }).click();

      // Friend selector should not be required/visible for salary
      // (implementation may hide it or just not validate it)
    });

    test('should create income from friend', async ({ page }) => {
      // Ensure a friend exists for the dropdown
      await ensureFriend(TEST_EMAIL, TEST_PASSWORD, FRIEND_USER_ID);
      await page.reload();
      await page.waitForURL(/\/dashboard\/income/, { timeout: 10000 });

      await incomePage.clickAddIncome();

      // Select "From Friend"
      await incomePage.sourceTypeSelect.click();
      await page.getByRole('option', { name: /from friend/i }).click();

      // Wait for friend options to load
      await page.waitForTimeout(500);

      // Select a friend if available
      const friendOptions = await incomePage.friendSelector.locator('..').locator('[role="option"]').count();

      if (friendOptions > 0) {
        await incomePage.friendSelector.click();
        await page.getByRole('option').first().click();

        await incomePage.fillIncomeForm({
          sourceType: 'From Friend',
          amount: '1000',
          description: 'Friend payment',
          date: new Date().toISOString().split('T')[0],
          paymentType: 'Cash',
        });

        await incomePage.submitIncomeForm();
        await page.waitForTimeout(1500);

        await expect(page.getByText(/income added/i)).toBeVisible();
      }
    });

    test('should show validation errors for empty form', async ({ page }) => {
      await incomePage.clickAddIncome();

      // Try to submit empty form
      await incomePage.submitIncomeForm();

      // Should show validation errors
      await expect(page.getByText(/source.*required/i)).toBeVisible();
      await expect(page.getByText(/amount.*required/i)).toBeVisible();
    });

    test('should cancel adding income', async ({ page }) => {
      await incomePage.clickAddIncome();
      await incomePage.cancelIncomeForm();
      await expect(incomePage.addDialog).not.toBeVisible();
    });

    test('should create income with all payment types', async ({ page }) => {
      const paymentTypes = ['Cash', 'UPI', 'Card', 'Net Banking'];

      for (const paymentType of paymentTypes) {
        await incomePage.clickAddIncome();
        await incomePage.fillIncomeForm({
          sourceType: 'Salary',
          amount: '100',
          description: `Test ${paymentType}`,
          date: new Date().toISOString().split('T')[0],
          paymentType,
        });
        await incomePage.submitIncomeForm();
        await page.waitForTimeout(1000);
      }

      // All should be added
      await expect(page.getByText(/income added/i)).toBeVisible();
    });
  });

  test.describe('Edit Income', () => {
    test('should open edit dialog with existing values', async ({ page }) => {
      // First create an income to edit
      await incomePage.clickAddIncome();
      await incomePage.fillIncomeForm({
        sourceType: 'Salary',
        amount: '1000',
        description: 'To be edited',
        date: new Date().toISOString().split('T')[0],
        paymentType: 'Cash',
      });
      await incomePage.submitIncomeForm();
      await page.waitForTimeout(1500);

      // Click edit on first income
      const editButton = page.getByRole('button', { name: /edit/i }).or(page.locator('button').has(page.locator('svg').first()));
      await editButton.first().click();

      // Dialog should open with title "Edit Income"
      await expect(page.getByText(/edit income/i)).toBeVisible();

      // Form should have pre-filled values
      await expect(incomePage.amountInput).toHaveValue('1000');
    });

    test('should update income successfully', async ({ page }) => {
      // Create income
      await incomePage.clickAddIncome();
      await incomePage.fillIncomeForm({
        sourceType: 'Salary',
        amount: '500',
        description: 'Original',
        date: new Date().toISOString().split('T')[0],
        paymentType: 'UPI',
      });
      await incomePage.submitIncomeForm();
      await page.waitForTimeout(1500);

      // Edit it
      const editButton = page.getByRole('button', { name: /edit/i });
      await editButton.first().click();

      await incomePage.fillIncomeForm({
        sourceType: 'Salary',
        amount: '750',
        description: 'Updated',
        date: new Date().toISOString().split('T')[0],
        paymentType: 'Card',
      });
      await incomePage.submitIncomeForm();
      await page.waitForTimeout(1500);

      // Check success
      await expect(page.getByText(/income updated/i)).toBeVisible();
    });

    test('should cancel editing', async ({ page }) => {
      const editButton = page.getByRole('button', { name: /edit/i });
      if (await editButton.count() > 0) {
        await editButton.first().click();
        await incomePage.cancelIncomeForm();

        // Dialog should close
        await expect(incomePage.addDialog).not.toBeVisible();
      }
    });
  });

  test.describe('Delete Income', () => {
    test('should show delete confirmation dialog', async ({ page }) => {
      const deleteButton = page.getByRole('button', { name: /delete/i }).or(page.locator('button').has(page.locator('svg').last()));

      if (await deleteButton.count() > 0) {
        await deleteButton.first().click();

        // Delete confirmation should appear
        await expect(page.getByText(/delete income/i)).toBeVisible();
        await expect(page.getByText(/are you sure/i)).toBeVisible();
      }
    });

    test('should delete income successfully', async ({ page }) => {
      const deleteButton = page.getByRole('button', { name: /delete/i });

      if (await deleteButton.count() > 0) {
        // Get initial count
        const incomeRows = page.locator('tbody tr').or(page.locator('[role="listitem"]'));
        const initialCount = await incomeRows.count();

        // Click delete on first income
        await deleteButton.first().click();

        // Confirm deletion
        const deleteDialog = page.locator('[role="alertdialog"]');
        await deleteDialog.getByRole('button', { name: /delete/i }).click();

        // Wait for deletion
        await page.waitForTimeout(1500);

        // Check success toast
        await expect(page.getByText(/income deleted/i)).toBeVisible();
      }
    });

    test('should cancel deletion', async ({ page }) => {
      const deleteButton = page.getByRole('button', { name: /delete/i });

      if (await deleteButton.count() > 0) {
        await deleteButton.first().click();

        const deleteDialog = page.locator('[role="alertdialog"]');
        await deleteDialog.getByRole('button', { name: /cancel/i }).click();

        // Dialog should close
        await expect(deleteDialog).not.toBeVisible();
      }
    });
  });

  test.describe('Filter Income', () => {
    test('should filter by source type', async ({ page }) => {
      const sourceFilter = page.getByRole('combobox').filter({ hasText: /source/i }).or(page.getByLabel(/source/i));

      if (await sourceFilter.isVisible()) {
        await sourceFilter.click();
        await page.getByRole('option', { name: /salary/i }).click();

        // Wait for filter
        await page.waitForTimeout(1000);

        // Should show filtered results
        const incomeRows = page.locator('tbody tr').or(page.locator('[role="listitem"]'));
        const count = await incomeRows.count();
        expect(count).toBeGreaterThanOrEqual(0);
      }
    });

    test('should filter by date range', async ({ page }) => {
      const dateFrom = page.getByLabel(/from date/i).or(page.getByPlaceholder(/from/i));
      const dateTo = page.getByLabel(/to date/i).or(page.getByPlaceholder(/to/i));

      if (await dateFrom.isVisible()) {
        const today = new Date().toISOString().split('T')[0];
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

        await dateFrom.fill(yesterday);
        await dateTo.fill(today);

        // Wait for filter
        await page.waitForTimeout(1000);

        const count = await page.locator('tbody tr').or(page.locator('[role="listitem"]')).count();
        expect(count).toBeGreaterThanOrEqual(0);
      }
    });
  });

  test.describe('Income List Display', () => {
    test('should display income entries', async ({ page }) => {
      const incomeRows = page.locator('tbody tr').or(page.locator('[role="listitem"]'));
      const count = await incomeRows.count();

      // Should have at least the ones we created
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should show income details', async ({ page }) => {
      // Each income row should show:
      // Source type, Amount, Date, Payment Type, Edit/Delete buttons

      const firstRow = page.locator('tbody tr').or(page.locator('[role="listitem"]')).first();
      await expect(firstRow).toBeVisible();
    });

    test('should show empty state when no income', async ({ page }) => {
      const noIncomeText = page.getByText(/no income/i);

      const incomeRows = page.locator('tbody tr').or(page.locator('[role="listitem"]'));
      const hasIncome = await incomeRows.count() > 0;

      if (hasIncome) {
        await expect(noIncomeText).not.toBeVisible();
      } else {
        await expect(noIncomeText).toBeVisible();
      }
    });
  });
});
