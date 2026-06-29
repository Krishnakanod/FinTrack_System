import { test, expect } from '@playwright/test';

test.describe('Budgets', () => {
  test('can create, view, update, and delete budgets', async ({ page }) => {
    // Login as test user
    await page.goto('/login');
    await page.locator('input[name="email"]').fill('test@example.com');
    await page.locator('input[name="password"]').fill('Password123!');
    await page.locator('button[type="submit"]').click();

    // Wait for dashboard to load
    await expect(page).toHaveURL(/\/dashboard/);

    // Navigate to budget page
    await page.getByRole('link', { name: 'Budgets' }).click();

    // Create a new budget
    await page.getByRole('button', { name: 'Set Budget' }).click();

    await page.locator('select[name="category"]').selectOption('Food');
    await page.locator('select[name="period"]').selectOption('monthly');
    await page.locator('input[name="amount"]').fill('5000');

    await page.getByRole('button', { name: 'Set Budget' }).click();

    // Verify budget was created
    await expect(page.getByText('Budget created successfully')).toBeVisible();
    await expect(page.getByText('Food')).toBeVisible();
    await expect(page.getByText('₹5,000.00')).toBeVisible();

    // Update the budget
    await page.getByRole('button', { name: 'Edit Budget' }).click();

    await page.locator('input[name="amount"]').fill('6000');
    await page.getByRole('button', { name: 'Update Budget' }).click();

    // Verify budget was updated
    await expect(page.getByText('Budget updated successfully')).toBeVisible();
    await expect(page.getByText('₹6,000.00')).toBeVisible();

    // Delete the budget
    await page.getByRole('button', { name: 'Delete Budget' }).click();
    await page.getByRole('button', { name: 'Delete' }).click();

    // Verify budget was deleted
    await expect(page.getByText('Budget deleted successfully')).toBeVisible();
    await expect(page.getByText('No budgets set yet')).toBeVisible();
  });
});

test.describe('Notifications', () => {
  test('can view notifications and mark as read', async ({ page }) => {
    // Login as test user
    await page.goto('/login');
    await page.locator('input[name="email"]').fill('test@example.com');
    await page.locator('input[name="password"]').fill('Password123!');
    await page.locator('button[type="submit"]').click();

    // Wait for dashboard to load
    await expect(page).toHaveURL(/\/dashboard/);

    // Navigate to notifications via header
    await page.getByRole('button', { name: 'Notifications' }).click();

    // Verify notifications dropdown opens
    await expect(page.getByText('Notifications')).toBeVisible();

    // Test marking notification as read (if any exist)
    const notificationItems = await page.locator('.notification-item').all();
    if (notificationItems.length > 0) {
      const firstNotification = notificationItems[0];
      await firstNotification.getByRole('button', { name: 'Mark as read' }).click();

      // Verify notification was marked as read
      await expect(firstNotification).toHaveClass(/read/);
    }

    // Test marking all as read
    await page.getByRole('button', { name: 'Mark all read' }).click();

    // Verify all notifications are marked as read
    await expect(page.getByText('All notifications marked as read')).toBeVisible();
  });
});