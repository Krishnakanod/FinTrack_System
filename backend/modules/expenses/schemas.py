"""Pydantic schemas for expense module."""

from decimal import Decimal
from pydantic import BaseModel, Field, field_serializer, model_validator
from typing import Literal, Optional
from datetime import date

from shared.enums import ExpenseCategory, PaymentType


# ===== Request Schemas =====

class ExpenseCreate(BaseModel):
    """Request body for creating a manual expense."""

    category: ExpenseCategory
    description: str = ""
    amount: Decimal = Field(..., gt=0)
    date: date
    payment_type: PaymentType


class ExpenseUpdate(BaseModel):
    """Request body for updating an expense (all fields optional)."""

    category: Optional[ExpenseCategory] = None
    description: Optional[str] = None
    amount: Optional[Decimal] = Field(default=None, gt=0)
    date: Optional[date] = None
    payment_type: Optional[PaymentType] = None


class OcrUploadRequest(BaseModel):
    """Request body for OCR receipt upload."""

    image_base64: str = Field(..., min_length=1)
    mime_type: str = Field(..., pattern=r"^image\/(jpeg|png)$")


class OcrConfirmRequest(BaseModel):
    """Request body for confirming an OCR-parsed expense."""

    category: ExpenseCategory
    description: str = ""
    amount: Decimal = Field(..., gt=0)
    date: date
    payment_type: PaymentType
    ocr_confidence: float = Field(..., ge=0.0, le=1.0)


# ===== Response Schemas =====

class ExpenseResponse(BaseModel):
    """Response body for a single expense."""

    id: str
    category: ExpenseCategory
    description: str
    amount: Decimal
    date: date
    payment_type: PaymentType
    source: Literal["manual", "ocr"]
    ocr_confidence: Optional[float] = None
    receipt_image_url: Optional[str] = None
    created_at: str
    updated_at: str

    @field_serializer("amount")
    def serialize_amount(self, value: Decimal, _info):
        return float(value)


class OcrResponse(BaseModel):
    """Response body for OCR preview (does not save)."""

    amount: Optional[float] = None
    date: Optional[str] = None
    merchant: Optional[str] = None
    raw_text: str = ""
    confidence_score: float = 0.0


class ExpenseListResponse(BaseModel):
    """Response body for paginated expense list."""

    items: list[ExpenseResponse]
    total: int
