"""Activity feed endpoints.

Mounted at /api/v1/activity by backend.main.

Provides a paginated timeline of workspace events and an SSE stream
for real-time activity updates.
"""
from __future__ import annotations

import logging
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.database import get_session
from backend.core.workspace import WorkspaceContext, get_workspace_context
from backend.core.redis_events import subscribe_workspace
from backend.models.db import ActivityEvent, User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/activity", tags=["activity"])


class ActivityOut:
    """Lightweight dict-based response (avoids Pydantic overhead for list)."""
    pass


@router.get("")
async def list_activity(
    limit: int = Query(50, ge=1, le=100),
    before: datetime | None = Query(None),
    ctx: WorkspaceContext = Depends(get_workspace_context),
    db: AsyncSession = Depends(get_session),
):
    """Paginated activity feed for the workspace."""
    q = (
        select(ActivityEvent)
        .where(ActivityEvent.workspace_id == ctx.workspace.id)
        .order_by(ActivityEvent.created_at.desc())
        .limit(limit)
    )
    if before:
        q = q.where(ActivityEvent.created_at < before)

    result = await db.execute(q)
    events = result.scalars().all()

    # Batch-load actor info
    actor_ids = list({e.actor_user_id for e in events if e.actor_user_id})
    actors_map: dict[UUID, User] = {}
    if actor_ids:
        actors_result = await db.execute(select(User).where(User.id.in_(actor_ids)))
        actors_map = {u.id: u for u in actors_result.scalars().all()}

    return [
        {
            "id": str(e.id),
            "event_type": e.event_type,
            "actor_email": actors_map[e.actor_user_id].email if e.actor_user_id and e.actor_user_id in actors_map else None,
            "actor_name": actors_map[e.actor_user_id].full_name if e.actor_user_id and e.actor_user_id in actors_map else None,
            "summary": e.summary,
            "details": e.details,
            "created_at": e.created_at.isoformat() if e.created_at else None,
        }
        for e in events
    ]


@router.get("/stream")
async def activity_stream(
    request: Request,
    ctx: WorkspaceContext = Depends(get_workspace_context),
):
    """SSE stream for real-time workspace activity."""
    async def event_generator():
        async for chunk in subscribe_workspace(str(ctx.workspace.id)):
            if await request.is_disconnected():
                break
            yield chunk

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
