"""Expense module — Beanie Document model."""

from datetime import datetime
from decimal import Decimal
from beanie import Document, Indexed
from typing import Literal, Any
from pydantic import field_validator
from bson.decimal128 import Decimal128

from shared.enums import ExpenseCategory, PaymentType


class Expense(Document):
    """Expense model for tracking user expenses."""

    user_id: str = Indexed()
    category: ExpenseCategory
    paid_to_name: str | None = None
    description: str
    amount: Decimal
    date: datetime
    payment_type: PaymentType
    source: Literal["manual", "ocr"]
    ocr_confidence: float | None = None
    receipt_image_url: str | None = None
    edited: bool = False
    created_at: datetime
    updated_at: datetime

    @field_validator("amount", mode="before")
    @classmethod
    def parse_amount(cls, v: Any) -> Decimal:
        """Convert Decimal128 from MongoDB to Decimal."""
        if isinstance(v, Decimal128):
            return v.to_decimal()
        return Decimal(str(v)) if v else Decimal("0")

    class Settings:
        name = "expenses"
        indexes = [
            ("user_id", "date"),  # compound index for user's expenses by date
            ("user_id", "category"),  # for category filtering
        ]
        use_state_management = True
