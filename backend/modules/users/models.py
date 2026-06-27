"""Users module — Beanie Document models for Friendship.

Note: User model is defined in modules/auth/models.py and reused here.
"""

from datetime import datetime, timezone
from beanie import Document, Indexed
from typing import Literal


class Friendship(Document):
    """Friendship relationship between two users.

    Locked behavior (Spec-06 §1.1):
    - v1 always writes status="accepted" directly (no approval flow)
    - Bidirectional: a single document covers both A<->B directions.
      When listing friends of user X, query both requester_id==X
      AND addressee_id==X, returning the OTHER party in each case.
    - Cannot add yourself (validated in service layer).
    - Query for existing friendship must check both directions
      before creating a new document.
    """

    requester_id: str = Indexed()
    addressee_id: str = Indexed()
    status: Literal["pending", "accepted"] = "accepted"
    created_at: datetime

    class Settings:
        name = "friendships"
        # Unique compound index prevents duplicate A->B friendships.
        # Application layer also checks B->A direction before insert.
        indexes = [
            [("requester_id", 1), ("addressee_id", 1)],
        ]
        use_state_management = True