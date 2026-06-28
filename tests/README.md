# FinTrack E2E Tests

End-to-end tests for FinTrack System using Playwright.

## Prerequisites

1. **Backend running** on `http://localhost:8000`
2. **Frontend running** on `http://localhost:3000`
3. **MongoDB connected** and accessible
4. **Test account** exists in database

## Installation

```bash
cd tests
npm install
npx playwright install
```

## Running Tests

### Run all tests
```bash
npm test
# or
npx playwright test
```

### Run specific test file
```bash
npx playwright test tests/auth.spec.ts
npx playwright test tests/dashboard.spec.ts
npx playwright test tests/expenses.spec.ts
npx playwright test tests/income.spec.ts
npx playwright test tests/friends.spec.ts
```

### Run by test name pattern
```bash
npx playwright test --grep "login"
npx playwright test --grep "should add expense"
```

### Run in headed mode (see browser)
```bash
npx playwright test --headed
```

### Run in debug mode
```bash
npx playwright test --debug
```

### Run with UI mode
```bash
npx playwright test --ui
```

### Run specific browser
```bash
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
```

### Run single test file
```bash
npx playwright test tests/auth.spec.ts --project=chromium
```

## View Test Report

After running tests, view the HTML report:

```bash
npx playwright show-report
```

## Test Structure

```
tests/
├── fixtures/
│   └── test-fixtures.ts    # Shared test fixtures
├── tests/
│   ├── smoke.spec.ts       # Basic health checks
│   ├── auth.spec.ts        # Login, signup, logout tests
│   ├── dashboard.spec.ts   # Dashboard layout tests
│   ├── expenses.spec.ts    # Expense CRUD tests
│   ├── income.spec.ts      # Income CRUD tests
│   └── friends.spec.ts     # Friends management tests
├── page-objects.ts         # Page Object Models
├── playwright.config.ts    # Playwright configuration
└── package.json
```

## Test Accounts

The tests use the following test account (update in test files if needed):

- **Email:** `test@fintrack.com`
- **Password:** `TestPassword123`

For signup tests, unique emails are generated automatically.

## Page Object Model

Tests use the Page Object pattern for maintainability. Available page objects:

- `LoginPage` - Login page interactions
- `SignupPage` - Signup flow (details + OTP)
- `DashboardPage` - Dashboard layout and stats
- `Sidebar` - Navigation sidebar
- `ExpensesPage` - Expense CRUD operations
- `IncomePage` - Income CRUD operations
- `FriendsPage` - Friends management

## Configuration

See `playwright.config.ts`:

- **Base URL:** `http://localhost:3000`
- **Timeout:** 60 seconds per test
- **Viewport:** 1280x720
- **Screenshot:** On failure
- **Video:** On failure
- **Trace:** On first retry

## CI/CD

For CI environments:

```bash
# Runs in headless mode with retries
npx playwright test --reporter=html,junit
```

## Troubleshooting

### Tests fail with timeout
- Ensure backend is running on port 8000
- Ensure frontend is running on port 3000
- Check MongoDB connection
- Increase timeout in `playwright.config.ts`

### Authentication errors
- Verify test account exists in database
- Check JWT_SECRET matches between tests and backend
- Clear browser storage between tests

### Elements not found
- Check for dynamic loading - add `waitForTimeout` or proper wait conditions
- Verify selectors in `page-objects.ts`
- Run in headed/debug mode to see actual page state

## Best Practices

1. **Use page objects** - Don't use raw selectors in tests
2. **Wait for elements** - Use `toBeVisible()` instead of fixed delays
3. **Unique data** - Use timestamps for unique emails in signup tests
4. **Clean up** - Remove test data after tests when possible
5. **Descriptive names** - Test names should describe expected behavior
