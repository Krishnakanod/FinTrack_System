import { test, expect } from '@playwright/test';

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