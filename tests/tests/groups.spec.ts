/**
 * Groups & Splitting E2E Tests
 *
 * Tests for:
 * - Create group
 * - Add equal-split transaction
 * - Verify balances update
 * - Real-time transaction appears in second browser context
 * - Custom split validation (blocks submission when sum != total)
 */

import { test, expect } from "@playwright/test";
import { LoginPage } from "../page-objects";

const TEST_USER = {
  email: "test@fintrack.com",
  password: "TestPassword123",
  name: "Test User",
};

const TEST2_USER = {
  email: "test2@fintrack.com",
  password: "TestPassword123",
  name: "Test Two",
};

async function login(page: any, email: string, password: string) {
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.login(email, password);
  await page.waitForURL("/dashboard", { timeout: 10000 });
  await expect(page.getByText("Loading...")).toBeHidden({ timeout: 10000 });
}

async function createGroup(page: any, name: string) {
  await page.goto("/dashboard/groups");
  await page.waitForSelector('[data-testid="create-group-button"]', { timeout: 10000 });
  await page.getByTestId("create-group-button").click();
  await page.getByTestId("group-name-input").fill(name);
  await page.getByTestId("group-description-input").fill("Test group");

  const friendOption = page.getByTestId("friend-option").filter({ hasText: "Test Two" }).first();
  await friendOption.click();

  await page.getByTestId("submit-create-group").click();
  await expect(page.getByText("Group created successfully")).toBeVisible({ timeout: 5000 });
  await expect(page.getByTestId("group-card").filter({ hasText: name }).first()).toBeVisible({ timeout: 5000 });
}

test.describe("Groups & Splitting", () => {
  test("should create a new group and display it in the list", async ({ page }) => {
    await login(page, TEST_USER.email, TEST_USER.password);
    await createGroup(page, "Test Group Create");
    await expect(page.getByTestId("group-card").filter({ hasText: "Test Group Create" }).first()).toBeVisible();
  });

  test("should add an equal-split transaction and update balances", async ({ page }) => {
    await login(page, TEST_USER.email, TEST_USER.password);
    await createGroup(page, "Test Equal Split");

    await page.getByTestId("group-card").filter({ hasText: "Test Equal Split" }).first().click();

    await page.getByTestId("add-transaction-button").click();
    await page.getByTestId("transaction-amount").fill("300");
    await page.getByTestId("transaction-description").fill("Dinner");
    await page.getByTestId("paid-by-select").click();
    await page.getByRole("option", { name: /Test User/i }).click();

    // Select all members for equal split
    const memberOptions = page.getByTestId("member-option");
    const count = await memberOptions.count();
    for (let i = 0; i < count; i++) {
      await memberOptions.nth(i).click();
    }

    await page.getByTestId("submit-transaction").click();
    await expect(page.getByText("Transaction added")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Dinner")).toBeVisible();

    // Verify balances
    await page.goto("/dashboard/balances");
    await expect(page.getByTestId("balance-row").first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/Owed to you/i).first()).toBeVisible();
  });

  test("should reject custom split when amounts do not sum to total", async ({ page }) => {
    await login(page, TEST_USER.email, TEST_USER.password);
    await createGroup(page, "Test Custom Split");

    await page.getByTestId("group-card").filter({ hasText: "Test Custom Split" }).first().click();

    await page.getByTestId("add-transaction-button").click();
    await page.getByTestId("transaction-amount").fill("100");
    await page.getByTestId("transaction-description").fill("Invalid split");
    await page.getByTestId("paid-by-select").click();
    await page.getByRole("option", { name: /Test User/i }).click();

    const memberOptions = page.getByTestId("member-option");
    const count = await memberOptions.count();
    for (let i = 0; i < count; i++) {
      await memberOptions.nth(i).click();
    }

    await page.getByTestId("split-type-custom").click();

    // Set custom amounts to 30 each — does not sum to 100
    const inputs = page.locator("text=Custom amounts").locator("xpath=..").locator("input[type='number']");
    const inputCount = await inputs.count();
    for (let i = 0; i < inputCount; i++) {
      await inputs.nth(i).fill("30");
    }

    // The submit button should be disabled because amounts don't sum to total
    await expect(page.getByTestId("submit-transaction")).toBeDisabled();
  });

  test("should deliver new transaction to another member in real-time", async ({ browser }) => {
    const userAContext = await browser.newContext();
    const userBContext = await browser.newContext();

    const pageA = await userAContext.newPage();
    const pageB = await userBContext.newPage();

    await login(pageA, TEST_USER.email, TEST_USER.password);
    await login(pageB, TEST2_USER.email, TEST2_USER.password);

    await createGroup(pageA, "Realtime Group");

    // User B opens the same group
    await pageB.goto("/dashboard/groups");
    await pageB.getByTestId("group-card").filter({ hasText: "Realtime Group" }).first().click();

    // User A adds a transaction
    await pageA.getByTestId("group-card").filter({ hasText: "Realtime Group" }).first().click();
    await pageA.getByTestId("add-transaction-button").click();
    await pageA.getByTestId("transaction-amount").fill("250");
    await pageA.getByTestId("transaction-description").fill("Realtime dinner");
    await pageA.getByTestId("paid-by-select").click();
    await pageA.getByRole("option", { name: /Test User/i }).click();

    const memberOptions = pageA.getByTestId("member-option");
    const count = await memberOptions.count();
    for (let i = 0; i < count; i++) {
      await memberOptions.nth(i).click();
    }

    await pageA.getByTestId("submit-transaction").click();

    await expect(pageA.getByText("Transaction added")).toBeVisible({ timeout: 5000 });
    await expect(pageB.getByText("Realtime dinner")).toBeVisible({ timeout: 10000 });

    await userAContext.close();
    await userBContext.close();
  });
});
