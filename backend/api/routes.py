"""FastAPI report routes — Celery-backed, auth-protected."""
from __future__ import annotations

import logging
import re
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response, StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.auth import get_current_user
from backend.core.database import get_session
from backend.core.rate_limit import limiter
from backend.models.db import ReportRecord, User
from backend.models.report import DueDiligenceReport, ReportRequest, ReportStatusResponse

logger = logging.getLogger(__name__)
router = APIRouter(tags=["reports"])


_ALL_SECTIONS = {"financial", "risk", "market", "legal"}


def _trim_report(report: DueDiligenceReport, focus_areas: list[str]) -> DueDiligenceReport:
    """Zero out sections not in focus_areas so the response only contains what was asked for."""
    requested = set(focus_areas)
    for section in _ALL_SECTIONS - requested:
        setattr(report, section, None)
    return report


def _has_requested_sections(record: ReportRecord, focus_areas: list[str]) -> bool:
    """Return True only if the cached report has real data for every requested section."""
    if not record.data:
        return False
    for area in focus_areas:
        section = record.data.get(area)
        if not section:
            return False
        # Discard fallback sections (confidence_score == 0 means agent failed)
        if section.get("confidence_score", 0) == 0:
            return False
    return True


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


@router.post(
    "/reports",
    response_model=ReportStatusResponse,
    status_code=202,
    responses={200: {"model": DueDiligenceReport, "description": "Cache hit — completed report returned immediately"}},
)
@limiter.limit("20/hour")
async def create_report(
    request: Request,
    body: ReportRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> ReportStatusResponse | DueDiligenceReport:
    """Kick off a report. Returns 202 immediately; poll GET /reports/{id}.

    If a completed report for the same company exists within the cache TTL
    window, returns that instead of running agents again (saves API cost).
    Pass force_refresh=true to bypass the cache.
    """
    from backend.core.config import get_settings
    from backend.tasks.report_task import run_report

    # ── Response cache lookup ──────────────────────────────────────────────
    if not body.force_refresh:
        settings = get_settings()
        cutoff = datetime.now(timezone.utc) - timedelta(hours=settings.report_cache_ttl_hours)
        candidates = await db.execute(
            select(ReportRecord)
            .where(
                ReportRecord.user_id == current_user.id,
                ReportRecord.company == body.company_name,
                ReportRecord.status == "complete",
                ReportRecord.created_at >= cutoff,
            )
            .order_by(ReportRecord.created_at.desc())
            .limit(10)
        )
        for hit in candidates.scalars().all():
            if _has_requested_sections(hit, body.focus_areas):
                logger.info(
                    "Cache hit for %s (focus=%s) — returning report %s",
                    body.company_name, body.focus_areas, hit.id,
                )
                report = _trim_report(_record_to_report(hit), body.focus_areas)
                from fastapi.responses import JSONResponse
                return JSONResponse(
                    content=report.model_dump(mode="json"),
                    status_code=200,
                )

    # ── No cache hit — run agents ──────────────────────────────────────────
    record = ReportRecord(
        user_id=current_user.id,
        company=body.company_name,
        ticker=body.ticker,
        status="pending",
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)

    task = run_report.delay(str(record.id), body.model_dump())
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
        ReportStatusResponse(
            id=r.id,
            status=r.status,
            company=r.company,
            ticker=r.ticker,
            overall_score=r.data.get("overall_score") if r.data else None,
            generated_at=r.updated_at,
        )
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

    # Revoke the Celery task if it's still running
    if record.celery_task_id and record.status in ("pending", "running"):
        from backend.core.celery_app import celery_app
        celery_app.control.revoke(record.celery_task_id, terminate=True, signal="SIGTERM")

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


@router.get("/reports/{report_id}/event-log")
async def get_event_log(
    report_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    """Return all events stored for a report (for polling catch-up when SSE drops)."""
    import json as _json

    import redis.asyncio as _aioredis

    from backend.core.config import get_settings

    record = await db.get(ReportRecord, report_id)
    if record is None or record.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Report not found")

    client = _aioredis.from_url(get_settings().redis_url, socket_connect_timeout=3)
    try:
        list_key = f"auditforge:report:{report_id}:event_log"
        raw_events = await client.lrange(list_key, 0, -1)
    finally:
        await client.aclose()

    events = []
    for raw in raw_events:
        try:
            events.append(_json.loads(raw))
        except Exception:
            pass
    return events


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

    safe_company = re.sub(r"[^\w\s\-]", "", record.company)[:50].strip().replace(" ", "_")
    filename = f"auditforge_{safe_company}_{record.id}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=\"{filename}\""},
    )
