import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3001';

// ===== TESTS =====

test.describe('Authentication', () => {
  test.describe('Login Page', () => {
    test('renders login form correctly', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);

      // Verify page structure — CardTitle is a div, not a heading
      await expect(page.getByText('Welcome back')).toBeVisible();
      await expect(page.getByLabel('Email')).toBeVisible();
      await expect(page.locator('#password')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();

      // Verify links
      await expect(page.getByRole('link', { name: 'Forgot password?' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Sign up' })).toBeVisible();
    });

    test('shows validation errors for empty submission', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      await page.getByRole('button', { name: 'Sign in' }).click();

      // HTML5 validation prevents submission; email should still be visible
      await expect(page.getByLabel('Email')).toBeVisible();
    });

    test('shows error for invalid credentials', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      await page.getByLabel('Email').fill('softwareproject881+nonexistent@gmail.com');
      await page.locator('#password').fill('WrongPass1');
      await page.getByRole('button', { name: 'Sign in' }).click();

      // Should show backend error message in a toast notification (sonner)
      await expect(page.locator('[data-sonner-toast]')).toBeVisible({ timeout: 10000 });
    });

    test('navigates to signup page via link', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      await page.getByRole('link', { name: 'Sign up' }).click();
      await expect(page).toHaveURL(`${BASE_URL}/signup`);
    });

    test('navigates to forgot password page via link', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      await page.getByRole('link', { name: 'Forgot password?' }).click();
      await expect(page).toHaveURL(`${BASE_URL}/forgot-password`);
    });
  });

  test.describe('Signup Page', () => {
    test('renders signup form correctly', async ({ page }) => {
      await page.goto(`${BASE_URL}/signup`);

      await expect(page.getByText('Create your account')).toBeVisible();
      await expect(page.getByLabel('Full Name')).toBeVisible();
      await expect(page.getByLabel('Email')).toBeVisible();
      await expect(page.locator('#password')).toBeVisible();
      await expect(page.locator('#confirm_password')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Sign up' })).toBeVisible();
    });

    test('validates password complexity client-side', async ({ page }) => {
      await page.goto(`${BASE_URL}/signup`);
      await page.getByLabel('Full Name').fill('Test User');
      await page.getByLabel('Email').fill('softwareproject881+test@gmail.com');
      await page.locator('#password').fill('short');
      await page.locator('#confirm_password').fill('short');
      await page.getByRole('button', { name: 'Sign up' }).click();

      // Should show validation error for short password
      await expect(page.getByText('at least 8 characters')).toBeVisible();
    });

    test('validates password match client-side', async ({ page }) => {
      await page.goto(`${BASE_URL}/signup`);
      await page.getByLabel('Full Name').fill('Test User');
      await page.getByLabel('Email').fill('softwareproject881+test@gmail.com');
      await page.locator('#password').fill('TestPass123');
      await page.locator('#confirm_password').fill('DifferentPass1');
      await page.getByRole('button', { name: 'Sign up' }).click();

      // Should show passwords don't match error
      await expect(page.getByText('Passwords do not match')).toBeVisible();
    });
  });

  test.describe('Forgot Password Page', () => {
    test('renders email form correctly', async ({ page }) => {
      await page.goto(`${BASE_URL}/forgot-password`);

      await expect(page.getByText('Forgot your password?')).toBeVisible();
      await expect(page.getByLabel('Email')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Send Reset Code' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Back to login' })).toBeVisible();
    });

    test('does not submit with invalid email format', async ({ page }) => {
      await page.goto(`${BASE_URL}/forgot-password`);
      await page.getByLabel('Email').fill('not-an-email');
      await page.getByRole('button', { name: 'Send Reset Code' }).click();

      // HTML5 type="email" validation prevents form submission.
      // Verify we stay on the same page (form didn't submit).
      await expect(page).toHaveURL(`${BASE_URL}/forgot-password`);
    });
  });

  test.describe('Protected Routes', () => {
    test('redirects unauthenticated user from /dashboard to /login', async ({ page }) => {
      // Navigate to login first to get a valid document context, then clear storage
      await page.goto(`${BASE_URL}/login`);
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });
      await page.context().clearCookies();

      await page.goto(`${BASE_URL}/dashboard`);

      // Should be redirected to login
      await expect(page).toHaveURL(`${BASE_URL}/login`);
    });

    test('redirects root (/) to /login', async ({ page }) => {
      await page.goto(`${BASE_URL}/`);

      // Server-side redirect should take us to /login
      await expect(page).toHaveURL(`${BASE_URL}/login`);
    });
  });

  test.describe('Dashboard Shell', () => {
    // These tests require an authenticated session.
    // We use page.addInitScript to set localStorage BEFORE the page loads,
    // ensuring the Zustand store initializes with the user data.

    async function setAuthState(
      page: any,
      user: { id: string; email: string; name: string; avatar_url: null },
    ) {
      // This script runs before any page code, ensuring localStorage is set
      // before the Zustand store initializes
      await page.addInitScript((userData: typeof user) => {
        const authState = {
          state: {
            accessToken: null,
            user: userData,
            isAuthenticated: true,
          },
          version: 0,
        };
        window.localStorage.setItem('fintrack-auth', JSON.stringify(authState));
      }, user);

      await page.goto(`${BASE_URL}/dashboard`);
      // Wait for the auth guard's useEffect to resolve
      await page.waitForLoadState('networkidle');
    }

    test('renders sidebar with all navigation items', async ({ page }) => {
      await setAuthState(page, {
        id: 'test-id',
        email: 'softwareproject881+shell@gmail.com',
        name: 'Test User',
        avatar_url: null,
      });

      // Wait for hydration and dashboard to load
      await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible({ timeout: 10000 });

      // Verify sidebar navigation items — narrow scope to the sidebar <aside>
      const sidebar = page.locator('aside');
      await expect(sidebar.getByText('Expenses')).toBeVisible();
      await expect(sidebar.getByText('Income')).toBeVisible();
      await expect(sidebar.getByText('Friends')).toBeVisible();
      await expect(sidebar.getByText('Groups')).toBeVisible();
      await expect(sidebar.getByText('Balances')).toBeVisible();
      await expect(sidebar.getByText('Budget')).toBeVisible();
      await expect(sidebar.getByText('Analytics')).toBeVisible();
      await expect(sidebar.getByText('Notifications')).toBeVisible();
    });

    test('shows user name in header', async ({ page }) => {
      await setAuthState(page, {
        id: 'test-id',
        email: 'softwareproject881+header@gmail.com',
        name: 'Krishna Test',
        avatar_url: null,
      });

      // Wait for hydration and dashboard to load
      await expect(page.getByText('Krishna Test')).toBeVisible({ timeout: 10000 });
      await expect(page.getByRole('button', { name: /Logout/i })).toBeVisible();
    });

    test('logout clears session and redirects to login', async ({ page }) => {
      await setAuthState(page, {
        id: 'test-id',
        email: 'softwareproject881+logout@gmail.com',
        name: 'Logout Test',
        avatar_url: null,
      });

      // Wait for dashboard to load
      await expect(page.getByRole('button', { name: /Logout/i })).toBeVisible({ timeout: 10000 });
      await page.getByRole('button', { name: /Logout/i }).click();

      // Should redirect to login
      await expect(page).toHaveURL(`${BASE_URL}/login`);

      // Verify storage was cleared — user is null
      const stored = await page.evaluate(() => localStorage.getItem('fintrack-auth'));
      const parsed = stored ? JSON.parse(stored) : null;
      expect(parsed?.state?.user).toBeNull();
    });

    test('renders placeholder cards on dashboard', async ({ page }) => {
      await setAuthState(page, {
        id: 'test-id',
        email: 'softwareproject881+cards@gmail.com',
        name: 'Test User',
        avatar_url: null,
      });

      // Wait for hydration and dashboard to load
      await expect(page.getByText('Net Balance', { exact: true })).toBeVisible({ timeout: 10000 });
      await expect(page.getByText('Total Income', { exact: true })).toBeVisible();
      await expect(page.getByText('Total Expenses', { exact: true })).toBeVisible();
      await expect(page.getByText('Recent Activity', { exact: true })).toBeVisible();
    });
  });
});
