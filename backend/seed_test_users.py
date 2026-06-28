import asyncio
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from core.config import settings
from core.security import hash_password
from modules.auth.models import User

async def seed_test_users():
    client = AsyncIOMotorClient(settings.mongodb_uri)
    await init_beanie(database=client[settings.mongodb_db_name], document_models=[User])

    password_hash = hash_password("TestPassword123")
    now = datetime.now(timezone.utc)

    users = [
        {
            "email": "test@fintrack.com",
            "name": "Test User",
            "password_hash": password_hash,
            "is_verified": True,
            "failed_login_attempts": 0,
            "locked_until": None,
            "avatar_url": None,
            "created_at": now,
            "updated_at": now,
        },
        {
            "email": "test2@fintrack.com",
            "name": "Test Two",
            "password_hash": password_hash,
            "is_verified": True,
            "failed_login_attempts": 0,
            "locked_until": None,
            "avatar_url": None,
            "created_at": now,
            "updated_at": now,
        },
        {
            "email": "friend@example.com",
            "name": "Friend Example",
            "password_hash": password_hash,
            "is_verified": True,
            "failed_login_attempts": 0,
            "locked_until": None,
            "avatar_url": None,
            "created_at": now,
            "updated_at": now,
        },
    ]

    for u in users:
        existing = await User.find_one(User.email == u["email"])
        if not existing:
            await User(**u).insert()
            print(f"Created {u['email']}")
        else:
            print(f"Already exists {u['email']}")

if __name__ == "__main__":
    asyncio.run(seed_test_users())
