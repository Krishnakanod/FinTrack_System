from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from core.config import settings
from typing import List

# Empty list that will be populated by future sprints with Beanie Document models
document_models: List = []

motor_client: AsyncIOMotorClient | None = None


async def init_db():
    """Initialize MongoDB connection and Beanie ODM."""
    global motor_client
    print(f"Initializing DB with URI: {settings.mongodb_uri[:50]}...")
    motor_client = AsyncIOMotorClient(settings.mongodb_uri, serverSelectionTimeoutMS=5000)
    database = motor_client[settings.mongodb_db_name]

    await init_beanie(
        database=database,
        document_models=document_models
    )
    print("DB initialized successfully")


async def close_db():
    """Close MongoDB connection."""
    global motor_client
    if motor_client:
        motor_client.close()
