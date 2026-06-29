from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from contextlib import asynccontextmanager
from core.config import settings
from core import database
from modules.auth.router import router as auth_router
from modules.expenses.router import router as expenses_router
from modules.income.router import router as income_router
from modules.users.router import router as users_router
from modules.websocket.router import router as websocket_router
from modules.groups.router import router as groups_router
from modules.notifications.router import router as notifications_router
from modules.budgets.router import router as budgets_router


from modules.budgets.scheduler import scheduler as budget_scheduler

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    await database.init_db()
    budget_scheduler.start()
    yield
    budget_scheduler.shutdown()
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

# ===== Global Exception Handlers =====

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """
    Convert FastAPI's default 422 validation errors into consistent error shape.
    Per Spec-04.md §1.4 — validation error response shape.

    Special case: missing Authorization header should return 401, not 422.
    """
    errors = exc.errors()
    # If the only error is a missing Authorization header, return 401
    if (
        len(errors) == 1
        and errors[0]["type"] == "missing"
        and errors[0].get("loc") == ("header", "authorization")
    ):
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={
                "error": "UNAUTHORIZED",
                "message": "Authentication required. Please log in.",
                "details": {},
            },
        )
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": "VALIDATION_ERROR",
            "message": "Request validation failed.",
            "details": errors,
        },
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """
    Catch-all for unhandled exceptions — prevents raw FastAPI HTML error pages.
    Returns a safe 500 response.
    """
    # Log the actual error for debugging (in production, use proper logging)
    import traceback
    traceback.print_exc()

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "INTERNAL_ERROR",
            "message": "An unexpected error occurred.",
            "details": {},
        },
    )


# Include routers
app.include_router(auth_router)
app.include_router(expenses_router)
app.include_router(income_router)
app.include_router(users_router)
app.include_router(websocket_router)
app.include_router(groups_router)
app.include_router(notifications_router)
app.include_router(budgets_router)


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
