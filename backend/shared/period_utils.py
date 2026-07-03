"""Period utilities for FinTrack budgets and analytics.

All operations use Asia/Kolkata (IST, UTC+5:30) per PRD.md §1.1.
Extracted into a shared module so Sprint 8 (budgets) and Sprint 9
(analytics/reports) can reuse the same anchor/range logic.
"""

from datetime import datetime, date, timedelta, timezone
from decimal import Decimal

IST = timezone(timedelta(hours=5, minutes=30))


def now_in_ist() -> datetime:
    """Return current datetime in Asia/Kolkata."""
    return datetime.now(IST)


def get_period_anchor(period: str, reference_date: datetime | date) -> str:
    """Return the canonical string identifying the current instance of `period`.

    Locked per Spec-08 §1.2 / Spec-09 §1.1:
    - daily:     "2026-06-20"  (YYYY-MM-DD)
    - weekly:    "2026-W25"    (YYYY-W[week])
    - monthly:   "2026-06"     (YYYY-MM)
    - quarterly: "2026-Q2"     (YYYY-Q[1-4])
    - yearly:    "2026"        (YYYY)
    """
    if isinstance(reference_date, datetime):
        d = reference_date.date()
    else:
        d = reference_date

    year = d.year

    if period == "daily":
        return d.strftime("%Y-%m-%d")
    if period == "weekly":
        iso_year, iso_week, _ = d.isocalendar()
        return f"{iso_year}-W{iso_week:02d}"
    if period == "monthly":
        return d.strftime("%Y-%m")
    if period == "quarterly":
        quarter = (d.month - 1) // 3 + 1
        return f"{year}-Q{quarter}"
    if period == "yearly":
        return str(year)

    raise ValueError(f"Unknown period: {period}")


def get_period_range(period: str, reference_date: datetime) -> tuple[datetime, datetime]:
    """Return [start, end] datetimes in IST for the given period containing reference_date.

    Locked per Spec-08 §1.3 and Spec-09 §1.1:
    - daily:     [today 00:00:00 IST, today 23:59:59.999999 IST]
    - weekly:    [Monday 00:00:00 IST, Sunday 23:59:59.999999 IST]
    - monthly:   [1st of current month 00:00:00 IST, last day of current month 23:59:59.999999 IST]
    - quarterly: [1st day of current quarter 00:00:00 IST, last day of current quarter 23:59:59.999999 IST]
    - yearly:    [Jan 1 00:00:00 IST, Dec 31 23:59:59.999999 IST]
    """
    if reference_date.tzinfo is None:
        # Assume naive datetimes are UTC; convert to IST for safety
        reference_date = reference_date.replace(tzinfo=timezone.utc)

    ist_dt = reference_date.astimezone(IST)
    d = ist_dt.date()
    year, month = d.year, d.month

    if period == "daily":
        start = datetime.combine(d, datetime.min.time()).replace(tzinfo=IST)
        end = datetime.combine(d, datetime.max.time()).replace(tzinfo=IST)
    elif period == "weekly":
        # d.weekday() returns Monday=0 ... Sunday=6
        monday = d - timedelta(days=d.weekday())
        sunday = monday + timedelta(days=6)
        start = datetime.combine(monday, datetime.min.time()).replace(tzinfo=IST)
        end = datetime.combine(sunday, datetime.max.time()).replace(tzinfo=IST)
    elif period == "monthly":
        start = datetime.combine(date(year, month, 1), datetime.min.time()).replace(tzinfo=IST)
        if month == 12:
            next_month = date(year + 1, 1, 1)
        else:
            next_month = date(year, month + 1, 1)
        end = datetime.combine(next_month - timedelta(days=1), datetime.max.time()).replace(tzinfo=IST)
    elif period == "quarterly":
        quarter_start_month = ((month - 1) // 3) * 3 + 1
        start = datetime.combine(date(year, quarter_start_month, 1), datetime.min.time()).replace(tzinfo=IST)
        if quarter_start_month == 10:
            next_quarter = date(year + 1, 1, 1)
        else:
            next_quarter = date(year, quarter_start_month + 3, 1)
        end = datetime.combine(next_quarter - timedelta(days=1), datetime.max.time()).replace(tzinfo=IST)
    elif period == "yearly":
        start = datetime.combine(date(year, 1, 1), datetime.min.time()).replace(tzinfo=IST)
        end = datetime.combine(date(year, 12, 31), datetime.max.time()).replace(tzinfo=IST)
    else:
        raise ValueError(f"Unknown period: {period}")

    return start, end


def decimal_to_float(value: Decimal | float | int | None) -> float:
    """Safely convert a Decimal/float/int to float for JSON serialization."""
    if value is None:
        return 0.0
    return float(value)
