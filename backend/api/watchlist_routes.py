"""Watchlist API routes — add/list/remove watched companies, drift events."""
from __future__ import annotations

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.core.activity import log_activity
from backend.core.auth import get_current_user
from backend.core.database import get_session
from backend.core.rate_limit import limiter
from backend.core.workspace import WorkspaceContext, get_workspace_context, require_role
from backend.models.db import DriftEvent, ReportRecord, User, WatchlistAuditLog, WatchlistItem
from backend.services.billing import WATCHLIST_MAX_SLOTS, WATCHLIST_SCAN_FREQUENCY

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/watchlist", tags=["watchlist"])


# ── Request / response schemas ─────────────────────────────────────────────

class AddWatchlistRequest(BaseModel):
    company: str
    ticker: str | None = None
    baseline_report_id: UUID | None = None


class WatchlistEventOut(BaseModel):
    id: str
    event_type: str
    severity: str
    summary: str
    details: dict | None = None
    detected_at: str
    acknowledged: bool


class WatchlistItemOut(BaseModel):
    id: str
    company: str
    ticker: str | None = None
    scan_frequency: str
    last_scan_at: str | None = None
    last_drift_at: str | None = None
    baseline_report_id: str | None = None
    status: str
    created_at: str
    archived_at: str | None = None
    latest_event: WatchlistEventOut | None = None
    unacknowledged_count: int = 0


class WatchlistListResponse(BaseModel):
    items: list[WatchlistItemOut]
    slots: dict


# ── Helpers ────────────────────────────────────────────────────────────────

def _event_out(ev: DriftEvent) -> WatchlistEventOut:
    return WatchlistEventOut(
        id=str(ev.id),
        event_type=ev.event_type,
        severity=ev.severity,
        summary=ev.summary,
        details=ev.details,
        detected_at=ev.detected_at.isoformat() if ev.detected_at else "",
        acknowledged=ev.acknowledged,
    )


def _item_out(
    item: WatchlistItem,
    latest: DriftEvent | None = None,
    unack: int = 0,
) -> WatchlistItemOut:
    return WatchlistItemOut(
        id=str(item.id),
        company=item.company,
        ticker=item.ticker,
        scan_frequency=item.scan_frequency,
        last_scan_at=item.last_scan_at.isoformat() if item.last_scan_at else None,
        last_drift_at=item.last_drift_at.isoformat() if item.last_drift_at else None,
        baseline_report_id=str(item.baseline_report_id) if item.baseline_report_id else None,
        status=item.status,
        created_at=item.created_at.isoformat() if item.created_at else "",
        archived_at=item.archived_at.isoformat() if item.archived_at else None,
        latest_event=_event_out(latest) if latest else None,
        unacknowledged_count=unack,
    )


# ── Routes ─────────────────────────────────────────────────────────────────

@router.post("", status_code=201)
@limiter.limit("5/minute")
async def add_watchlist_item(
    request: Request,
    body: AddWatchlistRequest,
    ctx: WorkspaceContext = Depends(require_role("admin", "analyst")),
    db: AsyncSession = Depends(get_session),
):
    ws = ctx.workspace
    user = ctx.user
    max_slots = WATCHLIST_MAX_SLOTS.get(ws.plan_tier, 0)
    if max_slots == 0:
        raise HTTPException(402, "Upgrade to Desk or Firm to use Watchlist.")

    count_q = await db.execute(
        select(func.count())
        .select_from(WatchlistItem)
        .where(WatchlistItem.workspace_id == ws.id, WatchlistItem.status == "active")
    )
    current = count_q.scalar() or 0
    if current >= max_slots:
        raise HTTPException(
            409,
            f"Watchlist full ({current}/{max_slots} slots). Remove a company or upgrade your plan.",
        )

    existing_q = await db.execute(
        select(WatchlistItem).where(
            WatchlistItem.workspace_id == ws.id,
            func.upper(WatchlistItem.company) == body.company.strip().upper(),
        )
    )
    existing = existing_q.scalar_one_or_none()

    if existing and existing.status == "active":
        raise HTTPException(409, f"{body.company} is already on your watchlist.")

    if body.baseline_report_id:
        report = await db.get(ReportRecord, body.baseline_report_id)
        if not report or report.workspace_id != ws.id or report.status != "complete":
            raise HTTPException(400, "Invalid or incomplete baseline report.")

    if existing and existing.status == "archived":
        existing.status = "active"
        existing.archived_at = None
        existing.ticker = body.ticker.upper().strip() if body.ticker else existing.ticker
        if body.baseline_report_id:
            existing.baseline_report_id = body.baseline_report_id
        log = WatchlistAuditLog(
            watchlist_item_id=existing.id,
            action="recovered",
            actor_user_id=user.id,
            details={"recovered_by": "re_add", "company": existing.company},
        )
        db.add(log)
        await db.commit()
        await db.refresh(existing)
        return _item_out(existing)

    item = WatchlistItem(
        user_id=user.id,
        workspace_id=ws.id,
        company=body.company.strip(),
        ticker=body.ticker.upper().strip() if body.ticker else None,
        scan_frequency=WATCHLIST_SCAN_FREQUENCY.get(ws.plan_tier, "weekly"),
        baseline_report_id=body.baseline_report_id,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)

    # Log activity
    await log_activity(
        db=db,
        workspace_id=ws.id,
        actor_user_id=user.id,
        event_type="watchlist_added",
        summary=f"{user.full_name or user.email} added {item.company} to watchlist",
        details={"item_id": str(item.id), "company": item.company},
    )
    await db.commit()

    return _item_out(item)


@router.get("")
async def list_watchlist(
    ctx: WorkspaceContext = Depends(get_workspace_context),
    db: AsyncSession = Depends(get_session),
    include_archived: bool = False,
):
    ws = ctx.workspace
    where_clause = WatchlistItem.workspace_id == ws.id
    if not include_archived:
        where_clause = (where_clause) & (WatchlistItem.archived_at.is_(None))

    result = await db.execute(
        select(WatchlistItem)
        .where(where_clause)
        .options(selectinload(WatchlistItem.drift_events))
        .order_by(WatchlistItem.created_at.desc())
    )
    items = result.scalars().all()

    out: list[WatchlistItemOut] = []
    for item in items:
        events = sorted(item.drift_events, key=lambda e: e.detected_at or e.id, reverse=True)
        latest = events[0] if events else None
        unack = sum(1 for e in events if not e.acknowledged)
        out.append(_item_out(item, latest, unack))

    max_slots = WATCHLIST_MAX_SLOTS.get(ws.plan_tier, 0)
    active_count = sum(1 for i in items if i.status == "active")
    return WatchlistListResponse(
        items=out,
        slots={"used": active_count, "max": max_slots},
    )


@router.get("/portfolio-summary")
async def portfolio_summary(
    ctx: WorkspaceContext = Depends(get_workspace_context),
    db: AsyncSession = Depends(get_session),
):
    """Aggregate portfolio stats across all active watchlist items."""
    result = await db.execute(
        select(WatchlistItem)
        .where(WatchlistItem.workspace_id == ctx.workspace.id, WatchlistItem.status == "active")
        .options(selectinload(WatchlistItem.drift_events))
    )
    items = result.scalars().all()

    total_items = len(items)
    total_alerts = 0
    material_changes = 0
    minor_changes = 0
    no_changes = 0
    never_scanned = 0
    # Sector-like grouping by first letter of ticker (placeholder until we have real sectors)
    tickers: list[str] = []

    for item in items:
        events = item.drift_events
        unack = sum(1 for e in events if not e.acknowledged)
        total_alerts += unack
        tickers.append(item.ticker or item.company[:4].upper())

        if not item.last_scan_at:
            never_scanned += 1
            continue

        # Classify by most recent event
        sorted_events = sorted(events, key=lambda e: e.detected_at or e.id, reverse=True)
        if sorted_events:
            latest_type = sorted_events[0].event_type
            if latest_type == "material_change":
                material_changes += 1
            elif latest_type == "minor_change":
                minor_changes += 1
            else:
                no_changes += 1
        else:
            no_changes += 1

    return {
        "total_companies": total_items,
        "total_unacknowledged_alerts": total_alerts,
        "status_breakdown": {
            "material_changes": material_changes,
            "minor_changes": minor_changes,
            "no_changes": no_changes,
            "never_scanned": never_scanned,
        },
        "tickers": tickers,
        "health_score": round(
            (no_changes / total_items * 100) if total_items > 0 else 100, 1
        ),
    }


@router.delete("/{item_id}", status_code=204)
@limiter.limit("10/day")
async def remove_watchlist_item(
    request: Request,
    item_id: UUID,
    ctx: WorkspaceContext = Depends(require_role("admin", "analyst")),
    db: AsyncSession = Depends(get_session),
):
    user = ctx.user
    item = await db.get(WatchlistItem, item_id)
    if not item or item.workspace_id != ctx.workspace.id:
        raise HTTPException(404, "Watchlist item not found.")

    from datetime import datetime, timezone
    item.archived_at = datetime.now(timezone.utc)
    item.status = "archived"

    log = WatchlistAuditLog(
        watchlist_item_id=item.id,
        action="archived",
        actor_user_id=user.id,
        details={"archived_by": "user_delete", "company": item.company},
    )
    db.add(log)
    await db.commit()


@router.get("/{item_id}/events")
async def get_drift_events(
    item_id: UUID,
    ctx: WorkspaceContext = Depends(get_workspace_context),
    db: AsyncSession = Depends(get_session),
):
    item = await db.get(WatchlistItem, item_id)
    if not item or item.workspace_id != ctx.workspace.id:
        raise HTTPException(404, "Watchlist item not found.")

    result = await db.execute(
        select(DriftEvent)
        .where(DriftEvent.watchlist_item_id == item_id)
        .order_by(DriftEvent.detected_at.desc())
        .limit(50)
    )
    return [_event_out(e) for e in result.scalars().all()]


@router.post("/{item_id}/acknowledge")
async def acknowledge_events(
    item_id: UUID,
    ctx: WorkspaceContext = Depends(get_workspace_context),
    db: AsyncSession = Depends(get_session),
):
    item = await db.get(WatchlistItem, item_id)
    if not item or item.workspace_id != ctx.workspace.id:
        raise HTTPException(404, "Watchlist item not found.")

    result = await db.execute(
        select(DriftEvent).where(
            DriftEvent.watchlist_item_id == item_id,
            DriftEvent.acknowledged == False,  # noqa: E712
        )
    )
    events = result.scalars().all()
    for ev in events:
        ev.acknowledged = True
    await db.commit()
    return {"acknowledged": len(events)}


@router.get("/{item_id}/audit-log")
async def get_audit_log(
    item_id: UUID,
    ctx: WorkspaceContext = Depends(get_workspace_context),
    db: AsyncSession = Depends(get_session),
):
    item = await db.get(WatchlistItem, item_id)
    if not item or item.workspace_id != ctx.workspace.id:
        raise HTTPException(404, "Watchlist item not found.")

    result = await db.execute(
        select(WatchlistAuditLog)
        .where(WatchlistAuditLog.watchlist_item_id == item_id)
        .order_by(WatchlistAuditLog.created_at.desc())
    )
    logs = result.scalars().all()

    return [
        {
            "id": str(log.id),
            "action": log.action,
            "actor_user_id": str(log.actor_user_id) if log.actor_user_id else None,
            "details": log.details,
            "created_at": log.created_at.isoformat() if log.created_at else "",
        }
        for log in logs
    ]


@router.post("/{item_id}/recover", status_code=200)
async def recover_watchlist_item(
    item_id: UUID,
    ctx: WorkspaceContext = Depends(require_role("admin", "analyst")),
    db: AsyncSession = Depends(get_session),
):
    item = await db.get(WatchlistItem, item_id)
    if not item or item.workspace_id != ctx.workspace.id:
        raise HTTPException(404, "Watchlist item not found.")
    if item.archived_at is None:
        raise HTTPException(400, "Item is not archived.")

    item.archived_at = None
    item.status = "active"

    log = WatchlistAuditLog(
        watchlist_item_id=item.id,
        action="recovered",
        actor_user_id=ctx.user.id,
        details={"recovered_by": "user_recover", "company": item.company},
    )
    db.add(log)
    await db.commit()
    await db.refresh(item)

    return _item_out(item)


@router.post("/{item_id}/rerun", status_code=202)
@limiter.limit("3/hour")
async def rerun_drift_check(
    request: Request,
    item_id: UUID,
    ctx: WorkspaceContext = Depends(require_role("admin", "analyst")),
    db: AsyncSession = Depends(get_session),
):
    item = await db.get(WatchlistItem, item_id)
    if not item or item.workspace_id != ctx.workspace.id:
        raise HTTPException(404, "Watchlist item not found.")
    if item.status != "active":
        raise HTTPException(400, "Watchlist item is paused.")

    from backend.tasks.watchlist_tasks import run_drift_check
    run_drift_check.delay(str(item.id))
    return {"status": "dispatched", "item_id": str(item.id)}
