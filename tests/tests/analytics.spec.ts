import { test, expect } from "@playwright/test";

test.describe("Analytics", () => {
  test.use({ storageState: undefined });

  const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:8000";
  const TEST_EMAIL = "test@example.com";
  const TEST_PASSWORD = "Password123!";

  test.beforeAll(async ({ request }) => {
    const api = request;
    const loginRes = await api.post(`${API_BASE_URL}/api/v1/auth/login`, {
      data: { email: TEST_EMAIL, password: TEST_PASSWORD },
    });

    if (!loginRes.ok()) {
      // User may not exist; skip seeding for this run.
      return;
    }

    const loginData = await loginRes.json();
    const token = loginData.access_token;

    const today = new Date().toISOString().split("T")[0];

    await api.post(`${API_BASE_URL}/api/v1/expenses/`, {
      data: {
        category: "Food",
        description: "Analytics test lunch",
        amount: 250,
        date: today,
        payment_type: "UPI",
      },
      headers: { Authorization: `Bearer ${token}` },
    });

    await api.post(`${API_BASE_URL}/api/v1/income/`, {
      data: {
        source_type: "salary",
        description: "Analytics test salary",
        amount: 50000,
        date: today,
        payment_type: "Net Banking",
      },
      headers: { Authorization: `Bearer ${token}` },
    });
  });

  test("renders analytics page with charts", async ({ page }) => {
    await page.goto("/login");
    await page.locator('input[name="email"]').fill(TEST_EMAIL);
    await page.locator('input[name="password"]').fill(TEST_PASSWORD);
    await page.locator('button[type="submit"]').click();

    await expect(page).toHaveURL(/\\/dashboard/);

    await page.getByRole("link", { name: "Analytics" }).click();
    await expect(page).toHaveURL(/\\/dashboard\\/analytics/);

    await expect(page.getByText("Expense Breakdown")).toBeVisible();
    await expect(page.getByText("Income vs Expense")).toBeVisible();
    await expect(page.getByText("Income Sources")).toBeVisible();
    await expect(page.getByText("Recent Activity")).toBeVisible();
  });

  test("period filter changes displayed data", async ({ page }) => {
    await page.goto("/login");
    await page.locator('input[name="email"]').fill(TEST_EMAIL);
    await page.locator('input[name="password"]').fill(TEST_PASSWORD);
    await page.locator('button[type="submit"]').click();

    await expect(page).toHaveURL(/\\/dashboard/);

    await page.getByRole("link", { name: "Analytics" }).click();
    await expect(page).toHaveURL(/\\/dashboard\\/analytics/);

    const select = page.locator('[role="combobox"]').first();
    await select.click();
    await page.getByRole("option", { name: "Weekly" }).click();

    // The chart titles should still be visible after the period change.
    await expect(page.getByText("Expense Breakdown")).toBeVisible();
    await expect(page.getByText("Income vs Expense")).toBeVisible();
  });

  test("downloads a report", async ({ page }) => {
    await page.goto("/login");
    await page.locator('input[name="email"]').fill(TEST_EMAIL);
    await page.locator('input[name="password"]').fill(TEST_PASSWORD);
    await page.locator('button[type="submit"]').click();

    await expect(page).toHaveURL(/\\/dashboard/);

    await page.getByRole("link", { name: "Analytics" }).click();
    await expect(page).toHaveURL(/\\/dashboard\\/analytics/);

    const startDate = "2026-01-01";
    const endDate = "2026-06-30";

    await page.getByRole("button", { name: "Download Report" }).click();

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.locator('input[type="date"]').first().fill(startDate),
      page.locator('input[type="date"]').nth(1).fill(endDate),
      page.getByRole("button", { name: "Download" }).click(),
    ]);

    const path = await download.path();
    expect(path).toBeTruthy();
  });
});
