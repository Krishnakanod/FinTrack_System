/**
 * Page Object Models for FinTrack e2e tests
 *
 * These provide reusable methods for interacting with the application
 */

import { Page, Locator } from '@playwright/test';

// ===== Auth Page Objects =====

export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly passwordToggle: Locator;
  readonly signInButton: Locator;
  readonly forgotPasswordLink: Locator;
  readonly signUpLink: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.getByLabel('Email');
    this.passwordInput = page.getByLabel('Password');
    this.passwordToggle = page.getByRole('button', { name: /eye/i }).first();
    this.signInButton = page.getByRole('button', { name: /sign in/i });
    this.forgotPasswordLink = page.getByRole('link', { name: /forgot password/i });
    this.signUpLink = page.getByRole('link', { name: /sign up/i });
    this.errorMessage = page.getByText(/invalid|error|failed/i);
  }

  async goto() {
    await this.page.goto('/login');
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.signInButton.click();
  }

  async fillEmail(email: string) {
    await this.emailInput.fill(email);
  }

  async fillPassword(password: string) {
    await this.passwordInput.fill(password);
  }

  async clickSignIn() {
    await this.signInButton.click();
  }

  async togglePasswordVisibility() {
    await this.passwordToggle.click();
  }
}

export class SignupPage {
  readonly page: Page;
  readonly nameInput: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly confirmPasswordInput: Locator;
  readonly passwordToggle: Locator;
  readonly confirmPasswordToggle: Locator;
  readonly signUpButton: Locator;
  readonly loginLink: Locator;
  readonly otpInput: Locator;
  readonly verifyButton: Locator;
  readonly resendOtpButton: Locator;
  readonly backButton: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.nameInput = page.getByLabel('Full Name');
    this.emailInput = page.getByLabel('Email');
    this.passwordInput = page.getByLabel('Password').first();
    this.confirmPasswordInput = page.getByLabel('Re-enter', { exact: true }).or(page.getByLabel('Confirm Password'));
    this.passwordToggle = page.locator('button').filter({ hasText: /eye/i }).first();
    this.confirmPasswordToggle = page.locator('button').filter({ hasText: /eye/i }).nth(1);
    this.signUpButton = page.getByRole('button', { name: /sign up/i });
    this.loginLink = page.getByRole('link', { name: /sign in/i });
    this.otpInput = page.locator('#otp');
    this.verifyButton = page.getByRole('button', { name: /verify/i });
    this.resendOtpButton = page.getByRole('button', { name: /resend otp/i });
    this.backButton = page.getByRole('button', { name: /back/i });
    this.errorMessage = page.getByText(/invalid|error|failed/i);
  }

  async goto() {
    await this.page.goto('/signup');
  }

  async signup(name: string, email: string, password: string, confirmPassword: string) {
    await this.nameInput.fill(name);
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.confirmPasswordInput.fill(confirmPassword);
    await this.signUpButton.click();
  }

  async enterOtp(otp: string) {
    await this.otpInput.fill(otp);
  }

  async clickVerify() {
    await this.verifyButton.click();
  }

  async resendOtp() {
    await this.resendOtpButton.click();
  }
}

// ===== Dashboard Page Objects =====

export class DashboardPage {
  readonly page: Page;
  readonly welcomeText: Locator;
  readonly userAvatar: Locator;
  readonly logoutButton: Locator;
  readonly netBalanceCard: Locator;
  readonly totalIncomeCard: Locator;
  readonly totalExpensesCard: Locator;
  readonly transactionsCount: Locator;
  readonly recentActivityFeed: Locator;
  readonly quickActions: Locator;
  readonly addExpenseLink: Locator;
  readonly addIncomeLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.welcomeText = page.getByText(/welcome back/i);
    this.userAvatar = page.locator('.h-8.w-8.rounded-full').or(page.getByTestId('user-avatar'));
    this.logoutButton = page.getByRole('button', { name: /logout/i });
    this.netBalanceCard = page.getByText(/net balance/i);
    this.totalIncomeCard = page.getByText(/total income/i);
    this.totalExpensesCard = page.getByText(/total expenses/i);
    this.transactionsCount = page.getByText(/transactions/i);
    this.recentActivityFeed = page.getByText(/recent activity/i);
    this.quickActions = page.getByText(/quick actions/i);
    this.addExpenseLink = page.getByRole('link', { name: /add expense/i });
    this.addIncomeLink = page.getByRole('link', { name: /add income/i });
  }

  async goto() {
    await this.page.goto('/dashboard');
  }

  async clickLogout() {
    await this.logoutButton.click();
  }

  async clickAddExpense() {
    await this.addExpenseLink.click();
  }

  async clickAddIncome() {
    await this.addIncomeLink.click();
  }
}

export class Sidebar {
  readonly page: Page;
  readonly navItems: Locator;
  readonly dashboardLink: Locator;
  readonly expensesLink: Locator;
  readonly incomeLink: Locator;
  readonly friendsLink: Locator;
  readonly hamburgerMenu: Locator;
  readonly mobileMenuOverlay: Locator;

  constructor(page: Page) {
    this.page = page;
    this.navItems = page.locator('nav');
    this.dashboardLink = page.getByRole('link', { name: /dashboard/i });
    this.expensesLink = page.getByRole('link', { name: /expenses/i });
    this.incomeLink = page.getByRole('link', { name: /income/i });
    this.friendsLink = page.getByRole('link', { name: /friends/i });
    this.hamburgerMenu = page.locator('button').filter({ has: page.locator('svg').first() }).first();
    this.mobileMenuOverlay = page.locator('[role="dialog"]').or(page.locator('.fixed.inset-0'));
  }

  async clickDashboard() {
    await this.dashboardLink.click();
  }

  async clickExpenses() {
    await this.expensesLink.click();
  }

  async clickIncome() {
    await this.incomeLink.click();
  }

  async clickFriends() {
    await this.friendsLink.click();
  }

  async openMobileMenu() {
    await this.hamburgerMenu.click();
  }
}

// ===== Expenses Page Objects =====

export class ExpensesPage {
  readonly page: Page;
  readonly addExpenseButton: Locator;
  readonly categoryFilter: Locator;
  readonly dateFromFilter: Locator;
  readonly dateToFilter: Locator;
  readonly expenseTable: Locator;
  readonly expenseRows: Locator;
  readonly noExpensesText: Locator;
  readonly editButtons: Locator;
  readonly deleteButtons: Locator;

  // Dialog locators
  readonly addDialog: Locator;
  readonly dialogTitle: Locator;
  readonly categorySelect: Locator;
  readonly amountInput: Locator;
  readonly descriptionInput: Locator;
  readonly dateInput: Locator;
  readonly paymentTypeSelect: Locator;
  readonly dialogCancelButton: Locator;
  readonly dialogSubmitButton: Locator;
  readonly tabsList: Locator;
  readonly manualTab: Locator;
  readonly ocrTab: Locator;
  readonly fileUploadInput: Locator;

  // Delete confirmation
  readonly deleteDialog: Locator;
  readonly deleteConfirmButton: Locator;
  readonly deleteCancelButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.addExpenseButton = page.getByRole('button', { name: /add expense/i });
    this.categoryFilter = page.getByRole('combobox').filter({ hasText: /category/i }).or(page.getByLabel(/category/i)).first();
    this.dateFromFilter = page.getByLabel(/from date/i).or(page.getByRole('textbox', { name: /from/i }));
    this.dateToFilter = page.getByLabel(/to date/i).or(page.getByRole('textbox', { name: /to/i }));
    this.expenseTable = page.locator('table');
    this.expenseRows = page.locator('tbody tr');
    this.noExpensesText = page.getByText(/no expenses/i);
    this.editButtons = page.getByRole('button', { name: /edit/i }).or(page.locator('button').has(page.locator('svg').first()));
    this.deleteButtons = page.getByRole('button', { name: /delete/i }).or(page.locator('button').has(page.locator('svg').last()));

    // Dialog
    this.addDialog = page.locator('[role="dialog"]').or(page.locator('[id*="dialog"]'));
    this.dialogTitle = this.addDialog.locator('[role="dialog"] h1, [role="dialog"] [class*="title"]').first();
    this.categorySelect = this.addDialog.getByRole('combobox').or(this.addDialog.getByLabel(/category/i));
    this.amountInput = this.addDialog.getByLabel(/amount/i);
    this.descriptionInput = this.addDialog.getByLabel(/description/i).or(this.addDialog.locator('textarea'));
    this.dateInput = this.addDialog.getByLabel(/date/i);
    this.paymentTypeSelect = this.addDialog.getByRole('combobox').filter({ hasText: /payment/i }).or(this.addDialog.getByLabel(/payment/i));
    this.dialogCancelButton = this.addDialog.getByRole('button', { name: /cancel/i });
    this.dialogSubmitButton = this.addDialog.getByRole('button', { name: /add|save|confirm/i });
    this.tabsList = page.locator('[role="tablist"]');
    this.manualTab = page.getByRole('tab', { name: /manual/i });
    this.ocrTab = page.getByRole('tab', { name: /scan|ocr/i });
    this.fileUploadInput = this.addDialog.locator('input[type="file"]');

    // Delete dialog
    this.deleteDialog = page.locator('[role="alertdialog"]').or(page.locator('[id*="alert"]'));
    this.deleteConfirmButton = this.deleteDialog.getByRole('button', { name: /delete/i });
    this.deleteCancelButton = this.deleteDialog.getByRole('button', { name: /cancel/i });
  }

  async goto() {
    await this.page.goto('/dashboard/expenses');
  }

  async clickAddExpense() {
    await this.addExpenseButton.click();
  }

  async fillExpenseForm({
    category,
    amount,
    description,
    date,
    paymentType,
  }: {
    category: string;
    amount: string;
    description?: string;
    date: string;
    paymentType: string;
  }) {
    if (category) {
      await this.categorySelect.click();
      await this.page.getByRole('option', { name: category }).click();
    }
    await this.amountInput.fill(amount);
    if (description) {
      await this.descriptionInput.fill(description);
    }
    await this.dateInput.fill(date);
    if (paymentType) {
      await this.paymentTypeSelect.click();
      await this.page.getByRole('option', { name: paymentType }).click();
    }
  }

  async submitExpenseForm() {
    await this.dialogSubmitButton.click();
  }

  async cancelExpenseForm() {
    await this.dialogCancelButton.click();
  }

  async deleteExpense(index: number = 0) {
    const deleteBtn = this.deleteButtons.nth(index);
    await deleteBtn.click();
    await this.deleteConfirmButton.click();
  }

  async getExpenseCount(): Promise<number> {
    const rows = this.expenseRows;
    return await rows.count();
  }
}

// ===== Income Page Objects =====

export class IncomePage {
  readonly page: Page;
  readonly addIncomeButton: Locator;
  readonly sourceTypeFilter: Locator;
  readonly incomeList: Locator;
  readonly incomeRows: Locator;
  readonly noIncomeText: Locator;

  // Dialog locators
  readonly addDialog: Locator;
  readonly sourceTypeSelect: Locator;
  readonly friendSelector: Locator;
  readonly amountInput: Locator;
  readonly descriptionInput: Locator;
  readonly dateInput: Locator;
  readonly paymentTypeSelect: Locator;
  readonly dialogCancelButton: Locator;
  readonly dialogSubmitButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.addIncomeButton = page.getByRole('button', { name: /add income/i });
    this.sourceTypeFilter = page.getByRole('combobox').filter({ hasText: /source/i }).or(page.getByLabel(/source/i));
    this.incomeList = page.locator('table').or(page.locator('[role="list"]'));
    this.incomeRows = page.locator('tbody tr').or(page.locator('[role="listitem"]'));
    this.noIncomeText = page.getByText(/no income/i);

    // Dialog
    this.addDialog = page.locator('[role="dialog"]');
    this.sourceTypeSelect = this.addDialog.getByRole('combobox').filter({ hasText: /source/i }).or(this.addDialog.getByLabel(/source/i));
    this.friendSelector = this.addDialog.getByRole('combobox').filter({ hasText: /friend/i }).or(this.addDialog.getByLabel(/friend/i));
    this.amountInput = this.addDialog.getByLabel(/amount/i);
    this.descriptionInput = this.addDialog.getByLabel(/description/i).or(this.addDialog.locator('textarea'));
    this.dateInput = this.addDialog.getByLabel(/date/i);
    this.paymentTypeSelect = this.addDialog.getByRole('combobox').filter({ hasText: /payment/i }).or(this.addDialog.getByLabel(/payment/i));
    this.dialogCancelButton = this.addDialog.getByRole('button', { name: /cancel/i });
    this.dialogSubmitButton = this.addDialog.getByRole('button', { name: /add|save|confirm/i });
  }

  async goto() {
    await this.page.goto('/dashboard/income');
  }

  async clickAddIncome() {
    await this.addIncomeButton.click();
  }

  async fillIncomeForm({
    sourceType,
    amount,
    description,
    date,
    paymentType,
    friendName,
  }: {
    sourceType: string;
    amount: string;
    description?: string;
    date: string;
    paymentType: string;
    friendName?: string;
  }) {
    await this.sourceTypeSelect.click();
    await this.page.getByRole('option', { name: sourceType }).click();

    if (friendName && sourceType.includes('Friend')) {
      await this.friendSelector.click();
      await this.page.getByRole('option', { name: friendName }).click();
    }

    await this.amountInput.fill(amount);
    if (description) {
      await this.descriptionInput.fill(description);
    }
    await this.dateInput.fill(date);
    await this.paymentTypeSelect.click();
    await this.page.getByRole('option', { name: paymentType }).click();
  }

  async submitIncomeForm() {
    await this.dialogSubmitButton.click();
  }

  async cancelIncomeForm() {
    await this.dialogCancelButton.click();
  }
}

// ===== Friends Page Objects =====

export class FriendsPage {
  readonly page: Page;
  readonly searchEmailInput: Locator;
  readonly searchButton: Locator;
  readonly searchResult: Locator;
  readonly addFriendButton: Locator;
  readonly friendsList: Locator;
  readonly friendRows: Locator;
  readonly noFriendsText: Locator;
  readonly removeFriendButtons: Locator;
  readonly removeConfirmButton: Locator;
  readonly removeCancelButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.searchEmailInput = page.getByLabel('Email').filter({ hasText: /@/ }).first().or(page.getByPlaceholder(/friend@example.com/i));
    this.searchButton = page.getByRole('button', { name: /search/i });
    this.searchResult = page.locator('.border').filter({ has: page.getByText(/@/) });
    this.addFriendButton = page.getByRole('button', { name: /add friend/i });
    this.friendsList = page.locator('[role="list"]').or(page.locator('table').or(page.locator('.space-y-2')));
    this.friendRows = page.locator('[role="listitem"]').or(page.locator('tbody tr')).or(this.friendsList.locator('> div > div').first().locator('..').locator('div'));
    this.noFriendsText = page.getByText(/no friends/i);
    this.removeFriendButtons = page.getByRole('button', { name: /remove/i }).or(page.locator('button').filter({ has: page.locator('svg').last() }));
    this.removeConfirmButton = page.getByRole('button', { name: /remove/i }).filter({ hasNot: page.locator('span') }).or(page.locator('[role="alertdialog"]').getByRole('button', { name: /remove/i }));
    this.removeCancelButton = page.getByRole('button', { name: /cancel/i });
  }

  async goto() {
    await this.page.goto('/dashboard/friends');
  }

  async searchEmail(email: string) {
    await this.searchEmailInput.fill(email);
    await this.searchButton.click();
  }

  async addFriend(): Promise<void> {
    await this.addFriendButton.click();
  }

  async removeFriend(index: number = 0) {
    await this.removeFriendButtons.nth(index).click();
    // Wait for dialog and confirm
    await this.page.waitForSelector('[role="alertdialog"]');
    await this.page.getByRole('button', { name: /remove/i }).nth(1).click();
  }

  async getFriendCount(): Promise<number> {
    return await this.friendRows.count();
  }
}

// Export all page objects
export const pages = {
  LoginPage,
  SignupPage,
  DashboardPage,
  Sidebar,
  ExpensesPage,
  IncomePage,
  FriendsPage,
};
