"""Workspace context dependency — the team-aware alternative to get_current_user.

Usage in routes:
    from backend.core.workspace import get_workspace_context, require_role, WorkspaceContext

    @router.post("/something")
    async def do_something(ctx: WorkspaceContext = Depends(get_workspace_context)):
        # ctx.workspace, ctx.membership, ctx.user are all loaded
        ...

    @router.delete("/something/{id}")
    async def delete_something(
        ctx: WorkspaceContext = Depends(require_role("admin")),
    ):
        # Only admins reach this handler
        ...
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

from fastapi import Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.auth import get_current_user
from backend.core.database import get_session
from backend.models.db import User, Workspace, WorkspaceMember


@dataclass
class WorkspaceContext:
    """Injected into every workspace-aware route."""
    workspace: Workspace
    membership: WorkspaceMember
    user: User


async def get_workspace_context(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> WorkspaceContext:
    """Resolve the calling user's active workspace + membership.

    Raises 403 if the user has no active workspace or isn't a member.
    """
    if not current_user.active_workspace_id:
        raise HTTPException(
            status_code=403,
            detail="No active workspace. Please contact support.",
        )

    workspace = await db.get(Workspace, current_user.active_workspace_id)
    if workspace is None:
        raise HTTPException(status_code=403, detail="Workspace not found.")

    result = await db.execute(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace.id,
            WorkspaceMember.user_id == current_user.id,
        )
    )
    membership = result.scalar_one_or_none()
    if membership is None:
        raise HTTPException(status_code=403, detail="You are not a member of this workspace.")

    return WorkspaceContext(workspace=workspace, membership=membership, user=current_user)


def require_role(*allowed_roles: str) -> Callable:
    """Factory that returns a Depends-compatible callable enforcing role checks.

    Usage:
        ctx: WorkspaceContext = Depends(require_role("admin"))
        ctx: WorkspaceContext = Depends(require_role("admin", "analyst"))
    """
    async def _check(
        ctx: WorkspaceContext = Depends(get_workspace_context),
    ) -> WorkspaceContext:
        if ctx.membership.role not in allowed_roles:
            raise HTTPException(
                status_code=403,
                detail=f"Insufficient permissions. Required role: {' or '.join(allowed_roles)}.",
            )
        return ctx

    return _check
