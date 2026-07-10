from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from pydantic import BaseModel
from core.config import settings
from typing import List

# Import all Beanie Document models here
from modules.auth.models import User, OTP, RefreshToken
from modules.expenses.models import Expense
from modules.income.models import Income
from modules.users.models import Friendship
from modules.notifications.models import Notification
from modules.groups.models import Group, GroupTransaction, Balance
from modules.budgets.models import Budget
from modules.budgets.history_models import BudgetEditLog, BudgetAlertLog

document_models: List[type[BaseModel]] = [
    User, OTP, RefreshToken, Expense, Income, Friendship, Notification,
    Group, GroupTransaction, Balance, Budget, BudgetEditLog, BudgetAlertLog,
]

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
