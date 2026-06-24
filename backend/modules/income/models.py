"""Income module — Beanie Document model."""

from datetime import datetime
from decimal import Decimal
from beanie import Document, Indexed
from typing import Any
from pydantic import field_validator
from bson.decimal128 import Decimal128

from shared.enums import IncomeSourceType, PaymentType


class Income(Document):
    """Income model for tracking user income."""

    user_id: str = Indexed()
    source_type: IncomeSourceType
    friend_id: str | None = None
    description: str
    amount: Decimal
    date: datetime
    payment_type: PaymentType
    created_at: datetime

    @field_validator("amount", mode="before")
    @classmethod
    def parse_amount(cls, v: Any) -> Decimal:
        """Convert Decimal128 from MongoDB to Decimal."""
        if isinstance(v, Decimal128):
            return v.to_decimal()
        return Decimal(str(v)) if v else Decimal("0")

    class Settings:
        name = "income"
        indexes = [
            ("user_id", "date"),  # compound index for user's income by date
        ]
        use_state_management = True
