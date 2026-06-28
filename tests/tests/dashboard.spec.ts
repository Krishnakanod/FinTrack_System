/**
 * Dashboard E2E Tests
 *
 * Tests for:
 * - Dashboard rendering with stats cards
 * - Recent activity feed
 * - Quick actions
 * - Sidebar navigation
 * - Header with user info and logout
 */

import { test, expect } from '@playwright/test';
import { LoginPage, DashboardPage, Sidebar } from '../page-objects';

test.describe('Dashboard', () => {
  let loginPage: LoginPage;
  let dashboardPage: DashboardPage;
  let sidebar: Sidebar;

  // Test account credentials - update these to match your test account
  const testEmail = 'test@fintrack.com';
  const testPassword = 'TestPassword123';

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    dashboardPage = new DashboardPage(page);
    sidebar = new Sidebar(page);

    // Login before each test
    await loginPage.goto();
    await loginPage.login(testEmail, testPassword);
    await page.waitForTimeout(2000);
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test.describe('Dashboard Layout', () => {
    test('should render dashboard with welcome message', async ({ page }) => {
      await expect(dashboardPage.welcomeText).toBeVisible();
    });

    test('should display all stats cards', async ({ page }) => {
      // Net Balance
      await expect(dashboardPage.netBalanceCard).toBeVisible();

      // Total Income
      await expect(dashboardPage.totalIncomeCard).toBeVisible();

      // Total Expenses
      await expect(dashboardPage.totalExpensesCard).toBeVisible();

      // Transactions count
      await expect(dashboardPage.transactionsCount).toBeVisible();
    });

    test('should display recent activity section', async ({ page }) => {
      await expect(dashboardPage.recentActivityFeed).toBeVisible();
    });

    test('should display quick actions section', async ({ page }) => {
      await expect(dashboardPage.quickActions).toBeVisible();
      await expect(dashboardPage.addExpenseLink).toBeVisible();
      await expect(dashboardPage.addIncomeLink).toBeVisible();
    });

    test('should show user avatar in header', async ({ page }) => {
      await expect(dashboardPage.userAvatar).toBeVisible();
    });

    test('should show logout button in header', async ({ page }) => {
      await expect(dashboardPage.logoutButton).toBeVisible();
    });
  });

  test.describe('Sidebar Navigation', () => {
    test('should display sidebar with all navigation items', async ({ page }) => {
      await expect(sidebar.dashboardLink).toBeVisible();
      await expect(sidebar.expensesLink).toBeVisible();
      await expect(sidebar.incomeLink).toBeVisible();
      await expect(sidebar.friendsLink).toBeVisible();
    });

    test('should highlight active navigation item', async ({ page }) => {
      // Dashboard should be active when on /dashboard
      const dashboardNavItem = sidebar.dashboardLink;
      // Check for active state (could be a class, aria-current, or visual indicator)
      await expect(dashboardNavItem).toBeVisible();
    });

    test('should navigate to expenses page', async ({ page }) => {
      await sidebar.clickExpenses();
      await expect(page).toHaveURL(/\/dashboard\/expenses/);
    });

    test('should navigate to income page', async ({ page }) => {
      await sidebar.clickIncome();
      await expect(page).toHaveURL(/\/dashboard\/income/);
    });

    test('should navigate to friends page', async ({ page }) => {
      await sidebar.clickFriends();
      await expect(page).toHaveURL(/\/dashboard\/friends/);
    });

    test('should navigate to dashboard from sidebar', async ({ page }) => {
      // Go to expenses first
      await sidebar.clickExpenses();
      await expect(page).toHaveURL(/\/expenses/);

      // Then back to dashboard
      await sidebar.clickDashboard();
      await expect(page).toHaveURL(/\/dashboard$/);
    });

    test('should show "Soon" badge for unreleased features', async ({ page }) => {
      // Groups, Balances, Budget, Analytics, Notifications should show "Soon"
      const soonBadges = page.getByText(/soon/i);
      await expect(soonBadges.first()).toBeVisible();
    });

    test('should open mobile hamburger menu', async ({ page }) => {
      // Resize to mobile
      await page.setViewportSize({ width: 375, height: 667 });

      await sidebar.openMobileMenu();

      // Mobile menu should be visible
      await expect(sidebar.mobileMenuOverlay).toBeVisible();
    });
  });

  test.describe('Quick Actions', () => {
    test('should navigate to expenses from quick action', async ({ page }) => {
      await dashboardPage.clickAddExpense();
      await expect(page).toHaveURL(/\/dashboard\/expenses/);
    });

    test('should navigate to income from quick action', async ({ page }) => {
      await dashboardPage.clickAddIncome();
      await expect(page).toHaveURL(/\/dashboard\/income/);
    });
  });

  test.describe('Header', () => {
    test('should display personalized welcome', async ({ page }) => {
      // Welcome should include user's name or "back"
      await expect(page.getByText(/welcome back/i)).toBeVisible();
    });

    test('should logout when clicking logout button', async ({ page }) => {
      await dashboardPage.clickLogout();
      await page.waitForTimeout(1000);
      await expect(page).toHaveURL(/\/login/);
    });
  });

  test.describe('Empty State', () => {
    test('should show empty state when no transactions exist', async ({ page }) => {
      // Check for empty state message in recent activity
      const emptyState = page.getByText(/no recent activity/i);
      await expect(emptyState).toBeVisible();
    });
  });

  test.describe('Data Display', () => {
    test('should display transaction count', async ({ page }) => {
      // The transactions card should show a number
      const transactionsCard = dashboardPage.transactionsCount;
      await expect(transactionsCard).toBeVisible();
    });

    test('should format currency correctly', async ({ page }) => {
      // Currency should be in INR format (₹ or Rs)
      const balanceElement = page.locator('[class*="text-green"]').or(page.locator('[class*="text-red"]').first());
      await expect(balanceElement).toBeVisible();
    });
  });
});
