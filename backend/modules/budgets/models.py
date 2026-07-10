"""Budgets module — Beanie Document model."""

from datetime import datetime
from decimal import Decimal
from typing import Literal

import pymongo
from beanie import Document, Indexed
from bson.decimal128 import Decimal128
from pydantic import field_validator

from shared.enums import ExpenseCategory


class Budget(Document):
    """Budget goal for a category + period combination.

    Locked contract per Spec-08 §1.1.
    `period_anchor` is internal-only and never exposed in API responses.
    """

    user_id: str = Indexed()
    category: ExpenseCategory
    period: Literal["daily", "monthly", "quarterly", "yearly"]
    amount: Decimal
    alert_sent_80: bool = False
    alert_sent_100: bool = False
    period_anchor: str
    created_at: datetime
    updated_at: datetime

    @field_validator("amount", mode="before")
    @classmethod
    def parse_amount(cls, v):
        if isinstance(v, Decimal128):
            return v.to_decimal()
        if isinstance(v, Decimal):
            return v
        return Decimal(str(v)) if v is not None else Decimal("0")

    class Settings:
        name = "budgets"
        indexes = [
            [("user_id", 1), ("category", 1), ("period", 1)],
        ]
        use_state_management = True
