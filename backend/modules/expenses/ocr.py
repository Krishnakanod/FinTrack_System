"""OCR module — Google Cloud Vision receipt parsing.

Uses the Google Cloud Vision REST API directly (TEXT_DETECTION) with an API key.
No service account JSON required — only GOOGLE_VISION_API_KEY env var.
"""

import re
import base64
import requests
from decimal import Decimal, InvalidOperation
from datetime import date
from typing import Optional

from core.config import settings
from dateutil import parser as dateutil_parser


# ===== Amount Extraction (per TRD.md §8.3 — exact patterns, locked) =====

def extract_amount(text: str) -> Optional[Decimal]:
    """Extract monetary amount from OCR text.

    Tries patterns in order: currency prefix (₹/Rs/INR), 'Total:', 'Amount:'
    Returns first match or None.
    """
    patterns = [
        r'(?:₹|Rs\.?|INR)\s*([\d,]+\.?\d*)',
        r'Total[:\s]*([\d,]+\.?\d*)',
        r'Amount[:\s]*([\d,]+\.?\d*)',
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            try:
                return Decimal(match.group(1).replace(',', ''))
            except (InvalidOperation, ValueError):
                continue
    return None


def extract_date(text: str) -> Optional[date]:
    """Extract date from OCR text using dateutil parser.

    Searches for date-like substrings in the text.
    Returns a date object or None.
    """
    if not text:
        return None

    # Try to find date patterns in the text
    # dateutil.parser is aggressive — limit to reasonable substrings
    lines = text.split('\n')
    for line in lines:
        # Skip lines that are too short or too long to be dates
        stripped = line.strip()
        if len(stripped) < 4 or len(stripped) > 30:
            continue
        try:
            parsed = dateutil_parser.parse(
                stripped,
                fuzzy=True,
                dayfirst=True,  # IST context: DD/MM/YYYY is common
            )
            return parsed.date()
        except (ValueError, OverflowError):
            continue
    return None


def extract_merchant(text: str) -> Optional[str]:
    """Extract merchant name from OCR text.

    Heuristic: first non-empty, non-numeric line of the receipt text.
    """
    if not text:
        return None

    lines = text.strip().split('\n')
    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        # Skip lines that are purely numeric (amounts, dates, etc.)
        if re.fullmatch(r'[\d\.,\s:₹]+', stripped):
            continue
        # Skip lines that are just a few punctuation chars
        if len(stripped) < 2:
            continue
        return stripped
    return None


def compute_confidence(
    amount: Optional[Decimal],
    parsed_date: Optional[date],
    merchant: Optional[str],
) -> float:
    """Compute OCR confidence score (Spec §1.5 — locked formula).

    confidence_score = fields_extracted / 3
    0 extracted → 0.0, 1 → 0.33, 2 → 0.67, 3 → 1.0
    """
    fields = [amount, parsed_date, merchant]
    extracted = sum(1 for f in fields if f is not None)
    return round(extracted / 3, 2)


def process_receipt(image_base64: str) -> dict:
    """Process a receipt image via Google Cloud Vision TEXT_DETECTION.

    Returns a dict with keys: amount, date, merchant, raw_text, confidence_score.
    All extracted fields are None/empty if nothing found (never raises).
    """
    empty_result = {
        "amount": None,
        "date": None,
        "merchant": None,
        "raw_text": "",
        "confidence_score": 0.0,
    }

    api_key = getattr(settings, "google_vision_api_key", None)
    if not api_key:
        return empty_result

    try:
        image_content = image_base64.split(",", 1)[-1]  # strip data URI prefix if present
        base64.b64decode(image_content, validate=True)
    except Exception:
        return empty_result

    try:
        url = f"https://vision.googleapis.com/v1/images:annotate?key={api_key}"
        payload = {
            "requests": [
                {
                    "image": {"content": image_content},
                    "features": [{"type": "TEXT_DETECTION", "maxResults": 1}],
                }
            ]
        }
        response = requests.post(url, json=payload, timeout=10)
        data = response.json()

        if response.status_code != 200:
            return empty_result

        responses = data.get("responses", [])
        if not responses:
            return empty_result

        error = responses[0].get("error")
        if error:
            return empty_result

        # Get full text annotation
        text_annotations = responses[0].get("textAnnotations", [])
        if not text_annotations:
            return empty_result

        full_text = text_annotations[0].get("description", "")
        if not full_text or not full_text.strip():
            return empty_result

        # Extract fields
        amount = extract_amount(full_text)
        parsed_date = extract_date(full_text)
        merchant = extract_merchant(full_text)
        confidence = compute_confidence(amount, parsed_date, merchant)

        return {
            "amount": float(amount) if amount is not None else None,
            "date": parsed_date.isoformat() if parsed_date else None,
            "merchant": merchant,
            "raw_text": full_text,
            "confidence_score": confidence,
        }

    except Exception:
        # Network error, timeout, malformed response — return empty gracefully
        return empty_result
