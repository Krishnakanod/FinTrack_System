# Spec-05 — Expense + Income Frontend

**Companion sprint doc:** `.claude/sprints/Sprint-05.md`
**Prerequisite reading:** `.claude/sprints/Sprint-04.md` Handoff Notes / `Spec-04.md` for exact JSON shapes and the OCR confidence threshold; `.claude/sprints/Sprint-03.md` Handoff Notes for the dashboard/layout pattern and `lib/api/client.ts` usage pattern.

---

## 1. Locked Contracts

### 1.1 API Function Signatures (`lib/api/expenses.ts`)
```typescript
createExpense(data: { category: string; description: string; amount: number; date: string; payment_type: string }): Promise<Expense>
uploadReceiptOcr(data: { image_base64: string; mime_type: string }): Promise<OcrResult>
confirmOcrExpense(data: { category: string; description: string; amount: number; date: string; payment_type: string; ocr_confidence: number }): Promise<Expense>
listExpenses(filters?: { category?: string; date_from?: string; date_to?: string }): Promise<{ items: Expense[]; total: number }>
updateExpense(id: string, data: Partial<ExpenseInput>): Promise<Expense>
deleteExpense(id: string): Promise<void>
```

### 1.2 API Function Signatures (`lib/api/income.ts`)
```typescript
createIncome(data: { source_type: 'salary' | 'from_friend'; friend_id?: string | null; description: string; amount: number; date: string; payment_type: string }): Promise<Income>
listIncome(filters?: { source_type?: string; date_from?: string; date_to?: string }): Promise<{ items: Income[]; total: number }>
updateIncome(id: string, data: Partial<IncomeInput>): Promise<Income>
deleteIncome(id: string): Promise<void>
```

### 1.3 TanStack Query Keys (Locked — Future Sprints Reference These)
```typescript
['expenses', filters]      // list
['expenses', 'detail', id] // single (if used)
['income', filters]
['income', 'detail', id]
['analytics']               // placeholder umbrella key — Sprint 9 will use specific
                             // sub-keys like ['analytics', 'net-balance'], but ALL
                             // expense/income mutations in this sprint must invalidate
                             // the broad ['analytics'] key (TanStack Query prefix
                             // matching) so Sprint 9's eventual queries are kept fresh
                             // without this sprint needing to know their exact shape
```

### 1.4 OCR Low-Confidence Threshold (Locked, from Spec-04 §1.5)
```
Show warning banner when confidence_score < 0.67
```
This exact numeric threshold must be used — confirm it matches what Sprint 4's Handoff Notes actually states (Spec-04 defines it, but if the implementing session deviated, the Handoff Notes value wins; flag a discrepancy to Krishna if so, per `CLAUDE.md` Section 1).

### 1.5 Expense Form Fields (Locked Set and Order)
```
Category (select, options = ExpenseCategory enum values exactly as in Spec-04 §1.1)
Description (text, optional)
Amount (number, required, > 0)
Date (date picker, defaults to today)
Payment Type (select, options = PaymentType enum values exactly as in Spec-04 §1.1)
```

### 1.6 Income Form Fields (Locked Set and Order)
```
Source Type (toggle/select: Salary | From Friend)
Friend (searchable select, ONLY visible/enabled when Source Type = From Friend)
Description (text, optional)
Amount (number, required, > 0)
Date (date picker, defaults to today)
Payment Type (select, same enum as expense)
```

### 1.7 "From Friend" Dropdown — Temporary Stub Contract
Since `GET /api/v1/users/friends` doesn't exist until Sprint 6, this sprint MUST stub the friend-selection control in a way that:
- Does not crash or silently submit invalid data
- Is clearly marked with a code comment: `// TODO Sprint 6: wire to GET /api/v1/users/friends, see Spec-06.md`
- Either disables the "From Friend" option entirely with a tooltip, OR accepts free-text temporarily — **your choice, but document which in Handoff Notes** since Sprint 6's spec depends on knowing which stub pattern to replace.

---

## 2. Acceptance Scenarios

### Scenario 5.1 — Add manual expense end-to-end
```gherkin
Given I am on /dashboard/expenses
When I click "Add Expense", select "Manual Entry", fill all fields validly, and submit
Then the dialog closes
And the new expense appears at the top of the list (assuming today's date)
And the dashboard's net balance (if visible) reflects the new expense
```

### Scenario 5.2 — OCR upload with high-confidence result
```gherkin
Given I am on the "Scan Receipt" tab of the Add Expense dialog
When I upload a clear receipt image
Then a loading state is shown during the API call
And the form pre-fills with extracted amount/date/merchant-as-description
And NO warning banner is shown (confidence_score >= 0.67)
When I click "Confirm & Save"
Then the expense is saved with source="ocr"
```

### Scenario 5.3 — OCR upload with low-confidence result
```gherkin
Given an ambiguous/partial receipt image
When I upload it via "Scan Receipt"
Then the form pre-fills with whatever was extracted (some fields may be blank)
And a yellow warning banner is visible: "Please double-check the extracted values" (exact copy is your choice, intent is locked)
And all fields remain editable
```

### Scenario 5.4 — OCR with no extractable text falls back gracefully
```gherkin
Given an image with no readable text
When I upload it
Then I see a toast: "Couldn't read receipt — please fill manually" (exact copy your choice)
And the form opens blank, ready for manual entry (not stuck in a loading/error state)
```

### Scenario 5.5 — Edit and delete expense
```gherkin
Given an existing expense in the list
When I click to edit it, change the amount, and save
Then the list reflects the updated amount immediately

When I click delete and confirm in the AlertDialog
Then the expense disappears from the list
```

### Scenario 5.6 — Add income (salary)
```gherkin
Given I am on /dashboard/income
When I select Source Type = "Salary", fill remaining fields, and submit
Then the friend dropdown was not shown/required
And the income entry appears in the list
```

### Scenario 5.7 — Add income (from friend) uses the stub gracefully
```gherkin
Given I select Source Type = "From Friend"
Then the friend selection control appears in whatever stubbed form was chosen (§1.7)
And submitting still produces a valid backend request (no malformed friend_id sent)
```

### Scenario 5.8 — Dashboard reflects real (client-computed) totals
```gherkin
Given I have added both expenses and income
When I view /dashboard
Then the Net Balance card shows sum(income) - sum(expenses), computed correctly
And the Recent Activity feed shows the most recent 10 items across both types, sorted by date descending
```

---

## 3. Explicitly Out of Scope for This Sprint
- Real friend selection (Sprint 6)
- Server-side analytics aggregation for dashboard totals (Sprint 9 — this sprint's dashboard math is explicitly client-side/temporary)
- Receipt image gallery/history view (not in PRD scope)

---

## 4. Open Implementation Choices (Document in Handoff Notes)
- Table vs. card-list UI for expense/income display
- Exact toast copy text
- Which "From Friend" stub pattern was used (§1.7) — **this is the most important one to document precisely**, including exact file and line number, since Sprint 6's spec needs to find and replace it
- Names/paths of the extracted presentational components for Net Balance and Recent Activity (Sprint 9 needs these)

---

*End of Spec-05.md*
