"""Groups module — Beanie Document models.

Locked contracts per Spec-07 §1:
- Group: group metadata with member list
- GroupTransaction: expense shared within a group with split details
- Balance: bidirectional net-debt records per user↔counterpart pair
"""

from datetime import datetime
from decimal import Decimal
from typing import Any, Literal

from beanie import Document, Indexed
from bson.decimal128 import Decimal128
from pydantic import BaseModel, field_validator


class Group(Document):
    """A group of users for shared expenses."""

    name: str
    description: str | None = None
    created_by: str = Indexed()  # user_id of creator
    members: list[str] = []      # user_ids; creator always included
    created_at: datetime

    class Settings:
        name = "groups"
        indexes = [
            [("members", 1)],  # index for list_groups queries
        ]
        use_state_management = True


class SplitEntry(BaseModel):
    """A single split entry inside a GroupTransaction.

    Locked per Spec-07 §1.2: does NOT include the payer.
    """

    user_id: str
    amount_owed: Decimal
    is_settled: bool = False

    @field_validator("amount_owed", mode="before")
    @classmethod
    def _parse_amount_owed(cls, v: Any) -> Decimal:
        if isinstance(v, Decimal128):
            return v.to_decimal()
        return Decimal(str(v)) if v is not None else Decimal("0")


class GroupTransaction(Document):
    """A transaction within a group, with equal or custom splits."""

    group_id: str = Indexed()
    description: str
    total_amount: Decimal
    paid_by: str = Indexed()  # user_id of payer
    split_type: Literal["equal", "custom"]
    splits: list[SplitEntry]  # excludes paid_by per Spec-07 §1.2
    date: datetime
    created_by: str  # user_id of submitter
    created_at: datetime

    @field_validator("total_amount", mode="before")
    @classmethod
    def _parse_total_amount(cls, v: Any) -> Decimal:
        if isinstance(v, Decimal128):
            return v.to_decimal()
        return Decimal(str(v)) if v is not None else Decimal("0")

    class Settings:
        name = "group_transactions"
        indexes = [
            [("group_id", 1), ("date", -1)],
            [("splits.user_id", 1)],
        ]
        use_state_management = True


class Balance(Document):
    """Net balance between a user and a counterpart.

    Locked convention per Spec-07 §1.3:
    - positive net_amount  => user_id owes counterpart_id
    - negative net_amount  => counterpart_id owes user_id
    - Both directions are written on every transaction.
    """

    user_id: str = Indexed()
    counterpart_id: str = Indexed()
    net_amount: Decimal
    updated_at: datetime

    @field_validator("net_amount", mode="before")
    @classmethod
    def _parse_net_amount(cls, v: Any) -> Decimal:
        if isinstance(v, Decimal128):
            return v.to_decimal()
        return Decimal(str(v)) if v is not None else Decimal("0")

    class Settings:
        name = "balances"
        indexes = [
            [("user_id", 1), ("counterpart_id", 1)],  # unique compound handled in service
        ]
        use_state_management = True
