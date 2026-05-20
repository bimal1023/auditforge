"""FastAPI report routes — Celery-backed, auth-protected."""
from __future__ import annotations

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response, StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.auth import get_current_user
from backend.core.database import get_session
from backend.models.db import ReportRecord, User
from backend.models.report import DueDiligenceReport, ReportRequest, ReportStatusResponse

logger = logging.getLogger(__name__)
router = APIRouter(tags=["reports"])


def _record_to_report(record: ReportRecord) -> DueDiligenceReport:
    if record.data:
        return DueDiligenceReport.model_validate(record.data)
    return DueDiligenceReport(
        id=record.id,
        company=record.company,
        ticker=record.ticker,
        status=record.status,
        error=record.error,
    )


@router.post("/reports", response_model=ReportStatusResponse, status_code=202)
async def create_report(
    request: ReportRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> ReportStatusResponse:
    """Kick off a report. Returns 202 immediately; poll GET /reports/{id}."""
    from backend.tasks.report_task import run_report

    record = ReportRecord(
        user_id=current_user.id,
        company=request.company_name,
        ticker=request.ticker,
        status="pending",
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)

    task = run_report.delay(str(record.id), request.model_dump())
    record.celery_task_id = task.id
    await db.commit()

    return ReportStatusResponse(id=record.id, status=record.status, company=record.company)


@router.get("/reports/{report_id}", response_model=DueDiligenceReport)
async def get_report(
    report_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> DueDiligenceReport:
    record = await db.get(ReportRecord, report_id)
    if record is None or record.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Report not found")
    return _record_to_report(record)


@router.get("/reports", response_model=list[ReportStatusResponse])
async def list_reports(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> list[ReportStatusResponse]:
    result = await db.execute(
        select(ReportRecord)
        .where(ReportRecord.user_id == current_user.id)
        .order_by(ReportRecord.created_at.desc())
        .limit(50)
    )
    return [
        ReportStatusResponse(id=r.id, status=r.status, company=r.company)
        for r in result.scalars().all()
    ]


@router.delete("/reports/{report_id}", status_code=204)
async def delete_report(
    report_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> None:
    record = await db.get(ReportRecord, report_id)
    if record is None or record.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Report not found")
    await db.delete(record)
    await db.commit()


@router.get("/reports/{report_id}/events")
async def stream_report_events(
    report_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> StreamingResponse:
    """SSE stream of agent progress events for a report."""
    record = await db.get(ReportRecord, report_id)
    if record is None or record.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Report not found")

    from backend.core.redis_events import subscribe

    async def _catchup() -> str | None:
        """Re-read DB status after Redis subscription is established."""
        await db.refresh(record)
        return record.status

    return StreamingResponse(
        subscribe(str(report_id), catchup_check=_catchup),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/reports/{report_id}/pdf")
async def download_pdf(
    report_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> Response:
    """Download a completed report as a PDF."""
    record = await db.get(ReportRecord, report_id)
    if record is None or record.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Report not found")
    if record.status != "complete":
        raise HTTPException(status_code=400, detail="Report is not complete yet")

    from backend.services.pdf_export import generate_pdf
    report = _record_to_report(record)
    pdf_bytes = generate_pdf(report)

    filename = f"auditforge_{record.company.replace(' ', '_')}_{record.id}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
