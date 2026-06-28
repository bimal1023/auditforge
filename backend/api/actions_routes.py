"""Deal Action Queue routes — generate/list/add/update/delete next-step tasks."""
from __future__ import annotations

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.database import get_session
from backend.core.rate_limit import limiter
from backend.core.workspace import WorkspaceContext, get_workspace_context, require_role
from backend.models.actions import VALID_CATEGORIES, VALID_PRIORITIES
from backend.models.db import DealAction, ReportRecord
from backend.services.action_generator import generate_actions

logger = logging.getLogger(__name__)
router = APIRouter(tags=["actions"])


# ── Schemas ──────────────────────────────────────────────────────────────────

class ActionOut(BaseModel):
    id: str
    report_id: str
    title: str
    description: str
    category: str
    priority: str
    rationale: str
    status: str
    origin: str
    created_at: str


class AddActionRequest(BaseModel):
    title: str
    description: str = ""
    category: str = "operational"
    priority: str = "medium"
    rationale: str = ""


class UpdateActionRequest(BaseModel):
    status: str | None = None
    title: str | None = None
    description: str | None = None
    category: str | None = None
    priority: str | None = None


_VALID_STATUSES = {"open", "in_progress", "done", "dismissed"}


def _out(a: DealAction) -> ActionOut:
    return ActionOut(
        id=str(a.id),
        report_id=str(a.report_id),
        title=a.title,
        description=a.description or "",
        category=a.category,
        priority=a.priority,
        rationale=a.rationale or "",
        status=a.status,
        origin=a.origin,
        created_at=a.created_at.isoformat() if a.created_at else "",
    )


async def _owned_report(report_id: UUID, ctx: WorkspaceContext, db: AsyncSession) -> ReportRecord:
    record = await db.get(ReportRecord, report_id)
    if record is None or record.workspace_id != ctx.workspace.id:
        raise HTTPException(404, "Report not found")
    return record


# ── Routes ───────────────────────────────────────────────────────────────────

@router.post("/reports/{report_id}/actions/generate", status_code=201)
@limiter.limit("10/hour")
async def generate_action_queue(
    request: Request,
    report_id: UUID,
    ctx: WorkspaceContext = Depends(require_role("admin", "analyst")),
    db: AsyncSession = Depends(get_session),
) -> list[ActionOut]:
    """Analyze the report and (re)generate its auto action queue.

    Replaces any existing auto-generated actions for this report. Manually
    added actions (origin="manual") are preserved.
    """
    record = await _owned_report(report_id, ctx, db)
    if record.status != "complete" or not record.data:
        raise HTTPException(400, "Report is not complete yet.")

    try:
        generated = await generate_actions(record.data)
    except Exception as exc:
        logger.error("Action generation failed for report %s: %s", report_id, exc)
        raise HTTPException(502, "Could not generate the action queue. Please try again.")

    if not generated:
        raise HTTPException(502, "No actions could be derived from this report.")

    # Drop prior auto actions; keep user-added ones.
    await db.execute(
        delete(DealAction).where(
            DealAction.report_id == report_id,
            DealAction.workspace_id == ctx.workspace.id,
            DealAction.origin == "auto",
        )
    )

    rows: list[DealAction] = []
    for g in generated:
        row = DealAction(
            user_id=ctx.user.id,
            workspace_id=ctx.workspace.id,
            report_id=report_id,
            title=g.title[:255],
            description=g.description,
            category=g.category,
            priority=g.priority,
            rationale=g.rationale,
            origin="auto",
        )
        db.add(row)
        rows.append(row)
    await db.commit()
    for row in rows:
        await db.refresh(row)

    return _ordered(rows + await _manual_actions(report_id, ctx, db))


@router.get("/reports/{report_id}/actions")
async def list_actions(
    report_id: UUID,
    ctx: WorkspaceContext = Depends(get_workspace_context),
    db: AsyncSession = Depends(get_session),
) -> list[ActionOut]:
    await _owned_report(report_id, ctx, db)
    result = await db.execute(
        select(DealAction).where(
            DealAction.report_id == report_id,
            DealAction.workspace_id == ctx.workspace.id,
        )
    )
    return _ordered(list(result.scalars().all()))


@router.post("/reports/{report_id}/actions", status_code=201)
async def add_action(
    report_id: UUID,
    body: AddActionRequest,
    ctx: WorkspaceContext = Depends(require_role("admin", "analyst")),
    db: AsyncSession = Depends(get_session),
) -> ActionOut:
    await _owned_report(report_id, ctx, db)
    if not body.title.strip():
        raise HTTPException(400, "Title is required.")

    category = body.category.strip().lower()
    if category not in VALID_CATEGORIES:
        category = "operational"
    priority = body.priority.strip().lower()
    if priority not in VALID_PRIORITIES:
        priority = "medium"

    row = DealAction(
        user_id=ctx.user.id,
        workspace_id=ctx.workspace.id,
        report_id=report_id,
        title=body.title.strip()[:255],
        description=body.description,
        category=category,
        priority=priority,
        rationale=body.rationale,
        origin="manual",
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return _out(row)


@router.patch("/actions/{action_id}")
async def update_action(
    action_id: UUID,
    body: UpdateActionRequest,
    ctx: WorkspaceContext = Depends(require_role("admin", "analyst")),
    db: AsyncSession = Depends(get_session),
) -> ActionOut:
    row = await db.get(DealAction, action_id)
    if row is None or row.workspace_id != ctx.workspace.id:
        raise HTTPException(404, "Action not found")

    if body.status is not None:
        if body.status not in _VALID_STATUSES:
            raise HTTPException(400, f"Invalid status. Valid: {sorted(_VALID_STATUSES)}")
        row.status = body.status
    if body.title is not None:
        row.title = body.title.strip()[:255]
    if body.description is not None:
        row.description = body.description
    if body.category is not None:
        c = body.category.strip().lower()
        row.category = c if c in VALID_CATEGORIES else row.category
    if body.priority is not None:
        p = body.priority.strip().lower()
        row.priority = p if p in VALID_PRIORITIES else row.priority

    await db.commit()
    await db.refresh(row)
    return _out(row)


@router.delete("/actions/{action_id}", status_code=204)
async def delete_action(
    action_id: UUID,
    ctx: WorkspaceContext = Depends(require_role("admin", "analyst")),
    db: AsyncSession = Depends(get_session),
) -> None:
    row = await db.get(DealAction, action_id)
    if row is None or row.workspace_id != ctx.workspace.id:
        raise HTTPException(404, "Action not found")
    await db.delete(row)
    await db.commit()


# ── Helpers ──────────────────────────────────────────────────────────────────

_PRIORITY_RANK = {"high": 0, "medium": 1, "low": 2}
_STATUS_RANK = {"open": 0, "in_progress": 1, "done": 2, "dismissed": 3}


def _ordered(rows: list[DealAction]) -> list[ActionOut]:
    """Open items first, then by priority, with done/dismissed sinking to the bottom."""
    ordered = sorted(
        rows,
        key=lambda a: (
            _STATUS_RANK.get(a.status, 0),
            _PRIORITY_RANK.get(a.priority, 1),
            a.created_at or a.id,
        ),
    )
    return [_out(a) for a in ordered]


async def _manual_actions(report_id: UUID, ctx: WorkspaceContext, db: AsyncSession) -> list[DealAction]:
    result = await db.execute(
        select(DealAction).where(
            DealAction.report_id == report_id,
            DealAction.workspace_id == ctx.workspace.id,
            DealAction.origin == "manual",
        )
    )
    return list(result.scalars().all())
