"""Budgets module — APScheduler job for evaluating budget thresholds.

Locked per Spec-08 §1.4 and §1.9.
Interval is configurable via BUDGET_SCHEDULER_INTERVAL_MINUTES env var.
"""

from decimal import Decimal

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from core.config import settings
from core.email import send_email
from modules.budgets.models import Budget
from modules.budgets.service import get_current_spend
from modules.notifications.service import create_notification
from shared.period_utils import get_period_anchor, now_in_ist, decimal_to_float


scheduler = AsyncIOScheduler(timezone="Asia/Kolkata")


def _format_inr(amount: Decimal) -> str:
    return f"₹{decimal_to_float(amount):,.2f}"


@scheduler.scheduled_job("interval", minutes=settings.budget_scheduler_interval_minutes)
async def evaluate_budgets() -> None:
    """Evaluate all budgets, reset flags on new period, and send alerts."""
    now = now_in_ist()
    print(f"[DEBUG] Budget scheduler running at {now}")

    budgets = await Budget.find_all().to_list()
    print(f"[DEBUG] Found {len(budgets)} budgets to evaluate")

    for budget in budgets:
        print(f"[DEBUG] Checking budget: {budget.category} for {budget.period}, amount: {budget.amount}")
        print(f"[DEBUG] Budget user_id: {budget.user_id}")
        print(f"[DEBUG] Current period anchor: {budget.period_anchor}")

        # Reset alert flags when a new period begins (Spec-08 §1.4)
        current_anchor = get_period_anchor(budget.period, now)
        print(f"[DEBUG] Calculated current anchor: {current_anchor}")

        if current_anchor != budget.period_anchor:
            print(f"[DEBUG] Period reset: {budget.period_anchor} -> {current_anchor}")
            budget.period_anchor = current_anchor
            budget.alert_sent_80 = False
            budget.alert_sent_100 = False
            budget.updated_at = now
            await budget.save()

        current_spend = await get_current_spend(budget.user_id, budget.category, budget.period)
        print(f"[DEBUG] Current spend: {current_spend}")

        amount = budget.amount
        print(f"[DEBUG] Budget amount: {amount}")

        if amount <= 0:
            print("[DEBUG] Skipping budget - amount <= 0")
            continue

        ratio = decimal_to_float(current_spend) / decimal_to_float(amount)
        print(f"[DEBUG] Ratio: {ratio} ({ratio*100:.1f}%)")
        print(f"[DEBUG] Alert flags - 80%: {budget.alert_sent_80}, 100%: {budget.alert_sent_100}")

        # 100% alert takes precedence over 80% alert
        if ratio >= 1.0 and not budget.alert_sent_100:
            print(f"[DEBUG] TRIGGERING 100% alert for budget {budget.id}")
            await _send_budget_alert(budget, current_spend, threshold="100")
            budget.alert_sent_100 = True
            budget.updated_at = now
            await budget.save()
        elif ratio >= 0.8 and not budget.alert_sent_80:
            print(f"[DEBUG] TRIGGERING 80% alert for budget {budget.id}")
            await _send_budget_alert(budget, current_spend, threshold="80")
            budget.alert_sent_80 = True
            budget.updated_at = now
            await budget.save()
        else:
            print("[DEBUG] No alert conditions met")


async def _send_budget_alert(budget: Budget, current_spend: Decimal, threshold: str) -> None:
    """Persist in-app notification and send email alert for a budget threshold."""
    from modules.auth.models import User  # avoid circular imports

    category = budget.category.value if hasattr(budget.category, "value") else str(budget.category)
    period = budget.period
    amount = budget.amount
    percentage_used = round(decimal_to_float(current_spend) / decimal_to_float(amount) * 100, 1)

    if threshold == "100":
        title = f"Budget Exceeded: {category}"
        body = (
            f"You've exceeded your {category} budget for this {period}. "
            f"Current spend: {_format_inr(current_spend)} / {_format_inr(amount)}."
        )
    else:
        title = f"Budget Alert: {category}"
        body = f"You've spent {percentage_used}% of your {category} budget for this {period}."

    metadata = {"budget_id": str(budget.id), "threshold": threshold}

    print(f"[DEBUG] Creating notification: {title}")

    # In-app notification + WebSocket push
    await create_notification(
        user_id=budget.user_id,
        type="budget_alert",
        title=title,
        body=body,
        metadata=metadata,
    )

    # Email alert
    user = await User.get(budget.user_id)
    if user and user.email:
        html = f"""
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
            <h2 style="color: #111827; margin-top: 0;">{title}</h2>
            <p style="color: #374151; font-size: 16px; line-height: 1.5;">{body}</p>
            <p style="color: #6b7280; font-size: 14px;">This alert was generated automatically by FinTrack.</p>
        </div>
        """
        try:
            await send_email(to_email=user.email, subject=title, body_html=html)
            print(f"[DEBUG] Email sent to {user.email}")
        except Exception as e:
            print(f"[DEBUG] Failed to send email: {e}")
            # Don't let email failure block the scheduler; the in-app notification is already sent
            pass