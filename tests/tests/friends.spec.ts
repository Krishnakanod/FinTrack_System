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

// Test user and friend constants for Sprint 6 E2E tests.
const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:8000';
const TEST_EMAIL = 'test@fintrack.com';
const TEST_PASSWORD = 'TestPassword123';
const FRIEND_USER_ID = '6a3fd64228f622c70898059a';
const FRIEND_EMAIL = 'test2@fintrack.com';

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

async function removeAllFriends(email: string, password: string) {
  const token = await getAuthToken(email, password);
  if (!token) return;
  const res = await fetch(`${API_BASE_URL}/api/v1/users/friends`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return;
  const data = await res.json();
  for (const friend of (data as { items: { id: string }[] }).items) {
    await fetch(`${API_BASE_URL}/api/v1/users/friends/${friend.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
  }
}

async function waitForFriendsList(page: any) {
  await expect(page.getByTestId('friends-list').or(page.getByTestId('no-friends-message'))).toBeVisible({ timeout: 10000 });
}

async function setFriendshipState(email: string, password: string, friendId: string, isFriend: boolean) {
  const token = await getAuthToken(email, password);
  if (!token) return;

  if (isFriend) {
    await fetch(`${API_BASE_URL}/api/v1/users/friends`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ friend_user_id: friendId }),
    });
  } else {
    await fetch(`${API_BASE_URL}/api/v1/users/friends/${friendId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
  }
}

test.describe('Friends Management', () => {
  let loginPage: LoginPage;
  let friendsPage: FriendsPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    friendsPage = new FriendsPage(page);

    // Ensure a clean friendship state before each test.
    await removeAllFriends(TEST_EMAIL, TEST_PASSWORD);

    // Login
    await loginPage.goto();
    await loginPage.login(TEST_EMAIL, TEST_PASSWORD);

    // Wait for the dashboard to finish loading after login.
    await page.waitForURL(/\/dashboard/, { timeout: 20000 });

    // Navigate to friends
    await friendsPage.goto();
  });

  test.describe('Friends Page Layout', () => {
    test('should render friends page with all elements', async ({ page }) => {
      await expect(page.getByTestId('friends-heading')).toHaveText('Friends');
      await expect(page.getByTestId('friends-subtitle')).toHaveText(/Manage your friends list/i);
    });

    test('should display search section', async ({ page }) => {
      await expect(friendsPage.searchEmailInput).toBeVisible();
      await expect(friendsPage.searchButton).toBeVisible();
    });

    test('should display friends list section', async ({ page }) => {
      await expect(page.getByTestId('friends-list-title')).toHaveText('Your Friends');
    });
  });

  test.describe('Search for Friends', () => {
    test('should search for user by email', async ({ page }) => {
      // Search for a test user
      await friendsPage.searchEmail('friend@example.com');

      // Should show search result or "not found" message
      await expect(
        friendsPage.searchResult.or(page.getByTestId('friend-not-found'))
      ).toBeVisible({ timeout: 5000 });
    });

    test('should show "not found" for non-existent email', async ({ page }) => {
      await friendsPage.searchEmail('nonexistent@example.com');
      await expect(page.getByTestId('friend-not-found')).toBeVisible({ timeout: 5000 });
    });

    test('should show search result with user details', async ({ page }) => {
      await friendsPage.searchEmail(FRIEND_EMAIL);
      await expect(friendsPage.searchResult).toContainText('@', { timeout: 5000 });
    });

    test('should enable add friend button for search results', async ({ page }) => {
      await friendsPage.searchEmail(FRIEND_EMAIL);
      await expect(friendsPage.searchResult).toBeVisible({ timeout: 5000 });
      await expect(friendsPage.addFriendButton).toBeEnabled();
    });

    test('should disable add friend button for already friends', async ({ page }) => {
      // Ensure test2 is a friend first
      await friendsPage.searchEmail(FRIEND_EMAIL);
      await expect(friendsPage.searchResult).toBeVisible({ timeout: 5000 });

      const addBtn = friendsPage.addFriendButton;
      if ((await addBtn.textContent())?.includes('Already')) {
        await expect(addBtn).toBeDisabled();
      } else {
        await friendsPage.addFriend();
        await expect(page.getByText(/friend added/i)).toBeVisible({ timeout: 5000 });
        // Search again
        await friendsPage.searchEmail(FRIEND_EMAIL);
        await expect(friendsPage.searchResult).toBeVisible({ timeout: 5000 });
        await expect(addBtn).toHaveText('Already Friends');
        await expect(addBtn).toBeDisabled();
      }
    });
  });

  test.describe('Add Friend', () => {
    test('should add friend successfully', async ({ page }) => {
      await friendsPage.searchEmail(FRIEND_EMAIL);
      await expect(friendsPage.searchResult).toBeVisible({ timeout: 5000 });

      // Add friend
      await friendsPage.addFriend();

      // Check success toast
      await expect(page.getByText(/friend added/i)).toBeVisible({ timeout: 5000 });

      // Search result should clear
      await expect(friendsPage.searchResult).toBeHidden();
    });

    test('should show error when adding self', async ({ page }) => {
      await friendsPage.searchEmail(TEST_EMAIL);
      await expect(friendsPage.searchResult).toBeVisible({ timeout: 5000 });

      // Click Add Friend on own profile; backend should reject with CANNOT_ADD_SELF
      await friendsPage.addFriendButton.click();
      await expect(page.getByText(/cannot add yourself/i)).toBeVisible({ timeout: 5000 });
    });

    test('should show error for already friends', async ({ page }) => {
      // Ensure test2 is already a friend
      await friendsPage.searchEmail(FRIEND_EMAIL);
      await expect(friendsPage.searchResult).toBeVisible({ timeout: 5000 });

      const addBtn = friendsPage.addFriendButton;
      if (!(await addBtn.textContent())?.includes('Already')) {
        await friendsPage.addFriend();
        await expect(page.getByText(/friend added/i)).toBeVisible({ timeout: 5000 });
        await friendsPage.searchEmail(FRIEND_EMAIL);
        await expect(friendsPage.searchResult).toBeVisible({ timeout: 5000 });
      }

      await expect(addBtn).toHaveText('Already Friends');
      await expect(addBtn).toBeDisabled();
    });

    test('should clear search after adding friend', async ({ page }) => {
      await friendsPage.searchEmail(FRIEND_EMAIL);
      await expect(friendsPage.searchResult).toBeVisible({ timeout: 5000 });

      await friendsPage.addFriend();
      await expect(page.getByText(/friend added/i)).toBeVisible({ timeout: 5000 });

      // Search result should be hidden
      await expect(friendsPage.searchResult).toBeHidden();

      // Search input should be cleared
      await expect(friendsPage.searchEmailInput).toHaveValue('');
    });
  });

  test.describe('Friends List', () => {
    test('should display friends list', async ({ page }) => {
      const count = await friendsPage.getFriendCount();

      // List title visible
      await expect(page.getByTestId('friends-list-title')).toHaveText('Your Friends');

      // Should show count in description
      if (count > 0) {
        await expect(page.getByText(`${count} friend`)).toBeVisible();
      }
    });

    test('should show empty state when no friends', async ({ page }) => {
      const hasFriends = await friendsPage.getFriendCount() > 0;

      if (!hasFriends) {
        await expect(friendsPage.noFriendsText).toBeVisible();
        await expect(page.getByText(/no friends yet/i)).toBeVisible();
      } else {
        await expect(friendsPage.noFriendsText).toBeHidden();
      }
    });

    test('should show friend details in list', async ({ page }) => {
      // Ensure a friend exists
      await setFriendshipState(TEST_EMAIL, TEST_PASSWORD, FRIEND_USER_ID, true);
      await page.reload();
      await page.waitForURL(/\/dashboard\/friends/, { timeout: 10000 });
      await waitForFriendsList(page);

      const firstFriend = friendsPage.friendRows.first();
      await expect(firstFriend).toBeVisible();

      // Should show name and email
      await expect(firstFriend.locator('p').first()).toBeVisible();
      await expect(firstFriend.locator('p').nth(1)).toBeVisible();
    });

    test('should show friend avatars', async ({ page }) => {
      // Ensure a friend exists
      await setFriendshipState(TEST_EMAIL, TEST_PASSWORD, FRIEND_USER_ID, true);
      await page.reload();
      await page.waitForURL(/\/dashboard\/friends/, { timeout: 10000 });
      await waitForFriendsList(page);

      const avatar = page.locator('.h-10.w-10.rounded-full').or(page.locator('[class*="avatar"]')).first();
      await expect(avatar).toBeVisible();
    });
  });

  test.describe('Remove Friend', () => {
    // Ensure a friend exists before each remove-friend test.
    test.beforeEach(async ({ page }) => {
      await setFriendshipState(TEST_EMAIL, TEST_PASSWORD, FRIEND_USER_ID, true);
      await page.reload();
      await page.waitForURL(/\/dashboard\/friends/, { timeout: 10000 });
      await waitForFriendsList(page);
    });

    test('should show remove button for each friend', async ({ page }) => {
      // Each friend should have a remove button
      await expect(friendsPage.removeFriendButtons.first()).toBeVisible();
    });

    test('should show confirmation dialog when removing friend', async ({ page }) => {
      await friendsPage.removeFriendButtons.first().click();

      // Confirmation dialog should appear
      await expect(page.getByRole('heading', { name: 'Remove Friend' })).toBeVisible();
      await expect(page.getByText(/are you sure/i)).toBeVisible();
    });

    test('should remove friend successfully', async ({ page }) => {
      const initialCount = await friendsPage.getFriendCount();
      expect(initialCount).toBeGreaterThan(0);

      // Click remove on first friend
      await friendsPage.removeFriendButtons.first().click();

      // Confirm removal
      await friendsPage.removeConfirmButton.click();

      // Check success toast
      await expect(page.getByText(/friend removed/i)).toBeVisible({ timeout: 5000 });

      // Wait for the friends list to update
      await expect.poll(async () => await friendsPage.getFriendCount()).toBe(initialCount - 1);
    });

    test('should cancel removal', async ({ page }) => {
      await friendsPage.removeFriendButtons.first().click();

      // Click cancel
      const dialog = page.locator('[role="alertdialog"]');
      await friendsPage.removeCancelButton.click();

      // Dialog should close
      await expect(dialog).toBeHidden();

      // Friend count should remain same
      const count = await friendsPage.getFriendCount();
      expect(count).toBeGreaterThan(0);
    });

    test('should show friend name in confirmation dialog', async ({ page }) => {
      const firstRow = friendsPage.friendRows.first();
      const friendName = await firstRow.locator('p').first().textContent();

      await friendsPage.removeFriendButtons.first().click();

      // Dialog should show the friend's name in the description text
      const dialog = page.locator('[role="alertdialog"]');
      await expect(dialog.getByText(/are you sure you want to remove/i)).toContainText(friendName || '');
    });
  });

  test.describe('Friend Search Validation', () => {
    test('should handle empty search', async ({ page }) => {
      // Search button should be disabled when email is empty
      await expect(friendsPage.searchButton).toBeDisabled();
    });

    test('should handle invalid email format', async ({ page }) => {
      await friendsPage.searchEmail('invalid-email');
      // The backend search endpoint may return 200 with null, showing "No user found"
      await expect(page.getByTestId('friend-not-found')).toBeVisible({ timeout: 5000 });
    });
  });
});
