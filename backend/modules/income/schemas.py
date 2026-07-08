"""Income module — Pydantic schemas."""

from decimal import Decimal
from pydantic import BaseModel, Field, field_serializer, model_validator
from typing import Optional
from datetime import date

from shared.enums import IncomeSourceType, PaymentType


# ===== Request Schemas =====

class IncomeCreate(BaseModel):
    """Request body for creating income."""

    source_type: IncomeSourceType
    friend_id: Optional[str] = None
    source_name: Optional[str] = None
    description: str = ""
    amount: Decimal = Field(..., gt=0)
    date: date
    payment_type: PaymentType

    @model_validator(mode="after")
    def validate_source(self):
        """
        if source_type == from_friend → exactly one of friend_id or source_name is required.
        if source_type == salary → friend_id and source_name must be None.
        """
        if self.source_type == IncomeSourceType.FROM_FRIEND:
            if bool(self.friend_id) == bool(self.source_name):
                raise ValueError(
                    "Exactly one of friend_id or source_name is required when source_type is 'from_friend'."
                )
        elif self.source_type == IncomeSourceType.SALARY:
            if self.friend_id is not None:
                raise ValueError("friend_id must be null when source_type is 'salary'.")
            if self.source_name is not None:
                raise ValueError("source_name must be null when source_type is 'salary'.")
        return self


class IncomeUpdate(BaseModel):
    """Request body for updating income (all fields optional)."""

    source_type: Optional[IncomeSourceType] = None
    friend_id: Optional[str] = None
    source_name: Optional[str] = None
    description: Optional[str] = None
    amount: Optional[Decimal] = Field(default=None, gt=0)
    date: Optional[date] = None
    payment_type: Optional[PaymentType] = None

    @model_validator(mode="after")
    def validate_source_on_update(self):
        """Re-validate friend_id/source_name rule whenever relevant fields are present."""
        source = self.source_type
        friend = self.friend_id
        name = self.source_name

        if source is not None and source == IncomeSourceType.FROM_FRIEND:
            if bool(friend) == bool(name):
                raise ValueError(
                    "Exactly one of friend_id or source_name is required when source_type is 'from_friend'."
                )
        elif source is not None and source == IncomeSourceType.SALARY:
            if friend is not None:
                raise ValueError("friend_id must be null when source_type is 'salary'.")
            if name is not None:
                raise ValueError("source_name must be null when source_type is 'salary'.")
        # If source_type is not being changed but source fields are provided, validate them.
        elif source is None:
            if friend is not None and name is not None:
                raise ValueError(
                    "Cannot provide both friend_id and source_name. Provide exactly one."
                )
        return self


# ===== Response Schema =====

class IncomeResponse(BaseModel):
    """Response body for a single income record."""

    id: str
    source_type: IncomeSourceType
    friend_id: Optional[str] = None
    source_name: Optional[str] = None
    description: str
    amount: Decimal
    date: date
    payment_type: PaymentType
    created_at: str

    @field_serializer("amount")
    def serialize_amount(self, value: Decimal, _info):
        return float(value)


class IncomeListResponse(BaseModel):
    """Response body for paginated income list."""

    items: list[IncomeResponse]
    total: int
