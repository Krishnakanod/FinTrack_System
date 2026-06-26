"""Shared enums for FinTrack domain types."""

from enum import Enum


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
