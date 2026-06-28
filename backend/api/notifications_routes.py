"""Notification endpoints.

Mounted at /api/v1/notifications by backend.main.

Tracks @mention notifications for workspace members.
"""
from __future__ import annotations

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.database import get_session
from backend.core.workspace import WorkspaceContext, get_workspace_context
from backend.models.db import Notification, Comment, User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/notifications", tags=["notifications"])


class MarkReadRequest(BaseModel):
    ids: list[UUID]


@router.get("/count")
async def notification_count(
    ctx: WorkspaceContext = Depends(get_workspace_context),
    db: AsyncSession = Depends(get_session),
):
    """Return unread notification count."""
    result = await db.execute(
        select(func.count(Notification.id)).where(
            Notification.user_id == ctx.user.id,
            Notification.workspace_id == ctx.workspace.id,
            Notification.read == False,  # noqa: E712
        )
    )
    return {"unread": result.scalar_one()}


@router.get("")
async def list_notifications(
    limit: int = Query(20, ge=1, le=100),
    ctx: WorkspaceContext = Depends(get_workspace_context),
    db: AsyncSession = Depends(get_session),
):
    """List notifications for the current user (newest first)."""
    result = await db.execute(
        select(Notification)
        .where(
            Notification.user_id == ctx.user.id,
            Notification.workspace_id == ctx.workspace.id,
        )
        .order_by(Notification.created_at.desc())
        .limit(limit)
    )
    notifications = result.scalars().all()

    # Load associated comments for preview
    comment_ids = [n.comment_id for n in notifications if n.comment_id]
    comments_map: dict[UUID, Comment] = {}
    if comment_ids:
        comments_result = await db.execute(
            select(Comment).where(Comment.id.in_(comment_ids))
        )
        comments_map = {c.id: c for c in comments_result.scalars().all()}

    # Load comment authors
    author_ids = list({c.user_id for c in comments_map.values()})
    authors_map: dict[UUID, User] = {}
    if author_ids:
        authors_result = await db.execute(select(User).where(User.id.in_(author_ids)))
        authors_map = {u.id: u for u in authors_result.scalars().all()}

    out = []
    for n in notifications:
        comment = comments_map.get(n.comment_id) if n.comment_id else None
        author = authors_map.get(comment.user_id) if comment else None
        out.append({
            "id": str(n.id),
            "notification_type": n.notification_type,
            "read": n.read,
            "comment_id": str(n.comment_id) if n.comment_id else None,
            "comment_preview": (comment.body[:120] + "...") if comment and len(comment.body) > 120 else (comment.body if comment else None),
            "comment_target_type": comment.target_type if comment else None,
            "comment_target_id": str(comment.target_id) if comment else None,
            "author_email": author.email if author else None,
            "author_name": author.full_name if author else None,
            "created_at": n.created_at.isoformat() if n.created_at else None,
        })

    return out


@router.post("/mark-read")
async def mark_read(
    req: MarkReadRequest,
    ctx: WorkspaceContext = Depends(get_workspace_context),
    db: AsyncSession = Depends(get_session),
):
    """Mark specific notifications as read."""
    if not req.ids:
        return {"marked": 0}

    result = await db.execute(
        update(Notification)
        .where(
            Notification.id.in_(req.ids),
            Notification.user_id == ctx.user.id,
            Notification.workspace_id == ctx.workspace.id,
        )
        .values(read=True)
    )
    await db.commit()
    return {"marked": result.rowcount}
