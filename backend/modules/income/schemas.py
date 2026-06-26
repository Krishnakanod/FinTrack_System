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
    description: str = ""
    amount: Decimal = Field(..., gt=0)
    date: date
    payment_type: PaymentType

    @model_validator(mode="after")
    def validate_friend_id(self):
        """
        if source_type == from_friend → friend_id is required (422 if missing)
        if source_type == salary → friend_id must be None (422 if provided)

        TODO: validate friend_id is an actual friend, once modules/users/ exists (Sprint 6)
        """
        if self.source_type == IncomeSourceType.FROM_FRIEND:
            if not self.friend_id:
                raise ValueError("friend_id is required when source_type is 'from_friend'.")
        elif self.source_type == IncomeSourceType.SALARY:
            if self.friend_id is not None:
                raise ValueError("friend_id must be null when source_type is 'salary'.")
        return self


class IncomeUpdate(BaseModel):
    """Request body for updating income (all fields optional)."""

    source_type: Optional[IncomeSourceType] = None
    friend_id: Optional[str] = None
    description: Optional[str] = None
    amount: Optional[Decimal] = Field(default=None, gt=0)
    date: Optional[date] = None
    payment_type: Optional[PaymentType] = None

    @model_validator(mode="after")
    def validate_friend_id_on_update(self):
        """Re-validate friend_id rule whenever source_type or friend_id is present.

        For partial updates: if neither field is set, skip validation.
        If only friend_id is set, validate it independently.
        """
        source = self.source_type
        friend = self.friend_id
        if source is not None and source == IncomeSourceType.FROM_FRIEND:
            if not friend:
                raise ValueError("friend_id is required when source_type is 'from_friend'.")
        elif source is not None and source == IncomeSourceType.SALARY:
            if friend is not None:
                raise ValueError("friend_id must be null when source_type is 'salary'.")
        # If source_type is not being changed (None) but friend_id is provided,
        # validate friend_id independently. This handles cases where the frontend
        # sends friend_id but not source_type during a partial update.
        elif source is None and friend is not None:
            raise ValueError("friend_id must be null when source_type is 'salary'.")
        return self


# ===== Response Schema =====

class IncomeResponse(BaseModel):
    """Response body for a single income record."""

    id: str
    source_type: IncomeSourceType
    friend_id: Optional[str] = None
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
