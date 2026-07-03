"""Analytics module — FastAPI router.

Locked per Spec-09 §1.2.
"""

from datetime import date as dt_date
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse

from core.deps import get_current_user
from modules.auth.models import User
from modules.analytics import service
from modules.analytics.schemas import (
    CategoryBreakdownResponse,
    IncomeBreakdownResponse,
    NetBalanceResponse,
    RecentActivityResponse,
    ReportDownloadRequest,
)
from modules.analytics.pdf_report import generate_pdf_report
from modules.analytics.excel_report import generate_excel_report


router = APIRouter(prefix="/api/v1/analytics", tags=["analytics"])
reports_router = APIRouter(prefix="/api/v1/reports", tags=["reports"])


Period = Literal["daily", "weekly", "monthly", "quarterly"]


@router.get("/expenses")
async def get_expenses_breakdown(
    period: Period = "monthly",
    current_user: User = Depends(get_current_user),
) -> CategoryBreakdownResponse:
    return await service.get_expense_breakdown(str(current_user.id), period)


@router.get("/income")
async def get_income_breakdown(
    period: Period = "monthly",
    current_user: User = Depends(get_current_user),
) -> IncomeBreakdownResponse:
    return await service.get_income_breakdown(str(current_user.id), period)


@router.get("/net-balance")
async def get_net_balance(
    current_user: User = Depends(get_current_user),
) -> NetBalanceResponse:
    return await service.get_net_balance(str(current_user.id))


@router.get("/recent-activity")
async def get_recent_activity(
    limit: int = 10,
    current_user: User = Depends(get_current_user),
) -> RecentActivityResponse:
    return await service.get_recent_activity(str(current_user.id), limit)


@reports_router.post("/download")
async def download_report(
    data: ReportDownloadRequest,
    current_user: User = Depends(get_current_user),
):
    if data.start_date > data.end_date:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": "INVALID_DATE_RANGE",
                "message": "Start date must be before end date.",
                "details": {},
            },
        )

    report_data = await service.generate_report_data(
        str(current_user.id), data.start_date, data.end_date
    )

    start_str = data.start_date.isoformat()
    end_str = data.end_date.isoformat()

    if data.format == "pdf":
        content = generate_pdf_report(report_data, str(current_user.id))
        filename = f"fintrack-report-{start_str}-to-{end_str}.pdf"
        return StreamingResponse(
            iter([content]),
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    content = generate_excel_report(report_data, str(current_user.id))
    filename = f"fintrack-report-{start_str}-to-{end_str}.xlsx"
    return StreamingResponse(
        iter([content]),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
