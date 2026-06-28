"""Comment CRUD endpoints.

Mounted at /api/v1/comments by backend.main.

Supports polymorphic targets (reports and deals). Handles @mentions
and creates notifications for mentioned workspace members.
"""
from __future__ import annotations

import logging
import re
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.database import get_session
from backend.core.workspace import WorkspaceContext, get_workspace_context, require_role
from backend.core.activity import log_activity
from backend.core.redis_events import publish_comment
from backend.models.db import (
    Comment, Notification, ReportRecord, Deal, User, WorkspaceMember,
)
from backend.models.comments import CreateCommentRequest, UpdateCommentRequest, CommentOut

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/comments", tags=["comments"])

_MENTION_RE = re.compile(r"@([\w.+-]+@[\w-]+\.[\w.-]+)")


def _parse_mentions(body: str) -> list[str]:
    """Extract @email mentions from comment body."""
    return list(set(_MENTION_RE.findall(body)))


async def _validate_target(
    db: AsyncSession, workspace_id: UUID, target_type: str, target_id: UUID
) -> None:
    """Ensure the target exists and belongs to this workspace."""
    if target_type == "report":
        row = await db.execute(
            select(ReportRecord.id).where(
                ReportRecord.id == target_id,
                ReportRecord.workspace_id == workspace_id,
            )
        )
    elif target_type == "deal":
        row = await db.execute(
            select(Deal.id).where(
                Deal.id == target_id,
                Deal.workspace_id == workspace_id,
            )
        )
    else:
        raise HTTPException(status_code=400, detail="Invalid target_type.")

    if row.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail=f"{target_type.title()} not found in this workspace.")


# ── LIST ──────────────────────────────────────────────────────────────────────

@router.get("", response_model=list[CommentOut])
async def list_comments(
    target_type: str = Query(..., pattern=r"^(report|deal)$"),
    target_id: UUID = Query(...),
    ctx: WorkspaceContext = Depends(get_workspace_context),
    db: AsyncSession = Depends(get_session),
):
    """List comments on a report or deal (ascending by created_at)."""
    await _validate_target(db, ctx.workspace.id, target_type, target_id)

    result = await db.execute(
        select(Comment)
        .where(
            Comment.target_type == target_type,
            Comment.target_id == target_id,
            Comment.workspace_id == ctx.workspace.id,
        )
        .order_by(Comment.created_at.asc())
    )
    comments = result.scalars().all()

    # Batch-load user info
    user_ids = list({c.user_id for c in comments})
    users_result = await db.execute(select(User).where(User.id.in_(user_ids)))
    users_map = {u.id: u for u in users_result.scalars().all()}

    return [
        CommentOut(
            id=c.id,
            user_id=c.user_id,
            user_email=users_map[c.user_id].email if c.user_id in users_map else "",
            user_name=users_map[c.user_id].full_name if c.user_id in users_map else None,
            target_type=c.target_type,
            target_id=c.target_id,
            body=c.body,
            mentions=c.mentions or [],
            edited_at=c.edited_at,
            created_at=c.created_at,
        )
        for c in comments
    ]


# ── CREATE ────────────────────────────────────────────────────────────────────

@router.post("", response_model=CommentOut, status_code=201)
async def create_comment(
    req: CreateCommentRequest,
    ctx: WorkspaceContext = Depends(require_role("admin", "analyst")),
    db: AsyncSession = Depends(get_session),
):
    """Create a comment on a report or deal."""
    await _validate_target(db, ctx.workspace.id, req.target_type, req.target_id)

    mentions = _parse_mentions(req.body)

    comment = Comment(
        workspace_id=ctx.workspace.id,
        user_id=ctx.user.id,
        target_type=req.target_type,
        target_id=req.target_id,
        body=req.body,
        mentions=mentions,
    )
    db.add(comment)
    await db.flush()

    # Create notifications for mentioned workspace members
    if mentions:
        members_result = await db.execute(
            select(User.id, User.email).join(
                WorkspaceMember, WorkspaceMember.user_id == User.id
            ).where(
                WorkspaceMember.workspace_id == ctx.workspace.id,
                User.email.in_(mentions),
                User.id != ctx.user.id,  # don't notify self
            )
        )
        for user_id, _email in members_result.all():
            notif = Notification(
                workspace_id=ctx.workspace.id,
                user_id=user_id,
                notification_type="mention",
                comment_id=comment.id,
            )
            db.add(notif)

    await db.commit()
    await db.refresh(comment)

    # Real-time push
    publish_comment(
        target_type=req.target_type,
        target_id=str(req.target_id),
        event_type="comment_added",
        comment_id=str(comment.id),
        user_email=ctx.user.email,
        user_name=ctx.user.full_name,
        body=req.body,
    )

    # Log activity
    await log_activity(
        db=db,
        workspace_id=ctx.workspace.id,
        actor_user_id=ctx.user.id,
        event_type="comment_added",
        summary=f"{ctx.user.full_name or ctx.user.email} commented on a {req.target_type}",
        details={"target_type": req.target_type, "target_id": str(req.target_id)},
    )
    await db.commit()

    return CommentOut(
        id=comment.id,
        user_id=comment.user_id,
        user_email=ctx.user.email,
        user_name=ctx.user.full_name,
        target_type=comment.target_type,
        target_id=comment.target_id,
        body=comment.body,
        mentions=comment.mentions or [],
        edited_at=comment.edited_at,
        created_at=comment.created_at,
    )


# ── UPDATE ────────────────────────────────────────────────────────────────────

@router.patch("/{comment_id}", response_model=CommentOut)
async def update_comment(
    comment_id: UUID,
    req: UpdateCommentRequest,
    ctx: WorkspaceContext = Depends(require_role("admin", "analyst")),
    db: AsyncSession = Depends(get_session),
):
    """Edit own comment body."""
    comment = await db.get(Comment, comment_id)
    if not comment or comment.workspace_id != ctx.workspace.id:
        raise HTTPException(status_code=404, detail="Comment not found.")
    if comment.user_id != ctx.user.id and ctx.membership.role != "admin":
        raise HTTPException(status_code=403, detail="Can only edit your own comments.")

    comment.body = req.body
    comment.mentions = _parse_mentions(req.body)
    comment.edited_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(comment)

    return CommentOut(
        id=comment.id,
        user_id=comment.user_id,
        user_email=ctx.user.email,
        user_name=ctx.user.full_name,
        target_type=comment.target_type,
        target_id=comment.target_id,
        body=comment.body,
        mentions=comment.mentions or [],
        edited_at=comment.edited_at,
        created_at=comment.created_at,
    )


# ── DELETE ────────────────────────────────────────────────────────────────────

@router.delete("/{comment_id}", status_code=204)
async def delete_comment(
    comment_id: UUID,
    ctx: WorkspaceContext = Depends(require_role("admin", "analyst")),
    db: AsyncSession = Depends(get_session),
):
    """Delete own comment (or any comment if admin)."""
    comment = await db.get(Comment, comment_id)
    if not comment or comment.workspace_id != ctx.workspace.id:
        raise HTTPException(status_code=404, detail="Comment not found.")
    if comment.user_id != ctx.user.id and ctx.membership.role != "admin":
        raise HTTPException(status_code=403, detail="Can only delete your own comments.")

    await db.delete(comment)
    await db.commit()
