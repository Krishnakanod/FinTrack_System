from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from core.config import settings
from core import database
from modules.auth.router import router as auth_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    await database.init_db()
    yield
    await database.close_db()


app = FastAPI(
    title="FinTrack API",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth_router, prefix="/api/v1")


@app.get("/health")
async def health_check():
    """Health check endpoint with MongoDB connectivity status."""
    db_status = "connected"
    try:
        if database.motor_client:
            await database.motor_client.admin.command("ping")
        else:
            db_status = "disconnected"
    except Exception:
        db_status = "disconnected"

    return {"status": "ok", "db": db_status}
