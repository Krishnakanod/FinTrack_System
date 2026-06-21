# Sprint 4 — Expense Module (Backend, incl. OCR) + Income Module (Backend)

**Layer:** Backend
**Depends on:** Sprint 2 (auth — needs `get_current_user`)
**Estimated files touched:** ~14-16

---

## Context to Read First

1. `docs/PRD.md` — Section 3.2 (Expense user stories US-04, US-05), Section 3.3 (Income user story US-06)
2. `docs/TRD.md` — Section 5.5 (expenses schema), Section 5.6 (income schema), Section 6.4-6.5 (API endpoints), Section 8 (full OCR integration spec — read this carefully, it has exact regex and Google Cloud Vision usage)
3. `docs/App-Flow.md` — Section 4 (Add Expense Manual), Section 5 (Add Expense OCR), Section 6 (Add Income)
4. `docs/Manual-Setup.md` — Section 4 — **confirm Krishna has a Google Cloud Vision API key ready.** If not, STOP and ask for it.
5. **Read `.claude/sprints/Sprint-02.md` → Handoff Notes** for the exact `get_current_user` import path and User document shape.

---

## Goal

Build complete `modules/expenses/` (manual + OCR-based creation, full CRUD) and `modules/income/` (full CRUD) backend modules. Both are grouped into one sprint since they're structurally similar simple CRUD modules. No frontend yet — verify via curl.

---

## Tasks

### 1. Shared Enums (`shared/enums.py`)
If not already started in a prior sprint:
```python
class ExpenseCategory(str, Enum):
    FOOD = "Food"
    TRANSPORT = "Transport"
    SHOPPING = "Shopping"
    ENTERTAINMENT = "Entertainment"
    HEALTH = "Health"
    UTILITIES = "Utilities"
    OTHER = "Other"

class PaymentType(str, Enum):
    CASH = "Cash"
    UPI = "UPI"
    CARD = "Card"
    NET_BANKING = "Net Banking"

class IncomeSourceType(str, Enum):
    SALARY = "salary"
    FROM_FRIEND = "from_friend"
```
These will be reused by the budgets and analytics modules in later sprints — keep this file as the single source of truth for categories.

### 2. Expense Module

**Models** (`modules/expenses/models.py`) — Beanie `Expense` document per `TRD.md` §5.5. Register in `core/database.py`'s `document_models`.

**Schemas** (`modules/expenses/schemas.py`) — `ExpenseCreate`, `ExpenseUpdate`, `ExpenseResponse`, `OcrUploadRequest` (image_base64, mime_type), `OcrResponse` (amount, date, merchant, raw_text, confidence_score), `OcrConfirmRequest` (same as ExpenseCreate plus source/ocr_confidence already set).

**OCR Logic** (`modules/expenses/ocr.py`) — implement exactly per `TRD.md` §8:
- Google Cloud Vision client setup using `GOOGLE_VISION_API_KEY` from settings
- `extract_text_from_image(image_base64: str) -> str`
- `extract_amount(text: str) -> Decimal | None` (regex per §8.3)
- `extract_date(text: str) -> date | None` (use `dateutil.parser`, search for date-like substrings)
- `extract_merchant(text: str) -> str | None` (first non-empty line heuristic)
- `compute_confidence(amount, date, merchant) -> float` (simple heuristic: e.g. 0.34 per successfully extracted field, or any reasonable scoring — document your formula)
- Handle the "no text detected" case gracefully — return all `None` fields, confidence 0.0, don't raise an exception (frontend needs to show "fill manually" in this case, per `App-Flow.md` §5)

**Service** (`modules/expenses/service.py`):
- `create_expense(user_id, data: ExpenseCreate) -> Expense` (source="manual")
- `process_ocr(user_id, data: OcrUploadRequest) -> OcrResponse` (calls ocr.py, does NOT save anything yet — preview only)
- `confirm_ocr_expense(user_id, data: OcrConfirmRequest) -> Expense` (source="ocr", saves with ocr_confidence)
- `list_expenses(user_id, category=None, date_from=None, date_to=None) -> list[Expense]`
- `get_expense(user_id, expense_id) -> Expense` (404 if not found or not owned by user)
- `update_expense(user_id, expense_id, data: ExpenseUpdate) -> Expense`
- `delete_expense(user_id, expense_id) -> None`

**Router** (`modules/expenses/router.py`) — all 7 endpoints from `TRD.md` §6.4, all requiring `get_current_user`. Register in `main.py`.

### 3. Income Module

**Models** (`modules/income/models.py`) — Beanie `Income` document per `TRD.md` §5.6. Register in `core/database.py`'s `document_models`.

**Schemas** (`modules/income/schemas.py`) — `IncomeCreate`, `IncomeUpdate`, `IncomeResponse`.
- Validation rule: if `source_type == "from_friend"`, `friend_id` is required; if `source_type == "salary"`, `friend_id` must be null. Enforce via Pydantic validator.
- **Note:** `friend_id` validity (i.e., is this actually a friend of the user?) can't be fully checked yet since the friends module doesn't exist until Sprint 6 — for now, just validate it's a non-empty string when required. Add a `# TODO: validate friend_id is an actual friend, once modules/users/ exists (Sprint 6)` comment.

**Service** (`modules/income/service.py`):
- `create_income(user_id, data: IncomeCreate) -> Income`
- `list_income(user_id, source_type=None, date_from=None, date_to=None) -> list[Income]`
- `get_income(user_id, income_id) -> Income`
- `update_income(user_id, income_id, data: IncomeUpdate) -> Income`
- `delete_income(user_id, income_id) -> None`

**Router** (`modules/income/router.py`) — all 5 endpoints from `TRD.md` §6.5. Register in `main.py`.

### 4. Verification (curl)
```bash
TOKEN="<paste access token from login>"

# Manual expense
curl -X POST http://localhost:8000/api/v1/expenses/ \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"category":"Food","description":"Lunch","amount":250,"date":"2026-06-20","payment_type":"UPI"}'

# OCR preview (use a real base64-encoded receipt image)
curl -X POST http://localhost:8000/api/v1/expenses/ocr \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"image_base64":"<...>","mime_type":"image/jpeg"}'

# Income
curl -X POST http://localhost:8000/api/v1/income/ \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"source_type":"salary","description":"June salary","amount":50000,"date":"2026-06-01","payment_type":"Net Banking"}'
```

### 5. Basic Tests (optional but recommended)
- `backend/tests/test_expenses.py`, `backend/tests/test_income.py` — CRUD happy paths at minimum.

---

## Definition of Done

- [ ] All 7 expense endpoints work via curl (create, OCR preview, OCR confirm, list, get, update, delete)
- [ ] OCR successfully extracts amount/date/merchant from at least one real test receipt image
- [ ] OCR gracefully handles an image with no readable text (no 500 error)
- [ ] All 5 income endpoints work via curl
- [ ] Income validation correctly enforces friend_id requirement based on source_type
- [ ] Expense list filtering by category and date range works
- [ ] Both modules registered in `core/database.py` and `main.py`

---

## Handoff Notes (fill this out at the end of the sprint)

```markdown
### Sprint 4 Handoff Notes

**What was built:**
- [fill in]

**Decisions made (not already in TRD.md):**
- [e.g., OCR confidence scoring formula used]
- [e.g., where OCR images are temporarily held — are they discarded after parsing,
  or is receipt_image_url actually populated? (TRD schema has the field but original
  scope doesn't require image storage/hosting — clarify and document your choice)]

**Known issues / deferred items:**
- friend_id on Income is not yet validated against real friendships (Sprint 6 dependency)
- [anything else]

**What Sprint 5 needs to know:**
- Exact request/response JSON shapes for all expense and income endpoints
- OCR response shape exactly, including what a "low confidence" threshold looks like
  numerically (frontend needs this to decide when to show the warning banner)

**What Sprint 6 needs to know:**
- The TODO in income schemas.py validating friend_id — once modules/users/ exists,
  consider whether to retroactively add that validation (optional, not blocking)
```
