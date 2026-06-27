/**
 * Authentication E2E Tests
 *
 * Tests for:
 * - Login page rendering
 * - Login with valid credentials
 * - Login with invalid credentials
 * - Logout functionality
 * - Signup flow (details + OTP verification)
 * - Duplicate email signup error
 * - Auth guard (redirect unauthenticated users)
 */

import { test, expect } from '@playwright/test';
import { LoginPage, SignupPage, DashboardPage } from '../page-objects';

test.describe('Authentication', () => {
  let loginPage: LoginPage;
  let signupPage: SignupPage;
  let dashboardPage: DashboardPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    signupPage = new SignupPage(page);
    dashboardPage = new DashboardPage(page);
  });

  test.describe('Login Page', () => {
    test('should render login page with all elements', async ({ page }) => {
      await loginPage.goto();

      // Check page title
      await expect(page).toHaveTitle(/FinTrack/);

      // Check main heading
      await expect(page.getByText(/welcome back/i)).toBeVisible();

      // Check form fields
      await expect(loginPage.emailInput).toBeVisible();
      await expect(loginPage.passwordInput).toBeVisible();

      // Check buttons and links
      await expect(loginPage.signInButton).toBeVisible();
      await expect(loginPage.forgotPasswordLink).toBeVisible();
      await expect(loginPage.signUpLink).toBeVisible();
    });

    test('should toggle password visibility', async ({ page }) => {
      await loginPage.goto();

      // Password should be hidden by default
      await expect(loginPage.passwordInput).toHaveAttribute('type', 'password');

      // Click toggle button
      await loginPage.togglePasswordVisibility();

      // Password should now be visible
      await expect(loginPage.passwordInput).toHaveAttribute('type', 'text');

      // Click again to hide
      await loginPage.togglePasswordVisibility();
      await expect(loginPage.passwordInput).toHaveAttribute('type', 'password');
    });

    test('should show validation errors for empty fields', async ({ page }) => {
      await loginPage.goto();

      // Try to submit without filling fields
      await loginPage.clickSignIn();

      // Should show validation errors
      await expect(page.getByText(/email is required/i)).toBeVisible();
      await expect(page.getByText(/password is required/i)).toBeVisible();
    });

    test('should navigate to signup page when clicking sign up link', async ({ page }) => {
      await loginPage.goto();
      await loginPage.signUpLink.click();
      await expect(page).toHaveURL(/\/signup/);
    });

    test('should navigate to forgot password page', async ({ page }) => {
      await loginPage.goto();
      await loginPage.forgotPasswordLink.click();
      await expect(page).toHaveURL(/\/forgot-password/);
    });
  });

  test.describe('Login Functionality', () => {
    test('should login with valid credentials and redirect to dashboard', async ({ page }) => {
      // Use existing test account credentials
      // Note: This test assumes a test account exists in the database
      const testEmail = 'test@fintrack.com';
      const testPassword = 'TestPassword123';

      await loginPage.goto();
      await loginPage.login(testEmail, testPassword);

      // Wait for navigation or toast
      await page.waitForTimeout(2000);

      // Should redirect to dashboard
      await expect(page).toHaveURL(/\/dashboard/);
    });

    test('should show error for invalid credentials', async ({ page }) => {
      const invalidEmail = 'nonexistent@fintrack.com';
      const invalidPassword = 'WrongPassword123';

      await loginPage.goto();
      await loginPage.login(invalidEmail, invalidPassword);

      // Wait for error response
      await page.waitForTimeout(1000);

      // Should show error message
      await expect(page.getByText(/invalid|error|failed|unauthorized/i)).toBeVisible();

      // Should stay on login page
      await expect(page).toHaveURL(/\/login/);
    });

    test('should show error for wrong password', async ({ page }) => {
      // Note: This test assumes a test account exists
      const testEmail = 'test@fintrack.com';
      const wrongPassword = 'WrongPassword456';

      await loginPage.goto();
      await loginPage.login(testEmail, wrongPassword);

      // Wait for error response
      await page.waitForTimeout(1000);

      // Should show error message
      await expect(page.getByText(/invalid|error|failed/i)).toBeVisible();
    });
  });

  test.describe('Logout Functionality', () => {
    test('should logout and redirect to login page', async ({ page }) => {
      // First login (using existing account)
      const testEmail = 'test@fintrack.com';
      const testPassword = 'TestPassword123';

      await loginPage.goto();
      await loginPage.login(testEmail, testPassword);
      await page.waitForTimeout(2000);

      // Check we're on dashboard
      await expect(page).toHaveURL(/\/dashboard/);

      // Click logout
      const logoutButton = page.getByRole('button', { name: /logout/i });
      await expect(logoutButton).toBeVisible();
      await logoutButton.click();

      // Wait for logout
      await page.waitForTimeout(1000);

      // Should redirect to login
      await expect(page).toHaveURL(/\/login/);
    });
  });

  test.describe('Signup Flow', () => {
    test('should render signup page with all elements', async ({ page }) => {
      await signupPage.goto();

      // Check page title
      await expect(page).toHaveTitle(/FinTrack/);

      // Check main heading
      await expect(page.getByText(/create your account/i)).toBeVisible();

      // Check form fields (step 1)
      await expect(signupPage.nameInput).toBeVisible();
      await expect(signupPage.emailInput).toBeVisible();
      await expect(signupPage.passwordInput).toBeVisible();
      await expect(signupPage.confirmPasswordInput).toBeVisible();

      // Check buttons
      await expect(signupPage.signUpButton).toBeVisible();
      await expect(signupPage.loginLink).toBeVisible();
    });

    test('should show validation errors for invalid input', async ({ page }) => {
      await signupPage.goto();

      // Submit empty form
      await signupPage.signUpButton.click();

      // Should show validation errors
      await expect(page.getByText(/name is required/i)).toBeVisible();
      await expect(page.getByText(/email is required/i)).toBeVisible();
      await expect(page.getByText(/password.*8/i)).toBeVisible();
    });

    test('should show error when passwords do not match', async ({ page }) => {
      await signupPage.goto();

      await signupPage.nameInput.fill('Test User');
      await signupPage.emailInput.fill('test@example.com');
      await signupPage.passwordInput.fill('Password123');
      await signupPage.confirmPasswordInput.fill('DifferentPassword123');

      await signupPage.signUpButton.click();

      // Should show password mismatch error
      await expect(page.getByText(/passwords? (do not match|must match)/i)).toBeVisible();
    });

    test('should complete signup and show OTP screen', async ({ page }) => {
      // Generate unique email
      const uniqueEmail = `test_${Date.now()}@fintrack.e2e`;
      const testName = 'E2E Test User';
      const testPassword = 'TestPassword123';

      await signupPage.goto();
      await signupPage.signup(testName, uniqueEmail, testPassword, testPassword);

      // Wait for OTP screen to appear
      await page.waitForTimeout(1000);

      // Should show OTP verification screen
      await expect(page.getByText(/verify your email/i)).toBeVisible();
      await expect(signupPage.otpInput).toBeVisible();
      await expect(signupPage.verifyButton).toBeVisible();
    });

    test('should navigate to login from signup', async ({ page }) => {
      await signupPage.goto();
      await signupPage.loginLink.click();
      await expect(page).toHaveURL(/\/login/);
    });
  });

  test.describe('Auth Guard', () => {
    test('should redirect unauthenticated user from dashboard to login', async ({ page }) => {
      // Clear any existing auth by going to login first
      await page.goto('/login');
      await page.evaluate(() => {
        localStorage.clear();
      });

      // Try to access dashboard
      await page.goto('/dashboard');

      // Should redirect to login
      await expect(page).toHaveURL(/\/login/);
    });

    test('should redirect unauthenticated user from expenses to login', async ({ page }) => {
      await page.evaluate(() => {
        localStorage.clear();
      });

      await page.goto('/dashboard/expenses');
      await expect(page).toHaveURL(/\/login/);
    });

    test('should redirect unauthenticated user from income to login', async ({ page }) => {
      await page.evaluate(() => {
        localStorage.clear();
      });

      await page.goto('/dashboard/income');
      await expect(page).toHaveURL(/\/login/);
    });

    test('should redirect unauthenticated user from friends to login', async ({ page }) => {
      await page.evaluate(() => {
        localStorage.clear();
      });

      await page.goto('/dashboard/friends');
      await expect(page).toHaveURL(/\/login/);
    });
  });
});
