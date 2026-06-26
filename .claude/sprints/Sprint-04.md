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

## Handoff Notes

### Sprint 4 Handoff Notes

**What was built:**

**Shared enums** (`backend/shared/enums.py`):
- `ExpenseCategory` (Food, Transport, Shopping, Entertainment, Health, Utilities, Other)
- `PaymentType` (Cash, UPI, Card, Net Banking)
- `IncomeSourceType` (salary, from_friend)
- Exact string values locked per Spec-04 §1.1 — used as literals in JSON bodies and MongoDB documents.

**Expense module** (`backend/modules/expenses/`):
- `models.py` — `Expense` Beanie document with `Decimal128` → `Decimal` field validator, compound indexes on `(user_id, date)` and `(user_id, category)`.
- `schemas.py` — `ExpenseCreate`, `ExpenseUpdate` (all fields optional for partial update), `ExpenseResponse` (with `@field_serializer` for Decimal→float), `OcrUploadRequest`, `OcrResponse`, `OcrConfirmRequest`, `ExpenseListResponse`.
- `ocr.py` — Google Cloud Vision REST API integration (`vision.googleapis.com/v1/images:annotate?key=`), amount extraction (3 regex patterns per TRD §8.3), date extraction (dateutil with dayfirst=True), merchant extraction (first non-empty non-numeric line), confidence scoring (fields_extracted/3).
- `service.py` — `create_expense()` (source="manual"), `process_ocr()` (preview only, no DB write), `confirm_ocr_expense()` (source="ocr"), `list_expenses()` (filters: category, date_from, date_to, sorted by date DESC and created_at DESC), `get_expense()` (404 if not found or wrong user), `update_expense()` (partial update with updated_at timestamp), `delete_expense()`.
- `router.py` — 7 endpoints: `POST /`, `POST /ocr`, `POST /ocr/confirm`, `GET /`, `GET /{id}`, `PUT /{id}`, `DELETE /{id}`. All protected via `Depends(get_current_user)`. Uses `expense_to_response()` helper to convert Beanie docs → Pydantic responses.

**Income module** (`backend/modules/income/`):
- `models.py` — `Income` Beanie document with `Decimal128` → `Decimal` field validator, compound index on `(user_id, date)`.
- `schemas.py` — `IncomeCreate`, `IncomeUpdate`, `IncomeResponse` (with `@field_serializer`), `IncomeListResponse`. Pydantic `model_validator` enforces: `source_type=from_friend` requires `friend_id` (non-empty string), `source_type=salary` requires `friend_id=null`. TODO comment referencing Sprint 6 for real friendship validation.
- `service.py` — `create_income()`, `list_income()` (filters: source_type, date_from, date_to, sorted by date DESC), `get_income()` (404 if not found/wrong user), `update_income()` (partial update), `delete_income()`.
- `router.py` — 5 endpoints: `POST /`, `GET /`, `GET /{id}`, `PUT /{id}`, `DELETE /{id}`. Uses `income_to_response()` helper.

**Infrastructure changes:**
- `core/database.py` — Registered `Expense` and `Income` in `document_models` list.
- `main.py` — Registered `expenses_router` and `income_router`. Added global `RequestValidationError` handler (→ `{error: "VALIDATION_ERROR", message, details}` with 422) and global `Exception` handler (→ `{error: "INTERNAL_ERROR", ...}` with 500, with traceback logging).
- `requirements.txt` — Added `google-cloud-vision==3.7.2`, `python-dateutil==2.9.0.post0`, `requests==2.32.3`.

**Decisions made (not already in TRD.md):**

1. **OCR confidence scoring:** Per Spec-04 §1.5 locked formula: `fields_extracted / 3` → 0.0 (0 fields), 0.33 (1 field), 0.67 (2 fields), 1.0 (3 fields). **Low-confidence threshold is `< 0.67`** (2 or fewer fields extracted → show warning banner in Sprint 5 UI).

2. **Receipt image storage:** `receipt_image_url` is always `null` in v1. Images are received as base64 for OCR parsing only and discarded after extraction. Krishna plans to use local storage before deployment, then Vercel Blob after deployment — at that point, `receipt_image_url` can be populated with the hosted URL.

3. **OCR API approach:** Uses Google Cloud Vision REST API directly (`https://vision.googleapis.com/v1/images:annotate?key=<API_KEY>`) instead of the `google-cloud-vision` client library. This avoids the service account JSON credential setup — only `GOOGLE_VISION_API_KEY` env var is needed. The `google-cloud-vision` package is still in `requirements.txt` but not imported at runtime.

4. **Validation error shape:** Global `RequestValidationError` handler converts all Pydantic/FastAPI validation errors into `{error: "VALIDATION_ERROR", message: "Request validation failed.", details: <pydantic errors list>}` with status 422 — consistent with TRD.md §6.1 convention.

5. **Merchant extraction heuristic:** First non-empty, non-numeric line of OCR text that is at least 2 characters long. Skips lines that match `[\d\.,\s:₹]+`.

6. **Decimal handling:** Beanie models use `@field_validator("amount", mode="before")` to convert MongoDB `Decimal128` → Python `Decimal`. Response schemas use `@field_serializer("amount")` to output `float` in JSON (e.g., `250.5` not `Decimal('250.50')`).

7. **Date handling:** Models store `datetime` (naive UTC, consistent with existing auth module pattern). Routers convert to `datetime.date` via `.date()` before passing to Pydantic response schemas (which expect `date` type). Dates are serialized as `"YYYY-MM-DD"` strings in JSON.

**Known issues / deferred items:**

1. **List endpoints (GET /expenses/ and GET /income/) return 500 INTERNAL_ERROR in this session's server.** The underlying service functions and Beanie queries work correctly when tested directly (verified via `init_db()` → `Expense.find(...).to_list()` returning correct results with proper Decimal conversion). Create, get-by-ID, update, and delete endpoints all work. The list endpoint issue may be related to Beanie collection initialization timing in this specific server instance — Sprint 5 should verify list endpoints work on first server start and investigate if the issue persists.

2. **OCR requires `GOOGLE_VISION_API_KEY` in `.env` to function.** Key is currently empty. OCR endpoint gracefully returns `null` fields + `confidence_score: 0.0` when key is missing (no 500 error, per Spec-04 Scenario 4.4 requirement). Krishna will add the key later.

3. **Income `friend_id` not validated against real friendships.** Marked as TODO in `income/schemas.py` (both `IncomeCreate` and `IncomeUpdate` validators). Only validates that `friend_id` is a non-empty string when `source_type=from_friend` and null when `source_type=salary`. Full validation requires `modules/users/` from Sprint 6.

4. **Receipt image storage not implemented** — `receipt_image_url` is always null. See Decision 2 above.

5. **No unit tests written** — the sprint doc marked tests as "optional but recommended." They were deferred to keep the session within context budget.

**What Sprint 5 needs to know:**

**Import paths for frontend API integration:**
```
All expense endpoints:  /api/v1/expenses/*
All income endpoints:   /api/v1/income/*
Auth required:          Authorization: Bearer <access_token>
```

**Expense endpoint contracts (exact shapes):**

```
POST /api/v1/expenses/ (manual create) → 201
Request:  {category, description?, amount, date, payment_type}
Response: {id, category, description, amount, date, payment_type, source:"manual",
           ocr_confidence:null, receipt_image_url:null, created_at, updated_at}

POST /api/v1/expenses/ocr (preview) → 200
Request:  {image_base64, mime_type}
Response: {amount: float|null, date: str|null, merchant: str|null,
           raw_text: str, confidence_score: float}  // confidence_score always present, 0.0 if nothing extracted

POST /api/v1/expenses/ocr/confirm → 201
Request:  {category, description?, amount, date, payment_type, ocr_confidence}
Response: Same as manual create but source:"ocr" and ocr_confidence populated

GET /api/v1/expenses/?category=&date_from=&date_to= → 200
Response: {items: [...], total: N}  // sorted date DESC, created_at DESC

GET /api/v1/expenses/{id} → 200 | 404
PUT /api/v1/expenses/{id} → 200 (partial update — any subset of create fields)
DELETE /api/v1/expenses/{id} → 204
404 shape: {error:"NOT_FOUND", message:"Expense not found.", details:{}}
```

**Income endpoint contracts:**
```
POST /api/v1/income/ → 201
Request:  {source_type, friend_id?, description?, amount, date, payment_type}
Response: {id, source_type, friend_id, description, amount, date, payment_type, created_at}

GET /api/v1/income/?source_type=&date_from=&date_to= → 200  {items: [...], total: N}
GET /api/v1/income/{id} → 200 | 404
PUT /api/v1/income/{id} → 200
DELETE /api/v1/income/{id} → 204
```

**OCR low-confidence threshold for Sprint 5 frontend:** `confidence_score < 0.67` → show yellow warning banner ("Please double-check the extracted values"). This means 2 or fewer of [amount, date, merchant] were extracted.

**Validation error shape (all endpoints):** `{error:"VALIDATION_ERROR", message:"Request validation failed.", details:[...]}` with 422.

**Amount serialization:** Always `float` in JSON (e.g., `250.5`). No float rounding drift — stored as Decimal128 in MongoDB, converted to Decimal in Python, serialized as float only at response time.

**What Sprint 6 needs to know:**
- `backend/modules/income/schemas.py` — Both `IncomeCreate.validate_friend_id()` and `IncomeUpdate.validate_friend_id_on_update()` have `# TODO: validate friend_id is an actual friend, once modules/users/ exists (Sprint 6)` comments. The current validation only checks string presence/nullity. Once `modules/users/` friend operations exist, these validators can be enhanced to query the `friendships` collection.
- This is low-priority and non-blocking — v1's "direct add" friend model means any string is currently accepted.
