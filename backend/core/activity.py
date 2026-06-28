"""Workspace activity logger.

Convenience helper that inserts an ActivityEvent row and publishes
it to the workspace's Redis SSE channel for real-time delivery.
"""
from __future__ import annotations

import logging
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.db import ActivityEvent
from backend.core.redis_events import publish_workspace

logger = logging.getLogger(__name__)


async def log_activity(
    db: AsyncSession,
    workspace_id: UUID,
    actor_user_id: UUID | None,
    event_type: str,
    summary: str,
    details: dict | None = None,
) -> None:
    """Insert ActivityEvent + publish to workspace SSE channel.

    Swallows all errors so callers don't need try/except.
    """
    try:
        event = ActivityEvent(
            workspace_id=workspace_id,
            actor_user_id=actor_user_id,
            event_type=event_type,
            summary=summary,
            details=details or {},
        )
        db.add(event)
        await db.flush()

        # Real-time push (fire-and-forget over Redis pub/sub)
        publish_workspace(
            workspace_id=str(workspace_id),
            event_type=event_type,
            summary=summary,
            actor_user_id=str(actor_user_id) if actor_user_id else None,
            details=details or {},
        )
    except Exception as exc:
        logger.warning("log_activity failed (non-fatal): %s", exc)
