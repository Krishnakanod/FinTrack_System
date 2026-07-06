"""Groups module — Pydantic request/response schemas.

Locked contracts per Spec-07 §1.
"""

from datetime import date, datetime
from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_serializer, model_validator


# ===== Member / User Populated View =====

class MemberProfile(BaseModel):
    """Populated member object returned inside group responses."""

    id: str
    name: str
    email: str
    avatar_url: str | None = None


# ===== Group Request Schemas =====

class GroupCreate(BaseModel):
    """Request body for POST /api/v1/groups/groups."""

    name: str = Field(..., min_length=1)
    description: str = ""
    member_ids: list[str] = Field(default_factory=list)


class GroupUpdate(BaseModel):
    """Request body for PUT /api/v1/groups/groups/{id}."""

    name: Optional[str] = Field(default=None, min_length=1)
    description: Optional[str] = None


class AddMemberRequest(BaseModel):
    """Request body for POST /api/v1/groups/groups/{id}/members."""

    user_id: str = Field(..., min_length=1)


# ===== Split / Transaction Request Schemas =====

class CustomSplitEntry(BaseModel):
    """Single split entry for custom split requests."""

    user_id: str
    amount_owed: Decimal = Field(..., gt=0)


class GroupTransactionCreate(BaseModel):
    """Request body for POST /api/v1/groups/groups/{id}/transactions.

    Locked per Spec-07 §1.6:
    - For split_type="equal", send `split_among` (list of user_ids).
    - For split_type="custom", send `splits` (list of {user_id, amount_owed}).
    - paid_by is implicitly included in split_among if needed; stored splits
      exclude the payer.
    """

    amount: Decimal = Field(..., gt=0)
    description: str = Field(..., min_length=1)
    paid_by: str = Field(..., min_length=1)
    split_type: Literal["equal", "custom"]
    split_among: Optional[list[str]] = None
    splits: Optional[list[CustomSplitEntry]] = None
    date: date

    @model_validator(mode="after")
    def _validate_split_fields(self):
        if self.split_type == "equal":
            if not self.split_among or len(self.split_among) == 0:
                raise ValueError("split_among must contain at least one user for equal splits")
            # equal splits do not use client-sent splits
            self.splits = None
        else:
            if not self.splits or len(self.splits) == 0:
                raise ValueError("splits must be provided for custom split")
            if self.split_among:
                # split_among is not used for custom; ignore to keep request clean
                self.split_among = None
        return self


# ===== Response Schemas =====

class GroupResponse(BaseModel):
    """Response body for a single group with populated members."""

    id: str
    name: str
    description: str | None = None
    created_by: str
    created_by_name: str
    members: list[MemberProfile]
    created_at: str


class GroupListResponse(BaseModel):
    """Response body for GET /api/v1/groups/groups."""

    items: list[GroupResponse]


class SplitResponse(BaseModel):
    """Single split entry inside a transaction response."""

    user_id: str
    amount_owed: Decimal
    is_settled: bool = False

    @field_serializer("amount_owed")
    def serialize_amount_owed(self, value: Decimal, _info):
        return float(value)


class GroupTransactionResponse(BaseModel):
    """Response body for a single group transaction."""

    id: str
    group_id: str
    description: str
    total_amount: Decimal
    paid_by: str
    split_type: Literal["equal", "custom"]
    splits: list[SplitResponse]
    date: datetime  # serialized to ISO 8601 below
    created_by: str
    created_at: datetime

    @field_serializer("total_amount")
    def serialize_total_amount(self, value: Decimal, _info):
        return float(value)

    @field_serializer("date")
    def serialize_date(self, value: datetime, _info):
        return value.isoformat()

    @field_serializer("created_at")
    def serialize_created_at(self, value: datetime, _info):
        return value.isoformat()


class GroupTransactionListResponse(BaseModel):
    """Response body for GET /api/v1/groups/groups/{id}/transactions."""

    items: list[GroupTransactionResponse]


class BalanceResponse(BaseModel):
    """Single balance summary item."""

    counterpart_id: str
    counterpart_name: str
    net_amount: Decimal
    direction: Literal["you_owe", "owed_to_you", "settled"]

    @field_serializer("net_amount")
    def serialize_net_amount(self, value: Decimal, _info):
        return float(value)


class BalanceListResponse(BaseModel):
    """Response body for GET /api/v1/balances."""

    items: list[BalanceResponse]
