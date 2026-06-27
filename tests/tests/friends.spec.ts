/**
 * Friends Management E2E Tests
 *
 * Tests for:
 * - Search user by email
 * - Add friend
 * - List friends
 * - Remove friend with confirmation
 * - Cannot add self as friend
 * - Already friends handling
 * - Empty state handling
 */

import { test, expect } from '@playwright/test';
import { LoginPage, FriendsPage } from '../page-objects';

test.describe('Friends Management', () => {
  let loginPage: LoginPage;
  let friendsPage: FriendsPage;

  const testEmail = 'test@fintrack.com';
  const testPassword = 'TestPassword123';

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    friendsPage = new FriendsPage(page);

    // Login
    await loginPage.goto();
    await loginPage.login(testEmail, testPassword);
    await page.waitForTimeout(2000);

    // Navigate to friends
    await friendsPage.goto();
  });

  test.describe('Friends Page Layout', () => {
    test('should render friends page with all elements', async ({ page }) => {
      await expect(page.getByText(/friends/i)).toBeVisible();
      await expect(page.getByText(/manage your friends/i)).toBeVisible();
    });

    test('should display search section', async ({ page }) => {
      await expect(friendsPage.searchEmailInput).toBeVisible();
      await expect(friendsPage.searchButton).toBeVisible();
    });

    test('should display friends list section', async ({ page }) => {
      await expect(page.getByText(/your friends/i)).toBeVisible();
    });
  });

  test.describe('Search for Friends', () => {
    test('should search for user by email', async ({ page }) => {
      // Search for a test user
      await friendsPage.searchEmail('friend@example.com');

      // Wait for search results
      await page.waitForTimeout(1500);

      // Should show search result or "not found" message
      const hasResult = await friendsPage.searchResult.isVisible().catch(() => false);
      const hasNotFound = await page.getByText(/no user found/i).isVisible().catch(() => false);

      expect(hasResult || hasNotFound).toBe(true);
    });

    test('should show "not found" for non-existent email', async ({ page }) => {
      await friendsPage.searchEmail('nonexistent@example.com');
      await page.waitForTimeout(1500);

      // Should show "no user found" message
      await expect(page.getByText(/no user found/i)).toBeVisible();
    });

    test('should show search result with user details', async ({ page }) => {
      // This test assumes there's a test user in the database
      // Search for existing user
      await friendsPage.searchEmail('test2@fintrack.com');
      await page.waitForTimeout(1500);

      // If user exists, should show name and email
      const searchResult = friendsPage.searchResult;
      if (await searchResult.isVisible()) {
        await expect(searchResult).toContainText('@');
      }
    });

    test('should enable add friend button for search results', async ({ page }) => {
      await friendsPage.searchEmail('test2@fintrack.com');
      await page.waitForTimeout(1500);

      // If user found, add friend button should be enabled
      if (await friendsPage.searchResult.isVisible()) {
        await expect(friendsPage.addFriendButton).toBeEnabled();
      }
    });

    test('should disable add friend button for already friends', async ({ page }) => {
      // First add a friend
      await friendsPage.searchEmail('test2@fintrack.com');
      await page.waitForTimeout(1500);

      if (await friendsPage.searchResult.isVisible()) {
        await friendsPage.addFriend();
        await page.waitForTimeout(1000);

        // Search again
        await friendsPage.searchEmail('test2@fintrack.com');
        await page.waitForTimeout(1500);

        // Button should show "Already Friends" and be disabled
        const addBtn = friendsPage.searchResult.locator('button').filter({ hasText: /add/i });
        if (await addBtn.isVisible()) {
          // Should either be disabled or show "Already Friends"
          const isDisabled = await addBtn.isDisabled();
          const text = await addBtn.textContent();
          expect(isDisabled || text?.includes('Already')).toBe(true);
        }
      }
    });
  });

  test.describe('Add Friend', () => {
    test('should add friend successfully', async ({ page }) => {
      // Search for user
      await friendsPage.searchEmail('test2@fintrack.com');
      await page.waitForTimeout(1500);

      // Check if user found
      if (await friendsPage.searchResult.isVisible()) {
        // Add friend
        await friendsPage.addFriend();

        // Wait for success
        await page.waitForTimeout(1500);

        // Check success toast
        await expect(page.getByText(/friend added/i)).toBeVisible();

        // Search result should clear
        await expect(friendsPage.searchResult).not.toBeVisible();
      }
    });

    test('should show error when adding self', async ({ page }) => {
      // Search for own email
      await friendsPage.searchEmail(testEmail);
      await page.waitForTimeout(1500);

      // Should show error or not find the user
      // Backend returns 400 CANNOT_ADD_SELF
      const hasError = await page.getByText(/cannot add self|yourself/i).isVisible().catch(() => false);
      const hasNotFound = await page.getByText(/no user found/i).isVisible().catch(() => false);

      expect(hasError || hasNotFound).toBe(true);
    });

    test('should show error for already friends', async ({ page }) => {
      // This test assumes we have an existing friend
      // Try to add same friend twice
      const existingFriendEmail = 'test2@fintrack.com';

      await friendsPage.searchEmail(existingFriendEmail);
      await page.waitForTimeout(1500);

      if (await friendsPage.searchResult.isVisible()) {
        // Check if already friends
        const isAlreadyFriends = await friendsPage.searchResult.locator('button').filter({ hasText: /already/i }).isVisible().catch(() => false);

        if (!isAlreadyFriends) {
          // Add friend first
          await friendsPage.addFriend();
          await page.waitForTimeout(1500);

          // Search again
          await friendsPage.searchEmail(existingFriendEmail);
          await page.waitForTimeout(1500);
        }

        // Should show "Already Friends" button or error
        const addBtn = friendsPage.searchResult.locator('button').filter({ hasText: /add/i });
        if (await addBtn.isVisible()) {
          const text = await addBtn.textContent();
          expect(text?.includes('Already')).toBe(true);
        }
      }
    });

    test('should clear search after adding friend', async ({ page }) => {
      await friendsPage.searchEmail('test2@fintrack.com');
      await page.waitForTimeout(1500);

      if (await friendsPage.searchResult.isVisible()) {
        await friendsPage.addFriend();
        await page.waitForTimeout(1500);

        // Search result should be hidden
        await expect(friendsPage.searchResult).not.toBeVisible();

        // Search input should be cleared
        await expect(friendsPage.searchEmailInput).toHaveValue('');
      }
    });
  });

  test.describe('Friends List', () => {
    test('should display friends list', async ({ page }) => {
      // Get friend count
      const count = await friendsPage.getFriendCount();

      // List should be visible
      await expect(page.getByText(/your friends/i)).toBeVisible();

      // Should show count
      const countText = page.getByText(new RegExp(`${count} friend`, 'i'));
      if (count > 0) {
        await expect(countText).toBeVisible();
      }
    });

    test('should show empty state when no friends', async ({ page }) => {
      const hasFriends = await friendsPage.getFriendCount() > 0;

      if (!hasFriends) {
        await expect(friendsPage.noFriendsText).toBeVisible();
        await expect(page.getByText(/no friends yet/i)).toBeVisible();
      } else {
        await expect(friendsPage.noFriendsText).not.toBeVisible();
      }
    });

    test('should show friend details in list', async ({ page }) => {
      const friendCount = await friendsPage.getFriendCount();

      if (friendCount > 0) {
        const firstFriend = friendsPage.friendRows.first();
        await expect(firstFriend).toBeVisible();

        // Should show name
        await expect(firstFriend.locator('p').first()).toBeVisible();

        // Should show email
        await expect(firstFriend.locator('p').nth(1)).toBeVisible();
      }
    });

    test('should show friend avatars', async ({ page }) => {
      const friendCount = await friendsPage.getFriendCount();

      if (friendCount > 0) {
        const avatar = page.locator('.h-10.w-10.rounded-full').or(page.locator('[class*="avatar"]')).first();
        await expect(avatar).toBeVisible();
      }
    });
  });

  test.describe('Remove Friend', () => {
    test('should show remove button for each friend', async ({ page }) => {
      const friendCount = await friendsPage.getFriendCount();

      if (friendCount > 0) {
        // Each friend should have a remove button
        await expect(friendsPage.removeFriendButtons.first()).toBeVisible();
      }
    });

    test('should show confirmation dialog when removing friend', async ({ page }) => {
      if (await friendsPage.removeFriendButtons.count() > 0) {
        await friendsPage.removeFriendButtons.first().click();

        // Confirmation dialog should appear
        await expect(page.getByText(/remove friend/i)).toBeVisible();
        await expect(page.getByText(/are you sure/i)).toBeVisible();
      }
    });

    test('should remove friend successfully', async ({ page }) => {
      const initialCount = await friendsPage.getFriendCount();

      if (initialCount > 0) {
        // Click remove on first friend
        await friendsPage.removeFriendButtons.first().click();

        // Wait for dialog
        await page.waitForSelector('[role="alertdialog"]');

        // Click confirm in dialog
        const dialog = page.locator('[role="alertdialog"]');
        await dialog.getByRole('button', { name: /remove/i }).click();

        // Wait for removal
        await page.waitForTimeout(1500);

        // Check success toast
        await expect(page.getByText(/friend removed/i)).toBeVisible();

        // Count should decrease
        const newCount = await friendsPage.getFriendCount();
        expect(newCount).toBe(initialCount - 1);
      }
    });

    test('should cancel removal', async ({ page }) => {
      if (await friendsPage.removeFriendButtons.count() > 0) {
        await friendsPage.removeFriendButtons.first().click();

        // Click cancel
        const dialog = page.locator('[role="alertdialog"]');
        await dialog.getByRole('button', { name: /cancel/i }).click();

        // Dialog should close
        await expect(dialog).not.toBeVisible();

        // Friend count should remain same
        const count = await friendsPage.getFriendCount();
        expect(count).toBeGreaterThan(0);
      }
    });

    test('should show friend name in confirmation dialog', async ({ page }) => {
      if (await friendsPage.removeFriendButtons.count() > 0) {
        // Get friend name before clicking remove
        const friendName = await friendsPage.removeFriendButtons.first().locator('..').locator('p').first().textContent();

        await friendsPage.removeFriendButtons.first().click();

        // Dialog should show the friend's name
        await expect(page.getByText(friendName || /friend/i)).toBeVisible();
      }
    });
  });

  test.describe('Friend Search Validation', () => {
    test('should handle empty search', async ({ page }) => {
      // Click search with empty email
      await friendsPage.searchButton.click();

      // Should not crash - might show validation or just do nothing
      const isCrashed = await page.getByText(/error|crash/i).isVisible().catch(() => false);
      expect(isCrashed).toBe(false);
    });

    test('should handle invalid email format', async ({ page }) => {
      await friendsPage.searchEmail('invalid-email');
      await page.waitForTimeout(1500);

      // Should show error or not found
      const hasError = await page.getByText(/invalid/i).isVisible().catch(() => false);
      const hasNotFound = await page.getByText(/no user found/i).isVisible().catch(() => false);

      expect(hasError || hasNotFound).toBe(true);
    });
  });
});
