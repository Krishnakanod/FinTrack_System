# Spec-04 — Expense Module (Backend, incl. OCR) + Income Module (Backend)

**Companion sprint doc:** `.claude/sprints/Sprint-04.md`
**Prerequisite reading:** `.claude/sprints/Sprint-02.md` Handoff Notes / `Spec-02.md` for `get_current_user` import path.

---

## 1. Locked Contracts

### 1.1 Shared Enums (`shared/enums.py`) — Exact Values
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
**These string values are locked exactly as spelled/cased** — they are used as literal values in JSON request/response bodies, in MongoDB documents, and will be referenced again by Sprint 8 (budgets) and Sprint 9 (analytics). Do not alter casing or spelling.

### 1.2 `expenses` Collection — Beanie Document
```python
class Expense(Document):
    user_id: str                    # indexed
    category: ExpenseCategory
    description: str = ""
    amount: Decimal                 # > 0, 2 decimal places
    date: datetime                  # indexed, IST-meaningful but stored as UTC
    payment_type: PaymentType
    source: Literal["manual", "ocr"]
    ocr_confidence: float | None = None
    receipt_image_url: str | None = None
    created_at: datetime
    updated_at: datetime

    class Settings:
        name = "expenses"
        indexes = [...]   # { user_id: 1, date: -1 }, { user_id: 1, category: 1 }
```
**Validation (locked):** `amount` must be `> 0`. Reject `amount <= 0` with `422`.

### 1.3 `income` Collection — Beanie Document
```python
class Income(Document):
    user_id: str                    # indexed
    source_type: IncomeSourceType
    friend_id: str | None = None    # required if source_type == FROM_FRIEND, must be null if SALARY
    description: str = ""
    amount: Decimal                 # > 0
    date: datetime                  # indexed
    payment_type: PaymentType
    created_at: datetime

    class Settings:
        name = "income"
```

### 1.4 Request/Response Schemas — Exact Shapes

**`POST /api/v1/expenses/`** (manual create)
Request:
```json
{
  "category": "Food",
  "description": "Lunch with friends",
  "amount": 250.50,
  "date": "2026-06-20",
  "payment_type": "UPI"
}
```
Response — `201 Created`:
```json
{
  "id": "string",
  "category": "Food",
  "description": "Lunch with friends",
  "amount": 250.50,
  "date": "2026-06-20T00:00:00Z",
  "payment_type": "UPI",
  "source": "manual",
  "ocr_confidence": null,
  "receipt_image_url": null,
  "created_at": "ISO8601",
  "updated_at": "ISO8601"
}
```
Response — `422` (invalid category/payment_type/amount): standard FastAPI/Pydantic validation error shape is acceptable here, OR convert to the project's `{error, message, details}` shape — **pick one consistently across the whole module and document the choice**, since Sprint 5's frontend error handling needs to know which shape to expect. Recommended: convert all validation errors to `{error: "VALIDATION_ERROR", message, details}` for consistency with the rest of the API per `TRD.md` §6.1.

**`POST /api/v1/expenses/ocr`** (preview, does NOT save)
Request:
```json
{ "image_base64": "string (no data: prefix)", "mime_type": "image/jpeg" }
```
Response — `200 OK`:
```json
{
  "amount": 250.50,
  "date": "2026-06-20",
  "merchant": "Cafe Coffee Day",
  "raw_text": "full OCR text dump...",
  "confidence_score": 0.67
}
```
- Any of `amount`, `date`, `merchant` may be `null` if not extractable.
- `confidence_score` is always a float between `0.0` and `1.0` (never null) — `0.0` if nothing was extracted at all.
- **Never returns a non-2xx for "no text found"** — that's a valid (if low-confidence) result, not an error. Per `App-Flow.md` §5.
- Response — `400 Bad Request` only for actual malformed input (bad base64, unsupported mime_type, image > 5MB):
```json
{ "error": "INVALID_IMAGE", "message": "Could not process the uploaded image.", "details": {} }
```

**`POST /api/v1/expenses/ocr/confirm`**
Request: identical shape to manual create, PLUS:
```json
{ "category": "Food", "description": "...", "amount": 250.50, "date": "2026-06-20", "payment_type": "UPI", "ocr_confidence": 0.67 }
```
Response — `201 Created`: same shape as manual create response, but `source: "ocr"` and `ocr_confidence` populated.

**`GET /api/v1/expenses/?category=&date_from=&date_to=`**
All filters optional. Response — `200 OK`:
```json
{ "items": [ /* array of expense objects, same shape as create response */ ], "total": 42 }
```
Sort order (locked): `date` descending, then `created_at` descending as tiebreaker.

**`GET /api/v1/expenses/{id}`** — `200` with single expense object, or `404`:
```json
{ "error": "NOT_FOUND", "message": "Expense not found.", "details": {} }
```
(Also `404` — not `403` — if the expense exists but belongs to a different user, to avoid leaking existence.)

**`PUT /api/v1/expenses/{id}`** — partial update accepted (any subset of create fields). `200` with updated object, or `404` per above.

**`DELETE /api/v1/expenses/{id}`** — `204 No Content` on success, `404` per above.

**Income endpoints** — mirror the same conventions (`POST /`, `GET /`, `GET /{id}`, `PUT /{id}`, `DELETE /{id}`) with this schema:
```json
{
  "source_type": "from_friend",
  "friend_id": "string-or-null",
  "description": "Movie tickets",
  "amount": 500,
  "date": "2026-06-15",
  "payment_type": "Cash"
}
```
**Validation (locked):** if `source_type == "from_friend"`, `friend_id` is required (`422` if missing). If `source_type == "salary"`, `friend_id` must be `null` (`422` if a value is provided — don't silently ignore it).

### 1.5 OCR Confidence Scoring Formula (Locked)
```
confidence_score = (fields successfully extracted / 3) where fields = [amount, date, merchant]
i.e. 0 extracted → 0.0, 1 → 0.33, 2 → 0.67, 3 → 1.0
```
**Low-confidence threshold (locked, for frontend warning banner in Sprint 5):** `confidence_score < 0.67` (i.e., 2 or fewer fields extracted) triggers the warning. This exact threshold value must be communicated in this sprint's Handoff Notes verbatim so Sprint 5 hardcodes the same number.

### 1.6 Amount Extraction Regex (Locked — from TRD.md §8.3, restated as binding)
```python
patterns = [
    r'(?:₹|Rs\.?|INR)\s*([\d,]+\.?\d*)',
    r'Total[:\s]*([\d,]+\.?\d*)',
    r'Amount[:\s]*([\d,]+\.?\d*)',
]
```
Try in this exact order, return first match.

---

## 2. Acceptance Scenarios

### Scenario 4.1 — Manual expense creation
```gherkin
Given I have a valid access token
When I POST /api/v1/expenses/ with category="Food", amount=250.50, date="2026-06-20", payment_type="UPI"
Then I receive 201 with source="manual" and the exact amount preserved (no float rounding drift)
```

### Scenario 4.2 — Reject zero/negative amount
```gherkin
When I POST /api/v1/expenses/ with amount=0
Then I receive 422
When I POST /api/v1/expenses/ with amount=-50
Then I receive 422
```

### Scenario 4.3 — OCR with a readable receipt
```gherkin
Given a test receipt image containing a clearly printed total like "Total: Rs. 450"
When I POST /api/v1/expenses/ocr with that image as base64
Then I receive 200 with amount=450 extracted correctly
And confidence_score reflects however many of [amount, date, merchant] were found
```

### Scenario 4.4 — OCR with unreadable/blank image
```gherkin
Given an image with no readable text (e.g. a solid color image)
When I POST /api/v1/expenses/ocr
Then I receive 200 (NOT an error)
And amount, date, merchant are all null
And confidence_score is 0.0
```

### Scenario 4.5 — OCR confirm saves correctly
```gherkin
Given a successful OCR preview response
When I POST /api/v1/expenses/ocr/confirm with the (possibly user-edited) fields plus ocr_confidence
Then I receive 201 with source="ocr" and the ocr_confidence value persisted
```

### Scenario 4.6 — List filtering
```gherkin
Given I have 5 expenses across categories Food and Transport, spanning May and June 2026
When I GET /api/v1/expenses/?category=Food
Then only Food expenses are returned
When I GET /api/v1/expenses/?date_from=2026-06-01&date_to=2026-06-30
Then only June expenses are returned, regardless of category
```

### Scenario 4.7 — Cannot access another user's expense
```gherkin
Given User A has an expense with id "X"
When User B (different valid token) sends GET /api/v1/expenses/X
Then User B receives 404 (not 403)
```

### Scenario 4.8 — Income validation enforces friend_id rule
```gherkin
When I POST /api/v1/income/ with source_type="from_friend" and no friend_id
Then I receive 422

When I POST /api/v1/income/ with source_type="salary" and friend_id="some-id"
Then I receive 422

When I POST /api/v1/income/ with source_type="salary" and no friend_id
Then I receive 201
```

---

## 3. Explicitly Out of Scope for This Sprint
- Real validation that `friend_id` corresponds to an actual friendship (Sprint 6 dependency — leave a TODO per Sprint-04.md)
- Receipt image persistent storage/hosting (the `receipt_image_url` field exists in the schema but populating it with a real hosted URL is not required for v1 unless Krishna requests it — document whether you populate it or leave it null)
- Any frontend (Sprint 5)

---

## 4. Open Implementation Choices (Document in Handoff Notes)
- Validation error response shape consistency decision (§1.4)
- Whether receipt images are discarded after OCR processing or stored somewhere (and if stored, where)
- Exact merchant-extraction heuristic beyond "first non-empty line" if you refine it

---

*End of Spec-04.md*
