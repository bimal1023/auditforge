"""FastAPI report routes — Celery-backed, auth-protected."""
from __future__ import annotations

import logging
import re
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response, StreamingResponse
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.auth import get_current_user
from backend.core.database import get_session
from backend.core.activity import log_activity
from backend.core.rate_limit import limiter
from backend.core.workspace import WorkspaceContext, get_workspace_context, require_role
from backend.models.db import CreditLog, ReportRecord, User, Workspace
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
    ctx: WorkspaceContext = Depends(get_workspace_context),
    db: AsyncSession = Depends(get_session),
) -> ReportStatusResponse | DueDiligenceReport:
    """Kick off a report. Returns 202 immediately; poll GET /reports/{id}.

    If a completed report for the same company exists within the cache TTL
    window, returns that instead of running agents again (saves API cost).
    Pass force_refresh=true to bypass the cache.
    """
    from backend.core.config import get_settings
    from backend.tasks.report_task import run_report

    ws = ctx.workspace

    # ── Response cache lookup (workspace-scoped) ───────────────────────────
    if not body.force_refresh:
        settings = get_settings()
        cutoff = datetime.now(timezone.utc) - timedelta(hours=settings.report_cache_ttl_hours)
        candidates = await db.execute(
            select(ReportRecord)
            .where(
                ReportRecord.workspace_id == ws.id,
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
                hit.updated_at = datetime.now(timezone.utc)
                await db.commit()
                report = _trim_report(_record_to_report(hit), body.focus_areas)
                from fastapi.responses import JSONResponse
                return JSONResponse(
                    content=report.model_dump(mode="json"),
                    status_code=200,
                )

    # ── No cache hit — enforce credit balance from workspace ────────────────
    if ws.memo_credits <= 0:
        raise HTTPException(
            status_code=402,
            detail=(
                "Out of memo credits. Upgrade to Desk for 50 memos/month, "
                "or wait for your next billing cycle."
            ),
        )

    # Viewers can't create reports
    if ctx.membership.role == "viewer":
        raise HTTPException(status_code=403, detail="Viewers cannot create reports.")

    # Atomically decrement credits at the workspace level.
    result = await db.execute(
        update(Workspace)
        .where(Workspace.id == ws.id, Workspace.memo_credits > 0)
        .values(memo_credits=Workspace.memo_credits - 1)
    )
    if result.rowcount == 0:
        raise HTTPException(
            status_code=402,
            detail="Out of memo credits. Upgrade to Desk for 50 memos/month, "
                   "or wait for your next billing cycle.",
        )

    # Log the credit usage
    db.add(CreditLog(
        workspace_id=ws.id,
        user_id=ctx.user.id,
        action="report_run",
        delta=-1,
    ))

    record = ReportRecord(
        user_id=ctx.user.id,
        workspace_id=ws.id,
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

    await log_activity(
        db=db,
        workspace_id=ws.id,
        actor_user_id=ctx.user.id,
        event_type="report_created",
        summary=f"{ctx.user.full_name or ctx.user.email} started a report on {body.company_name}",
        details={"report_id": str(record.id), "company": body.company_name},
    )
    await db.commit()

    return ReportStatusResponse(id=record.id, status=record.status, company=record.company)


@router.get("/reports/{report_id}", response_model=DueDiligenceReport)
async def get_report(
    report_id: UUID,
    ctx: WorkspaceContext = Depends(get_workspace_context),
    db: AsyncSession = Depends(get_session),
) -> DueDiligenceReport:
    record = await db.get(ReportRecord, report_id)
    if record is None or record.workspace_id != ctx.workspace.id:
        raise HTTPException(status_code=404, detail="Report not found")
    return _record_to_report(record)


@router.get("/reports", response_model=list[ReportStatusResponse])
async def list_reports(
    ctx: WorkspaceContext = Depends(get_workspace_context),
    db: AsyncSession = Depends(get_session),
) -> list[ReportStatusResponse]:
    result = await db.execute(
        select(ReportRecord)
        .where(ReportRecord.workspace_id == ctx.workspace.id)
        .order_by(ReportRecord.updated_at.desc())
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
    ctx: WorkspaceContext = Depends(require_role("admin", "analyst")),
    db: AsyncSession = Depends(get_session),
) -> None:
    record = await db.get(ReportRecord, report_id)
    if record is None or record.workspace_id != ctx.workspace.id:
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
    ctx: WorkspaceContext = Depends(get_workspace_context),
    db: AsyncSession = Depends(get_session),
) -> StreamingResponse:
    """SSE stream of agent progress events for a report."""
    record = await db.get(ReportRecord, report_id)
    if record is None or record.workspace_id != ctx.workspace.id:
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
    ctx: WorkspaceContext = Depends(get_workspace_context),
    db: AsyncSession = Depends(get_session),
):
    """Return all events stored for a report (for polling catch-up when SSE drops)."""
    import json as _json

    import redis.asyncio as _aioredis

    from backend.core.config import get_settings

    record = await db.get(ReportRecord, report_id)
    if record is None or record.workspace_id != ctx.workspace.id:
        raise HTTPException(status_code=404, detail="Report not found")

    client = _aioredis.from_url(get_settings().redis_url, socket_connect_timeout=3)
    try:
        list_key = f"arthvion:report:{report_id}:event_log"
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
    ctx: WorkspaceContext = Depends(get_workspace_context),
    db: AsyncSession = Depends(get_session),
) -> Response:
    """Download a completed report as a PDF."""
    record = await db.get(ReportRecord, report_id)
    if record is None or record.workspace_id != ctx.workspace.id:
        raise HTTPException(status_code=404, detail="Report not found")
    if record.status != "complete":
        raise HTTPException(status_code=400, detail="Report is not complete yet")

    from backend.services.pdf_export import generate_pdf
    report = _record_to_report(record)
    pdf_bytes = generate_pdf(report)

    safe_company = re.sub(r"[^\w\s\-]", "", record.company)[:50].strip().replace(" ", "_")
    filename = f"arthvion_{safe_company}_{record.id}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=\"{filename}\""},
    )


@router.get("/reports/{report_id}/json")
async def download_json(
    report_id: UUID,
    ctx: WorkspaceContext = Depends(get_workspace_context),
    db: AsyncSession = Depends(get_session),
) -> Response:
    """Download a completed report as typed JSON — the canonical machine-readable
    payload for downstream tooling (CRM, data warehouse, custom scripts)."""
    record = await db.get(ReportRecord, report_id)
    if record is None or record.workspace_id != ctx.workspace.id:
        raise HTTPException(status_code=404, detail="Report not found")
    if record.status != "complete":
        raise HTTPException(status_code=400, detail="Report is not complete yet")

    report = _record_to_report(record)
    payload = report.model_dump_json(indent=2)

    safe_company = re.sub(r"[^\w\s\-]", "", record.company)[:50].strip().replace(" ", "_")
    filename = f"arthvion_{safe_company}_{record.id}.json"
    return Response(
        content=payload,
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename=\"{filename}\""},
    )
